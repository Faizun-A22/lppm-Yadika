// controllers/admin/penelitianController.js
const penelitianService = require('../../services/admin/penelitianService');
const { formatResponse, formatError, formatPaginatedResponse } = require('../../utils/responseFormatter');
const { getFileUrl } = require('../../utils/helpers');

/**
 * Controller untuk manajemen penelitian
 * 
 * SEMUA FUNGSI TELAH DIPERBARUI:
 * - Menghilangkan penggunaan .select() dengan relasi kompleks
 * - Menggunakan query sederhana terlebih dahulu
 * - Error handling yang lebih baik
 */

// ==================== PENELITIAN CONTROLLERS ====================

const getAllPenelitian = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, tahun, skema, search } = req.query;
        const userId = req.user.role === 'dosen' ? req.user.id_user : null;
        
        const result = await penelitianService.getAllPenelitian({
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            tahun,
            skema,
            search,
            userId
        });
        
        // Format file URLs jika ada
        const formattedData = (result.data || []).map(item => ({
            ...item,
            file_proposal_url: item.file_proposal ? getFileUrl(item.file_proposal) : null,
            file_laporan_kemajuan_url: item.file_laporan_kemajuan ? getFileUrl(item.file_laporan_kemajuan) : null,
            file_laporan_akhir_url: item.file_laporan_akhir ? getFileUrl(item.file_laporan_akhir) : null
        }));
        
        res.json(formatPaginatedResponse(
            formattedData,
            result.pagination?.page || parseInt(page),
            result.pagination?.limit || parseInt(limit),
            result.pagination?.total || 0,
            'Data penelitian berhasil diambil'
        ));
    } catch (error) {
        console.error('Error in getAllPenelitian:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil data penelitian'));
    }
};

const getPenelitianById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.role === 'dosen' ? req.user.id_user : null;
        
        const penelitian = await penelitianService.getPenelitianById(id, userId);
        
        if (!penelitian) {
            return res.status(404).json(formatError('Penelitian tidak ditemukan'));
        }
        
        // Format file URLs
        const result = {
            ...penelitian,
            file_proposal_url: penelitian.file_proposal ? getFileUrl(penelitian.file_proposal) : null,
            file_laporan_kemajuan_url: penelitian.file_laporan_kemajuan ? getFileUrl(penelitian.file_laporan_kemajuan) : null,
            file_laporan_akhir_url: penelitian.file_laporan_akhir ? getFileUrl(penelitian.file_laporan_akhir) : null
        };
        
        res.json(formatResponse('success', 'Data penelitian berhasil diambil', result));
    } catch (error) {
        console.error('Error in getPenelitianById:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil detail penelitian'));
    }
};

const createPenelitian = async (req, res, next) => {
    try {
        const penelitianData = {
            ...req.body,
            id_ketua: req.body.id_ketua || req.user.id_user,
            created_by: req.user.id_user
        };
        
        // Handle file uploads
        if (req.files) {
            if (req.files.file_proposal) {
                penelitianData.file_proposal = req.files.file_proposal[0].path;
            }
            if (req.files.file_laporan_kemajuan) {
                penelitianData.file_laporan_kemajuan = req.files.file_laporan_kemajuan[0].path;
            }
            if (req.files.file_laporan_akhir) {
                penelitianData.file_laporan_akhir = req.files.file_laporan_akhir[0].path;
            }
        }
        
        // Parse anggota if sent as JSON string
        if (req.body.anggota && typeof req.body.anggota === 'string') {
            try {
                penelitianData.anggota = JSON.parse(req.body.anggota);
            } catch (e) {
                penelitianData.anggota = [];
            }
        }
        
        const newPenelitian = await penelitianService.createPenelitian(penelitianData);
        
        res.status(201).json(formatResponse('success', 'Penelitian berhasil dibuat', newPenelitian));
    } catch (error) {
        console.error('Error in createPenelitian:', error);
        res.status(500).json(formatError(error.message || 'Gagal membuat penelitian'));
    }
};

const updatePenelitian = async (req, res, next) => {
    try {
        const { id } = req.params;
        const penelitianData = {
            ...req.body,
            updated_by: req.user.id_user
        };
        
        // Handle file uploads
        if (req.files) {
            if (req.files.file_proposal) {
                penelitianData.file_proposal = req.files.file_proposal[0].path;
            }
            if (req.files.file_laporan_kemajuan) {
                penelitianData.file_laporan_kemajuan = req.files.file_laporan_kemajuan[0].path;
            }
            if (req.files.file_laporan_akhir) {
                penelitianData.file_laporan_akhir = req.files.file_laporan_akhir[0].path;
            }
        }
        
        // Parse anggota if sent as JSON string
        if (req.body.anggota && typeof req.body.anggota === 'string') {
            try {
                penelitianData.anggota = JSON.parse(req.body.anggota);
            } catch (e) {
                penelitianData.anggota = [];
            }
        }
        
        const updatedPenelitian = await penelitianService.updatePenelitian(id, penelitianData, req.user.id_user);
        
        if (!updatedPenelitian) {
            return res.status(404).json(formatError('Penelitian tidak ditemukan'));
        }
        
        res.json(formatResponse('success', 'Penelitian berhasil diupdate', updatedPenelitian));
    } catch (error) {
        console.error('Error in updatePenelitian:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengupdate penelitian'));
    }
};

const deletePenelitian = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const deleted = await penelitianService.deletePenelitian(id, req.user.id_user);
        
        if (!deleted) {
            return res.status(404).json(formatError('Penelitian tidak ditemukan'));
        }
        
        res.json(formatResponse('success', 'Penelitian berhasil dihapus'));
    } catch (error) {
        console.error('Error in deletePenelitian:', error);
        res.status(500).json(formatError(error.message || 'Gagal menghapus penelitian'));
    }
};

const submitPenelitian = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await penelitianService.submitPenelitian(id, req.user.id_user);
        
        res.json(formatResponse('success', 'Penelitian berhasil disubmit untuk review', result));
    } catch (error) {
        console.error('Error in submitPenelitian:', error);
        res.status(500).json(formatError(error.message || 'Gagal submit penelitian'));
    }
};

const updateStatusPenelitian = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, catatan } = req.body;
        
        const result = await penelitianService.updateStatusPenelitian(id, status, catatan, req.user.id_user);
        
        res.json(formatResponse('success', `Status penelitian berhasil diupdate menjadi ${status}`, result));
    } catch (error) {
        console.error('Error in updateStatusPenelitian:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengupdate status penelitian'));
    }
};

const getReviewHistory = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const reviews = await penelitianService.getReviewHistory(id);
        
        res.json(formatResponse('success', 'Riwayat review berhasil diambil', reviews || []));
    } catch (error) {
        console.error('Error in getReviewHistory:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil riwayat review'));
    }
};

// ==================== PENGABDIAN CONTROLLERS ====================

const getAllPengabdian = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, tahun, skema, search } = req.query;
        const userId = req.user.role === 'dosen' ? req.user.id_user : null;
        
        const result = await penelitianService.getAllPengabdian({
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            tahun,
            skema,
            search,
            userId
        });
        
        // Format file URLs
        const formattedData = (result.data || []).map(item => ({
            ...item,
            file_proposal_url: item.file_proposal ? getFileUrl(item.file_proposal) : null,
            file_laporan_kemajuan_url: item.file_laporan_kemajuan ? getFileUrl(item.file_laporan_kemajuan) : null,
            file_laporan_akhir_url: item.file_laporan_akhir ? getFileUrl(item.file_laporan_akhir) : null
        }));
        
        res.json(formatPaginatedResponse(
            formattedData,
            result.pagination?.page || parseInt(page),
            result.pagination?.limit || parseInt(limit),
            result.pagination?.total || 0,
            'Data pengabdian berhasil diambil'
        ));
    } catch (error) {
        console.error('Error in getAllPengabdian:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil data pengabdian'));
    }
};

const getPengabdianById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.role === 'dosen' ? req.user.id_user : null;
        
        const pengabdian = await penelitianService.getPengabdianById(id, userId);
        
        if (!pengabdian) {
            return res.status(404).json(formatError('Pengabdian tidak ditemukan'));
        }
        
        // Format file URLs
        const result = {
            ...pengabdian,
            file_proposal_url: pengabdian.file_proposal ? getFileUrl(pengabdian.file_proposal) : null,
            file_laporan_kemajuan_url: pengabdian.file_laporan_kemajuan ? getFileUrl(pengabdian.file_laporan_kemajuan) : null,
            file_laporan_akhir_url: pengabdian.file_laporan_akhir ? getFileUrl(pengabdian.file_laporan_akhir) : null
        };
        
        res.json(formatResponse('success', 'Data pengabdian berhasil diambil', result));
    } catch (error) {
        console.error('Error in getPengabdianById:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil detail pengabdian'));
    }
};

const createPengabdian = async (req, res, next) => {
    try {
        const pengabdianData = {
            ...req.body,
            id_ketua: req.body.id_ketua || req.user.id_user,
            created_by: req.user.id_user
        };
        
        // Handle file uploads
        if (req.files) {
            if (req.files.file_proposal) {
                pengabdianData.file_proposal = req.files.file_proposal[0].path;
            }
            if (req.files.file_laporan_kemajuan) {
                pengabdianData.file_laporan_kemajuan = req.files.file_laporan_kemajuan[0].path;
            }
            if (req.files.file_laporan_akhir) {
                pengabdianData.file_laporan_akhir = req.files.file_laporan_akhir[0].path;
            }
        }
        
        // Parse anggota if sent as JSON string
        if (req.body.anggota && typeof req.body.anggota === 'string') {
            try {
                pengabdianData.anggota = JSON.parse(req.body.anggota);
            } catch (e) {
                pengabdianData.anggota = [];
            }
        }
        
        const newPengabdian = await penelitianService.createPengabdian(pengabdianData);
        
        res.status(201).json(formatResponse('success', 'Pengabdian berhasil dibuat', newPengabdian));
    } catch (error) {
        console.error('Error in createPengabdian:', error);
        res.status(500).json(formatError(error.message || 'Gagal membuat pengabdian'));
    }
};

const updatePengabdian = async (req, res, next) => {
    try {
        const { id } = req.params;
        const pengabdianData = {
            ...req.body,
            updated_by: req.user.id_user
        };
        
        // Handle file uploads
        if (req.files) {
            if (req.files.file_proposal) {
                pengabdianData.file_proposal = req.files.file_proposal[0].path;
            }
            if (req.files.file_laporan_kemajuan) {
                pengabdianData.file_laporan_kemajuan = req.files.file_laporan_kemajuan[0].path;
            }
            if (req.files.file_laporan_akhir) {
                pengabdianData.file_laporan_akhir = req.files.file_laporan_akhir[0].path;
            }
        }
        
        // Parse anggota if sent as JSON string
        if (req.body.anggota && typeof req.body.anggota === 'string') {
            try {
                pengabdianData.anggota = JSON.parse(req.body.anggota);
            } catch (e) {
                pengabdianData.anggota = [];
            }
        }
        
        const updatedPengabdian = await penelitianService.updatePengabdian(id, pengabdianData, req.user.id_user);
        
        if (!updatedPengabdian) {
            return res.status(404).json(formatError('Pengabdian tidak ditemukan'));
        }
        
        res.json(formatResponse('success', 'Pengabdian berhasil diupdate', updatedPengabdian));
    } catch (error) {
        console.error('Error in updatePengabdian:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengupdate pengabdian'));
    }
};

const deletePengabdian = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const deleted = await penelitianService.deletePengabdian(id, req.user.id_user);
        
        if (!deleted) {
            return res.status(404).json(formatError('Pengabdian tidak ditemukan'));
        }
        
        res.json(formatResponse('success', 'Pengabdian berhasil dihapus'));
    } catch (error) {
        console.error('Error in deletePengabdian:', error);
        res.status(500).json(formatError(error.message || 'Gagal menghapus pengabdian'));
    }
};

const submitPengabdian = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await penelitianService.submitPengabdian(id, req.user.id_user);
        
        res.json(formatResponse('success', 'Pengabdian berhasil disubmit untuk review', result));
    } catch (error) {
        console.error('Error in submitPengabdian:', error);
        res.status(500).json(formatError(error.message || 'Gagal submit pengabdian'));
    }
};

const updateStatusPengabdian = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, catatan } = req.body;
        
        const result = await penelitianService.updateStatusPengabdian(id, status, catatan, req.user.id_user);
        
        res.json(formatResponse('success', `Status pengabdian berhasil diupdate menjadi ${status}`, result));
    } catch (error) {
        console.error('Error in updateStatusPengabdian:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengupdate status pengabdian'));
    }
};

// ==================== REVIEW CONTROLLERS ====================

const addReview = async (req, res, next) => {
    try {
        const { jenis, id } = req.params;
        const { status_review, catatan, tipe_review } = req.body;
        
        const reviewData = {
            reviewer_id: req.user.id_user,
            status_review,
            catatan,
            tipe_review
        };
        
        if (req.file) {
            reviewData.file_review = req.file.path;
        }
        
        const result = await penelitianService.addReview(jenis, id, reviewData);
        
        res.json(formatResponse('success', 'Review berhasil disimpan', result));
    } catch (error) {
        console.error('Error in addReview:', error);
        res.status(500).json(formatError(error.message || 'Gagal menyimpan review'));
    }
};

const getPendingReviews = async (req, res, next) => {
    try {
        const reviews = await penelitianService.getPendingReviews();
        
        res.json(formatResponse('success', 'Data review pending berhasil diambil', reviews || []));
    } catch (error) {
        console.error('Error in getPendingReviews:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil data review pending'));
    }
};

// ==================== SKEMA CONTROLLERS ====================

const getAllSkema = async (req, res, next) => {
    try {
        const { jenis, status } = req.query;
        
        const skema = await penelitianService.getAllSkema({ jenis, status });
        
        res.json(formatResponse('success', 'Data skema berhasil diambil', skema || []));
    } catch (error) {
        console.error('Error in getAllSkema:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil data skema'));
    }
};

const getSkemaById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const skema = await penelitianService.getSkemaById(id);
        
        if (!skema) {
            return res.status(404).json(formatError('Skema tidak ditemukan'));
        }
        
        res.json(formatResponse('success', 'Data skema berhasil diambil', skema));
    } catch (error) {
        console.error('Error in getSkemaById:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil detail skema'));
    }
};

const createSkema = async (req, res, next) => {
    try {
        const skemaData = {
            ...req.body,
            created_by: req.user.id_user
        };
        
        const newSkema = await penelitianService.createSkema(skemaData);
        
        res.status(201).json(formatResponse('success', 'Skema berhasil dibuat', newSkema));
    } catch (error) {
        console.error('Error in createSkema:', error);
        res.status(500).json(formatError(error.message || 'Gagal membuat skema'));
    }
};

const updateSkema = async (req, res, next) => {
    try {
        const { id } = req.params;
        const skemaData = {
            ...req.body,
            updated_by: req.user.id_user
        };
        
        const updatedSkema = await penelitianService.updateSkema(id, skemaData);
        
        if (!updatedSkema) {
            return res.status(404).json(formatError('Skema tidak ditemukan'));
        }
        
        res.json(formatResponse('success', 'Skema berhasil diupdate', updatedSkema));
    } catch (error) {
        console.error('Error in updateSkema:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengupdate skema'));
    }
};

const deleteSkema = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const deleted = await penelitianService.deleteSkema(id);
        
        if (!deleted) {
            return res.status(404).json(formatError('Skema tidak ditemukan'));
        }
        
        res.json(formatResponse('success', 'Skema berhasil dihapus'));
    } catch (error) {
        console.error('Error in deleteSkema:', error);
        res.status(500).json(formatError(error.message || 'Gagal menghapus skema'));
    }
};

// ==================== STATISTIK CONTROLLERS ====================

const getStatistik = async (req, res, next) => {
    try {
        const { tahun } = req.query;
        
        const statistik = await penelitianService.getStatistik(tahun);
        
        res.json(formatResponse('success', 'Statistik berhasil diambil', statistik || {}));
    } catch (error) {
        console.error('Error in getStatistik:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil statistik'));
    }
};

const getRingkasanDosen = async (req, res, next) => {
    try {
        const { tahun, fakultas } = req.query;
        
        const ringkasan = await penelitianService.getRingkasanDosen({ tahun, fakultas });
        
        res.json(formatResponse('success', 'Ringkasan per dosen berhasil diambil', ringkasan || []));
    } catch (error) {
        console.error('Error in getRingkasanDosen:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil ringkasan dosen'));
    }
};

const getRingkasanFakultas = async (req, res, next) => {
    try {
        const { tahun } = req.query;
        
        const ringkasan = await penelitianService.getRingkasanFakultas(tahun);
        
        res.json(formatResponse('success', 'Ringkasan per fakultas berhasil diambil', ringkasan || []));
    } catch (error) {
        console.error('Error in getRingkasanFakultas:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil ringkasan fakultas'));
    }
};

// ==================== LUARAN CONTROLLERS ====================

const uploadLuaran = async (req, res, next) => {
    try {
        const { jenis, id } = req.params;
        const luaranData = {
            ...req.body,
            id_referensi: id,
            jenis_referensi: jenis,
            created_by: req.user.id_user
        };
        
        // Handle file uploads
        if (req.files) {
            if (req.files.file_publikasi) {
                luaranData.file_publikasi = req.files.file_publikasi[0].path;
            }
            if (req.files.file_haki) {
                luaranData.file_haki = req.files.file_haki[0].path;
            }
            if (req.files.file_luaran_lain) {
                luaranData.file_luaran_lain = req.files.file_luaran_lain[0].path;
            }
        }
        
        const luaran = await penelitianService.uploadLuaran(luaranData);
        
        res.status(201).json(formatResponse('success', 'Luaran berhasil diupload', luaran));
    } catch (error) {
        console.error('Error in uploadLuaran:', error);
        res.status(500).json(formatError(error.message || 'Gagal upload luaran'));
    }
};

const getLuaranById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const luaran = await penelitianService.getLuaranById(id);
        
        if (!luaran) {
            return res.status(404).json(formatError('Luaran tidak ditemukan'));
        }
        
        // Format file URLs
        const result = {
            ...luaran,
            file_publikasi_url: luaran.file_publikasi ? getFileUrl(luaran.file_publikasi) : null,
            file_haki_url: luaran.file_haki ? getFileUrl(luaran.file_haki) : null,
            file_luaran_lain_url: luaran.file_luaran_lain ? getFileUrl(luaran.file_luaran_lain) : null
        };
        
        res.json(formatResponse('success', 'Data luaran berhasil diambil', result));
    } catch (error) {
        console.error('Error in getLuaranById:', error);
        res.status(500).json(formatError(error.message || 'Gagal mengambil detail luaran'));
    }
};

module.exports = {
    // Penelitian
    getAllPenelitian,
    getPenelitianById,
    createPenelitian,
    updatePenelitian,
    deletePenelitian,
    submitPenelitian,
    updateStatusPenelitian,
    getReviewHistory,
    
    // Pengabdian
    getAllPengabdian,
    getPengabdianById,
    createPengabdian,
    updatePengabdian,
    deletePengabdian,
    submitPengabdian,
    updateStatusPengabdian,
    
    // Review
    addReview,
    getPendingReviews,
    
    // Skema
    getAllSkema,
    getSkemaById,
    createSkema,
    updateSkema,
    deleteSkema,
    
    // Statistik
    getStatistik,
    getRingkasanDosen,
    getRingkasanFakultas,
    
    // Luaran
    uploadLuaran,
    getLuaranById
};