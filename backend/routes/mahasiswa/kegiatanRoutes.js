const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const kegiatanController = require('../../controllers/mahasiswa/kegiatanController');

// All routes require authentication
router.use(authenticateToken);

// Public routes for authenticated users (mahasiswa)
router.get('/', kegiatanController.getAllKegiatan);
router.get('/stats', kegiatanController.getKegiatanStats);
router.get('/upcoming', kegiatanController.getUpcomingKegiatan);
router.get('/jenis/:jenis', kegiatanController.getKegiatanByJenis);
router.get('/:id', kegiatanController.getKegiatanById);
router.get('/:id/check-registration', kegiatanController.checkRegistrationStatus);

// Registration
router.post('/:id/register', kegiatanController.registerKegiatan);

module.exports = router;