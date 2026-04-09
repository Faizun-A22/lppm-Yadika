const repositoryService = require('../services/repositoryService');
const { 
    formatResponse, 
    formatError, 
    formatPaginatedResponse 
} = require('../utils/responseFormatter');

/**
 * Get journals list with filtering and pagination
 */
const getJournals = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            jenis_jurnal,
            tahun,
            search,
            sortBy = 'created_at',
            sortOrder = 'DESC'
        } = req.query;

        const result = await repositoryService.getJournals({
            page: parseInt(page),
            limit: parseInt(limit),
            jenis_jurnal,
            tahun: tahun ? parseInt(tahun) : null,
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
                'Data jurnal berhasil diambil'
            )
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get journal by ID
 */
const getJournalById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const journal = await repositoryService.getJournalById(id);
        
        if (!journal) {
            return res.status(404).json(
                formatError('Jurnal tidak ditemukan')
            );
        }

        // Increment views
        await repositoryService.incrementViews(id);

        return res.status(200).json(
            formatResponse('success', 'Detail jurnal berhasil diambil', journal)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get journals by type (spirit/josiati)
 */
const getJournalsByType = async (req, res, next) => {
    try {
        const { type } = req.params;
        const { page = 1, limit = 10 } = req.query;

        // Map type to jenis_jurnal ID
        let jenisJurnalId = null;
        if (type === 'spirit') {
            jenisJurnalId = 'spirit-uuid'; // Ganti dengan UUID sebenarnya
        } else if (type === 'josiati') {
            jenisJurnalId = 'josiati-uuid'; // Ganti dengan UUID sebenarnya
        }

        const result = await repositoryService.getJournalsByType({
            jenis_jurnal_id: jenisJurnalId,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        return res.status(200).json(
            formatPaginatedResponse(
                result.documents,
                page,
                limit,
                result.pagination.totalItems,
                'Data jurnal berhasil diambil'
            )
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Search journals with advanced filters
 */
const searchJournals = async (req, res, next) => {
    try {
        const {
            q,
            jenis_jurnal,
            tahun,
            penulis,
            page = 1,
            limit = 10
        } = req.query;

        const result = await repositoryService.searchJournals({
            query: q,
            jenis_jurnal,
            tahun: tahun ? parseInt(tahun) : null,
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
 * Get journal statistics
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
 * Get popular tags/keywords from journals
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
 * Get top authors
 */
const getTopAuthors = async (req, res, next) => {
    try {
        const { limit = 5 } = req.query;
        
        const authors = await repositoryService.getTopAuthors(parseInt(limit));
        
        return res.status(200).json(
            formatResponse('success', 'Top authors berhasil diambil', authors)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get available years
 */
const getYears = async (req, res, next) => {
    try {
        const years = await repositoryService.getYears();
        
        return res.status(200).json(
            formatResponse('success', 'Tahun publikasi berhasil diambil', years)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Download journal and increment download count
 */
const downloadJournal = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id_user;

        const result = await repositoryService.downloadJournal(id, userId);

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
 * Increment journal views
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
    getJournals,
    getJournalById,
    getJournalsByType,
    searchJournals,
    getStatistics,
    getPopularTags,
    getTopAuthors,
    getYears,
    downloadJournal,
    incrementViews
};