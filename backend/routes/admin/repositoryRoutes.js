const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const repositoryController = require('../../controllers/admin/repositoryController');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth'); // Sesuaikan dengan export yang ada
const { uploadRepository } = require('../../middleware/upload');

// Validasi rules
const documentValidation = [
    body('judul').notEmpty().withMessage('Judul harus diisi'),
    body('kategori').isIn(['jurnal', 'penelitian', 'pengabdian', 'buku', 'haki', 'prosiding', 'laporan'])
        .withMessage('Kategori tidak valid'),
    body('tahun').isInt({ min: 2000, max: 2100 }).withMessage('Tahun tidak valid'),
    body('penulis').notEmpty().withMessage('Penulis harus diisi'),
    body('doi').optional().isString(),
    body('link').optional().isURL().withMessage('Link tidak valid'),
    body('keywords').optional().isString()
];

// Middleware untuk semua route admin
router.use(authenticateToken); // Gunakan authenticateToken
router.use(authorizeRoles('admin')); // Gunakan authorizeRoles dengan parameter string, bukan array

// Routes
router.get('/dashboard-stats', repositoryController.getDashboardStats);
router.get('/documents', repositoryController.getAllDocuments);
router.get('/documents/:id', repositoryController.getDocumentById);
router.get('/documents/:id/download', repositoryController.downloadDocument);
router.get('/categories/count', repositoryController.getCategoryCounts);
router.get('/storage/info', repositoryController.getStorageInfo);

// Gunakan uploadRepository untuk upload file (allow up to 50MB)
router.post('/documents',
    uploadRepository.single('file'),
    documentValidation,
    repositoryController.createDocument
);

router.put('/documents/:id',
    uploadRepository.single('file'),
    documentValidation,
    repositoryController.updateDocument
);

router.delete('/documents/:id', repositoryController.deleteDocument);
router.post('/documents/:id/increment-view', repositoryController.incrementView);
router.post('/documents/:id/increment-download', repositoryController.incrementDownload);

module.exports = router;