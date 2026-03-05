const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const beritaController = require('../../controllers/mahasiswa/beritaController');

// All routes require authentication
router.use(authenticateToken);

// Public routes for authenticated users (mahasiswa)
router.get('/', beritaController.getAllBerita);
router.get('/stats', beritaController.getBeritaStats);
router.get('/featured', beritaController.getFeaturedBerita);
router.get('/kategori/:kategori', beritaController.getBeritaByCategory);
router.get('/:id', beritaController.getBeritaById);

module.exports = router;