const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { upload } = require('../../middleware/upload');
const kegiatanController = require('../../controllers/admin/kegiatanController');
const { handleValidationErrors } = require('../../utils/validation');

// Validasi rules untuk kegiatan
const kegiatanValidation = [
    body('nama_kegiatan')
        .notEmpty().withMessage('Nama kegiatan wajib diisi')
        .isLength({ min: 5, max: 255 }).withMessage('Nama kegiatan harus 5-255 karakter'),
    
    body('jenis_kegiatan')
        .notEmpty().withMessage('Jenis kegiatan wajib dipilih')
        .isIn(['seminar', 'workshop', 'pelatihan', 'konferensi', 'lainnya'])
        .withMessage('Jenis kegiatan tidak valid'),
    
    body('tanggal_mulai')
        .notEmpty().withMessage('Tanggal mulai wajib diisi')
        .isISO8601().withMessage('Format tanggal tidak valid'),
    
    body('tanggal_selesai')
        .notEmpty().withMessage('Tanggal selesai wajib diisi')
        .isISO8601().withMessage('Format tanggal tidak valid')
        .custom((value, { req }) => {
            if (new Date(value) < new Date(req.body.tanggal_mulai)) {
                throw new Error('Tanggal selesai harus setelah tanggal mulai');
            }
            return true;
        }),
    
    body('lokasi')
        .notEmpty().withMessage('Lokasi wajib diisi')
        .isLength({ min: 3 }).withMessage('Lokasi minimal 3 karakter'),
    
    body('kapasitas')
        .optional()
        .isInt({ min: 1 }).withMessage('Kapasitas harus angka positif'),
    
    body('link_pendaftaran')
        .optional()
        .isURL().withMessage('Link pendaftaran tidak valid')
];

// All routes below require authentication and admin role
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// Stats and calendar routes
router.get('/stats', kegiatanController.getKegiatanStats);
router.get('/calendar', kegiatanController.getCalendarData);

// CRUD routes
router.route('/')
    .get(kegiatanController.getAllKegiatan)
    .post(
        upload.single('poster'),
        kegiatanValidation,
        handleValidationErrors,
        kegiatanController.createKegiatan
    );

router.route('/:id')
    .get(kegiatanController.getKegiatanById)
    .put(
        upload.single('poster'),
        kegiatanValidation,
        handleValidationErrors,
        kegiatanController.updateKegiatan
    )
    .delete(kegiatanController.deleteKegiatan);

// Update status route
router.patch('/:id/status',
    body('status').isIn(['upcoming', 'ongoing', 'completed', 'cancelled']).withMessage('Status tidak valid'),
    handleValidationErrors,
    kegiatanController.updateKegiatanStatus
);

module.exports = router;