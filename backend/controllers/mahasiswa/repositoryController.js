const repositoryService = require('../../services/mahasiswa/repositoryService');
const { 
    formatResponse, 
    formatError, 
    formatPaginatedResponse 
} = require('../../utils/responseFormatter');
const { validationResult } = require('express-validator');

/**
 * Get repository list with filtering and pagination
 */
const getRepository = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            kategori,
            tahun,
            search,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        const result = await repositoryService.getRepository({
            page: parseInt(page),
            limit: parseInt(limit),
            kategori,
            tahun,
            search,
            sortBy,
            sortOrder
        });

        return res.status(200).json(
            formatPaginatedResponse(
                result.documents,
                page,
                limit,
                result.pagination.totalItems,
                'Repository berhasil diambil'
            )
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get repository by ID
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

        // Increment views
        await repositoryService.incrementViews(id);

        return res.status(200).json(
            formatResponse('success', 'Detail dokumen berhasil diambil', document)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Search repository with advanced filters
 */
const searchRepository = async (req, res, next) => {
    try {
        const {
            q,
            kategori,
            tahun,
            penulis,
            page = 1,
            limit = 10
        } = req.query;

        const result = await repositoryService.searchRepository({
            query: q,
            kategori,
            tahun,
            penulis,
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
 * Get repository statistics
 */
const getStatistics = async (req, res, next) => {
    try {
        const statistics = await repositoryService.getStatistics();
        
        return res.status(200).json(
            formatResponse('success', 'Statistik berhasil diambil', statistics)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get popular tags from repository
 */
const getPopularTags = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;
        
        const tags = await repositoryService.getPopularTags(parseInt(limit));
        
        return res.status(200).json(
            formatResponse('success', 'Popular tags berhasil diambil', tags)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Download document and increment download count
 */
const downloadDocument = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id_user;

        const result = await repositoryService.downloadDocument(id, userId);

        if (!result.success) {
            return res.status(404).json(
                formatError(result.message)
            );
        }

        // Increment download count
        await repositoryService.incrementDownloads(id);

        // Send file for download
        return res.download(result.filepath, result.filename);
    } catch (error) {
        next(error);
    }
};

/**
 * Increment document views
 */
const incrementViews = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await repositoryService.incrementViews(id);
        
        return res.status(200).json(
            formatResponse('success', 'Views berhasil diupdate')
        );
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getRepository,
    getRepositoryById,
    searchRepository,
    getStatistics,
    getPopularTags,
    downloadDocument,
    incrementViews
};