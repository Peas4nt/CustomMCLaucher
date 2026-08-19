import fs from 'fs';
import path from 'path';
import { ModMetadata } from '../../types/index.js';

interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon_url?: string;
  team: string;
}

export class ModrinthEnricher {
  private cachePath: string;
  private cache: Map<string, ModMetadata> = new Map();

  constructor(baseDataDir: string = './data') {
    this.cachePath = path.resolve(baseDataDir, 'modrinth_cache.json');
    this.loadCache();
  }

  private loadCache(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        const raw = fs.readFileSync(this.cachePath, 'utf-8');
        const data = JSON.parse(raw);
        Object.entries(data).forEach(([key, val]) => {
          this.cache.set(key, val as ModMetadata);
        });
        console.log(`[ModrinthEnricher] Loaded ${this.cache.size} cached mod metadata entries.`);
      }
    } catch (e) {
      console.warn('[ModrinthEnricher] Could not load cache:', e);
    }
  }

  private saveCache(): void {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const obj = Object.fromEntries(this.cache.entries());
      fs.writeFileSync(this.cachePath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[ModrinthEnricher] Could not save cache:', e);
    }
  }

  /**
   * Cleans filename to human search keyword
   * e.g. "ArmorStatues-v21.1.0-1.21.1-NeoForge.jar" -> "ArmorStatues"
   * e.g. "CreateDragonsPlus-1.11.2b.jar" -> "Create Dragons Plus"
   * e.g. "xaerominimap-neoforge-1.21.1-26.4.2.jar" -> "xaero minimap"
   */
  public cleanFileName(filename: string): string {
    let name = filename;
    if (name.endsWith('.disabled')) name = name.slice(0, -'.disabled'.length);
    if (name.endsWith('.jar') || name.endsWith('.zip')) name = name.slice(0, name.lastIndexOf('.'));

    // Replace camelCase with spaces: "CreateDragonsPlus" -> "Create Dragons Plus"
    name = name.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Remove common tokens like versions, mc1.21, neoforge, fabric, snapshot
    const tokens = name.split(/[\s\-_\+]+/);
    const validTokens: string[] = [];

    for (const t of tokens) {
      const lower = t.toLowerCase();
      if (/^[v\d]/.test(lower) && validTokens.length > 0) break;
      if (
        ['fabric', 'forge', 'neoforge', 'quilt', 'snapshot', 'release', 'alpha', 'beta', 'lts', 'all'].includes(
          lower
        ) &&
        validTokens.length > 0
      ) {
        break;
      }
      if (lower.startsWith('mc') && validTokens.length > 0) break;
      validTokens.push(t);
    }

    return validTokens.join(' ') || tokens[0] || name;
  }

  /**
   * Enriches a list of mod files with real metadata from Modrinth API
   */
  public async enrichMods(
    files: { relativePath: string; sha1: string }[]
  ): Promise<Map<string, ModMetadata>> {
    const results = new Map<string, ModMetadata>();
    const missingBySha1: { relativePath: string; sha1: string }[] = [];

    // 1. Check cache first
    for (const file of files) {
      if (this.cache.has(file.sha1)) {
        results.set(file.relativePath, this.cache.get(file.sha1)!);
      } else {
        missingBySha1.push(file);
      }
    }

    if (missingBySha1.length === 0) {
      return results;
    }

    console.log(`[ModrinthEnricher] Resolving ${missingBySha1.length} mods via Modrinth API...`);

    // 2. Batch hash lookup via Modrinth version_files API (supports batch SHA-1)
    const sha1List = missingBySha1.map((f) => f.sha1);
    const projectIdsToFetch = new Set<string>();
    const sha1ToProjectId = new Map<string, string>();

    try {
      const response = await fetch('https://api.modrinth.com/v2/version_files', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Peas4nt/CustomMCLaucher/0.5 (admin-enricher)',
        },
        body: JSON.stringify({
          hashes: sha1List,
          algorithm: 'sha1',
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as Record<string, { project_id: string; author_id?: string }>;
        for (const [sha, verInfo] of Object.entries(data)) {
          if (verInfo && verInfo.project_id) {
            sha1ToProjectId.set(sha, verInfo.project_id);
            projectIdsToFetch.add(verInfo.project_id);
          }
        }
      }
    } catch (err: any) {
      console.warn('[ModrinthEnricher] Hash lookup failed:', err.message);
    }

    // 3. Batch fetch projects for all matched project IDs
    const projectIdToMeta = new Map<string, ModMetadata>();
    if (projectIdsToFetch.size > 0) {
      const idArray = Array.from(projectIdsToFetch);
      // Fetch in chunks of 50
      for (let i = 0; i < idArray.length; i += 50) {
        const chunk = idArray.slice(i, i + 50);
        try {
          const pRes = await fetch(
            `https://api.modrinth.com/v2/projects?ids=${encodeURIComponent(JSON.stringify(chunk))}`,
            {
              headers: {
                'User-Agent': 'Peas4nt/CustomMCLaucher/0.5 (admin-enricher)',
              },
            }
          );
          if (pRes.ok) {
            const projects = (await pRes.json()) as ModrinthProject[];
            for (const p of projects) {
              const meta: ModMetadata = {
                title: p.title,
                author: p.slug, // fallback author
                iconUrl: p.icon_url,
                description: p.description,
                projectUrl: `https://modrinth.com/mod/${p.slug}`,
              };
              projectIdToMeta.set(p.id, meta);
            }
          }
        } catch (e: any) {
          console.warn('[ModrinthEnricher] Projects fetch error:', e.message);
        }
      }
    }

    // Map resolved projects back to files
    const stillUnresolved: { relativePath: string; sha1: string }[] = [];
    for (const file of missingBySha1) {
      const projId = sha1ToProjectId.get(file.sha1);
      if (projId && projectIdToMeta.has(projId)) {
        const meta = projectIdToMeta.get(projId)!;
        this.cache.set(file.sha1, meta);
        results.set(file.relativePath, meta);
      } else {
        stillUnresolved.push(file);
      }
    }

    // 4. For files not matched by SHA-1 (e.g. CurseForge or custom builds), fallback to smart search
    if (stillUnresolved.length > 0) {
      console.log(`[ModrinthEnricher] Performing smart search for ${stillUnresolved.length} remaining mods...`);
      // Run searches in parallel with concurrency of 5
      const searchPromises = stillUnresolved.map(async (file) => {
        const cleanQuery = this.cleanFileName(file.relativePath);
        if (!cleanQuery) return;

        try {
          const sRes = await fetch(
            `https://api.modrinth.com/v2/search?query=${encodeURIComponent(cleanQuery)}&facets=[["project_type:mod"]]&limit=1`,
            {
              headers: {
                'User-Agent': 'Peas4nt/CustomMCLaucher/0.5 (admin-enricher)',
              },
            }
          );

          if (sRes.ok) {
            const sData: any = await sRes.json();
            if (sData.hits && sData.hits.length > 0) {
              const hit = sData.hits[0];
              const meta: ModMetadata = {
                title: hit.title,
                author: hit.author,
                iconUrl: hit.icon_url || undefined,
                description: hit.description || undefined,
                projectUrl: `https://modrinth.com/mod/${hit.slug}`,
              };
              this.cache.set(file.sha1, meta);
              results.set(file.relativePath, meta);
            }
          }
        } catch {
          // Ignore individual search failures
        }
      });

      await Promise.allSettled(searchPromises);
    }

    // Save newly resolved metadata to disk cache
    this.saveCache();
    console.log(`[ModrinthEnricher] Finished enrichment. Total cached: ${this.cache.size}`);

    return results;
  }
}

export const modrinthEnricher = new ModrinthEnricher();
