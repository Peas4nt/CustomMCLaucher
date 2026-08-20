import {
  AdminUser,
  GameServer,
  GlobalConfig,
  ModpackManifest,
  ModLoaderType,
  NewsArticle,
  NewsTag,
  CreateNewsPayload,
} from './types';

const ADMIN_TOKEN_KEY = 'cmcl_admin_token';
const ADMIN_USER_KEY = 'cmcl_admin_user';

class AdminApiService {
  private baseUrl = '';

  public getStoredToken(): string | null {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  }

  public getStoredUser(): AdminUser | null {
    const data = localStorage.getItem(ADMIN_USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  public setSession(token: string, user: AdminUser): void {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  }

  public clearSession(): void {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
  }

  private getAuthHeaders(): HeadersInit {
    const token = this.getStoredToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // --- Admin Status & Setup ---
  public async getAdminStatus(): Promise<{ hasAdmin: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/auth/admin-status`);
    if (!res.ok) throw new Error('Failed to check admin status');
    return res.json();
  }

  public async setupFirstAdmin(email: string, username: string, passwordPlain: string): Promise<{ accessToken: string; user: AdminUser }> {
    const res = await fetch(`${this.baseUrl}/api/auth/setup-first-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password: passwordPlain }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to setup admin');
    return data;
  }

  public async login(identifier: string, passwordPlain: string): Promise<{ accessToken: string; user: AdminUser }> {
    const res = await fetch(`${this.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: passwordPlain }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid credentials');
    if (data.user.role !== 'ADMIN') {
      throw new Error('Access denied. Administrator privileges are required to access this panel.');
    }
    return data;
  }

  public async getMe(): Promise<AdminUser> {
    const res = await fetch(`${this.baseUrl}/api/auth/me`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to verify session');
    return res.json();
  }

  // --- Global Config ---
  public async getConfig(): Promise<GlobalConfig> {
    const res = await fetch(`${this.baseUrl}/api/config`);
    if (!res.ok) throw new Error('Failed to fetch global config');
    return res.json();
  }

  public async getGlobalConfig(): Promise<GlobalConfig> {
    return this.getConfig();
  }

  public async updateConfig(data: Partial<GlobalConfig>): Promise<GlobalConfig> {
    const res = await fetch(`${this.baseUrl}/api/config`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update global config');
    }
    return res.json();
  }

  public async updateGlobalConfig(data: Partial<GlobalConfig>): Promise<GlobalConfig> {
    return this.updateConfig(data);
  }

  // --- Game Servers ---
  public async getServers(): Promise<GameServer[]> {
    const res = await fetch(`${this.baseUrl}/api/servers`);
    if (!res.ok) throw new Error('Failed to fetch servers');
    return res.json();
  }

  public async createServer(serverData: {
    name: string;
    ipAddress: string;
    port: number;
    isPrimary?: boolean;
    description?: string;
  }): Promise<GameServer> {
    const res = await fetch(`${this.baseUrl}/api/servers`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(serverData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create server');
    }
    return res.json();
  }

  public async updateServer(id: string, serverData: Partial<GameServer>): Promise<GameServer> {
    const res = await fetch(`${this.baseUrl}/api/servers/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(serverData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update server');
    }
    return res.json();
  }

  public async setPrimaryServer(id: string): Promise<GameServer> {
    const res = await fetch(`${this.baseUrl}/api/servers/${id}/set-primary`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to set primary server');
    return res.json();
  }

  public async deleteServer(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/servers/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete server');
  }

  // --- Manifest & Indexer ---
  public async getManifest(): Promise<ModpackManifest> {
    const res = await fetch(`${this.baseUrl}/api/manifest`);
    if (!res.ok) throw new Error('Failed to fetch manifest');
    return res.json();
  }

  public async triggerRescan(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/indexer/rescan`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to rescan file system');
    return res.json();
  }

  public async rescanFiles(): Promise<ModpackManifest> {
    await this.triggerRescan();
    return this.getManifest();
  }

  public async uploadFile(category: string, file: File): Promise<any> {
    const token = this.getStoredToken();
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${this.baseUrl}/api/files/${category}/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to upload file');
    }
    return res.json();
  }

  public async uploadFiles(category: string, files: File[]): Promise<any> {
    const results = [];
    for (const file of files) {
      const res = await this.uploadFile(category, file);
      results.push(res);
    }
    return results;
  }

  public async deleteFile(category: string, relativePath: string): Promise<any> {
    const cleanPath = relativePath.startsWith(`${category}/`)
      ? relativePath.slice(category.length + 1)
      : relativePath;
    const res = await fetch(`${this.baseUrl}/api/files/${category}/${encodeURIComponent(cleanPath)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete file');
    }
    return res.json();
  }

  public async toggleFileDisabled(
    category: string,
    relativePath: string
  ): Promise<{ message: string; oldPath: string; newPath: string; isDisabled: boolean }> {
    const cleanPath = relativePath.startsWith(`${category}/`)
      ? relativePath.slice(category.length + 1)
      : relativePath;
    const res = await fetch(
      `${this.baseUrl}/api/files/${category}/toggle-disabled/${encodeURIComponent(cleanPath)}`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
      }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to toggle file disabled status');
    }
    return res.json();
  }

  // --- User Administration & Management ---
  public async getUsers(status?: 'ACTIVE' | 'DEACTIVATED'): Promise<AdminUser[]> {
    const query = status ? `?status=${status}` : '';
    const res = await fetch(`${this.baseUrl}/api/users${query}`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
  }

  public async checkNickname(username: string): Promise<{ username: string; available: boolean }> {
    const res = await fetch(`${this.baseUrl}/api/auth/check-nickname?username=${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error('Failed to check nickname availability');
    return res.json();
  }

  public async createUser(data: {
    email: string;
    username: string;
    password: string;
    role?: 'ADMIN' | 'USER';
  }): Promise<AdminUser> {
    const res = await fetch(`${this.baseUrl}/api/users`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create user');
    }
    return res.json();
  }

  public async updateUserRole(id: string, role: 'ADMIN' | 'USER'): Promise<AdminUser> {
    const res = await fetch(`${this.baseUrl}/api/users/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update user role');
    }
    return res.json();
  }

  public async updateUser(
    id: string,
    data: {
      email?: string;
      username?: string;
      role?: 'ADMIN' | 'USER';
      status?: 'ACTIVE' | 'DEACTIVATED';
      password?: string;
    }
  ): Promise<AdminUser> {
    const res = await fetch(`${this.baseUrl}/api/users/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update user');
    }
    return res.json();
  }

  public async deleteUser(id: string, permanent: boolean = false): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/users/${id}${permanent ? '?permanent=true' : ''}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete user');
  }

  public async restoreUser(id: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/users/${id}/restore`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to restore user');
  }

  // --- Public APIs for Versions (Proxied through backend to bypass browser CORS restrictions) ---
  public async fetchMojangVersions(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/config/mojang-versions`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {
      // Fallback to direct client fetch
    }

    try {
      const res = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
      if (!res.ok) return [];
      const data = await res.json();
      return data.versions
        .filter((v: any) => v.type === 'release')
        .map((v: any) => v.id);
    } catch {
      return [];
    }
  }

  public async fetchFabricLoaderVersions(gameVersion: string): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/config/fabric-versions?gameVersion=${encodeURIComponent(gameVersion)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {
      // Fallback
    }

    try {
      const res = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(gameVersion)}`);
      if (!res.ok) return [];
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((item: any) => item.loader?.version).filter(Boolean);
      }
      return [];
    } catch {
      return [];
    }
  }

  public async fetchNeoForgeLoaderVersions(gameVersion: string): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/config/neoforge-versions?gameVersion=${encodeURIComponent(gameVersion)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {
      // Fallback
    }

    try {
      const res = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
      if (res.ok) {
        const data = await res.json();
        const allVersions: string[] = data.versions || [];
        const parts = gameVersion.split('.');
        let prefix = '';
        if (parts.length >= 2) {
          const major = parts[0];
          const minor = parts[1];
          const patch = parts[2] || '0';
          if (major === '1' && minor === '21') {
            prefix = `21.${patch}.`;
          } else if (major === '1' && minor === '20') {
            if (patch === '1') prefix = '47.1.';
            else prefix = `20.${patch}.`;
          } else if (major === '1') {
            prefix = `${minor}.${patch}.`;
          }
        }
        const filtered = allVersions.filter((v) => v.startsWith(prefix)).reverse();
        if (filtered.length > 0) return filtered;
        return allVersions.filter((v) => v.includes(gameVersion.replace('1.', ''))).reverse();
      }
    } catch {
      // Ignore network errors
    }
    return [];
  }

  public async fetchForgeLoaderVersions(gameVersion: string): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/config/forge-versions?gameVersion=${encodeURIComponent(gameVersion)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
      }
    } catch {
      // Fallback
    }

    return [];
  }

  // --- News & Articles Administration ---

  public async getNews(tagId?: string, search?: string): Promise<NewsArticle[]> {
    const params = new URLSearchParams();
    if (tagId) params.append('tagId', tagId);
    if (search) params.append('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/api/news${query}`);
    if (!res.ok) throw new Error('Failed to fetch news');
    return res.json();
  }

  public async getNewsAdmin(tagId?: string, search?: string): Promise<NewsArticle[]> {
    const params = new URLSearchParams();
    if (tagId) params.append('tagId', tagId);
    if (search) params.append('search', search);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${this.baseUrl}/api/news/admin/all${query}`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch admin news');
    return res.json();
  }

  public async getArticle(idOrSlug: string): Promise<NewsArticle> {
    const res = await fetch(`${this.baseUrl}/api/news/${idOrSlug}`);
    if (!res.ok) throw new Error('Failed to fetch article');
    return res.json();
  }

  public async createArticle(payload: CreateNewsPayload): Promise<NewsArticle> {
    const res = await fetch(`${this.baseUrl}/api/news`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create news article');
    }
    return res.json();
  }

  public async updateArticle(id: string, payload: Partial<CreateNewsPayload>): Promise<NewsArticle> {
    const res = await fetch(`${this.baseUrl}/api/news/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update news article');
    }
    return res.json();
  }

  public async deleteArticle(id: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/news/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete news article');
    }
    return res.json();
  }

  // --- News Tags Administration ---

  public async getNewsTags(): Promise<NewsTag[]> {
    const res = await fetch(`${this.baseUrl}/api/news/tags`);
    if (!res.ok) throw new Error('Failed to fetch news tags');
    return res.json();
  }

  public async createNewsTag(name: string, color?: string): Promise<NewsTag> {
    const res = await fetch(`${this.baseUrl}/api/news/tags`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create tag');
    }
    return res.json();
  }

  public async updateNewsTag(id: string, name: string, color?: string): Promise<NewsTag> {
    const res = await fetch(`${this.baseUrl}/api/news/tags/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update tag');
    }
    return res.json();
  }

  public async deleteNewsTag(id: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/api/news/tags/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete tag');
    }
    return res.json();
  }

  public async uploadNewsImage(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData();
    formData.append('image', file);

    const token = this.getStoredToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${this.baseUrl}/api/news/upload-image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload image');
    }

    const data = await res.json();
    // Return absolute URL using baseUrl so it works in both dev (localhost:4000) and production
    const fullUrl = data.url.startsWith('http') ? data.url : `${this.baseUrl}${data.url}`;
    return { url: fullUrl, filename: data.filename };
  }
}

export const adminApi = new AdminApiService();
