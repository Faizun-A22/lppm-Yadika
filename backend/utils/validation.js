// utils/validation.js

const { body, validationResult } = require('express-validator');

/**
 * Validasi format email
 * @param {string} email - Email yang akan divalidasi
 * @returns {boolean} - True jika valid
 */
const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

/**
 * Validasi password (minimal 6 karakter)
 * @param {string} password - Password yang akan divalidasi
 * @returns {boolean} - True jika valid
 */
const validatePassword = (password) => {
    return password && password.length >= 6;
};

/**
 * Validasi nama (minimal 3 karakter)
 * @param {string} name - Nama yang akan divalidasi
 * @returns {boolean} - True jika valid
 */
const validateName = (name) => {
    return name && name.trim().length >= 3;
};

/**
 * Validasi NIM (tidak boleh kosong)
 * @param {string} nim - NIM yang akan divalidasi
 * @returns {boolean} - True jika valid
 */
const validateNIM = (nim) => {
    return nim && nim.trim().length > 0;
};

/**
 * Validasi NIDN (tidak boleh kosong)
 * @param {string} nidn - NIDN yang akan divalidasi
 * @returns {boolean} - True jika valid
 */
const validateNIDN = (nidn) => {
    return nidn && nidn.trim().length > 0;
};

/**
 * Validasi nomor HP (10-15 digit angka)
 * @param {string} no_hp - Nomor HP yang akan divalidasi
 * @returns {boolean} - True jika valid
 */
const validateNoHP = (no_hp) => {
    if (!no_hp) return false;
    const phoneRegex = /^[0-9]{10,15}$/;
    return phoneRegex.test(no_hp);
};

/**
 * Validasi ID Program Studi (harus UUID)
 * @param {string} id_prodi - ID Program Studi
 * @returns {boolean} - True jika valid
 */
const validateProdiId = (id_prodi) => {
    if (!id_prodi) return false;
    // UUID format: 8-4-4-4-12
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id_prodi);
};

// ==================== VALIDATION RULES ====================

/**
 * Validation rules untuk registrasi
 */
const registerValidation = [
    // Validasi nama
    body('name')
        .trim()
        .isLength({ min: 3 }).withMessage('Nama lengkap minimal 3 karakter')
        .matches(/^[a-zA-Z\s]+$/).withMessage('Nama hanya boleh mengandung huruf dan spasi'),
    
    // Validasi email
    body('email')
        .isEmail().withMessage('Email tidak valid')
        .normalizeEmail(),
    
    // Validasi password
    body('password')
        .isLength({ min: 6 }).withMessage('Password minimal 6 karakter'),
    
    // Validasi role
    body('isDosen')
        .isBoolean().withMessage('isDosen harus boolean'),
    
    // Validasi NIM/NIDN (dikirim sebagai 'nim')
    body('nim')
        .custom((value, { req }) => {
            const isDosen = req.body.isDosen === true;
            if (!value || value.trim() === '') {
                throw new Error(isDosen ? 'NIDN wajib diisi' : 'NIM wajib diisi');
            }
            if (!/^\d+$/.test(value)) {
                throw new Error(isDosen ? 'NIDN hanya boleh berisi angka' : 'NIM hanya boleh berisi angka');
            }
            return true;
        }),
    
    // Validasi ID Program Studi (WAJIB - dari database)
    body('id_prodi')
        .notEmpty().withMessage('Program studi wajib dipilih')
        .custom((value) => {
            if (!validateProdiId(value)) {
                throw new Error('ID Program Studi tidak valid');
            }
            return true;
        }),
    
    // Validasi Nomor HP (WAJIB)
    body('no_hp')
        .notEmpty().withMessage('Nomor HP wajib diisi')
        .matches(/^[0-9]{10,15}$/).withMessage('Nomor HP harus 10-15 digit angka')
];

/**
 * Validation rules untuk login
 */
const loginValidation = [
    body('email')
        .isEmail().withMessage('Email tidak valid')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password wajib diisi'),
    
    body('isAdmin')
        .optional()
        .isBoolean().withMessage('isAdmin harus boolean'),
    
    body('isDosen')
        .optional()
        .isBoolean().withMessage('isDosen harus boolean')
];

/**
 * Validation rules untuk pendaftaran magang
 */
const pendaftaranMagangValidation = [
    body('program_studi')
        .notEmpty().withMessage('Program studi wajib diisi'),
    
    body('semester')
        .isInt({ min: 1, max: 14 }).withMessage('Semester harus antara 1-14'),
    
    body('no_hp')
        .matches(/^[0-9]{10,15}$/).withMessage('Nomor HP harus 10-15 digit angka'),
    
    body('domisili')
        .notEmpty().withMessage('Domisili wajib diisi')
        .isLength({ min: 5 }).withMessage('Domisili minimal 5 karakter')
];

/**
 * Validation rules untuk perusahaan magang
 */
const perusahaanMagangValidation = [
    body('nama_perusahaan')
        .notEmpty().withMessage('Nama perusahaan wajib diisi')
        .isLength({ min: 3 }).withMessage('Nama perusahaan minimal 3 karakter'),
    
    body('bidang_perusahaan')
        .notEmpty().withMessage('Bidang perusahaan wajib diisi'),
    
    body('posisi_magang')
        .notEmpty().withMessage('Posisi magang wajib diisi'),
    
    body('durasi_magang')
        .isInt({ min: 1, max: 12 }).withMessage('Durasi magang harus antara 1-12 bulan'),
    
    body('tanggal_mulai')
        .isDate().withMessage('Tanggal mulai tidak valid'),
    
    body('tanggal_selesai')
        .isDate().withMessage('Tanggal selesai tidak valid')
        .custom((value, { req }) => {
            if (new Date(value) <= new Date(req.body.tanggal_mulai)) {
                throw new Error('Tanggal selesai harus setelah tanggal mulai');
            }
            return true;
        }),
    
    body('alamat_perusahaan')
        .notEmpty().withMessage('Alamat perusahaan wajib diisi'),
    
    body('nama_pembimbing_lapangan')
        .notEmpty().withMessage('Nama pembimbing lapangan wajib diisi'),
    
    body('kontak_pembimbing')
        .matches(/^[0-9]{10,15}$/).withMessage('Kontak pembimbing harus 10-15 digit angka'),
    
    body('email_pembimbing')
        .optional()
        .isEmail().withMessage('Email pembimbing tidak valid')
];

/**
 * Validation rules untuk luaran magang
 */
const luaranMagangValidation = [
    body('judul_proyek')
        .notEmpty().withMessage('Judul proyek wajib diisi')
        .isLength({ min: 5 }).withMessage('Judul proyek minimal 5 karakter'),
    
    body('deskripsi_pekerjaan')
        .notEmpty().withMessage('Deskripsi pekerjaan wajib diisi'),
    
    body('link_poster_presentasi')
        .notEmpty().withMessage('Link poster presentasi wajib diisi')
        .isURL().withMessage('Link tidak valid'),
    
    body('link_laporan')
        .notEmpty().withMessage('Link laporan wajib diisi')
        .isURL().withMessage('Link tidak valid'),
    
    body('link_foto_kegiatan')
        .notEmpty().withMessage('Link foto kegiatan wajib diisi')
        .isURL().withMessage('Link tidak valid')
];

/**
 * Handler untuk menangani error validasi
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validasi gagal',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

module.exports = {
    validateEmail,
    validatePassword,
    validateName,
    validateNIM,
    validateNIDN,
    validateNoHP,
    validateProdiId,
    registerValidation,
    loginValidation,
    pendaftaranMagangValidation,
    perusahaanMagangValidation,
    luaranMagangValidation,
    handleValidationErrors
};