const express = require('express');
const router = express.Router();
const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/auth');
const {
    getJournals,
    getJournalById,
    getStatistics,
    getPopularTags,
    downloadJournal,
    incrementViews,
    searchJournals,
    getJournalsByType,
    getTopAuthors,
    getYears
} = require('../controllers/repositoryController');

// Routes publik (tanpa auth) - untuk tampilan repository
router.get('/', getJournals);
router.get('/search', searchJournals);
router.get('/statistics', getStatistics);
router.get('/popular-tags', getPopularTags);
router.get('/top-authors', getTopAuthors);
router.get('/years', getYears);
router.get('/type/:type', getJournalsByType);
router.get('/:id', getJournalById);
router.post('/:id/view', incrementViews);
router.get('/:id/download', downloadJournal);

// Routes dengan autentikasi (jika diperlukan)
router.use(authenticateToken);
router.post('/:id/bookmark', (req, res) => {
    // Bookmark functionality for authenticated users
    res.status(200).json({ success: true, message: 'Journal bookmarked' });
});

module.exports = router;