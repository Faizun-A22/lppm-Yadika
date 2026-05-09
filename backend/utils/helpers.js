// utils/helpers.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
};

const generateToken = (userId, role) => {
    return jwt.sign(
        { userId, role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
};

const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

/**
 * Mendapatkan URL publik untuk file
 * @param {string} filePath - Path file dari database (contoh: "magang/krs/nama-file.jpg")
 * @returns {string|null} - URL lengkap atau null
 */
// utils/helpers.js

/**
 * Mendapatkan URL publik untuk file
 * @param {string} filePath - Path file dari database
 * @returns {string|null} - URL lengkap atau null
 */

// utils/helpers.js
const getFileUrl = (filePath) => {
    if (!filePath) return null;
    
    // Jika sudah URL lengkap, return langsung
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
        return filePath;
    }
    
    // Hapus 'uploads/' duplikat jika ada
    let cleanPath = filePath;
    if (cleanPath.startsWith('uploads/')) {
        cleanPath = cleanPath.substring('uploads/'.length);
    }
    if (cleanPath.startsWith('uploads\\')) {
        cleanPath = cleanPath.substring('uploads\\'.length);
    }
    
    // Hapus double uploads
    cleanPath = cleanPath.replace(/^uploads[\/\\]/, '');
    cleanPath = cleanPath.replace(/[\/\\]uploads[\/\\]/, '/');
    cleanPath = cleanPath.replace(/\\/g, '/');
    
    // Encode untuk keamanan
    cleanPath = cleanPath.split('/').map(part => encodeURIComponent(part)).join('/');
    
    // Gunakan base URL tanpa /api
    const baseUrl = process.env.API_BASE_URL || 'http://103.189.234.236';
    
    // Langsung ke /uploads/, BUKAN /api/uploads/
    return `${baseUrl}/uploads/${cleanPath}`;
};

const updateMagangStatus = async (supabase, id_magang, status_magang) => {
    const { error } = await supabase
        .from('magang')
        .update({ status_magang })
        .eq('id_magang', id_magang);

    if (error) throw error;
};

module.exports = {
    hashPassword,
    comparePassword,
    generateToken,
    formatDate,
    getFileUrl,
    updateMagangStatus
};
