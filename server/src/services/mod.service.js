import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import config from '../config/index.js';

/**
 * Service encapsulating mod, resourcepack, and shaderpack file operations,
 * stream hashing, in-memory caching, and unified manifest generation.
 */
class ModService {
  constructor() {
    // In-memory cache: "category:filename" -> { mtimeMs, size, hash }
    this.hashCache = new Map();
  }

  /**
   * Ensures that all storage directories exist.
   */
  async ensureDirectories() {
    const dirs = [config.modsDir, config.resourcepacksDir, config.shaderpacksDir];
    for (const dir of dirs) {
      try {
        if (!fs.existsSync(dir)) {
          await fs.promises.mkdir(dir, { recursive: true });
          console.log(`[ModService] Created directory: ${dir}`);
        }
      } catch (err) {
        console.error(`[ModService Error] Failed to create directory ${dir}:`, err);
      }
    }
  }

  /**
   * Calculates the SHA-256 hash of a file using Node streams.
   * @param {string} filePath Absolute path to file
   * @returns {Promise<string>} Hex SHA-256 digest
   */
  calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 });

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Scans a specific category directory and builds its manifest list with cache.
   * @param {string} category Category name (mods, resourcepacks, shaderpacks)
   * @param {string} dirPath Directory path
   * @param {string} staticRoute Static endpoint prefix
   * @param {string} baseUrl Base server URL
   */
  async scanCategory(category, dirPath, staticRoute, baseUrl) {
    try {
      if (!fs.existsSync(dirPath)) {
        await fs.promises.mkdir(dirPath, { recursive: true });
      }

      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const items = [];
      const activeKeys = new Set();

      for (const entry of entries) {
        if (!entry.isFile() || entry.name.startsWith('.')) {
          continue;
        }

        const safeFilename = path.basename(entry.name);
        const cacheKey = `${category}:${safeFilename}`;
        activeKeys.add(cacheKey);
        const filePath = path.join(dirPath, safeFilename);

        try {
          const stats = await fs.promises.stat(filePath);
          let hash;

          const cached = this.hashCache.get(cacheKey);
          if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
            hash = cached.hash;
          } else {
            hash = await this.calculateFileHash(filePath);
            this.hashCache.set(cacheKey, {
              mtimeMs: stats.mtimeMs,
              size: stats.size,
              hash,
            });
          }

          items.push({
            filename: safeFilename,
            hash: hash,
            size: stats.size,
            downloadUrl: `${baseUrl}${staticRoute}/${encodeURIComponent(safeFilename)}`,
          });
        } catch (fileErr) {
          console.error(`[ModService Warning] Failed to process ${category} file '${safeFilename}':`, fileErr.message);
        }
      }

      // Cleanup cache for deleted files in this category
      for (const cachedKey of this.hashCache.keys()) {
        if (cachedKey.startsWith(`${category}:`) && !activeKeys.has(cachedKey)) {
          this.hashCache.delete(cachedKey);
        }
      }

      return items;
    } catch (err) {
      console.error(`[ModService Error] Error scanning category ${category}:`, err);
      return [];
    }
  }

  /**
   * Scans mods directory.
   */
  async getModManifest(baseUrl) {
    return this.scanCategory('mods', config.modsDir, config.staticModsRoute, baseUrl);
  }

  /**
   * Scans resourcepacks directory.
   */
  async getResourcepacksManifest(baseUrl) {
    return this.scanCategory('resourcepacks', config.resourcepacksDir, config.staticResourcepacksRoute, baseUrl);
  }

  /**
   * Scans shaderpacks directory.
   */
  async getShaderpacksManifest(baseUrl) {
    return this.scanCategory('shaderpacks', config.shaderpacksDir, config.staticShaderpacksRoute, baseUrl);
  }

  /**
   * Returns unified full manifest covering mods, resourcepacks, and shaderpacks.
   */
  async getFullManifest(baseUrl) {
    await this.ensureDirectories();

    const [mods, resourcepacks, shaderpacks] = await Promise.all([
      this.getModManifest(baseUrl),
      this.getResourcepacksManifest(baseUrl),
      this.getShaderpacksManifest(baseUrl),
    ]);

    return {
      mods,
      resourcepacks,
      shaderpacks,
    };
  }
}

export default new ModService();
