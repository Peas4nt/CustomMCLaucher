import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('[Database] SQLite connected successfully via Prisma.');
    
    // Seed default GlobalConfig if missing
    const existingConfig = await prisma.globalConfig.findUnique({
      where: { id: 'global' },
    });

    if (!existingConfig) {
      await prisma.globalConfig.create({
        data: {
          id: 'global',
          minecraftVersion: '1.20.1',
          loaderType: 'FABRIC',
          loaderVersion: '0.15.11',
          javaVersion: 17,
          jvmArgs: '-XX:+UseG1GC -Dsun.rmi.dgc.server.gcInterval=2147483646 -XX:+UnlockExperimentalVMOptions -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M',
        },
      });
      console.log('[Database] Seeded initial GlobalConfig.');
    }

    // Seed default GameServer if none exist
    const serverCount = await prisma.gameServer.count();
    if (serverCount === 0) {
      await prisma.gameServer.create({
        data: {
          name: 'Main Survival Server',
          ipAddress: 'play.example.com',
          port: 25565,
          isPrimary: true,
          description: 'Official Main Server with active community and differential modpack sync.',
        },
      });
      console.log('[Database] Seeded initial Primary GameServer.');
    }
  } catch (error) {
    console.error('[Database] Failed to connect to SQLite:', error);
    process.exit(1);
  }
}
