const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
    authenticateToken,
    authorizeRoles
} = require('../middleware/auth');
const {
    getAllBerita,
    getBeritaById,
    getBeritaByCategory,
    getLatestBerita,
    getTrendingBerita,
    getFeaturedBerita,
    searchBerita,
    getBeritaStatistics,
    getPopularTags,
    incrementViews,
    createBerita,
    updateBerita,
    deleteBerita,
    getBeritaForPublic
} = require('../controllers/beritaController');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const uploadDir = 'uploads/berita-umum';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'berita-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Hanya file gambar yang diperbolehkan (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// Public routes (no authentication required)
router.get('/', getAllBerita);
router.get('/public', getBeritaForPublic);
router.get('/latest', getLatestBerita);
router.get('/trending', getTrendingBerita);
router.get('/featured', getFeaturedBerita);
router.get('/search', searchBerita);
router.get('/statistics', getBeritaStatistics);
router.get('/popular-tags', getPopularTags);
router.get('/category/:kategori', getBeritaByCategory);
router.get('/:id', getBeritaById);
router.post('/:id/view', incrementViews);

// Protected routes (require authentication and admin role)
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

router.post('/', upload.single('gambar_thumbnail'), createBerita);
router.put('/:id', upload.single('gambar_thumbnail'), updateBerita);
router.delete('/:id', deleteBerita);

module.exports = router;