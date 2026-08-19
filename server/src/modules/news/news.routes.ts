import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { newsController } from './news.controller.js';
import { authenticateJwt, requireAdmin } from '../../middleware/auth.middleware.js';

const router = Router();

// Ensure uploads/news directory exists
const newsUploadsDir = path.resolve(process.cwd(), 'uploads/news');
if (!fs.existsSync(newsUploadsDir)) {
  fs.mkdirSync(newsUploadsDir, { recursive: true });
}

const newsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, newsUploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .slice(0, 40);
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

const newsUpload = multer({
  storage: newsStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// Image upload endpoint for news (cover, gallery, inline)
router.post(
  '/upload-image',
  authenticateJwt,
  requireAdmin,
  newsUpload.single('image'),
  (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided' });
      return;
    }
    const relativeUrl = `/uploads/news/${req.file.filename}`;
    res.json({
      url: relativeUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  }
);

// Public routes
router.get('/', (req, res) => newsController.getPublicNews(req, res));
router.get('/tags', (req, res) => newsController.getTags(req, res));
router.get('/:idOrSlug', (req, res) => newsController.getArticle(req, res));

// Admin routes
router.get('/admin/all', authenticateJwt, requireAdmin, (req, res) => newsController.getAllNewsAdmin(req, res));
router.post('/', authenticateJwt, requireAdmin, (req, res) => newsController.createArticle(req, res));
router.put('/:id', authenticateJwt, requireAdmin, (req, res) => newsController.updateArticle(req, res));
router.delete('/:id', authenticateJwt, requireAdmin, (req, res) => newsController.deleteArticle(req, res));

// Admin tags routes
router.post('/tags', authenticateJwt, requireAdmin, (req, res) => newsController.createTag(req, res));
router.put('/tags/:id', authenticateJwt, requireAdmin, (req, res) => newsController.updateTag(req, res));
router.delete('/tags/:id', authenticateJwt, requireAdmin, (req, res) => newsController.deleteTag(req, res));

export default router;
