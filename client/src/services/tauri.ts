import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { LauncherSettings, SyncProgressData } from '../types';
import { apiService } from './api';

export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export class TauriService {
  public static async syncModpack(): Promise<void> {
    const baseUrl = apiService.getBaseUrl();
    if (!isTauriEnvironment()) {
      console.log('[Tauri Dev Mock] Simulating modpack sync against', baseUrl);
      return new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await invoke('sync_modpack_cmd', { apiUrl: baseUrl });
  }

  public static async launchGame(payload: {
    playerName: string;
    playerUuid: string;
    authToken: string;
    minecraftVersion: string;
    loaderType: string;
    loaderVersion: string;
    serverIp?: string;
    serverPort?: number;
  }): Promise<{ success: boolean; pid: number; message: string }> {
    if (!isTauriEnvironment()) {
      console.log('[Tauri Dev Mock] Simulating Minecraft launch:', payload);
      return {
        success: true,
        pid: 12345,
        message: 'Mock process launched in browser dev mode.',
      };
    }

    return await invoke('launch_game_cmd', {
      payload: {
        player_name: payload.playerName,
        player_uuid: payload.playerUuid,
        auth_token: payload.authToken,
        minecraft_version: payload.minecraftVersion,
        loader_type: payload.loaderType,
        loader_version: payload.loaderVersion,
        server_ip: payload.serverIp || null,
        server_port: payload.serverPort || null,
        base_api_url: apiService.getBaseUrl(),
      },
    });
  }

  public static async getSettings(): Promise<LauncherSettings> {
    if (!isTauriEnvironment()) {
      return {
        min_ram_mb: 2048,
        max_ram_mb: 4096,
        java_path: null,
        custom_game_dir: null,
        window_width: 1280,
        window_height: 720,
        close_after_launch: false,
      };
    }
    return await invoke('get_settings_cmd');
  }

  public static async saveSettings(settings: LauncherSettings): Promise<void> {
    if (!isTauriEnvironment()) {
      console.log('[Tauri Dev Mock] Saved settings:', settings);
      return;
    }
    await invoke('save_settings_cmd', { newSettings: settings });
  }

  public static async openFolder(folderName: 'mods' | 'config' | 'shaderpacks' | 'resourcepacks' | 'screenshots' | 'logs' | 'root'): Promise<void> {
    if (!isTauriEnvironment()) {
      console.log(`[Tauri Dev Mock] Open folder requested: ${folderName}`);
      return;
    }
    await invoke('open_folder_cmd', { folderName });
  }

  public static async onSyncProgress(callback: (data: SyncProgressData) => void): Promise<UnlistenFn> {
    if (!isTauriEnvironment()) {
      return () => {};
    }
    return await listen<any>('sync-progress', (event) => {
      const p = event.payload;
      callback({
        status: p.status,
        currentFile: p.current_file,
        filesCompleted: p.files_completed,
        totalFiles: p.total_files,
        bytesDownloaded: p.bytes_downloaded,
        totalBytes: p.total_bytes,
        progressPercent: p.progress_percent,
        speedMbps: p.speed_mbps,
      });
    });
  }

  public static async onDownloadProgress(callback: (data: {
    stage: string;
    currentFile: string;
    filesCompleted: number;
    totalFiles: number;
    progressPercent: number;
    statusText: string;
  }) => void): Promise<UnlistenFn> {
    if (!isTauriEnvironment()) {
      return () => {};
    }
    return await listen<any>('download-progress', (event) => {
      const p = event.payload;
      callback({
        stage: p.stage,
        currentFile: p.current_file,
        filesCompleted: p.files_completed,
        totalFiles: p.total_files,
        progressPercent: p.progress_percent,
        statusText: p.status_text,
      });
    });
  }

  public static async killGame(): Promise<void> {
    if (!isTauriEnvironment()) {
      console.log('[Tauri Dev Mock] Mocking game process termination');
      return;
    }
    await invoke('kill_game_cmd');
  }

  public static async isGameRunning(): Promise<boolean> {
    if (!isTauriEnvironment()) return false;
    try {
      return await invoke<boolean>('is_game_running_cmd');
    } catch {
      return false;
    }
  }

  public static async checkGameDownloaded(minecraftVersion?: string): Promise<boolean> {
    if (!isTauriEnvironment()) return true;
    try {
      return await invoke<boolean>('check_game_downloaded_cmd', { minecraftVersion: minecraftVersion || null });
    } catch {
      return false;
    }
  }

  public static async downloadGameFiles(payload: {
    minecraftVersion: string;
    loaderType: string;
    loaderVersion: string;
  }): Promise<void> {
    if (!isTauriEnvironment()) return;
    await invoke('download_game_files_cmd', {
      minecraftVersion: payload.minecraftVersion,
      loaderType: payload.loaderType,
      loaderVersion: payload.loaderVersion,
    });
  }

  public static async pingServer(host: string, port: number = 25565): Promise<{
    online: boolean;
    online_players: number;
    max_players: number;
    motd?: string;
    version?: string;
    sample_players?: { name: string; id?: string }[];
  }> {
    if (!isTauriEnvironment()) {
      return { online: true, online_players: 0, max_players: 20 };
    }
    return await invoke('ping_server_cmd', { host, port });
  }

  public static async getGameLogs(): Promise<{ text: string; stream: string; timestamp: string }[]> {
    if (!isTauriEnvironment()) return [];
    try {
      return await invoke('get_game_logs_cmd');
    } catch {
      return [];
    }
  }

  public static async clearGameLogs(): Promise<void> {
    if (!isTauriEnvironment()) return;
    await invoke('clear_game_logs_cmd');
  }

  public static async onGameLog(callback: (data: { text: string; stream: string; timestamp: string }) => void): Promise<UnlistenFn> {
    if (!isTauriEnvironment()) {
      return () => {};
    }
    return await listen<any>('game-log', (event) => {
      callback(event.payload);
    });
  }

  public static async onGameExited(callback: () => void): Promise<UnlistenFn> {
    if (!isTauriEnvironment()) {
      return () => {};
    }
    return await listen<any>('game-exited', () => {
      callback();
    });
  }
}
