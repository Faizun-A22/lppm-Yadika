const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const desaController = require('../../controllers/admin/desaController');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { handleValidationErrors } = require('../../utils/validation');

// Semua route memerlukan autentikasi dan role admin
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// Validasi rules
const desaValidation = [
    body('nama_desa').notEmpty().withMessage('Nama desa wajib diisi'),
    body('kabupaten').notEmpty().withMessage('Kabupaten wajib diisi'),
    body('provinsi').notEmpty().withMessage('Provinsi wajib diisi'),
    body('kuota').isInt({ min: 1 }).withMessage('Kuota minimal 1'),
    body('id_dosen_pembimbing').optional().isUUID().withMessage('ID Dosen tidak valid'),
    body('nama_pembimbing_lapangan').optional(),
    body('kontak_pembimbing_lapangan').optional().matches(/^[0-9]{10,15}$/).withMessage('Kontak harus 10-15 digit angka')
];

// Routes
router.get('/', desaController.getAllDesa);
router.get('/list/aktif', desaController.getDesaAktif);
router.get('/stats', desaController.getDesaStats);
router.get('/:id', desaController.getDesaById);
router.post('/', desaValidation, handleValidationErrors, desaController.createDesa);
router.put('/:id', desaValidation, handleValidationErrors, desaController.updateDesa);
router.delete('/:id', desaController.deleteDesa);
router.patch('/:id/status', desaController.toggleStatus);
router.get('/:id/peserta', desaController.getPesertaDesa);

module.exports = router;