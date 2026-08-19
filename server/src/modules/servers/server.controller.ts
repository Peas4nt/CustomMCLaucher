import { Request, Response } from 'express';
import { serverService } from './server.service.js';

export class ServerController {
  public async listServers(req: Request, res: Response): Promise<void> {
    try {
      const servers = await serverService.listServers();
      res.json(servers);
    } catch (error) {
      console.error('[ServerController] Failed to list servers:', error);
      res.status(500).json({ error: 'Failed to retrieve server list' });
    }
  }

  public async getServerById(req: Request, res: Response): Promise<void> {
    try {
      const server = await serverService.getServerById(req.params.id);
      if (!server) {
        res.status(404).json({ error: 'Server not found' });
        return;
      }
      res.json(server);
    } catch (error) {
      console.error('[ServerController] Failed to get server:', error);
      res.status(500).json({ error: 'Failed to retrieve server' });
    }
  }

  public async createServer(req: Request, res: Response): Promise<void> {
    try {
      const { name, ipAddress, port, isPrimary, description, iconUrl } = req.body;
      if (!name || !ipAddress) {
        res.status(400).json({ error: 'name and ipAddress are required' });
        return;
      }

      const server = await serverService.createServer({
        name,
        ipAddress,
        port: port ? parseInt(port, 10) : 25565,
        isPrimary: Boolean(isPrimary),
        description,
        iconUrl,
      });

      res.status(201).json(server);
    } catch (error) {
      console.error('[ServerController] Failed to create server:', error);
      res.status(500).json({ error: 'Failed to create server' });
    }
  }

  public async updateServer(req: Request, res: Response): Promise<void> {
    try {
      const { name, ipAddress, port, isPrimary, description, iconUrl } = req.body;
      const updated = await serverService.updateServer(req.params.id, {
        name,
        ipAddress,
        port: port ? parseInt(port, 10) : undefined,
        isPrimary: isPrimary !== undefined ? Boolean(isPrimary) : undefined,
        description,
        iconUrl,
      });

      res.json(updated);
    } catch (error) {
      console.error('[ServerController] Failed to update server:', error);
      res.status(500).json({ error: 'Failed to update server' });
    }
  }

  public async setPrimaryServer(req: Request, res: Response): Promise<void> {
    try {
      const updated = await serverService.setPrimaryServer(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error('[ServerController] Failed to set primary server:', error);
      res.status(500).json({ error: 'Failed to set primary server' });
    }
  }

  public async deleteServer(req: Request, res: Response): Promise<void> {
    try {
      await serverService.deleteServer(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error('[ServerController] Failed to delete server:', error);
      res.status(500).json({ error: 'Failed to delete server' });
    }
  }
}

export const serverController = new ServerController();
