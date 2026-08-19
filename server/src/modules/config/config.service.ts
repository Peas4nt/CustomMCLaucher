import { prisma } from '../../config/database.js';
import { GlobalConfigDto, ModLoaderType, UpdateGlobalConfigDto } from '../../types/index.js';
import { fileIndexerService } from '../indexer/indexer.service.js';

export class GlobalConfigService {
  /**
   * Retrieve global configuration settings
   */
  public async getConfig(): Promise<GlobalConfigDto> {
    let config = await prisma.globalConfig.findUnique({
      where: { id: 'global' },
    });

    if (!config) {
      config = await prisma.globalConfig.create({
        data: {
          id: 'global',
          minecraftVersion: '1.20.1',
          loaderType: 'FABRIC',
          loaderVersion: '0.15.11',
          javaVersion: 17,
          jvmArgs: '-XX:+UseG1GC -Dsun.rmi.dgc.server.gcInterval=2147483646 -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M',
        },
      });
    }

    return {
      id: config.id,
      minecraftVersion: config.minecraftVersion,
      loaderType: config.loaderType as ModLoaderType,
      loaderVersion: config.loaderVersion,
      javaVersion: config.javaVersion,
      jvmArgs: config.jvmArgs,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Update global configuration settings
   */
  public async updateConfig(dto: UpdateGlobalConfigDto): Promise<GlobalConfigDto> {
    const updated = await prisma.globalConfig.update({
      where: { id: 'global' },
      data: {
        ...(dto.minecraftVersion !== undefined && { minecraftVersion: dto.minecraftVersion }),
        ...(dto.loaderType !== undefined && { loaderType: dto.loaderType }),
        ...(dto.loaderVersion !== undefined && { loaderVersion: dto.loaderVersion }),
        ...(dto.javaVersion !== undefined && { javaVersion: dto.javaVersion }),
        ...(dto.jvmArgs !== undefined && { jvmArgs: dto.jvmArgs }),
      },
    });

    // Invalidate manifest cache when config changes
    fileIndexerService.invalidateCache();

    return {
      id: updated.id,
      minecraftVersion: updated.minecraftVersion,
      loaderType: updated.loaderType as ModLoaderType,
      loaderVersion: updated.loaderVersion,
      javaVersion: updated.javaVersion,
      jvmArgs: updated.jvmArgs,
      updatedAt: updated.updatedAt,
    };
  }
}

export const globalConfigService = new GlobalConfigService();
