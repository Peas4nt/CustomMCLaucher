import { Request, Response } from 'express';
import { globalConfigService } from './config.service.js';

export class GlobalConfigController {
  public async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = await globalConfigService.getConfig();
      res.json(config);
    } catch (error) {
      console.error('[GlobalConfigController] Failed to get config:', error);
      res.status(500).json({ error: 'Failed to retrieve configuration' });
    }
  }

  public async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { minecraftVersion, loaderType, loaderVersion, javaVersion, jvmArgs } = req.body;
      const updated = await globalConfigService.updateConfig({
        minecraftVersion,
        loaderType,
        loaderVersion,
        javaVersion: javaVersion ? parseInt(javaVersion, 10) : undefined,
        jvmArgs,
      });
      res.json(updated);
    } catch (error) {
      console.error('[GlobalConfigController] Failed to update config:', error);
      res.status(500).json({ error: 'Failed to update configuration' });
    }
  }

  public async getMojangVersions(_req: Request, res: Response): Promise<void> {
    try {
      const response = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
      if (!response.ok) {
        res.json([]);
        return;
      }
      const data: any = await response.json();
      const versions = (data.versions || [])
        .filter((v: any) => v.type === 'release')
        .map((v: any) => v.id);
      res.json(versions);
    } catch (err) {
      console.error('[GlobalConfigController] Failed to fetch Mojang versions:', err);
      res.json([]);
    }
  }

  public async getFabricVersions(req: Request, res: Response): Promise<void> {
    try {
      const gameVersion = (req.query.gameVersion as string) || '';
      const response = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(gameVersion)}`);
      if (!response.ok) {
        res.json([]);
        return;
      }
      const data: any = await response.json();
      if (Array.isArray(data)) {
        res.json(data.map((item: any) => item.loader?.version).filter(Boolean));
        return;
      }
      res.json([]);
    } catch (err) {
      console.error('[GlobalConfigController] Failed to fetch Fabric versions:', err);
      res.json([]);
    }
  }

  public async getNeoForgeVersions(req: Request, res: Response): Promise<void> {
    try {
      const gameVersion = (req.query.gameVersion as string) || '';
      const response = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
      if (response.ok) {
        const data: any = await response.json();
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
        let filtered = allVersions.filter((v) => v.startsWith(prefix)).reverse();
        if (filtered.length === 0) {
          filtered = allVersions.filter((v) => v.includes(gameVersion.replace('1.', ''))).reverse();
        }
        res.json(filtered);
        return;
      }
      res.json([]);
    } catch (err) {
      console.error('[GlobalConfigController] Failed to fetch NeoForge versions:', err);
      res.json([]);
    }
  }

  public async getForgeVersions(req: Request, res: Response): Promise<void> {
    try {
      const gameVersion = (req.query.gameVersion as string) || '';
      
      // 1. Try BMCLAPI (returns complete list of all releases for that gameVersion)
      try {
        const bmclRes = await fetch(`https://bmclapi2.bangbang93.com/forge/minecraft/${encodeURIComponent(gameVersion)}`);
        if (bmclRes.ok) {
          const data: any = await bmclRes.json();
          if (Array.isArray(data) && data.length > 0) {
            const list = data.map((item: any) => item.version).filter(Boolean);
            if (list.length > 0) {
              res.json(list);
              return;
            }
          }
        }
      } catch {
        // Fallback to promotions
      }

      // 2. Try official promotions_slim.json
      const promoRes = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
      if (promoRes.ok) {
        const data: any = await promoRes.json();
        const promos = data.promos || {};
        const versions: string[] = [];
        const latestKey = `${gameVersion}-latest`;
        const recKey = `${gameVersion}-recommended`;
        if (promos[latestKey]) versions.push(promos[latestKey]);
        if (promos[recKey] && promos[recKey] !== promos[latestKey]) versions.push(promos[recKey]);
        if (versions.length > 0) {
          res.json(versions);
          return;
        }
      }

      res.json([]);
    } catch (err) {
      console.error('[GlobalConfigController] Failed to fetch Forge versions:', err);
      res.json([]);
    }
  }
}

export const globalConfigController = new GlobalConfigController();
