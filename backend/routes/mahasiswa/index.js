const express = require('express');
const router = express.Router();
const kknRoutes = require('./kknRoutes');
const magangRoutes = require('./magangRoutes');
const beritaRoutes = require('./beritaRoutes');
const kegiatanRoutes = require('./kegiatanRoutes');
const repositoryRoutes = require('./repositoryRoutes');
const profilRoutes = require('./profilRoutes');

// Mount routes
router.use('/kkn', kknRoutes);
router.use('/magang', magangRoutes);
router.use('/berita', beritaRoutes);
router.use('/kegiatan', kegiatanRoutes);
router.use('/repository', repositoryRoutes);
router.use('/profil', profilRoutes);

module.exports = router;