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

const getFileUrl = (filePath) => {
    if (!filePath) return null;
    // Assuming server runs on localhost:3000
    return `http://localhost:3000/${filePath.replace(/\\/g, '/')}`;
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