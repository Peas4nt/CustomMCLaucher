import { prisma } from '../../config/database.js';
import { CreateGameServerDto, GameServerDto, UpdateGameServerDto } from '../../types/index.js';

export class ServerService {
  /**
   * List all game servers, ordered with primary server first
   */
  public async listServers(): Promise<GameServerDto[]> {
    const servers = await prisma.gameServer.findMany({
      orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
    });
    return servers;
  }

  /**
   * Get single server by ID
   */
  public async getServerById(id: string): Promise<GameServerDto | null> {
    return await prisma.gameServer.findUnique({ where: { id } });
  }

  /**
   * Get current primary server
   */
  public async getPrimaryServer(): Promise<GameServerDto | null> {
    return await prisma.gameServer.findFirst({
      where: { isPrimary: true },
    });
  }

  /**
   * Create a new game server entry.
   * If isPrimary is true, unset isPrimary on all others.
   */
  public async createServer(dto: CreateGameServerDto): Promise<GameServerDto> {
    if (dto.isPrimary) {
      await prisma.gameServer.updateMany({
        data: { isPrimary: false },
      });
    } else {
      // If this is the first server, make it primary automatically
      const count = await prisma.gameServer.count();
      if (count === 0) {
        dto.isPrimary = true;
      }
    }

    return await prisma.gameServer.create({
      data: {
        name: dto.name,
        ipAddress: dto.ipAddress,
        port: dto.port || 25565,
        isPrimary: dto.isPrimary || false,
        description: dto.description || null,
        iconUrl: dto.iconUrl || null,
      },
    });
  }

  /**
   * Update server details
   */
  public async updateServer(id: string, dto: UpdateGameServerDto): Promise<GameServerDto> {
    if (dto.isPrimary) {
      await prisma.gameServer.updateMany({
        where: { id: { not: id } },
        data: { isPrimary: false },
      });
    }

    return await prisma.gameServer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.ipAddress !== undefined && { ipAddress: dto.ipAddress }),
        ...(dto.port !== undefined && { port: dto.port }),
        ...(dto.isPrimary !== undefined && { isPrimary: dto.isPrimary }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.iconUrl !== undefined && { iconUrl: dto.iconUrl }),
      },
    });
  }

  /**
   * Mark a server as primary (unsetting all others)
   */
  public async setPrimaryServer(id: string): Promise<GameServerDto> {
    await prisma.gameServer.updateMany({
      data: { isPrimary: false },
    });

    return await prisma.gameServer.update({
      where: { id },
      data: { isPrimary: true },
    });
  }

  /**
   * Delete a server. If deleting primary server, promote next server if available.
   */
  public async deleteServer(id: string): Promise<void> {
    const server = await prisma.gameServer.findUnique({ where: { id } });
    if (!server) return;

    await prisma.gameServer.delete({ where: { id } });

    if (server.isPrimary) {
      const nextServer = await prisma.gameServer.findFirst();
      if (nextServer) {
        await prisma.gameServer.update({
          where: { id: nextServer.id },
          data: { isPrimary: true },
        });
      }
    }
  }
}

export const serverService = new ServerService();
