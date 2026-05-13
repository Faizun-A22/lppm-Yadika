// controllers/admin/penelitianController.js
const penelitianService = require('../../services/admin/penelitianService');
const { formatResponse, formatError, formatPaginatedResponse } = require('../../utils/responseFormatter');
const { getFileUrl } = require('../../utils/helpers');

/**
 * Controller untuk manajemen penelitian
 */
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
        
        // Format file URLs
        result.data = result.data.map(item => ({
            ...item,
            file_proposal_url: item.file_proposal ? getFileUrl(item.file_proposal) : null,
            file_laporan_kemajuan_url: item.file_laporan_kemajuan ? getFileUrl(item.file_laporan_kemajuan) : null,
            file_laporan_akhir_url: item.file_laporan_akhir ? getFileUrl(item.file_laporan_akhir) : null
        }));
        
        res.json(formatPaginatedResponse(
            result.data,
            result.pagination.page,
            result.pagination.limit,
            result.pagination.total,
            'Data penelitian berhasil diambil'
        ));
    } catch (error) {
        next(error);
    }
};

const getPenelitianById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.role === 'dosen' ? req.user.id_user : null;
        
        const penelitian = await penelitianService.getPenelitianById(id, userId);
        
        // Format file URLs
        const result = {
            ...penelitian,
            file_proposal_url: penelitian.file_proposal ? getFileUrl(penelitian.file_proposal) : null,
            file_laporan_kemajuan_url: penelitian.file_laporan_kemajuan ? getFileUrl(penelitian.file_laporan_kemajuan) : null,
            file_laporan_akhir_url: penelitian.file_laporan_akhir ? getFileUrl(penelitian.file_laporan_akhir) : null
        };
        
        // Format anggota URLs jika ada
        if (result.anggota) {
            result.anggota = result.anggota.map(anggota => ({
                ...anggota,
                foto_profil_url: anggota.foto_profil ? getFileUrl(anggota.foto_profil) : null
            }));
        }
        
        res.json(formatResponse('success', 'Data penelitian berhasil diambil', result));
    } catch (error) {
        next(error);
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
            penelitianData.anggota = JSON.parse(req.body.anggota);
        }
        
        const newPenelitian = await penelitianService.createPenelitian(penelitianData);
        
        res.status(201).json(formatResponse('success', 'Penelitian berhasil dibuat', newPenelitian));
    } catch (error) {
        next(error);
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
            penelitianData.anggota = JSON.parse(req.body.anggota);
        }
        
        const updatedPenelitian = await penelitianService.updatePenelitian(id, penelitianData, req.user.id_user);
        
        res.json(formatResponse('success', 'Penelitian berhasil diupdate', updatedPenelitian));
    } catch (error) {
        next(error);
    }
};

const deletePenelitian = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await penelitianService.deletePenelitian(id, req.user.id_user);
        
        res.json(formatResponse('success', 'Penelitian berhasil dihapus'));
    } catch (error) {
        next(error);
    }
};

const submitPenelitian = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await penelitianService.submitPenelitian(id, req.user.id_user);
        
        res.json(formatResponse('success', 'Penelitian berhasil disubmit untuk review', result));
    } catch (error) {
        next(error);
    }
};

const updateStatusPenelitian = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, catatan } = req.body;
        
        const result = await penelitianService.updateStatusPenelitian(id, status, catatan, req.user.id_user);
        
        res.json(formatResponse('success', `Status penelitian berhasil diupdate menjadi ${status}`, result));
    } catch (error) {
        next(error);
    }
};

const getReviewHistory = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const reviews = await penelitianService.getReviewHistory(id);
        
        res.json(formatResponse('success', 'Riwayat review berhasil diambil', reviews));
    } catch (error) {
        next(error);
    }
};

/**
 * Controller untuk manajemen pengabdian
 */
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
        result.data = result.data.map(item => ({
            ...item,
            file_proposal_url: item.file_proposal ? getFileUrl(item.file_proposal) : null,
            file_laporan_kemajuan_url: item.file_laporan_kemajuan ? getFileUrl(item.file_laporan_kemajuan) : null,
            file_laporan_akhir_url: item.file_laporan_akhir ? getFileUrl(item.file_laporan_akhir) : null
        }));
        
        res.json(formatPaginatedResponse(
            result.data,
            result.pagination.page,
            result.pagination.limit,
            result.pagination.total,
            'Data pengabdian berhasil diambil'
        ));
    } catch (error) {
        next(error);
    }
};

const getPengabdianById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.role === 'dosen' ? req.user.id_user : null;
        
        const pengabdian = await penelitianService.getPengabdianById(id, userId);
        
        // Format file URLs
        const result = {
            ...pengabdian,
            file_proposal_url: pengabdian.file_proposal ? getFileUrl(pengabdian.file_proposal) : null,
            file_laporan_kemajuan_url: pengabdian.file_laporan_kemajuan ? getFileUrl(pengabdian.file_laporan_kemajuan) : null,
            file_laporan_akhir_url: pengabdian.file_laporan_akhir ? getFileUrl(pengabdian.file_laporan_akhir) : null
        };
        
        // Format anggota URLs jika ada
        if (result.anggota) {
            result.anggota = result.anggota.map(anggota => ({
                ...anggota,
                foto_profil_url: anggota.foto_profil ? getFileUrl(anggota.foto_profil) : null
            }));
        }
        
        res.json(formatResponse('success', 'Data pengabdian berhasil diambil', result));
    } catch (error) {
        next(error);
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
            pengabdianData.anggota = JSON.parse(req.body.anggota);
        }
        
        const newPengabdian = await penelitianService.createPengabdian(pengabdianData);
        
        res.status(201).json(formatResponse('success', 'Pengabdian berhasil dibuat', newPengabdian));
    } catch (error) {
        next(error);
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
            pengabdianData.anggota = JSON.parse(req.body.anggota);
        }
        
        const updatedPengabdian = await penelitianService.updatePengabdian(id, pengabdianData, req.user.id_user);
        
        res.json(formatResponse('success', 'Pengabdian berhasil diupdate', updatedPengabdian));
    } catch (error) {
        next(error);
    }
};

const deletePengabdian = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await penelitianService.deletePengabdian(id, req.user.id_user);
        
        res.json(formatResponse('success', 'Pengabdian berhasil dihapus'));
    } catch (error) {
        next(error);
    }
};

const submitPengabdian = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await penelitianService.submitPengabdian(id, req.user.id_user);
        
        res.json(formatResponse('success', 'Pengabdian berhasil disubmit untuk review', result));
    } catch (error) {
        next(error);
    }
};

const updateStatusPengabdian = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, catatan } = req.body;
        
        const result = await penelitianService.updateStatusPengabdian(id, status, catatan, req.user.id_user);
        
        res.json(formatResponse('success', `Status pengabdian berhasil diupdate menjadi ${status}`, result));
    } catch (error) {
        next(error);
    }
};

/**
 * Controller untuk review
 */
const addReview = async (req, res, next) => {
    try {
        const { jenis, id } = req.params; // jenis: 'penelitian' atau 'pengabdian'
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
        next(error);
    }
};

const getPendingReviews = async (req, res, next) => {
    try {
        const reviews = await penelitianService.getPendingReviews();
        
        res.json(formatResponse('success', 'Data review pending berhasil diambil', reviews));
    } catch (error) {
        next(error);
    }
};

/**
 * Controller untuk skema
 */
const getAllSkema = async (req, res, next) => {
    try {
        const { jenis, status } = req.query;
        
        const skema = await penelitianService.getAllSkema({ jenis, status });
        
        res.json(formatResponse('success', 'Data skema berhasil diambil', skema));
    } catch (error) {
        next(error);
    }
};

const getSkemaById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const skema = await penelitianService.getSkemaById(id);
        
        res.json(formatResponse('success', 'Data skema berhasil diambil', skema));
    } catch (error) {
        next(error);
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
        next(error);
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
        
        res.json(formatResponse('success', 'Skema berhasil diupdate', updatedSkema));
    } catch (error) {
        next(error);
    }
};

const deleteSkema = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        await penelitianService.deleteSkema(id);
        
        res.json(formatResponse('success', 'Skema berhasil dihapus'));
    } catch (error) {
        next(error);
    }
};

/**
 * Controller untuk statistik
 */
const getStatistik = async (req, res, next) => {
    try {
        const { tahun } = req.query;
        
        const statistik = await penelitianService.getStatistik(tahun);
        
        res.json(formatResponse('success', 'Statistik berhasil diambil', statistik));
    } catch (error) {
        next(error);
    }
};

const getRingkasanDosen = async (req, res, next) => {
    try {
        const { tahun, fakultas } = req.query;
        
        const ringkasan = await penelitianService.getRingkasanDosen({ tahun, fakultas });
        
        res.json(formatResponse('success', 'Ringkasan per dosen berhasil diambil', ringkasan));
    } catch (error) {
        next(error);
    }
};

const getRingkasanFakultas = async (req, res, next) => {
    try {
        const { tahun } = req.query;
        
        const ringkasan = await penelitianService.getRingkasanFakultas(tahun);
        
        res.json(formatResponse('success', 'Ringkasan per fakultas berhasil diambil', ringkasan));
    } catch (error) {
        next(error);
    }
};

/**
 * Controller untuk luaran
 */
const uploadLuaran = async (req, res, next) => {
    try {
        const { jenis, id } = req.params; // jenis: 'penelitian' atau 'pengabdian'
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
        next(error);
    }
};

const getLuaranById = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const luaran = await penelitianService.getLuaranById(id);
        
        // Format file URLs
        const result = {
            ...luaran,
            file_publikasi_url: luaran.file_publikasi ? getFileUrl(luaran.file_publikasi) : null,
            file_haki_url: luaran.file_haki ? getFileUrl(luaran.file_haki) : null,
            file_luaran_lain_url: luaran.file_luaran_lain ? getFileUrl(luaran.file_luaran_lain) : null
        };
        
        res.json(formatResponse('success', 'Data luaran berhasil diambil', result));
    } catch (error) {
        next(error);
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