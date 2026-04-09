const beritaService = require('../services/beritaService');
const { formatResponse, formatError, formatPaginatedResponse } = require('../utils/responseFormatter');
const fs = require('fs');
const path = require('path');

/**
 * Get all berita with pagination and filtering
 */
const getAllBerita = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            kategori,
            status = 'published',
            search,
            sortBy = 'tanggal_publish',
            sortOrder = 'DESC'
        } = req.query;

        const result = await beritaService.getAllBerita({
            page: parseInt(page),
            limit: parseInt(limit),
            kategori,
            status,
            search,
            sortBy,
            sortOrder
        });

        return res.status(200).json(
            formatPaginatedResponse(
                result.berita,
                page,
                limit,
                result.pagination.totalItems,
                'Data berita berhasil diambil'
            )
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get berita for public (only published)
 */
const getBeritaForPublic = async (req, res, next) => {
    try {
        const {
            page = 1,
            limit = 10,
            kategori,
            search,
            sortBy = 'tanggal_publish',
            sortOrder = 'DESC'
        } = req.query;

        const result = await beritaService.getAllBerita({
            page: parseInt(page),
            limit: parseInt(limit),
            kategori,
            status: 'publish',
            search,
            sortBy,
            sortOrder
        });

        return res.status(200).json(
            formatPaginatedResponse(
                result.berita,
                page,
                limit,
                result.pagination.totalItems,
                'Data berita berhasil diambil'
            )
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get berita by ID
 */
const getBeritaById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const berita = await beritaService.getBeritaById(id);
        
        if (!berita) {
            return res.status(404).json(
                formatError('Berita tidak ditemukan')
            );
        }

        return res.status(200).json(
            formatResponse('success', 'Detail berita berhasil diambil', berita)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get berita by category
 */
const getBeritaByCategory = async (req, res, next) => {
    try {
        const { kategori } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const result = await beritaService.getBeritaByCategory({
            kategori,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        return res.status(200).json(
            formatPaginatedResponse(
                result.berita,
                page,
                limit,
                result.pagination.totalItems,
                `Data berita kategori ${kategori} berhasil diambil`
            )
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get latest berita
 */
const getLatestBerita = async (req, res, next) => {
    try {
        const { limit = 5 } = req.query;
        
        const berita = await beritaService.getLatestBerita(parseInt(limit));
        
        return res.status(200).json(
            formatResponse('success', 'Berita terbaru berhasil diambil', berita)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get trending berita
 */
const getTrendingBerita = async (req, res, next) => {
    try {
        const { limit = 5 } = req.query;
        
        const berita = await beritaService.getTrendingBerita(parseInt(limit));
        
        return res.status(200).json(
            formatResponse('success', 'Berita trending berhasil diambil', berita)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get featured berita
 */
const getFeaturedBerita = async (req, res, next) => {
    try {
        const { limit = 3 } = req.query;
        
        const berita = await beritaService.getFeaturedBerita(parseInt(limit));
        
        return res.status(200).json(
            formatResponse('success', 'Berita unggulan berhasil diambil', berita)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Search berita
 */
const searchBerita = async (req, res, next) => {
    try {
        const {
            q,
            kategori,
            page = 1,
            limit = 10
        } = req.query;

        const result = await beritaService.searchBerita({
            query: q,
            kategori,
            page: parseInt(page),
            limit: parseInt(limit)
        });

        return res.status(200).json(
            formatPaginatedResponse(
                result.berita,
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
 * Get berita statistics
 */
const getBeritaStatistics = async (req, res, next) => {
    try {
        const statistics = await beritaService.getBeritaStatistics();
        
        return res.status(200).json(
            formatResponse('success', 'Statistik berita berhasil diambil', statistics)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Get popular tags
 */
const getPopularTags = async (req, res, next) => {
    try {
        const { limit = 10 } = req.query;
        
        const tags = await beritaService.getPopularTags(parseInt(limit));
        
        return res.status(200).json(
            formatResponse('success', 'Popular tags berhasil diambil', tags)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Increment berita views
 */
const incrementViews = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await beritaService.incrementViews(id);
        
        return res.status(200).json(
            formatResponse('success', 'Views berhasil diupdate')
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Create new berita (admin only)
 */
const createBerita = async (req, res, next) => {
    try {
        const beritaData = {
            judul: req.body.judul,
            isi_berita: req.body.isi_berita,
            kategori: req.body.kategori || 'pengumuman',
            status: req.body.status || 'draft',
            id_admin: req.user.id_user
        };

        if (req.file) {
            beritaData.gambar_thumbnail = `/uploads/berita-umum/${req.file.filename}`;
        }

        const berita = await beritaService.createBerita(beritaData);
        
        return res.status(201).json(
            formatResponse('success', 'Berita berhasil dibuat', berita)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Update berita (admin only)
 */
const updateBerita = async (req, res, next) => {
    try {
        const { id } = req.params;
        const beritaData = {
            judul: req.body.judul,
            isi_berita: req.body.isi_berita,
            kategori: req.body.kategori,
            status: req.body.status
        };

        if (req.file) {
            // Get old berita to delete old image
            const oldBerita = await beritaService.getBeritaById(id);
            if (oldBerita && oldBerita.gambar_thumbnail) {
                const oldImagePath = path.join(__dirname, '..', oldBerita.gambar_thumbnail);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            beritaData.gambar_thumbnail = `/uploads/berita-umum/${req.file.filename}`;
        }

        const berita = await beritaService.updateBerita(id, beritaData);
        
        if (!berita) {
            return res.status(404).json(
                formatError('Berita tidak ditemukan')
            );
        }

        return res.status(200).json(
            formatResponse('success', 'Berita berhasil diupdate', berita)
        );
    } catch (error) {
        next(error);
    }
};

/**
 * Delete berita (admin only)
 */
const deleteBerita = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Get berita to delete image
        const berita = await beritaService.getBeritaById(id);
        if (berita && berita.gambar_thumbnail) {
            const imagePath = path.join(__dirname, '..', berita.gambar_thumbnail);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }
        
        const deleted = await beritaService.deleteBerita(id);
        
        if (!deleted) {
            return res.status(404).json(
                formatError('Berita tidak ditemukan')
            );
        }

        return res.status(200).json(
            formatResponse('success', 'Berita berhasil dihapus')
        );
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAllBerita,
    getBeritaById,
    getBeritaByCategory,
    getLatestBerita,
    getTrendingBerita,
    getFeaturedBerita,
    searchBerita,
    getBeritaStatistics,
    getPopularTags,
    incrementViews,
    createBerita,
    updateBerita,
    deleteBerita,
    getBeritaForPublic
};