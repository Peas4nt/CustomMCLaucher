import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '../../config/database.js';
import { modrinthEnricher } from './modrinth.enricher.js';
import {
  FileCategory,
  IndexerScanResult,
  ManifestFileEntry,
  ModpackManifest,
  ModLoaderType,
  ModMetadata,
} from '../../types/index.js';

export class FileIndexerService {
  private baseDir: string;
  private categories: FileCategory[] = ['mods', 'config', 'shaderpacks', 'resourcepacks'];
  private cachedManifest: ModpackManifest | null = null;
  private fileSha1Map: Map<string, string> = new Map();
  private isScanning: boolean = false;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(baseDir || process.env.MODPACK_DIR || './data/shared_modpack');
    this.ensureDirectories();
  }

  /**
   * Ensure shared modpack subdirectories exist on disk
   */
  public ensureDirectories(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    for (const category of this.categories) {
      const catDir = path.join(this.baseDir, category);
      if (!fs.existsSync(catDir)) {
        fs.mkdirSync(catDir, { recursive: true });
      }
    }
    console.log(`[Indexer] Verified shared modpack directory at: ${this.baseDir}`);
  }

  /**
   * Asynchronously compute both SHA-256 and SHA-1 in a single stream pass
   */
  public async computeHashes(filePath: string): Promise<{ sha256: string; sha1: string }> {
    return new Promise((resolve, reject) => {
      const sha256 = crypto.createHash('sha256');
      const sha1 = crypto.createHash('sha1');
      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => reject(err));
      stream.on('data', (chunk) => {
        sha256.update(chunk);
        sha1.update(chunk);
      });
      stream.on('end', () => {
        resolve({
          sha256: sha256.digest('hex'),
          sha1: sha1.digest('hex'),
        });
      });
    });
  }

  public async computeSha256(filePath: string): Promise<string> {
    const { sha256 } = await this.computeHashes(filePath);
    return sha256;
  }

  /**
   * Recursively scans directory and returns relative paths
   */
  private scanDirectoryRecursive(dirPath: string, relativeRoot: string = ''): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dirPath)) return results;

    const list = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const item of list) {
      const fullPath = path.join(dirPath, item.name);
      const relPath = relativeRoot ? `${relativeRoot}/${item.name}` : item.name;

      if (item.isDirectory()) {
        results.push(...this.scanDirectoryRecursive(fullPath, relPath));
      } else if (item.isFile()) {
        // Skip hidden or system temporary files
        if (!item.name.startsWith('.') && !item.name.endsWith('.tmp')) {
          results.push(relPath);
        }
      }
    }
    return results;
  }

  /**
   * Perform a full recursive scan of all modpack categories, calculate SHA-256 and SHA-1 hashes,
   * synchronize database records, and rebuild the in-memory manifest cache with Modrinth metadata.
   */
  public async rescan(): Promise<IndexerScanResult> {
    if (this.isScanning) {
      throw new Error('File indexer scan is already in progress');
    }

    this.isScanning = true;
    const startTime = Date.now();
    let scannedCount = 0;
    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;

    try {
      this.ensureDirectories();

      // Gather existing files in database
      const existingDbFiles = await prisma.indexedFile.findMany();
      const dbFileMap = new Map<string, { id: string; sha256: string; sizeBytes: number }>();
      for (const f of existingDbFiles) {
        dbFileMap.set(f.relativePath, { id: f.id, sha256: f.sha256, sizeBytes: f.sizeBytes });
      }

      const activeOnDiskPaths = new Set<string>();

      for (const category of this.categories) {
        const catDir = path.join(this.baseDir, category);
        const relativeFiles = this.scanDirectoryRecursive(catDir);

        for (const relSubPath of relativeFiles) {
          scannedCount++;
          const relativePath = `${category}/${relSubPath}`;
          activeOnDiskPaths.add(relativePath);
          const fullPath = path.join(this.baseDir, relativePath);

          const stats = fs.statSync(fullPath);
          const sizeBytes = stats.size;
          const { sha256, sha1 } = await this.computeHashes(fullPath);
          this.fileSha1Map.set(relativePath, sha1);

          const existing = dbFileMap.get(relativePath);
          if (!existing) {
            // New file added
            await prisma.indexedFile.create({
              data: {
                relativePath,
                category,
                sha256,
                sizeBytes,
              },
            });
            addedCount++;
          } else if (existing.sha256 !== sha256 || existing.sizeBytes !== sizeBytes) {
            // File modified
            await prisma.indexedFile.update({
              where: { relativePath },
              data: {
                sha256,
                sizeBytes,
              },
            });
            updatedCount++;
          }
        }
      }

      // Check for removed files and delete from database
      for (const dbFile of existingDbFiles) {
        if (!activeOnDiskPaths.has(dbFile.relativePath)) {
          await prisma.indexedFile.delete({
            where: { relativePath: dbFile.relativePath },
          });
          deletedCount++;
        }
      }

      // Rebuild in-memory cached manifest
      await this.buildCachedManifest();

      const durationMs = Date.now() - startTime;
      console.log(
        `[Indexer] Scan complete in ${durationMs}ms: Scanned=${scannedCount}, Added=${addedCount}, Updated=${updatedCount}, Deleted=${deletedCount}`
      );

      return {
        scannedCount,
        addedCount,
        updatedCount,
        deletedCount,
        durationMs,
      };
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Build in-memory cached manifest for sub-millisecond responses
   */
  public async buildCachedManifest(): Promise<ModpackManifest> {
    const config = await prisma.globalConfig.findUnique({ where: { id: 'global' } });
    const indexedFiles = await prisma.indexedFile.findMany({
      orderBy: { relativePath: 'asc' },
    });

    // Populate SHA-1 for any files missing in memory map
    const modFilesToEnrich: { relativePath: string; sha1: string }[] = [];
    for (const file of indexedFiles) {
      if (file.category === 'mods') {
        let sha1 = this.fileSha1Map.get(file.relativePath);
        if (!sha1) {
          const fullPath = path.join(this.baseDir, file.relativePath);
          if (fs.existsSync(fullPath)) {
            const hashes = await this.computeHashes(fullPath);
            sha1 = hashes.sha1;
            this.fileSha1Map.set(file.relativePath, sha1);
          }
        }
        if (sha1) {
          modFilesToEnrich.push({ relativePath: file.relativePath, sha1 });
        }
      }
    }

    // Enrich mods with Modrinth metadata
    let enrichedMap = new Map<string, ModMetadata>();
    try {
      enrichedMap = await modrinthEnricher.enrichMods(modFilesToEnrich);
    } catch (e) {
      console.warn('[Indexer] Modrinth enrichment warning:', e);
    }

    const entries: ManifestFileEntry[] = indexedFiles.map((file) => ({
      path: file.relativePath,
      category: file.category as FileCategory,
      sha256: file.sha256,
      sha1: this.fileSha1Map.get(file.relativePath),
      sizeBytes: file.sizeBytes,
      downloadUrl: `/api/files/${file.relativePath}`,
      updatedAt: file.updatedAt.toISOString(),
      meta: enrichedMap.get(file.relativePath),
    }));

    // Client downloads only active files (files without .disabled suffix)
    const activeFilesForDistribution = entries.filter((e) => !e.path.endsWith('.disabled'));

    const totalSizeBytes = activeFilesForDistribution.reduce((acc, curr) => acc + curr.sizeBytes, 0);

    const categories = {
      mods: entries.filter((e) => e.category === 'mods'),
      config: entries.filter((e) => e.category === 'config'),
      shaderpacks: entries.filter((e) => e.category === 'shaderpacks'),
      resourcepacks: entries.filter((e) => e.category === 'resourcepacks'),
    };

    this.cachedManifest = {
      version: `${config?.minecraftVersion || '1.20.1'}-${config?.loaderType || 'FABRIC'}-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      minecraftVersion: config?.minecraftVersion || '1.20.1',
      loaderType: (config?.loaderType || 'FABRIC') as ModLoaderType,
      loaderVersion: config?.loaderVersion || '0.15.11',
      totalFiles: activeFilesForDistribution.length,
      totalSizeBytes,
      files: activeFilesForDistribution,
      categories,
    };

    return this.cachedManifest;
  }

  /**
   * Returns cached manifest or rebuilds it if null
   */
  public async getManifest(): Promise<ModpackManifest> {
    if (!this.cachedManifest) {
      return await this.buildCachedManifest();
    }
    return this.cachedManifest;
  }

  /**
   * Returns category-filtered manifest files
   */
  public async getCategoryManifest(category: FileCategory): Promise<ManifestFileEntry[]> {
    const manifest = await this.getManifest();
    return manifest.categories[category] || [];
  }

  /**
   * Invalidate cached manifest so next request rebuilds it
   */
  public invalidateCache(): void {
    this.cachedManifest = null;
  }

  public getBaseDir(): string {
    return this.baseDir;
  }
}

export const fileIndexerService = new FileIndexerService();
