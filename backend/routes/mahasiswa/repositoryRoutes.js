const express = require('express');
const router = express.Router();
const {
    authenticateToken,
    authorizeRoles
} = require('../../middleware/auth');
const {
    getRepository,
    getRepositoryById,
    getStatistics,
    getPopularTags,
    downloadDocument,
    incrementViews,
    searchRepository
} = require('../../controllers/mahasiswa/repositoryController');

// Semua routes memerlukan autentikasi dan role mahasiswa
router.use(authenticateToken);
router.use(authorizeRoles('mahasiswa'));

// Routes
router.get('/', getRepository);
router.get('/statistics', getStatistics);
router.get('/popular-tags', getPopularTags);
router.get('/search', searchRepository);
router.get('/:id', getRepositoryById);
router.post('/:id/view', incrementViews);
router.get('/:id/download', downloadDocument);

module.exports = router;