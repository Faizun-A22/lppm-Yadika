const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const profilController = require('../../controllers/mahasiswa/profilController');
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
        // Gunakan req.user.id_user (dari middleware auth)
        cb(null, `profile-${req.user.id_user}-${uniqueSuffix}${ext}`);
    }
});

// Konfigurasi storage untuk upload dokumen
const dokumenStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/dokumen/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const jenis = req.body.jenis_dokumen || 'dokumen';
        cb(null, `${jenis}-${req.user.id_user}-${uniqueSuffix}${ext}`);
    }
});

// Filter file untuk upload
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipe file tidak didukung. Hanya JPG, PNG, GIF, dan PDF yang diperbolehkan.'), false);
    }
};

// Limit file size
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

const dokumenUpload = multer({
    storage: dokumenStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: fileFilter
});

// Semua route di bawah ini memerlukan autentikasi dan role mahasiswa
// Gunakan middleware yang sudah ada: authenticateToken dan authorizeRoles
router.use(authenticateToken);
router.use(authorizeRoles('mahasiswa'));

// ===========================================
// ROUTES PROFIL
// ===========================================

/**
 * @route   GET /api/mahasiswa/profil
 * @desc    Mendapatkan data profil mahasiswa
 * @access  Private (Mahasiswa)
 */
router.get('/', profilController.getProfile);

/**
 * @route   PUT /api/mahasiswa/profil
 * @desc    Mengupdate profil mahasiswa
 * @access  Private (Mahasiswa)
 */
router.put('/', profilController.updateProfile);

/**
 * @route   POST /api/mahasiswa/profil/foto
 * @desc    Upload foto profil
 * @access  Private (Mahasiswa)
 */
router.post('/foto', profileUpload.single('foto'), profilController.uploadFotoProfil);

/**
 * @route   GET /api/mahasiswa/profil/statistik
 * @desc    Mendapatkan statistik pendaftaran
 * @access  Private (Mahasiswa)
 */
router.get('/statistik', profilController.getStatistik);

/**
 * @route   GET /api/mahasiswa/profil/riwayat
 * @desc    Mendapatkan riwayat pendaftaran
 * @access  Private (Mahasiswa)
 */
router.get('/riwayat', profilController.getRiwayatPendaftaran);

/**
 * @route   POST /api/mahasiswa/profil/ubah-password
 * @desc    Mengubah password
 * @access  Private (Mahasiswa)
 */
router.post('/ubah-password', profilController.changePassword);

/**
 * @route   GET /api/mahasiswa/profil/dokumen
 * @desc    Mendapatkan daftar dokumen
 * @access  Private (Mahasiswa)
 */
router.get('/dokumen', profilController.getDokumen);

/**
 * @route   POST /api/mahasiswa/profil/dokumen
 * @desc    Upload dokumen
 * @access  Private (Mahasiswa)
 */
router.post('/dokumen', dokumenUpload.single('file'), profilController.uploadDokumen);

/**
 * @route   DELETE /api/mahasiswa/profil/dokumen/:id_dokumen
 * @desc    Menghapus dokumen
 * @access  Private (Mahasiswa)
 */
router.delete('/dokumen/:id_dokumen', profilController.deleteDokumen);

/**
 * @route   GET /api/mahasiswa/profil/download-data
 * @desc    Download data pribadi dalam format JSON
 * @access  Private (Mahasiswa)
 */
router.get('/download-data', profilController.downloadDataPribadi);

module.exports = router;