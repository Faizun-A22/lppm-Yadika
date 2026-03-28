const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const notifikasiController = require('../../controllers/admin/notifikasiController');

// Semua route memerlukan autentikasi
router.use(authenticateToken);

// GET semua notifikasi untuk user yang login
router.get('/', notifikasiController.getNotifications);

// POST mark all as read
router.post('/read-all', notifikasiController.markAllAsRead);

// POST mark single as read
router.post('/:id/read', notifikasiController.markAsRead);

module.exports = router;