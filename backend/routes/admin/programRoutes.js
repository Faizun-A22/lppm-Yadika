const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const programController = require('../../controllers/admin/programController');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { handleValidationErrors } = require('../../utils/validation');

// Semua route memerlukan autentikasi dan role admin
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// Validasi rules
const programValidation = [
    body('nama_program').notEmpty().withMessage('Nama program wajib diisi'),
    body('jenis').isIn(['magang', 'kkn']).withMessage('Jenis program tidak valid'),
    body('kuota').isInt({ min: 1 }).withMessage('Kuota minimal 1'),
    body('periode').notEmpty().withMessage('Periode wajib diisi')
];

// Routes
router.get('/', programController.getAllPrograms);
router.get('/:id', programController.getProgramById);
router.post('/', programValidation, handleValidationErrors, programController.createProgram);
router.put('/:id', programValidation, handleValidationErrors, programController.updateProgram);
router.delete('/:id', programController.deleteProgram);
router.patch('/:id/status', programController.toggleStatus);

module.exports = router;