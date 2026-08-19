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
}

export const globalConfigController = new GlobalConfigController();
