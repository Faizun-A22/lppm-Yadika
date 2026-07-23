const repositoryService = require('../../services/dosen/repositoryService');
const { formatResponse, formatError, formatPaginatedResponse } = require('../../utils/responseFormatter');
const { validationResult } = require('express-validator');

/**
 * Get ALL repository documents (public)
 * Tidak membatasi berdasarkan user
 */
const getAllRepository = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            tipe,
            tahun,
            search,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        const result = await repositoryService.getAllRepository({
            page: parseInt(page),
            limit: parseInt(limit),
            tipe,
            tahun,
            search,
            sortBy,
            sortOrder
        });

        return res.status(200).json({
            success: true,
            message: 'Repository berhasil diambil',
            data: result.documents,
            pagination: result.pagination
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user's personal repository (dosen only)
 */
const getUserRepository = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            tipe,
            tahun,
            search,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;
        
        const userId = req.user.id_user;

        const result = await repositoryService.getUserRepository(userId, {
            page: parseInt(page),
            limit: parseInt(limit),
            tipe,
            tahun,
            search,
            sortBy,
            sortOrder
        });

        return res.status(200).json({
            success: true,
            message: 'Repository pribadi berhasil diambil',
            data: result.documents,
            pagination: result.pagination
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get repository by ID (public)
 * Tidak memerlukan kepemilikan untuk VIEW
 */
const getRepositoryById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const document = await repositoryService.getRepositoryById(id);
        
        if (!document) {
            return res.status(404).json(
                formatError('Dokumen tidak ditemukan')
            );
        }

        return res.status(200).json(
            formatResponse('success', 'Detail dokumen berhasil diambil', document)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Search repository (public)
 */
const searchRepository = async (req, res, next) => {
    try {
        const {
            q,
            tipe,
            tahun,
            page = 1,
            limit = 10
        } = req.query;

        const result = await repositoryService.searchRepository({
            query: q,
            tipe,
            tahun,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        return res.status(200).json(
            formatPaginatedResponse(
                result.documents,
                page,
                limit,
                result.pagination.totalItems,
                'Hasil pencarian berhasil diambil'
            )
        );
    } catch (error) {
        next(error);
    }
};

const createRepository = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json(
                formatError('Validasi gagal', errors.array())
            );
        }

        const userId = req.user.id_user;
        const userRole = req.user.role;
        const file = req.file;
        
        // ===== PERBAIKAN DI SINI =====
        // Parse penulis dengan aman
        let penulis = [req.user.nama_lengkap];
        if (req.body.penulis) {
            try {
                const parsed = JSON.parse(req.body.penulis);
                penulis = Array.isArray(parsed) ? parsed : [req.body.penulis];
            } catch (e) {
                // Jika bukan JSON, split by comma
                penulis = req.body.penulis.split(',').map(p => p.trim()).filter(p => p);
                if (penulis.length === 0) penulis = [req.user.nama_lengkap];
            }
        }
        
        // Parse kata_kunci dengan aman
        let kata_kunci = [];
        if (req.body.kata_kunci) {
            try {
                const parsed = JSON.parse(req.body.kata_kunci);
                kata_kunci = Array.isArray(parsed) ? parsed : [req.body.kata_kunci];
            } catch (e) {
                kata_kunci = req.body.kata_kunci.split(',').map(k => k.trim()).filter(k => k);
            }
        }
        
        // Parse additional_data
        let additionalData = {};
        if (req.body.additional_data) {
            try {
                additionalData = JSON.parse(req.body.additional_data);
            } catch (e) {
                additionalData = {};
            }
        }
        // ===== SAMPAI SINI =====

        const repositoryData = {
            judul: req.body.judul,
            tipe: req.body.tipe,
            tahun: parseInt(req.body.tahun),
            penulis: penulis,
            abstrak: req.body.abstrak,
            kata_kunci: kata_kunci,
            visibility: req.body.visibility || 'public',
            uploaded_by_role: userRole,
            ...additionalData
        };

        const result = await repositoryService.createRepository(userId, repositoryData, file);

        if (!result.success) {
            return res.status(400).json(
                formatError(result.message)
            );
        }

        return res.status(201).json(
            formatResponse('success', 'Repository berhasil dibuat', result.data)
        );
    } catch (error) {
        next(error);
    }
};

const updateRepository = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_user;
        const file = req.file;
        
        // Parse dengan aman
        let penulis, kata_kunci, additionalData = {};
        
        if (req.body.penulis) {
            try {
                penulis = JSON.parse(req.body.penulis);
            } catch (e) {
                penulis = req.body.penulis.split(',').map(p => p.trim()).filter(p => p);
            }
        }
        
        if (req.body.kata_kunci) {
            try {
                kata_kunci = JSON.parse(req.body.kata_kunci);
            } catch (e) {
                kata_kunci = req.body.kata_kunci.split(',').map(k => k.trim()).filter(k => k);
            }
        }
        
        if (req.body.additional_data) {
            try {
                additionalData = JSON.parse(req.body.additional_data);
            } catch (e) {
                additionalData = {};
            }
        }

        const updateData = {
            judul: req.body.judul,
            tipe: req.body.tipe,
            tahun: req.body.tahun ? parseInt(req.body.tahun) : undefined,
            penulis,
            abstrak: req.body.abstrak,
            kata_kunci,
            visibility: req.body.visibility,
            ...additionalData
        };

        // Remove undefined fields
        Object.keys(updateData).forEach(key => 
            updateData[key] === undefined && delete updateData[key]
        );

        const result = await repositoryService.updateRepository(id, userId, updateData, file);

        if (!result.success) {
            return res.status(result.status || 400).json(
                formatError(result.message)
            );
        }

        return res.status(200).json(
            formatResponse('success', 'Repository berhasil diperbarui', result.data)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Delete repository
 * Hanya pemilik yang bisa delete
 */
const deleteRepository = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_user;

        const result = await repositoryService.deleteRepository(id, userId);

        if (!result.success) {
            return res.status(result.status || 400).json(
                formatError(result.message)
            );
        }

        return res.status(200).json(
            formatResponse('success', 'Repository berhasil dihapus')
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get public statistics (all documents)
 */
const getPublicStatistics = async (req, res, next) => {
    try {
        const statistics = await repositoryService.getPublicStatistics();
        
        return res.status(200).json({
            success: true,
            message: 'Statistik berhasil diambil',
            data: statistics
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get statistics for current user (personal)
 */
const getMyStatistics = async (req, res, next) => {
    try {
        const userId = req.user.id_user;
        const statistics = await repositoryService.getUserStatistics(userId);
        
        return res.status(200).json({
            success: true,
            message: 'Statistik pribadi berhasil diambil',
            data: statistics
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get popular tags (global)
 */
const getPopularTags = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;
        
        const tags = await repositoryService.getPopularTags(parseInt(limit));
        
        return res.status(200).json({
            success: true,
            message: 'Popular tags berhasil diambil',
            data: tags
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Increment views
 */
const incrementViews = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await repositoryService.incrementViews(id);
        
        return res.status(200).json({
            success: true,
            message: 'Views berhasil diupdate'
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Download document
 */
const downloadDocument = async (req, res, next) => {
    try {
        const { id } = req.params;

        const result = await repositoryService.downloadDocument(id);

        if (!result.success) {
            return res.status(404).json(
                formatError(result.message)
            );
        }

        await repositoryService.incrementDownloads(id);

        return res.download(result.filepath, result.filename);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllRepository,
    getUserRepository,
    getRepositoryById,
    searchRepository,
    createRepository,
    updateRepository,
    deleteRepository,
    getPublicStatistics,
    getMyStatistics,
    getPopularTags,
    incrementViews,
    downloadDocument
};