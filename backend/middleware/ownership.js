// middleware/ownership.js
const repositoryService = require('../services/dosen/repositoryService');

async function checkRepositoryOwnership(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id_user;
        
        const document = await repositoryService.getRepositoryById(id);
        
        if (!document) {
            return res.status(404).json({
                success: false,
                message: 'Dokumen tidak ditemukan'
            });
        }
        
        // Cek apakah user adalah pemilik atau admin
        if (document.uploaded_by !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Anda tidak memiliki izin untuk mengubah dokumen ini'
            });
        }
        
        req.document = document;
        next();
    } catch (error) {
        next(error);
    }
}

module.exports = {
    checkRepositoryOwnership
};