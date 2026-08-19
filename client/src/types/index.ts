export type UserRole = 'ADMIN' | 'USER';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  role: UserRole;
}

export interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
}

export interface GameServer {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  isPrimary: boolean;
  description: string | null;
  iconUrl: string | null;
  pingMs?: number;
  onlinePlayers?: number;
  maxPlayers?: number;
  isOnline?: boolean;
  samplePlayers?: { name: string; id?: string }[];
}

export interface GlobalConfig {
  id: string;
  minecraftVersion: string;
  loaderType: 'FABRIC' | 'FORGE' | 'NEOFORGE' | 'VANILLA';
  loaderVersion: string;
  javaVersion: number;
  jvmArgs: string;
}

export interface SyncProgressData {
  status: 'IDLE' | 'CHECKING' | 'DOWNLOADING' | 'READY' | 'ERROR';
  currentFile: string;
  filesCompleted: number;
  totalFiles: number;
  bytesDownloaded: number;
  totalBytes: number;
  progressPercent: number;
  speedMbps: number;
}

export interface LauncherSettings {
  min_ram_mb: number;
  max_ram_mb: number;
  java_path: string | null;
  custom_game_dir: string | null;
  window_width: number;
  window_height: number;
  close_after_launch: boolean;
}

export interface NewsTag {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  coverImage: string;
  summary: string;
  content: string;
  images: string; // JSON string array of gallery image URLs
  tagId: string | null;
  tag?: NewsTag | null;
  viewsCount: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}
