const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const perusahaanMagangController = require('../../controllers/admin/perusahaanMagangController');

// Semua route memerlukan autentikasi dan role admin
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

/**
 * @route   GET /api/admin/magang/perusahaan
 * @desc    Get all perusahaan magang with pagination and filters
 * @access  Private (Admin)
 */
router.get('/', perusahaanMagangController.getPerusahaanMagang);

/**
 * @route   GET /api/admin/magang/perusahaan/statistics
 * @desc    Get statistics for perusahaan magang
 * @access  Private (Admin)
 */
router.get('/statistics', perusahaanMagangController.getPerusahaanStatistics);

/**
 * @route   GET /api/admin/magang/perusahaan/:id
 * @desc    Get single perusahaan magang by ID
 * @access  Private (Admin)
 */
router.get('/:id', perusahaanMagangController.getPerusahaanMagangById);

/**
 * @route   PUT /api/admin/magang/perusahaan/:id/verifikasi
 * @desc    Update perusahaan magang status (verification)
 * @access  Private (Admin)
 */
router.put('/:id/verifikasi', perusahaanMagangController.verifikasiPerusahaanMagang);

/**
 * @route   DELETE /api/admin/magang/perusahaan/:id
 * @desc    Delete perusahaan magang
 * @access  Private (Admin)
 */
router.delete('/:id', perusahaanMagangController.deletePerusahaanMagang);

module.exports = router;