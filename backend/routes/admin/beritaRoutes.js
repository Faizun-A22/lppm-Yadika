const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { upload } = require('../../middleware/upload');
const beritaController = require('../../controllers/admin/beritaController');
const { handleValidationErrors } = require('../../utils/validation');

// Validasi rules untuk berita
const beritaValidation = [
    body('judul')
        .notEmpty().withMessage('Judul berita wajib diisi')
        .isLength({ min: 5, max: 255 }).withMessage('Judul berita harus 5-255 karakter'),
    
    body('konten')
        .notEmpty().withMessage('Konten berita wajib diisi')
        .isLength({ min: 10 }).withMessage('Konten berita minimal 10 karakter'),
    
    body('kategori')
        .notEmpty().withMessage('Kategori berita wajib dipilih')
        .isIn(['pengumuman', 'kegiatan', 'prestasi', 'kerjasama', 'lainnya'])
        .withMessage('Kategori tidak valid'),
    
    body('status')
        .optional()
        .isIn(['draft', 'publish', 'archived'])
        .withMessage('Status tidak valid')
];

// All routes below require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// Stats route
router.get('/stats', beritaController.getBeritaStats);

// Bulk delete route
router.post('/bulk-delete', beritaController.bulkDeleteBerita);

// CRUD routes
router.route('/')
    .get(beritaController.getAllBerita)
    .post(
        upload.single('thumbnail'),
        beritaValidation,
        handleValidationErrors,
        beritaController.createBerita
    );

router.route('/:id')
    .get(beritaController.getBeritaById)
    .put(
        upload.single('thumbnail'),
        beritaValidation,
        handleValidationErrors,
        beritaController.updateBerita
    )
    .delete(beritaController.deleteBerita);

// Update status route
router.patch('/:id/status', 
    body('status').isIn(['draft', 'publish', 'archived']).withMessage('Status tidak valid'),
    handleValidationErrors,
    beritaController.updateStatusBerita
);

module.exports = router;