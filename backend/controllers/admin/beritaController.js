const { validationResult } = require('express-validator');
const beritaService = require('../../services/admin/beritaService');

// @desc    Get all berita
// @route   GET /api/admin/berita
exports.getAllBerita = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || '',
            kategori: req.query.kategori || '',
            status: req.query.status || '',
            sortBy: req.query.sortBy || 'created_at',
            sortOrder: req.query.sortOrder || 'desc'
        };

        const pagination = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10
        };

        const result = await beritaService.getAllBerita(filters, pagination);

        // Add thumbnail URLs
        const dataWithUrls = result.data.map(item => ({
            ...item,
            thumbnail_url: item.gambar_thumbnail ? 
                `${req.protocol}://${req.get('host')}/uploads/berita/${item.gambar_thumbnail}` : null,
            admin_name: item.admin?.nama_lengkap || null
        }));

        res.json({
            success: true,
            data: dataWithUrls,
            pagination: result.pagination
        });

    } catch (error) {
        console.error('Error in getAllBerita:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data berita',
            error: error.message
        });
    }
};

// @desc    Get berita by ID
// @route   GET /api/admin/berita/:id
exports.getBeritaById = async (req, res) => {
    try {
        const { id } = req.params;
        const berita = await beritaService.getBeritaById(id);

        // Format response
        const formattedBerita = {
            ...berita,
            thumbnail_url: berita.gambar_thumbnail ? 
                `${req.protocol}://${req.get('host')}/uploads/berita/${berita.gambar_thumbnail}` : null,
            admin_name: berita.admin?.nama_lengkap || null
        };

        res.json({
            success: true,
            data: formattedBerita
        });

    } catch (error) {
        console.error('Error in getBeritaById:', error);
        res.status(error.message === 'Berita tidak ditemukan' ? 404 : 500).json({
            success: false,
            message: error.message || 'Gagal mengambil data berita'
        });
    }
};

// @desc    Create new berita
// @route   POST /api/admin/berita
exports.createBerita = async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.file) {
                beritaService.deleteFile(req.file.path);
            }
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: errors.array()
            });
        }

        const berita = await beritaService.createBerita(req.body, req.file, req.user.id_user);

        // Format response
        const formattedBerita = {
            ...berita,
            thumbnail_url: berita.gambar_thumbnail ? 
                `${req.protocol}://${req.get('host')}/uploads/berita/${berita.gambar_thumbnail}` : null
        };

        res.status(201).json({
            success: true,
            message: 'Berita berhasil dibuat',
            data: formattedBerita
        });

    } catch (error) {
        console.error('Error in createBerita:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal membuat berita'
        });
    }
};

// @desc    Update berita
// @route   PUT /api/admin/berita/:id
exports.updateBerita = async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.file) {
                beritaService.deleteFile(req.file.path);
            }
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const berita = await beritaService.updateBerita(id, req.body, req.file, req.user.id_user);

        // Format response
        const formattedBerita = {
            ...berita,
            thumbnail_url: berita.gambar_thumbnail ? 
                `${req.protocol}://${req.get('host')}/uploads/berita/${berita.gambar_thumbnail}` : null
        };

        res.json({
            success: true,
            message: 'Berita berhasil diupdate',
            data: formattedBerita
        });

    } catch (error) {
        console.error('Error in updateBerita:', error);
        res.status(error.message === 'Berita tidak ditemukan' ? 404 : 500).json({
            success: false,
            message: error.message || 'Gagal mengupdate berita'
        });
    }
};

// @desc    Delete berita
// @route   DELETE /api/admin/berita/:id
exports.deleteBerita = async (req, res) => {
    try {
        const { id } = req.params;
        const berita = await beritaService.deleteBerita(id, req.user.id_user);

        res.json({
            success: true,
            message: 'Berita berhasil dihapus',
            data: { judul: berita.judul }
        });

    } catch (error) {
        console.error('Error in deleteBerita:', error);
        res.status(error.message === 'Berita tidak ditemukan' ? 404 : 500).json({
            success: false,
            message: error.message || 'Gagal menghapus berita'
        });
    }
};

// @desc    Bulk delete berita
// @route   POST /api/admin/berita/bulk-delete
exports.bulkDeleteBerita = async (req, res) => {
    try {
        const { ids } = req.body;
        const count = await beritaService.bulkDeleteBerita(ids, req.user.id_user);

        res.json({
            success: true,
            message: `${count} berita berhasil dihapus`
        });

    } catch (error) {
        console.error('Error in bulkDeleteBerita:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal menghapus berita'
        });
    }
};

// @desc    Update status berita
// @route   PATCH /api/admin/berita/:id/status
exports.updateStatusBerita = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const berita = await beritaService.updateStatusBerita(id, status, req.user.id_user);

        res.json({
            success: true,
            message: 'Status berita berhasil diupdate',
            data: berita
        });

    } catch (error) {
        console.error('Error in updateStatusBerita:', error);
        res.status(error.message === 'Berita tidak ditemukan' ? 404 : 500).json({
            success: false,
            message: error.message || 'Gagal mengupdate status berita'
        });
    }
};

// @desc    Get berita stats
// @route   GET /api/admin/berita/stats
exports.getBeritaStats = async (req, res) => {
    try {
        const stats = await beritaService.getBeritaStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error in getBeritaStats:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil statistik berita',
            error: error.message
        });
    }
};