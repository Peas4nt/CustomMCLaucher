export interface ModrinthMeta {
  title: string;
  author: string;
  iconUrl?: string;
  description?: string;
  slug?: string;
  projectUrl?: string;
}

const CACHE_KEY = 'cml_modrinth_metadata_cache_v1';

class ModrinthService {
  private cache: Map<string, ModrinthMeta> = new Map();
  private pendingRequests: Map<string, Promise<ModrinthMeta | null>> = new Map();

  constructor() {
    this.loadCache();
  }

  private loadCache(): void {
    try {
      const data = localStorage.getItem(CACHE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        Object.entries(parsed).forEach(([k, v]) => this.cache.set(k, v as ModrinthMeta));
      }
    } catch {
      // Ignore cache load errors
    }
  }

  private saveCache(): void {
    try {
      const obj = Object.fromEntries(this.cache.entries());
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch {
      // Ignore storage limit errors
    }
  }

  /**
   * Clean mod filename into search query
   * e.g. "create-1.21.1-6.0.1.jar.disabled" -> "create"
   * e.g. "sodium-fabric-0.6.0+mc1.21.1.jar" -> "sodium"
   */
  public cleanModName(filename: string): string {
    let name = filename;
    if (name.endsWith('.disabled')) name = name.slice(0, -'.disabled'.length);
    if (name.endsWith('.jar') || name.endsWith('.zip')) name = name.slice(0, name.lastIndexOf('.'));

    // Remove common prefixes/suffixes like -forge, -fabric, -neoforge, -mc1.21, versions
    const parts = name.split(/[-_+]/);
    const cleanedParts: string[] = [];

    for (const part of parts) {
      const p = part.toLowerCase();
      // Stop on version numbers or modloader keywords if we already have a name
      if (/^[v\d]/.test(p) && cleanedParts.length > 0) break;
      if (['fabric', 'forge', 'neoforge', 'quilt', 'client', 'server', 'universal'].includes(p) && cleanedParts.length > 0) {
        break;
      }
      if (p.startsWith('mc') && cleanedParts.length > 0) break;
      cleanedParts.push(part);
    }

    return cleanedParts.join('-') || parts[0] || name;
  }

  public async fetchModMetadata(filename: string): Promise<ModrinthMeta | null> {
    const cleanKey = this.cleanModName(filename).toLowerCase();
    if (!cleanKey) return null;

    if (this.cache.has(cleanKey)) {
      return this.cache.get(cleanKey)!;
    }

    if (this.pendingRequests.has(cleanKey)) {
      return this.pendingRequests.get(cleanKey)!;
    }

    const fetchPromise = (async (): Promise<ModrinthMeta | null> => {
      try {
        const query = encodeURIComponent(cleanKey.replace(/-/g, ' '));
        const res = await fetch(
          `https://api.modrinth.com/v2/search?query=${query}&facets=[["project_type:mod"]]&limit=1`,
          {
            headers: {
              'User-Agent': 'Peas4nt/CustomMCLaucher/0.5 (admin-portal)',
            },
          }
        );

        if (!res.ok) return null;
        const data = await res.json();

        if (data.hits && data.hits.length > 0) {
          const hit = data.hits[0];
          const meta: ModrinthMeta = {
            title: hit.title,
            author: hit.author,
            iconUrl: hit.icon_url || undefined,
            description: hit.description || undefined,
            slug: hit.slug,
            projectUrl: `https://modrinth.com/mod/${hit.slug}`,
          };

          this.cache.set(cleanKey, meta);
          this.saveCache();
          return meta;
        }
      } catch (err) {
        console.warn(`[Modrinth] Failed to query metadata for "${cleanKey}":`, err);
      } finally {
        this.pendingRequests.delete(cleanKey);
      }

      return null;
    })();

    this.pendingRequests.set(cleanKey, fetchPromise);
    return fetchPromise;
  }
}

export const modrinthService = new ModrinthService();
