// routes/admin/penelitianRoutes.js
const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { upload, handleUploadError } = require('../../middleware/upload');
const penelitianController = require('../../controllers/admin/penelitianController');
const { body } = require('express-validator');
const { handleValidationErrors } = require('../../utils/validation');

// Validation rules
const penelitianValidation = [
    body('judul').notEmpty().withMessage('Judul wajib diisi'),
    body('skema_penelitian').notEmpty().withMessage('Skema penelitian wajib dipilih'),
    body('sumber_dana').notEmpty().withMessage('Sumber dana wajib diisi'),
    body('tahun').isInt({ min: 2000, max: 2100 }).withMessage('Tahun tidak valid'),
    body('dana_disetujui').optional().isNumeric().withMessage('Dana harus berupa angka'),
    body('id_ketua').notEmpty().withMessage('Ketua peneliti wajib dipilih'),
    body('anggota').optional().isArray()
];

const pengabdianValidation = [
    body('judul').notEmpty().withMessage('Judul wajib diisi'),
    body('skema_pengabdian').notEmpty().withMessage('Skema pengabdian wajib dipilih'),
    body('lokasi').notEmpty().withMessage('Lokasi wajib diisi'),
    body('tahun').isInt({ min: 2000, max: 2100 }).withMessage('Tahun tidak valid'),
    body('dana_disetujui').optional().isNumeric().withMessage('Dana harus berupa angka'),
    body('id_ketua').notEmpty().withMessage('Ketua pengabdian wajib dipilih'),
    body('anggota').optional().isArray()
];

// Semua route memerlukan autentikasi dan role admin/dosen
router.use(authenticateToken);
router.use(authorizeRoles('admin', 'dosen'));

// ==================== PENELITIAN ROUTES ====================

// GET semua penelitian dengan filter
router.get('/penelitian', penelitianController.getAllPenelitian);

// GET penelitian by ID
router.get('/penelitian/:id', penelitianController.getPenelitianById);

// POST create penelitian baru
router.post('/penelitian',
    upload.fields([
        { name: 'file_proposal', maxCount: 1 },
        { name: 'file_laporan_kemajuan', maxCount: 1 },
        { name: 'file_laporan_akhir', maxCount: 1 }
    ]),
    penelitianValidation,
    handleValidationErrors,
    handleUploadError,
    penelitianController.createPenelitian
);

// PUT update penelitian
router.put('/penelitian/:id',
    upload.fields([
        { name: 'file_proposal', maxCount: 1 },
        { name: 'file_laporan_kemajuan', maxCount: 1 },
        { name: 'file_laporan_akhir', maxCount: 1 }
    ]),
    penelitianValidation,
    handleValidationErrors,
    handleUploadError,
    penelitianController.updatePenelitian
);

// DELETE penelitian
router.delete('/penelitian/:id', penelitianController.deletePenelitian);

// POST submit penelitian untuk review
router.post('/penelitian/:id/submit', penelitianController.submitPenelitian);

// POST update status penelitian (admin only)
router.post('/penelitian/:id/status',
    authorizeRoles('admin'),
    body('status').isIn(['draft', 'submitted', 'review', 'review_content', 'revision', 'approved', 'rejected', 'completed']),
    body('catatan').optional(),
    handleValidationErrors,
    penelitianController.updateStatusPenelitian
);

// GET riwayat review penelitian
router.get('/penelitian/:id/review-history', penelitianController.getReviewHistory);

// ==================== PENGABDIAN ROUTES ====================

// GET semua pengabdian dengan filter
router.get('/pengabdian', penelitianController.getAllPengabdian);

// GET pengabdian by ID
router.get('/pengabdian/:id', penelitianController.getPengabdianById);

// POST create pengabdian baru
router.post('/pengabdian',
    upload.fields([
        { name: 'file_proposal', maxCount: 1 },
        { name: 'file_laporan_kemajuan', maxCount: 1 },
        { name: 'file_laporan_akhir', maxCount: 1 }
    ]),
    pengabdianValidation,
    handleValidationErrors,
    handleUploadError,
    penelitianController.createPengabdian
);

// PUT update pengabdian
router.put('/pengabdian/:id',
    upload.fields([
        { name: 'file_proposal', maxCount: 1 },
        { name: 'file_laporan_kemajuan', maxCount: 1 },
        { name: 'file_laporan_akhir', maxCount: 1 }
    ]),
    pengabdianValidation,
    handleValidationErrors,
    handleUploadError,
    penelitianController.updatePengabdian
);

// DELETE pengabdian
router.delete('/pengabdian/:id', penelitianController.deletePengabdian);

// POST submit pengabdian untuk review
router.post('/pengabdian/:id/submit', penelitianController.submitPengabdian);

// POST update status pengabdian (admin only)
router.post('/pengabdian/:id/status',
    authorizeRoles('admin'),
    body('status').isIn(['draft', 'submitted', 'review', 'review_content', 'revision', 'approved', 'rejected', 'completed']),
    body('catatan').optional(),
    handleValidationErrors,
    penelitianController.updateStatusPengabdian
);

// ==================== REVIEW ROUTES ====================
// POST add review (admin only)
router.post('/review/:jenis/:id',
    authorizeRoles('admin'),
    upload.single('file_review'),
    body('status_review').isIn(['diterima', 'revisi', 'ditolak']), // UBAH INI!
    body('catatan').optional(),
    body('tipe_review').isIn(['admin', 'substansi']),
    handleValidationErrors,
    penelitianController.addReview
);

// GET semua yang perlu direview (admin only)
router.get('/review/pending', authorizeRoles('admin'), penelitianController.getPendingReviews);

// ==================== SKEMA ROUTES ====================

// GET semua skema
router.get('/skema', penelitianController.getAllSkema);

// GET skema by ID
router.get('/skema/:id', penelitianController.getSkemaById);

// POST create skema baru (admin only)
router.post('/skema',
    authorizeRoles('admin'),
    body('kode_skema').notEmpty().withMessage('Kode skema wajib diisi'),
    body('nama_skema').notEmpty().withMessage('Nama skema wajib diisi'),
    body('jenis').isIn(['penelitian', 'pengabdian']).withMessage('Jenis tidak valid'),
    body('min_dana').isNumeric().withMessage('Minimal dana harus angka'),
    body('max_dana').isNumeric().withMessage('Maksimal dana harus angka'),
    body('durasi_min').isInt().withMessage('Durasi minimal harus angka'),
    body('durasi_max').isInt().withMessage('Durasi maksimal harus angka'),
    handleValidationErrors,
    penelitianController.createSkema
);

// PUT update skema (admin only)
router.put('/skema/:id',
    authorizeRoles('admin'),
    penelitianController.updateSkema
);

// DELETE skema (admin only)
router.delete('/skema/:id', authorizeRoles('admin'), penelitianController.deleteSkema);

// ==================== STATISTIK ROUTES ====================

// GET statistik penelitian & pengabdian
router.get('/statistik', penelitianController.getStatistik);

// GET ringkasan per dosen
router.get('/ringkasan-dosen', penelitianController.getRingkasanDosen);

// GET ringkasan per fakultas
router.get('/ringkasan-fakultas', penelitianController.getRingkasanFakultas);

// ==================== LUARAN ROUTES ====================

// POST upload luaran penelitian/pengabdian
router.post('/luaran/:jenis/:id',
    upload.fields([
        { name: 'file_publikasi', maxCount: 1 },
        { name: 'file_haki', maxCount: 1 },
        { name: 'file_luaran_lain', maxCount: 1 }
    ]),
    body('judul_luaran').notEmpty().withMessage('Judul luaran wajib diisi'),
    body('tipe_luaran').isIn(['publikasi', 'haki', 'buku', 'prosiding', 'lainnya']).withMessage('Tipe luaran tidak valid'),
    handleValidationErrors,
    penelitianController.uploadLuaran
);

// GET luaran by ID
router.get('/luaran/:id', penelitianController.getLuaranById);

module.exports = router;