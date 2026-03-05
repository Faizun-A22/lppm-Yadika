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

/**
 * Create new repository entry
 * Hanya user yang terautentikasi bisa upload
 */
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
        
        // Parse JSON fields
        const penulis = req.body.penulis ? JSON.parse(req.body.penulis) : [req.user.nama_lengkap];
        const kata_kunci = req.body.kata_kunci ? JSON.parse(req.body.kata_kunci) : [];
        
        // Parse additional data based on type
        let additionalData = {};
        if (req.body.additional_data) {
            additionalData = JSON.parse(req.body.additional_data);
        }

        const repositoryData = {
            judul: req.body.judul,
            tipe: req.body.tipe,
            tahun: parseInt(req.body.tahun),
            penulis: penulis,
            abstrak: req.body.abstrak,
            kata_kunci: kata_kunci,
            visibility: req.body.visibility || 'public',
            uploaded_by_role: userRole, // Simpan role uploader
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

/**
 * Update repository
 * Hanya pemilik yang bisa update
 */
const updateRepository = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_user;
        const file = req.file;
        
        // Parse JSON fields if they exist
        let penulis, kata_kunci, additionalData = {};
        
        if (req.body.penulis) {
            penulis = JSON.parse(req.body.penulis);
        }
        
        if (req.body.kata_kunci) {
            kata_kunci = JSON.parse(req.body.kata_kunci);
        }
        
        if (req.body.additional_data) {
            additionalData = JSON.parse(req.body.additional_data);
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