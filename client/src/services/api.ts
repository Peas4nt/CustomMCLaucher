import { GameServer, GlobalConfig, NewsArticle, UserProfile } from '../types';

const BACKEND_URL_STORAGE_KEY = 'cmcl_backend_url';

class ApiService {
  private customBaseUrl: string | null = null;

  public getBaseUrl(): string {
    if (this.customBaseUrl) return this.customBaseUrl;
    const stored = localStorage.getItem(BACKEND_URL_STORAGE_KEY);
    if (stored) return stored;
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
  }

  public setBaseUrl(url: string): void {
    const cleaned = url.trim().replace(/\/+$/, '');
    this.customBaseUrl = cleaned;
    localStorage.setItem(BACKEND_URL_STORAGE_KEY, cleaned);
  }

  public clearBaseUrl(): void {
    this.customBaseUrl = null;
    localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
  }

  public hasConfiguredBaseUrl(): boolean {
    return !!localStorage.getItem(BACKEND_URL_STORAGE_KEY);
  }

  private getHeaders(token?: string | null): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  public async checkHealth(targetUrl?: string): Promise<{
    status: string;
    service: string;
    version: string;
    minecraftVersion?: string;
    loaderType?: string;
    loaderVersion?: string;
    totalManagedFiles?: number;
  }> {
    const base = targetUrl ? targetUrl.trim().replace(/\/+$/, '') : this.getBaseUrl();
    const res = await fetch(`${base}/api/v1/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      // Try fallback to /api/health
      const fallbackRes = await fetch(`${base}/api/health`);
      if (!fallbackRes.ok) {
        throw new Error(`Connection failed (HTTP ${res.status})`);
      }
      return await fallbackRes.json();
    }

    return await res.json();
  }

  public async checkNickname(username: string): Promise<boolean> {
    const res = await fetch(`${this.getBaseUrl()}/api/auth/check-nickname?username=${encodeURIComponent(username.trim())}`);
    if (!res.ok) throw new Error('Failed to validate nickname with server');
    const data = await res.json();
    return !!data.available;
  }

  public async fetchServers(): Promise<GameServer[]> {
    const res = await fetch(`${this.getBaseUrl()}/api/servers`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch game servers (HTTP ${res.status})`);
    }
    return await res.json();
  }

  public async fetchGlobalConfig(): Promise<GlobalConfig> {
    const res = await fetch(`${this.getBaseUrl()}/api/config`);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to fetch global config (HTTP ${res.status})`);
    }
    return await res.json();
  }

  public async login(identifier: string, passwordPlain: string): Promise<{ accessToken: string; user: UserProfile }> {
    const res = await fetch(`${this.getBaseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ identifier: identifier.trim(), password: passwordPlain }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(errorData.error || 'Invalid credentials');
    }

    return await res.json();
  }

  public async register(email: string, username: string, passwordPlain: string): Promise<{ accessToken: string; user: UserProfile }> {
    const res = await fetch(`${this.getBaseUrl()}/api/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ email: email.trim(), username: username.trim(), password: passwordPlain }),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(errorData.error || 'Registration failed');
    }

    return await res.json();
  }

  public async fetchMe(token: string): Promise<UserProfile> {
    const res = await fetch(`${this.getBaseUrl()}/api/auth/me`, {
      headers: this.getHeaders(token),
    });

    if (!res.ok) throw new Error('Session expired');
    return await res.json();
  }

  public async fetchNews(tagId?: string): Promise<NewsArticle[]> {
    try {
      const query = tagId ? `?tagId=${tagId}` : '';
      const res = await fetch(`${this.getBaseUrl()}/api/news${query}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  public async fetchArticle(idOrSlug: string): Promise<NewsArticle | null> {
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/news/${idOrSlug}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  public resolveImageUrl(url: string | null | undefined): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
      return trimmed;
    }
    const base = this.getBaseUrl().replace(/\/+$/, '');
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return `${base}${cleanPath}`;
  }
}

export const apiService = new ApiService();
