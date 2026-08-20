import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { connectDatabase } from './config/database.js';
import { authController } from './modules/auth/auth.controller.js';
import { serverController } from './modules/servers/server.controller.js';
import { globalConfigController } from './modules/config/config.controller.js';
import { indexerController } from './modules/indexer/indexer.controller.js';
import { fileController } from './modules/files/file.controller.js';
import { fileIndexerService } from './modules/indexer/indexer.service.js';
import { authenticateJwt, requireAdmin } from './middleware/auth.middleware.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.params.category || 'mods';
    const dest = path.join(fileIndexerService.getBaseDir(), category);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage });

// Middlewares
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Admin Panel Static Assets & Uploads
const publicDir = path.resolve(__dirname, '../public');
const uploadsDir = path.resolve(process.cwd(), 'uploads');
app.use('/admin', express.static(path.join(publicDir, 'admin')));
app.use('/uploads', express.static(uploadsDir));

// Root Redirect to /admin
app.get('/', (_req, res) => {
  res.redirect('/admin');
});

// Fallback for Admin SPA routing
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(publicDir, 'admin', 'index.html'));
});

// --- API ROUTES ---

// Health & Status (supporting /api/health and /api/v1/health)
const healthHandler = async (_req: express.Request, res: express.Response) => {
  try {
    const manifest = await fileIndexerService.getManifest();
    res.json({
      status: 'online',
      service: 'CustomMCLauncher Administration API',
      version: '1.1.0',
      totalManagedFiles: manifest.totalFiles,
      totalSizeBytes: manifest.totalSizeBytes,
      minecraftVersion: manifest.minecraftVersion,
      loaderType: manifest.loaderType,
      loaderVersion: manifest.loaderVersion,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Service health check failed' });
  }
};

app.get('/api/health', healthHandler);
app.get('/api/v1/health', healthHandler);

// Authentication & Nickname Validation
app.get('/api/auth/admin-status', (req, res) => authController.getAdminStatus(req, res));
app.post('/api/auth/setup-first-admin', (req, res) => authController.setupFirstAdmin(req, res));
app.get('/api/auth/check-nickname', (req, res) => authController.checkNickname(req, res));
app.post('/api/auth/register', (req, res) => authController.register(req, res));
app.post('/api/auth/login', (req, res) => authController.login(req, res));
app.get('/api/auth/me', authenticateJwt, (req, res) => authController.me(req, res));

// User Account Administration
app.get('/api/users', authenticateJwt, requireAdmin, (req, res) => authController.listUsers(req, res));
app.post('/api/users', authenticateJwt, requireAdmin, (req, res) => authController.createUser(req, res));
app.put('/api/users/:id', authenticateJwt, requireAdmin, (req, res) => authController.updateUser(req, res));
app.delete('/api/users/:id', authenticateJwt, requireAdmin, (req, res) => authController.deleteUser(req, res));
app.put('/api/users/:id/restore', authenticateJwt, requireAdmin, (req, res) => authController.restoreUser(req, res));

// Game Servers Management
app.get('/api/servers', (req, res) => serverController.listServers(req, res));
app.get('/api/servers/:id', (req, res) => serverController.getServerById(req, res));
app.post('/api/servers', authenticateJwt, requireAdmin, (req, res) => serverController.createServer(req, res));
app.put('/api/servers/:id', authenticateJwt, requireAdmin, (req, res) => serverController.updateServer(req, res));
app.patch('/api/servers/:id/set-primary', authenticateJwt, requireAdmin, (req, res) =>
  serverController.setPrimaryServer(req, res)
);
app.delete('/api/servers/:id', authenticateJwt, requireAdmin, (req, res) => serverController.deleteServer(req, res));

// Global Config & Official Versions Proxies
app.get('/api/config', (req, res) => globalConfigController.getConfig(req, res));
app.put('/api/config', authenticateJwt, requireAdmin, (req, res) => globalConfigController.updateConfig(req, res));
app.get('/api/config/mojang-versions', (req, res) => globalConfigController.getMojangVersions(req, res));
app.get('/api/config/fabric-versions', (req, res) => globalConfigController.getFabricVersions(req, res));
app.get('/api/config/neoforge-versions', (req, res) => globalConfigController.getNeoForgeVersions(req, res));
app.get('/api/config/forge-versions', (req, res) => globalConfigController.getForgeVersions(req, res));

// Manifest & Indexer
app.get('/api/manifest', (req, res) => indexerController.getFullManifest(req, res));
app.get('/api/manifest/:category', (req, res) => indexerController.getCategoryManifest(req, res));
app.post('/api/indexer/rescan', authenticateJwt, requireAdmin, (req, res) => indexerController.triggerRescan(req, res));

// File Distribution, Upload & Deletion
app.get('/api/files/:category/*', (req, res) => fileController.downloadFile(req, res));
app.post('/api/files/:category/upload', authenticateJwt, requireAdmin, upload.single('file'), (req, res) =>
  fileController.handleUpload(req, res)
);
app.post('/api/files/:category/toggle-disabled/*', authenticateJwt, requireAdmin, (req, res) =>
  fileController.toggleDisabled(req, res)
);
app.delete('/api/files/:category/*', authenticateJwt, requireAdmin, (req, res) =>
  fileController.deleteFile(req, res)
);

import { newsController } from './modules/news/news.controller.js';
import { newsService } from './modules/news/news.service.js';
import newsRoutes from './modules/news/news.routes.js';

// News & Articles System
app.use('/api/news', newsRoutes);

// Start Server
async function bootstrap() {
  await connectDatabase();
  fileIndexerService.ensureDirectories();

  // Seed default news if empty
  await newsService.ensureSeedData();

  // Run initial background rescan on boot
  fileIndexerService
    .rescan()
    .then((result) => console.log(`[Indexer] Initial scan completed: ${result.scannedCount} files indexed.`))
    .catch((err) => console.error('[Indexer] Initial scan warning:', err.message));

  app.listen(PORT, () => {
    console.log(`[Server] CMCL Backend successfully listening on http://localhost:${PORT}`);
    console.log(`[Admin] Admin Panel accessible at http://localhost:${PORT}/admin`);
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
});
