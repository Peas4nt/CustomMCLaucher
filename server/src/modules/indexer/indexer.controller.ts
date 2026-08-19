import { Request, Response } from 'express';
import { fileIndexerService } from './indexer.service.js';
import { FileCategory } from '../../types/index.js';

export class IndexerController {
  /**
   * GET /api/manifest
   * Returns full manifest with all categorized files and SHA-256 hashes
   */
  public async getFullManifest(req: Request, res: Response): Promise<void> {
    try {
      const manifest = await fileIndexerService.getManifest();
      res.json(manifest);
    } catch (error) {
      console.error('[IndexerController] Error fetching full manifest:', error);
      res.status(500).json({ error: 'Failed to retrieve modpack manifest' });
    }
  }

  /**
   * GET /api/manifest/:category
   * Returns category-filtered file entries
   */
  public async getCategoryManifest(req: Request, res: Response): Promise<void> {
    try {
      const category = req.params.category as FileCategory;
      const validCategories: FileCategory[] = ['mods', 'config', 'shaderpacks', 'resourcepacks'];

      if (!validCategories.includes(category)) {
        res.status(400).json({
          error: `Invalid category. Allowed categories: ${validCategories.join(', ')}`,
        });
        return;
      }

      const files = await fileIndexerService.getCategoryManifest(category);
      res.json({
        category,
        totalFiles: files.length,
        files,
      });
    } catch (error) {
      console.error('[IndexerController] Error fetching category manifest:', error);
      res.status(500).json({ error: 'Failed to retrieve category manifest' });
    }
  }

  /**
   * POST /api/indexer/rescan
   * Triggers background re-scan and updates database hashes
   */
  public async triggerRescan(req: Request, res: Response): Promise<void> {
    try {
      const result = await fileIndexerService.rescan();
      res.json({
        message: 'File system re-index completed successfully',
        ...result,
      });
    } catch (error: any) {
      console.error('[IndexerController] Error during re-scan:', error);
      res.status(500).json({ error: error.message || 'File indexing scan failed' });
    }
  }
}

export const indexerController = new IndexerController();
