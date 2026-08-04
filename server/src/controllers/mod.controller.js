import modService from '../services/mod.service.js';
import config from '../config/index.js';

/**
 * Controller handling mod, resourcepack, and shaderpack API request/response flows.
 */
class ModController {
  _getBaseUrl(req) {
    const host = req.get('host') || `${config.host}:${config.port}`;
    const protocol = req.protocol || 'http';
    return `${protocol}://${host}`;
  }

  /**
   * Handles GET /api/health request.
   */
  async healthCheck(req, res) {
    try {
      const baseUrl = this._getBaseUrl(req);
      const manifest = await modService.getFullManifest(baseUrl);
      res.json({
        status: 'ok',
        version: '1.0.0',
        timestamp: Date.now(),
        modsCount: manifest.mods.length,
        resourcepacksCount: manifest.resourcepacks.length,
        shaderpacksCount: manifest.shaderpacks.length,
      });
    } catch (err) {
      res.status(500).json({
        status: 'error',
        error: err.message,
      });
    }
  }

  /**
   * Handles GET /api/manifest request (full unified manifest).
   */
  async getManifest(req, res) {
    try {
      const baseUrl = this._getBaseUrl(req);
      const manifest = await modService.getFullManifest(baseUrl);
      res.json(manifest);
    } catch (err) {
      console.error('[ModController Error] Failed to generate manifest:', err);
      res.status(500).json({
        error: 'Failed to generate content manifest',
      });
    }
  }

  /**
   * Handles GET /api/manifest/mods request.
   */
  async getMods(req, res) {
    try {
      const baseUrl = this._getBaseUrl(req);
      const mods = await modService.getModManifest(baseUrl);
      res.json(mods);
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate mods manifest' });
    }
  }

  /**
   * Handles GET /api/manifest/resourcepacks request.
   */
  async getResourcepacks(req, res) {
    try {
      const baseUrl = this._getBaseUrl(req);
      const packs = await modService.getResourcepacksManifest(baseUrl);
      res.json(packs);
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate resourcepacks manifest' });
    }
  }

  /**
   * Handles GET /api/manifest/shaderpacks request.
   */
  async getShaderpacks(req, res) {
    try {
      const baseUrl = this._getBaseUrl(req);
      const shaders = await modService.getShaderpacksManifest(baseUrl);
      res.json(shaders);
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate shaderpacks manifest' });
    }
  }
}

export default new ModController();
