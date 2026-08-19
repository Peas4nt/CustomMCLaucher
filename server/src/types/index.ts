export type UserRole = 'ADMIN' | 'USER';
export type UserStatus = 'ACTIVE' | 'DEACTIVATED';

export type ModLoaderType = 'FABRIC' | 'FORGE' | 'NEOFORGE' | 'VANILLA';

export type FileCategory = 'mods' | 'config' | 'shaderpacks' | 'resourcepacks';

export interface UserPayload {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: string;
  user: UserPayload;
}

export interface GameServerDto {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  isPrimary: boolean;
  description: string | null;
  iconUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGameServerDto {
  name: string;
  ipAddress: string;
  port?: number;
  isPrimary?: boolean;
  description?: string;
  iconUrl?: string;
}

export interface UpdateGameServerDto {
  name?: string;
  ipAddress?: string;
  port?: number;
  isPrimary?: boolean;
  description?: string;
  iconUrl?: string;
}

export interface GlobalConfigDto {
  id: string;
  minecraftVersion: string;
  loaderType: ModLoaderType;
  loaderVersion: string;
  javaVersion: number;
  jvmArgs: string;
  updatedAt: Date;
}

export interface UpdateGlobalConfigDto {
  minecraftVersion?: string;
  loaderType?: ModLoaderType;
  loaderVersion?: string;
  javaVersion?: number;
  jvmArgs?: string;
}

export interface ModMetadata {
  title?: string;
  author?: string;
  iconUrl?: string;
  description?: string;
  projectUrl?: string;
}

export interface ManifestFileEntry {
  path: string; // relative path e.g. "mods/fabric-api.jar"
  category: FileCategory;
  sha256: string;
  sha1?: string;
  sizeBytes: number;
  downloadUrl: string;
  updatedAt: string;
  meta?: ModMetadata;
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

export interface IndexerScanResult {
  scannedCount: number;
  addedCount: number;
  updatedCount: number;
  deletedCount: number;
  durationMs: number;
}
