import express from 'express';
import { fileURLToPath } from 'url';
import config from './config/index.js';
import modRoutes from './routes/mod.routes.js';
import modService from './services/mod.service.js';

const app = express();

// Security middleware headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// Serve static assets from public/ folders
app.use(config.staticModsRoute, express.static(config.modsDir));
app.use(config.staticResourcepacksRoute, express.static(config.resourcepacksDir));
app.use(config.staticShaderpacksRoute, express.static(config.shaderpacksDir));

// API routes
app.use('/api', modRoutes);

// Initialize storage and launch HTTP server
async function startServer() {
  await modService.ensureDirectories();

  const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
  if (isMain) {
    app.listen(config.port, config.host, () => {
      console.log(`🚀 Minecraft Launcher Server running on http://${config.host}:${config.port}`);
      console.log(`📁 Serving mods from: ${config.modsDir}`);
      console.log(`🎨 Serving resourcepacks from: ${config.resourcepacksDir}`);
      console.log(`✨ Serving shaderpacks from: ${config.shaderpacksDir}`);
      console.log(`📋 Content manifest API at: http://${config.host}:${config.port}/api/manifest`);
    });
  }
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});

export default app;
