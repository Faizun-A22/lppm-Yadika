const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const profilController = require('../../controllers/mahasiswa/profilController');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const supabase = require('../../config/database'); // TAMBAHKAN INI!

// ===========================================
// MIDDLEWARE - Harus DIPALING ATAS!
// ===========================================
// Semua route di bawah ini memerlukan autentikasi
router.use(authenticateToken);
router.use(authorizeRoles('mahasiswa'));

// ===========================================
// KONFIGURASI UPLOAD
// ===========================================

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
        // req.user sudah tersedia karena middleware sudah dijalankan
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

// ===========================================
// ROUTE UNTUK DATA DASAR (ringan)
// ===========================================

/**
 * @route   GET /api/mahasiswa/profil/basic
 * @desc    Mendapatkan data dasar mahasiswa (nama, nim, email, prodi)
 * @access  Private (Mahasiswa)
 */
router.get('/basic', async (req, res) => {
    try {
        // Log untuk debugging
        console.log('=== GET /basic ===');
        console.log('User dari token:', req.user ? {
            id: req.user.id_user,
            nama: req.user.nama_lengkap,
            role: req.user.role
        } : 'TIDAK ADA USER');

        const userId = req.user.id_user; // Sekarang pasti ada!

        const { data, error } = await supabase
            .from('users')
            .select(`
                id_user,
                nama_lengkap,
                email,
                nim,
                no_hp,
                foto_profil,
                id_prodi,
                program_studi!inner (
                    id_prodi,
                    nama_prodi,
                    jenjang
                )
            `)
            .eq('id_user', userId)
            .eq('role', 'mahasiswa')
            .eq('status', 'aktif')
            .single();

        if (error) {
            console.error('Error fetching user:', error);
            return res.status(404).json({
                success: false,
                message: 'Data mahasiswa tidak ditemukan'
            });
        }

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Data mahasiswa tidak ditemukan'
            });
        }

        res.json({
            success: true,
            data: {
                id_user: data.id_user,
                nama_lengkap: data.nama_lengkap,
                email: data.email,
                nim: data.nim,
                no_hp: data.no_hp || '',
                foto_profil: data.foto_profil,
                id_prodi: data.id_prodi,
                nama_prodi: data.program_studi?.nama_prodi,
                jenjang: data.program_studi?.jenjang
            }
        });

    } catch (error) {
        console.error('Error in /basic:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ===========================================
// ROUTES PROFIL LAINNYA
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