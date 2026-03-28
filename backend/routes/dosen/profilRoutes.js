const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const profilController = require('../../controllers/dosen/profilController');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');

// Konfigurasi storage untuk upload foto profil
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/profil/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `profile-dosen-${req.user.id_user}-${uniqueSuffix}${ext}`);
    }
});

// Filter file untuk upload
const profileUpload = multer({
    storage: profileStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowedImages = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (allowedImages.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Hanya file gambar yang diperbolehkan (JPG, PNG, GIF)'), false);
        }
    }
});

// Semua route di bawah ini memerlukan autentikasi dan role dosen
router.use(authenticateToken);
router.use(authorizeRoles('dosen'));

// ===========================================
// ROUTES PROFIL DOSEN
// ===========================================

/**
 * @route   GET /api/dosen/profil
 * @desc    Mendapatkan data profil dosen
 * @access  Private (Dosen)
 */
router.get('/', profilController.getProfile);

/**
 * @route   PUT /api/dosen/profil
 * @desc    Mengupdate profil dosen
 * @access  Private (Dosen)
 */
router.put('/', profilController.updateProfile);

/**
 * @route   POST /api/dosen/profil/foto
 * @desc    Upload foto profil
 * @access  Private (Dosen)
 */
router.post('/foto', profileUpload.single('foto'), profilController.uploadFotoProfil);

/**
 * @route   GET /api/dosen/profil/statistik
 * @desc    Mendapatkan statistik kinerja dosen
 * @access  Private (Dosen)
 */
router.get('/statistik', profilController.getStatistik);

/**
 * @route   GET /api/dosen/profil/publikasi
 * @desc    Mendapatkan publikasi terbaru
 * @access  Private (Dosen)
 */
router.get('/publikasi', profilController.getPublikasiTerbaru);

/**
 * @route   POST /api/dosen/profil/ubah-password
 * @desc    Mengubah password
 * @access  Private (Dosen)
 */
router.post('/ubah-password', profilController.changePassword);

/**
 * @route   GET /api/dosen/profil/export
 * @desc    Export data kinerja
 * @access  Private (Dosen)
 */
router.get('/export', profilController.exportDataKinerja);

// ===========================================
// ROUTES RIWAYAT PENDIDIKAN
// ===========================================

/**
 * @route   GET /api/dosen/profil/pendidikan
 * @desc    Mendapatkan riwayat pendidikan
 * @access  Private (Dosen)
 */
router.get('/pendidikan', profilController.getRiwayatPendidikan);

/**
 * @route   POST /api/dosen/profil/pendidikan
 * @desc    Menambah riwayat pendidikan
 * @access  Private (Dosen)
 */
router.post('/pendidikan', profilController.addRiwayatPendidikan);

/**
 * @route   PUT /api/dosen/profil/pendidikan/:id_pendidikan
 * @desc    Mengupdate riwayat pendidikan
 * @access  Private (Dosen)
 */
router.put('/pendidikan/:id_pendidikan', profilController.updateRiwayatPendidikan);

/**
 * @route   DELETE /api/dosen/profil/pendidikan/:id_pendidikan
 * @desc    Menghapus riwayat pendidikan
 * @access  Private (Dosen)
 */
router.delete('/pendidikan/:id_pendidikan', profilController.deleteRiwayatPendidikan);

// ===========================================
// ROUTES RIWAYAT JABATAN
// ===========================================

/**
 * @route   GET /api/dosen/profil/jabatan
 * @desc    Mendapatkan riwayat jabatan
 * @access  Private (Dosen)
 */
router.get('/jabatan', profilController.getRiwayatJabatan);

/**
 * @route   POST /api/dosen/profil/jabatan
 * @desc    Menambah riwayat jabatan
 * @access  Private (Dosen)
 */
router.post('/jabatan', profilController.addRiwayatJabatan);

module.exports = router;