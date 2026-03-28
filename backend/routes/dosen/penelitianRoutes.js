// routes/dosen/penelitianRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { upload, handleUploadError } = require('../../middleware/upload');
const dosenPenelitianController = require('../../controllers/dosen/penelitianController');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validation rules
const penelitianValidation = [
    body('judul').notEmpty().withMessage('Judul wajib diisi'),
    body('skema').notEmpty().withMessage('Skema wajib dipilih'),
    body('jenis_pendanaan').isIn(['internal', 'eksternal', 'mandiri']).withMessage('Jenis pendanaan tidak valid'),
    body('tahun').isInt({ min: 2000, max: 2100 }).withMessage('Tahun tidak valid'),
    body('dana_diajukan').optional().isNumeric().withMessage('Dana harus berupa angka'),
    body('luaran').optional().isJSON().withMessage('Format luaran tidak valid')
];

const pengabdianValidation = [
    body('judul').notEmpty().withMessage('Judul wajib diisi'),
    body('skema').notEmpty().withMessage('Skema wajib dipilih'),
    body('jenis_pendanaan').isIn(['internal', 'eksternal', 'mandiri']).withMessage('Jenis pendanaan tidak valid'),
    body('lokasi').optional().isString(),
    body('tahun').isInt({ min: 2000, max: 2100 }).withMessage('Tahun tidak valid'),
    body('dana_diajukan').optional().isNumeric().withMessage('Dana harus berupa angka'),
    body('luaran').optional().isJSON().withMessage('Format luaran tidak valid')
];

// Semua route memerlukan autentikasi dan role dosen
router.use(authenticateToken);
router.use(authorizeRoles('dosen'));

// ==================== PENELITIAN ROUTES ====================

router.get('/penelitian', dosenPenelitianController.getAllPenelitian);
router.get('/penelitian/:id', dosenPenelitianController.getPenelitianById);

router.post('/penelitian',
    upload.fields([{ name: 'file_proposal', maxCount: 1 }]),
    penelitianValidation,
    handleValidationErrors,
    handleUploadError,
    dosenPenelitianController.createPenelitian
);

router.put('/penelitian/:id',
    upload.fields([{ name: 'file_proposal', maxCount: 1 }]),
    penelitianValidation,
    handleValidationErrors,
    handleUploadError,
    dosenPenelitianController.updatePenelitian
);

router.delete('/penelitian/:id', dosenPenelitianController.deletePenelitian);
router.post('/penelitian/:id/submit', dosenPenelitianController.submitPenelitian);

router.post('/penelitian/:id/laporan',
    upload.fields([
        { name: 'file_laporan_kemajuan', maxCount: 1 },
        { name: 'file_laporan_akhir', maxCount: 1 }
    ]),
    handleUploadError,
    dosenPenelitianController.uploadLaporan
);

// ==================== PENGABDIAN ROUTES ====================

router.get('/pengabdian', dosenPenelitianController.getAllPengabdian);
router.get('/pengabdian/:id', dosenPenelitianController.getPengabdianById);

router.post('/pengabdian',
    upload.fields([{ name: 'file_proposal', maxCount: 1 }]),
    pengabdianValidation,
    handleValidationErrors,
    handleUploadError,
    dosenPenelitianController.createPengabdian
);

router.put('/pengabdian/:id',
    upload.fields([{ name: 'file_proposal', maxCount: 1 }]),
    pengabdianValidation,
    handleValidationErrors,
    handleUploadError,
    dosenPenelitianController.updatePengabdian
);

router.delete('/pengabdian/:id', dosenPenelitianController.deletePengabdian);
router.post('/pengabdian/:id/submit', dosenPenelitianController.submitPengabdian);

router.post('/pengabdian/:id/laporan',
    upload.fields([
        { name: 'file_laporan_kemajuan', maxCount: 1 },
        { name: 'file_laporan_akhir', maxCount: 1 }
    ]),
    handleUploadError,
    dosenPenelitianController.uploadLaporanPengabdian
);

// ==================== LUARAN ROUTES ====================

router.post('/luaran/:jenis/:id',
    upload.fields([{ name: 'file_luaran', maxCount: 1 }]),
    body('tipe_luaran').isIn(['publikasi', 'haki', 'buku', 'pengabdian', 'lainnya']).withMessage('Tipe luaran tidak valid'),
    body('judul').notEmpty().withMessage('Judul luaran wajib diisi'),
    body('link_terkait').optional().isURL().withMessage('Link tidak valid'),
    handleValidationErrors,
    handleUploadError,
    dosenPenelitianController.uploadLuaran
);

router.get('/luaran/:id', dosenPenelitianController.getLuaranById);
router.delete('/luaran/:id', dosenPenelitianController.deleteLuaran);

// ==================== STATISTIK ROUTES ====================

router.get('/statistik', dosenPenelitianController.getStatistik);
router.get('/ringkasan-status', dosenPenelitianController.getRingkasanStatus);

module.exports = router;