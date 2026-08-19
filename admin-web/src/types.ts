export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'DEACTIVATED';
export type ModLoaderType = 'FABRIC' | 'FORGE' | 'NEOFORGE' | 'VANILLA';
export type FileCategory = 'mods' | 'config' | 'shaderpacks' | 'resourcepacks';

export interface AdminUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
}

export interface GameServer {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  isPrimary: boolean;
  description: string | null;
  iconUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GlobalConfig {
  id: string;
  minecraftVersion: string;
  loaderType: ModLoaderType;
  loaderVersion: string;
  javaVersion: number;
  jvmArgs: string;
  updatedAt: string;
}

export interface ModMetadata {
  title?: string;
  author?: string;
  iconUrl?: string;
  description?: string;
  projectUrl?: string;
}

export interface ManifestFileEntry {
  path: string;
  category: FileCategory;
  sha256: string;
  sha1?: string;
  sizeBytes: number;
  downloadUrl: string;
  updatedAt: string;
  meta?: ModMetadata;
}

export interface Manifest {
  version: string;
  minecraftVersion: string;
  loaderType: string;
  loaderVersion: string;
  totalFiles: number;
  totalSizeBytes: number;
  files: ManifestFileEntry[];
}

export interface NewsTag {
  id: string;
  name: string;
  slug: string;
  color: string;
  _count?: {
    articles: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  coverImage: string;
  summary: string;
  content: string;
  images: string; // JSON string
  tagId: string | null;
  tag?: NewsTag | null;
  viewsCount: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNewsPayload {
  title: string;
  summary?: string;
  content: string;
  coverImage: string;
  images?: string[];
  tagId?: string | null;
  published?: boolean;
}

export interface ModpackManifest {
  version: string;
  generatedAt: string;
  minecraftVersion: string;
  loaderType: ModLoaderType;
  loaderVersion: string;
  totalFiles: number;
  totalSizeBytes: number;
  files: ManifestFileEntry[];
  categories: {
    mods: ManifestFileEntry[];
    config: ManifestFileEntry[];
    shaderpacks: ManifestFileEntry[];
    resourcepacks: ManifestFileEntry[];
  };
}
