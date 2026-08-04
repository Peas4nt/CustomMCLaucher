import express from 'express';
import modController from '../controllers/mod.controller.js';

const router = express.Router();

/**
 * @route   GET /api/health
 * @desc    Health check route for launcher connectivity verification
 */
router.get('/health', (req, res) => modController.healthCheck(req, res));

/**
 * @route   GET /api/manifest
 * @desc    Unified manifest covering mods, resourcepacks, and shaderpacks
 */
router.get('/manifest', (req, res) => modController.getManifest(req, res));

/**
 * Category-specific manifest endpoints
 */
router.get('/manifest/mods', (req, res) => modController.getMods(req, res));
router.get('/manifest/resourcepacks', (req, res) => modController.getResourcepacks(req, res));
router.get('/manifest/shaderpacks', (req, res) => modController.getShaderpacks(req, res));

export default router;
