import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileIndexerService } from '../indexer/indexer.service.js';
import { FileCategory } from '../../types/index.js';

export class FileController {
  /**
   * GET /api/files/:category/*
   * Safely stream file to launcher client
   */
  public async downloadFile(req: Request, res: Response): Promise<void> {
    try {
      const category = req.params.category as FileCategory;
      const validCategories: FileCategory[] = ['mods', 'config', 'shaderpacks', 'resourcepacks'];

      if (!validCategories.includes(category)) {
        res.status(400).json({ error: 'Invalid file category' });
        return;
      }

      // Extract wildcard relative path and decode URI
      let relPath = req.params[0];
      if (!relPath) {
        res.status(400).json({ error: 'File path required' });
        return;
      }
      try {
        relPath = decodeURIComponent(relPath);
      } catch {}
      if (relPath.startsWith(`${category}/`)) {
        relPath = relPath.slice(category.length + 1);
      }

      const baseDir = fileIndexerService.getBaseDir();
      const safePath = path.normalize(path.join(baseDir, category, relPath));

      // Security check against directory traversal
      if (!safePath.startsWith(baseDir)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
        res.status(404).json({ error: 'Requested file not found' });
        return;
      }

      res.sendFile(safePath);
    } catch (error) {
      console.error('[FileController] Download error:', error);
      res.status(500).json({ error: 'Failed to download file' });
    }
  }

  /**
   * POST /api/files/:category/upload
   * Upload mod/resourcepack/shaderpack directly and trigger automatic re-index
   */
  public async handleUpload(req: Request, res: Response): Promise<void> {
    try {
      const category = req.params.category as FileCategory;
      const validCategories: FileCategory[] = ['mods', 'config', 'shaderpacks', 'resourcepacks'];

      if (!validCategories.includes(category)) {
        res.status(400).json({ error: 'Invalid file category' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Re-scan directory to update hashes and cache
      await fileIndexerService.rescan();

      res.status(201).json({
        message: 'File uploaded and indexed successfully',
        filename: req.file.filename,
        category,
      });
    } catch (error) {
      console.error('[FileController] Upload error:', error);
      res.status(500).json({ error: 'File upload failed' });
    }
  }

  /**
   * DELETE /api/files/:category/*
   * Delete file by category & relative path and trigger automatic re-index
   */
  public async deleteFile(req: Request, res: Response): Promise<void> {
    try {
      const category = req.params.category as FileCategory;
      const validCategories: FileCategory[] = ['mods', 'config', 'shaderpacks', 'resourcepacks'];

      if (!validCategories.includes(category)) {
        res.status(400).json({ error: 'Invalid file category' });
        return;
      }

      let relPath = req.params[0];
      if (!relPath) {
        res.status(400).json({ error: 'File path required' });
        return;
      }
      try {
        relPath = decodeURIComponent(relPath);
      } catch {}
      if (relPath.startsWith(`${category}/`)) {
        relPath = relPath.slice(category.length + 1);
      }

      const baseDir = fileIndexerService.getBaseDir();
      const safePath = path.normalize(path.join(baseDir, category, relPath));

      if (!safePath.startsWith(baseDir)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      if (fs.existsSync(safePath)) {
        fs.unlinkSync(safePath);
      }

      // Re-scan directory to update hashes and cache
      await fileIndexerService.rescan();

      res.json({ message: 'File deleted successfully', category, relPath });
    } catch (error) {
      console.error('[FileController] Delete error:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }

  /**
   * POST /api/files/:category/toggle-disabled/*
   * Toggle .disabled suffix for a mod/file and trigger automatic re-index
   */
  public async toggleDisabled(req: Request, res: Response): Promise<void> {
    try {
      const category = req.params.category as FileCategory;
      const validCategories: FileCategory[] = ['mods', 'config', 'shaderpacks', 'resourcepacks'];

      if (!validCategories.includes(category)) {
        res.status(400).json({ error: 'Invalid file category' });
        return;
      }

      let relPath = req.params[0];
      if (!relPath) {
        res.status(400).json({ error: 'File path required' });
        return;
      }
      try {
        relPath = decodeURIComponent(relPath);
      } catch {}
      if (relPath.startsWith(`${category}/`)) {
        relPath = relPath.slice(category.length + 1);
      }

      const baseDir = fileIndexerService.getBaseDir();
      const currentPath = path.normalize(path.join(baseDir, category, relPath));

      if (!currentPath.startsWith(baseDir)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      if (!fs.existsSync(currentPath)) {
        res.status(404).json({ error: `File not found: ${relPath}` });
        return;
      }

      let newPath: string;
      if (relPath.endsWith('.disabled')) {
        newPath = path.normalize(path.join(baseDir, category, relPath.slice(0, -'.disabled'.length)));
      } else {
        newPath = path.normalize(path.join(baseDir, category, `${relPath}.disabled`));
      }

      fs.renameSync(currentPath, newPath);

      // Re-scan directory to update hashes and cache
      await fileIndexerService.rescan();

      const newRelPath = path.relative(path.join(baseDir, category), newPath).replace(/\\/g, '/');
      const isDisabled = newRelPath.endsWith('.disabled');

      res.json({
        message: isDisabled ? 'File disabled' : 'File enabled',
        oldPath: relPath,
        newPath: newRelPath,
        isDisabled,
      });
    } catch (error) {
      console.error('[FileController] Toggle disabled error:', error);
      res.status(500).json({ error: 'Failed to toggle file status' });
    }
  }
}

export const fileController = new FileController();
