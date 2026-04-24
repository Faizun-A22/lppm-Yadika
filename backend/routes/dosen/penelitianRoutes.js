// routes/dosen/penelitianRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { upload, handleUploadError } = require('../../middleware/upload');
const dosenPenelitianController = require('../../controllers/dosen/penelitianController');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validation rules untuk penelitian (sesuai frontend)
const penelitianValidation = [
    body('judul').notEmpty().withMessage('Judul wajib diisi'),
    body('skema').notEmpty().withMessage('Skema wajib dipilih'),
    body('jenis_pendanaan').isIn(['internal', 'eksternal', 'mandiri']).withMessage('Jenis pendanaan tidak valid'),
    body('tahun').isInt({ min: 2000, max: 2100 }).withMessage('Tahun tidak valid'),
    body('durasi').optional().isInt({ min: 1, max: 36 }).withMessage('Durasi harus antara 1-36 bulan'),
    body('dana_diajukan').optional().isNumeric().withMessage('Dana harus berupa angka'),
    body('mitra').optional().isString(),
    body('luaran').optional().isJSON().withMessage('Format luaran tidak valid')
];

// Semua route memerlukan autentikasi dan role dosen
router.use(authenticateToken);
router.use(authorizeRoles('dosen'));

// ==================== PENELITIAN ROUTES (HANYA PENELITIAN) ====================

// GET routes
router.get('/penelitian', dosenPenelitianController.getAllPenelitian);
router.get('/penelitian/:id', dosenPenelitianController.getPenelitianById);
router.get('/statistik', dosenPenelitianController.getStatistik);
router.get('/ringkasan-status', dosenPenelitianController.getRingkasanStatus);

// POST routes
router.post('/penelitian',
    upload.fields([{ name: 'file_proposal', maxCount: 1 }]),
    penelitianValidation,
    handleValidationErrors,
    handleUploadError,
    dosenPenelitianController.createPenelitian
);

// PUT routes
router.put('/penelitian/:id',
    upload.fields([{ name: 'file_proposal', maxCount: 1 }]),
    penelitianValidation,
    handleValidationErrors,
    handleUploadError,
    dosenPenelitianController.updatePenelitian
);

// DELETE routes
router.delete('/penelitian/:id', dosenPenelitianController.deletePenelitian);

// Submit routes
router.post('/penelitian/:id/submit', dosenPenelitianController.submitPenelitian);

// Laporan routes
router.post('/penelitian/:id/laporan',
    upload.fields([
        { name: 'file_laporan_kemajuan', maxCount: 1 },
        { name: 'file_laporan_akhir', maxCount: 1 }
    ]),
    handleUploadError,
    dosenPenelitianController.uploadLaporan
);

// ==================== LUARAN ROUTES (DENGAN FILE HKI & KARYA ILMIAH) ====================

router.post('/luaran/:jenis/:id',
    upload.fields([{ name: 'file_luaran', maxCount: 1 }, { name: 'file_hki', maxCount: 1 }, { name: 'file_karya', maxCount: 1 }]),
    body('tipe_luaran').isIn(['publikasi', 'haki', 'buku', 'pengabdian', 'lainnya', 'conference', 'karya']).withMessage('Tipe luaran tidak valid'),
    body('judul').notEmpty().withMessage('Judul luaran wajib diisi'),
    body('link_terkait').optional().isURL().withMessage('Link tidak valid'),
    handleValidationErrors,
    handleUploadError,
    dosenPenelitianController.uploadLuaran
);

router.get('/luaran/:id', dosenPenelitianController.getLuaranById);
router.delete('/luaran/:id', dosenPenelitianController.deleteLuaran);

module.exports = router;