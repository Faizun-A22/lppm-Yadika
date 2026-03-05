const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { uploadRepository } = require('../../middleware/upload');
const repositoryController = require('../../controllers/dosen/repositoryController');

// Semua routes memerlukan autentikasi
router.use(authenticateToken);

// ============= PUBLIC ROUTES (semua user bisa akses) =============
router.get('/', repositoryController.getAllRepository);
router.get('/statistics', repositoryController.getPublicStatistics);
router.get('/popular-tags', repositoryController.getPopularTags);
router.get('/search', repositoryController.searchRepository);
router.get('/:id', repositoryController.getRepositoryById);
router.get('/:id/download', repositoryController.downloadDocument);
router.post('/:id/view', repositoryController.incrementViews);

// ============= PERSONAL ROUTES (khusus untuk user sendiri) =============
// HAPUS atau KOMENTAR dulu baris ini karena function-nya belum ada
// router.get('/my/list', repositoryController.getUserRepository); 

// Ganti dengan ini (pakai yang sudah ada)
router.get('/my/statistics', repositoryController.getMyStatistics);

// ============= ROUTES YANG MEMERLUKAN UPLOAD FILE =============
router.post('/', 
    authorizeRoles('dosen', 'admin'),
    uploadRepository.single('file'),
    repositoryController.createRepository
);

router.put('/:id', 
    authorizeRoles('dosen', 'admin'),
    uploadRepository.single('file'),
    repositoryController.updateRepository
);

router.delete('/:id', 
    authorizeRoles('dosen', 'admin'),
    repositoryController.deleteRepository
);

module.exports = router;