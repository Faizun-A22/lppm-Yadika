const { validationResult } = require('express-validator');
const kegiatanService = require('../../services/admin/kegiatanService');

// @desc    Get all kegiatan
// @route   GET /api/admin/kegiatan
exports.getAllKegiatan = async (req, res) => {
    try {
        const filters = {
            search: req.query.search || '',
            jenis: req.query.jenis || '',
            status: req.query.status || '',
            bulan: req.query.bulan || '',
            sortBy: req.query.sortBy || 'created_at',
            sortOrder: req.query.sortOrder || 'desc'
        };

        const pagination = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 10
        };

        const result = await kegiatanService.getAllKegiatan(filters, pagination);

        // Add poster URLs
        const dataWithUrls = result.data.map(item => ({
            ...item,
            poster_url: item.poster ? 
                `${req.protocol}://${req.get('host')}/uploads/kegiatan/${item.poster}` : null,
            admin_name: item.admin?.nama_lengkap || null
        }));

        res.json({
            success: true,
            data: dataWithUrls,
            pagination: result.pagination
        });

    } catch (error) {
        console.error('Error in getAllKegiatan:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data kegiatan',
            error: error.message
        });
    }
};

// @desc    Get kegiatan by ID
// @route   GET /api/admin/kegiatan/:id
exports.getKegiatanById = async (req, res) => {
    try {
        const { id } = req.params;
        const kegiatan = await kegiatanService.getKegiatanById(id);

        // Format response
        const formattedKegiatan = {
            ...kegiatan,
            poster_url: kegiatan.poster ? 
                `${req.protocol}://${req.get('host')}/uploads/kegiatan/${kegiatan.poster}` : null,
            admin_name: kegiatan.admin?.nama_lengkap || null
        };

        res.json({
            success: true,
            data: formattedKegiatan
        });

    } catch (error) {
        console.error('Error in getKegiatanById:', error);
        res.status(error.message === 'Kegiatan tidak ditemukan' ? 404 : 500).json({
            success: false,
            message: error.message || 'Gagal mengambil data kegiatan'
        });
    }
};

// @desc    Create new kegiatan
// @route   POST /api/admin/kegiatan
exports.createKegiatan = async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.file) {
                kegiatanService.deleteFile(req.file.path);
            }
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: errors.array()
            });
        }

        const kegiatan = await kegiatanService.createKegiatan(req.body, req.file, req.user.id_user);

        // Format response
        const formattedKegiatan = {
            ...kegiatan,
            poster_url: kegiatan.poster ? 
                `${req.protocol}://${req.get('host')}/uploads/kegiatan/${kegiatan.poster}` : null
        };

        res.status(201).json({
            success: true,
            message: 'Kegiatan berhasil dibuat',
            data: formattedKegiatan
        });

    } catch (error) {
        console.error('Error in createKegiatan:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal membuat kegiatan'
        });
    }
};

// @desc    Update kegiatan
// @route   PUT /api/admin/kegiatan/:id
exports.updateKegiatan = async (req, res) => {
    try {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            if (req.file) {
                kegiatanService.deleteFile(req.file.path);
            }
            return res.status(400).json({
                success: false,
                message: 'Validasi gagal',
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const kegiatan = await kegiatanService.updateKegiatan(id, req.body, req.file, req.user.id_user);

        // Format response
        const formattedKegiatan = {
            ...kegiatan,
            poster_url: kegiatan.poster ? 
                `${req.protocol}://${req.get('host')}/uploads/kegiatan/${kegiatan.poster}` : null
        };

        res.json({
            success: true,
            message: 'Kegiatan berhasil diupdate',
            data: formattedKegiatan
        });

    } catch (error) {
        console.error('Error in updateKegiatan:', error);
        res.status(error.message === 'Kegiatan tidak ditemukan' ? 404 : 500).json({
            success: false,
            message: error.message || 'Gagal mengupdate kegiatan'
        });
    }
};

// @desc    Delete kegiatan
// @route   DELETE /api/admin/kegiatan/:id
exports.deleteKegiatan = async (req, res) => {
    try {
        const { id } = req.params;
        const kegiatan = await kegiatanService.deleteKegiatan(id, req.user.id_user);

        res.json({
            success: true,
            message: 'Kegiatan berhasil dihapus',
            data: { nama: kegiatan.nama_kegiatan }
        });

    } catch (error) {
        console.error('Error in deleteKegiatan:', error);
        res.status(error.message === 'Kegiatan tidak ditemukan' ? 404 : 500).json({
            success: false,
            message: error.message || 'Gagal menghapus kegiatan'
        });
    }
};

// @desc    Get kegiatan stats
// @route   GET /api/admin/kegiatan/stats
exports.getKegiatanStats = async (req, res) => {
    try {
        const stats = await kegiatanService.getKegiatanStats();

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Error in getKegiatanStats:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil statistik kegiatan',
            error: error.message
        });
    }
};

// @desc    Update kegiatan status
// @route   PATCH /api/admin/kegiatan/:id/status
exports.updateKegiatanStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const kegiatan = await kegiatanService.updateKegiatanStatus(id, status, req.user.id_user);

        res.json({
            success: true,
            message: 'Status kegiatan berhasil diupdate',
            data: kegiatan
        });

    } catch (error) {
        console.error('Error in updateKegiatanStatus:', error);
        res.status(error.message === 'Kegiatan tidak ditemukan' ? 404 : 500).json({
            success: false,
            message: error.message || 'Gagal mengupdate status kegiatan'
        });
    }
};

// @desc    Get calendar data
// @route   GET /api/admin/kegiatan/calendar
exports.getCalendarData = async (req, res) => {
    try {
        const { month, year } = req.query;
        const calendarData = await kegiatanService.getCalendarData(month, year);

        res.json({
            success: true,
            data: calendarData
        });

    } catch (error) {
        console.error('Error in getCalendarData:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data kalender',
            error: error.message
        });
    }
};