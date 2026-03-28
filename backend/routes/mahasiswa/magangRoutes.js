const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { upload, handleUploadError } = require('../../middleware/upload');

// IMPORT CONTROLLER
const magangController = require('../../controllers/mahasiswa/magangController');

// CEK APAKAH CONTROLLER TERLOAD DENGAN BAIK
console.log('✅ magangController loaded:', Object.keys(magangController));

// Semua route memerlukan autentikasi dan role mahasiswa
router.use(authenticateToken);
router.use(authorizeRoles('mahasiswa'));

// ========== REGISTRASI MAGANG ==========
/**
 * @route   POST /api/magang/registrasi
 * @desc    Mendaftar program magang (langkah 1)
 * @access  Private (Mahasiswa)
 */
router.post(
    '/registrasi',
    upload.fields([
        { name: 'krs_file', maxCount: 1 },
        { name: 'khs_file', maxCount: 1 },
        { name: 'payment_file', maxCount: 1 }
    ]),
    [
        body('program_studi').notEmpty().withMessage('Program studi harus diisi'),
        body('no_hp').notEmpty().withMessage('Nomor HP harus diisi'),
        body('domisili').notEmpty().withMessage('Domisili harus diisi'),
        body('semester').isInt({ min: 1, max: 14 }).withMessage('Semester tidak valid')
    ],
    handleUploadError,
    magangController.createRegistrasi  // ✅ Perbaiki: dari daftarMagang jadi createRegistrasi
);

/**
 * @route   GET /api/magang/registrasi
 * @desc    Mendapatkan data registrasi magang mahasiswa
 * @access  Private (Mahasiswa)
 */
router.get('/registrasi', magangController.getRegistrasi);

/**
 * @route   PUT /api/magang/registrasi/:id
 * @desc    Update data registrasi magang
 * @access  Private (Mahasiswa)
 */
router.put(
    '/registrasi/:id',  // Perbaiki parameter
    upload.fields([
        { name: 'krs_file', maxCount: 1 },
        { name: 'khs_file', maxCount: 1 },
        { name: 'payment_file', maxCount: 1 }
    ]),
    [
        body('program_studi').optional().notEmpty().withMessage('Program studi harus diisi'),
        body('no_hp').optional().notEmpty().withMessage('Nomor HP harus diisi'),
        body('domisili').optional().notEmpty().withMessage('Domisili harus diisi'),
        body('semester').optional().isInt({ min: 1, max: 14 }).withMessage('Semester tidak valid')
    ],
    handleUploadError,
    magangController.updateRegistrasi
);

/**
 * @route   DELETE /api/magang/registrasi/:id
 * @desc    Batalkan pendaftaran magang
 * @access  Private (Mahasiswa)
 */
router.delete('/registrasi/:id', magangController.deleteFile);  // Atau buat method baru

// ========== DATA PERUSAHAAN ==========
/**
 * @route   POST /api/magang/perusahaan
 * @desc    Menambahkan data perusahaan
 * @access  Private (Mahasiswa)
 */
router.post(
    '/perusahaan',
    upload.fields([
        { name: 'surat_keterangan', maxCount: 1 },
        { name: 'struktur_organisasi', maxCount: 1 }
    ]),
    [
        body('nama_perusahaan').notEmpty().withMessage('Nama perusahaan harus diisi'),
        body('bidang_magang').notEmpty().withMessage('Bidang magang harus diisi'),
        body('posisi').notEmpty().withMessage('Posisi magang harus diisi'),
        body('durasi').isInt({ min: 1, max: 12 }).withMessage('Durasi harus 1-12 bulan'),
        body('tanggal_mulai').isDate().withMessage('Tanggal mulai tidak valid'),
        body('tanggal_selesai').isDate().withMessage('Tanggal selesai tidak valid'),
        body('alamat_perusahaan').notEmpty().withMessage('Alamat perusahaan harus diisi'),
        body('nama_pembimbing').notEmpty().withMessage('Nama pembimbing harus diisi'),
        body('kontak_pembimbing').notEmpty().withMessage('Kontak pembimbing harus diisi')
    ],
    handleUploadError,
    magangController.createPerusahaan  // ✅ Perbaiki: dari tambahPerusahaan jadi createPerusahaan
);

/**
 * @route   GET /api/magang/perusahaan
 * @desc    Mendapatkan data perusahaan magang
 * @access  Private (Mahasiswa)
 */
router.get('/perusahaan', magangController.getPerusahaan);

/**
 * @route   GET /api/magang/perusahaan/:id
 * @desc    Mendapatkan detail perusahaan magang
 * @access  Private (Mahasiswa)
 */
router.get('/perusahaan/:id', magangController.getPerusahaanById);  // Perbaiki parameter

/**
 * @route   PUT /api/magang/perusahaan/:id
 * @desc    Update data perusahaan magang
 * @access  Private (Mahasiswa)
 */
router.put(
    '/perusahaan/:id',
    upload.fields([
        { name: 'surat_keterangan', maxCount: 1 },
        { name: 'struktur_organisasi', maxCount: 1 }
    ]),
    handleUploadError,
    magangController.updatePerusahaan
);

// ========== LUARAN MAGANG ==========
/**
 * @route   POST /api/magang/luaran
 * @desc    Menambahkan luaran magang
 * @access  Private (Mahasiswa)
 */
router.post(
    '/luaran',
    upload.fields([
        { name: 'mou_file', maxCount: 1 },
        { name: 'sertifikat', maxCount: 1 },
        { name: 'logbook', maxCount: 1 }
    ]),
    [
        body('judul_proyek').notEmpty().withMessage('Judul proyek harus diisi'),
        body('deskripsi_pekerjaan').notEmpty().withMessage('Deskripsi pekerjaan harus diisi')
    ],
    handleUploadError,
    magangController.createLuaran  // ✅ Perbaiki: dari tambahLuaran jadi createLuaran
);

/**
 * @route   GET /api/magang/luaran
 * @desc    Mendapatkan data luaran magang
 * @access  Private (Mahasiswa)
 */
router.get('/luaran', magangController.getLuaran);

/**
 * @route   GET /api/magang/luaran/:id
 * @desc    Mendapatkan detail luaran magang
 * @access  Private (Mahasiswa)
 */
router.get('/luaran/:id', magangController.getLuaranById);  // Perbaiki parameter

/**
 * @route   PUT /api/magang/luaran/:id
 * @desc    Update data luaran magang
 * @access  Private (Mahasiswa)
 */
router.put(
    '/luaran/:id',
    upload.fields([
        { name: 'mou_file', maxCount: 1 },
        { name: 'sertifikat', maxCount: 1 },
        { name: 'logbook', maxCount: 1 },
        { name: 'poster', maxCount: 1 },
        { name: 'laporan', maxCount: 1 },
        { name: 'foto_kegiatan', maxCount: 10 }
    ]),
    handleUploadError,
    magangController.updateLuaran
);

// ========== DASHBOARD & STATUS ==========
/**
 * @route   GET /api/magang/status
 * @desc    Mendapatkan status keseluruhan magang
 * @access  Private (Mahasiswa)
 */
router.get('/status', magangController.getStatus);  // ✅ Perbaiki: dari getStatusMagang jadi getStatus

/**
 * @route   GET /api/magang/timeline
 * @desc    Mendapatkan timeline magang
 * @access  Private (Mahasiswa)
 */
router.get('/timeline', magangController.getTimeline);

/**
 * @route   GET /api/magang/riwayat
 * @desc    Mendapatkan riwayat pengajuan magang
 * @access  Private (Mahasiswa)
 */
router.get('/riwayat', magangController.getRiwayat);

/**
 * @route   GET /api/magang/program-studi
 * @desc    Mendapatkan daftar program studi
 * @access  Private (Mahasiswa)
 */
router.get('/program-studi', magangController.getProgramStudi);

// ========== FILE MANAGEMENT ==========
/**
 * @route   DELETE /api/magang/file/:jenis/:id
 * @desc    Hapus file yang sudah diupload
 * @access  Private (Mahasiswa)
 */
router.delete('/file/:jenis/:id', magangController.deleteFile);  // ✅ Perbaiki: dari hapusFile jadi deleteFile

module.exports = router;