const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const fakultasController = require('../../controllers/mahasiswa/fakultasController');

// Semua route memerlukan autentikasi dan role mahasiswa
router.use(authenticateToken);
router.use(authorizeRoles('mahasiswa'));

/**
 * @route   GET /api/mahasiswa/fakultas
 * @desc    Mendapatkan semua fakultas
 * @access  Private (Mahasiswa)
 */
router.get('/fakultas', fakultasController.getFakultas);

/**
 * @route   GET /api/mahasiswa/fakultas/:id_fakultas/prodi
 * @desc    Mendapatkan prodi berdasarkan fakultas
 * @access  Private (Mahasiswa)
 */
router.get('/fakultas/:id_fakultas/prodi', fakultasController.getProdiByFakultas);

/**
 * @route   GET /api/mahasiswa/fakultas/:id_fakultas/detail
 * @desc    Mendapatkan detail fakultas beserta prodi
 * @access  Private (Mahasiswa)
 */
router.get('/fakultas/:id_fakultas/detail', fakultasController.getDetailFakultas);

/**
 * @route   GET /api/mahasiswa/prodi
 * @desc    Mendapatkan semua program studi
 * @access  Private (Mahasiswa)
 */
router.get('/prodi', fakultasController.getAllProdi);

module.exports = router;