// controllers/dosen/penelitianController.js
const dosenPenelitianService = require('../../services/dosen/penelitianService');
const { formatResponse, formatPaginatedResponse } = require('../../utils/responseFormatter');
const { getFileUrl } = require('../../utils/helpers');

class DosenPenelitianController {
    
    // ==================== PENELITIAN ====================
    
    async getAllPenelitian(req, res, next) {
        try {
            const { page = 1, limit = 10, status, tahun, skema, search } = req.query;
            const userId = req.user.id_user;
            
            const result = await dosenPenelitianService.getAllPenelitian({
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
    }
    
    async getPenelitianById(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const penelitian = await dosenPenelitianService.getPenelitianById(id, userId);
            
            const result = {
                ...penelitian,
                file_proposal_url: penelitian.file_proposal ? getFileUrl(penelitian.file_proposal) : null,
                file_laporan_kemajuan_url: penelitian.file_laporan_kemajuan ? getFileUrl(penelitian.file_laporan_kemajuan) : null,
                file_laporan_akhir_url: penelitian.file_laporan_akhir ? getFileUrl(penelitian.file_laporan_akhir) : null
            };
            
            if (result.anggota) {
                result.anggota = result.anggota.map(anggota => ({
                    ...anggota,
                    foto_profil_url: anggota.user?.foto_profil ? getFileUrl(anggota.user.foto_profil) : null
                }));
            }
            
            res.json(formatResponse('success', 'Data penelitian berhasil diambil', result));
        } catch (error) {
            next(error);
        }
    }
    
    async createPenelitian(req, res, next) {
        try {
            const penelitianData = {
                ...req.body,
                id_ketua: req.user.id_user,
                created_by: req.user.id_user
            };
            
            // Parse luaran if sent as JSON string
            if (req.body.luaran && typeof req.body.luaran === 'string') {
                penelitianData.luaran = JSON.parse(req.body.luaran);
            }
            
            // Handle file uploads
            if (req.files && req.files.file_proposal) {
                penelitianData.file_proposal = req.files.file_proposal[0].path;
            }
            
            const newPenelitian = await dosenPenelitianService.createPenelitian(penelitianData);
            
            res.status(201).json(formatResponse('success', 'Penelitian berhasil dibuat', newPenelitian));
        } catch (error) {
            next(error);
        }
    }
    
    async updatePenelitian(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const penelitianData = {
                ...req.body,
                updated_by: userId
            };
            
            if (req.body.luaran && typeof req.body.luaran === 'string') {
                penelitianData.luaran = JSON.parse(req.body.luaran);
            }
            
            if (req.files && req.files.file_proposal) {
                penelitianData.file_proposal = req.files.file_proposal[0].path;
            }
            
            const updatedPenelitian = await dosenPenelitianService.updatePenelitian(id, penelitianData, userId);
            
            res.json(formatResponse('success', 'Penelitian berhasil diupdate', updatedPenelitian));
        } catch (error) {
            next(error);
        }
    }
    
    async deletePenelitian(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            await dosenPenelitianService.deletePenelitian(id, userId);
            
            res.json(formatResponse('success', 'Penelitian berhasil dihapus'));
        } catch (error) {
            next(error);
        }
    }
    
    async submitPenelitian(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const result = await dosenPenelitianService.submitPenelitian(id, userId);
            
            res.json(formatResponse('success', 'Penelitian berhasil disubmit untuk review', result));
        } catch (error) {
            next(error);
        }
    }
    
    async uploadLaporan(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const laporanData = {};
            
            if (req.files) {
                if (req.files.file_laporan_kemajuan) {
                    laporanData.file_laporan_kemajuan = req.files.file_laporan_kemajuan[0].path;
                }
                if (req.files.file_laporan_akhir) {
                    laporanData.file_laporan_akhir = req.files.file_laporan_akhir[0].path;
                }
            }
            
            const result = await dosenPenelitianService.uploadLaporan(id, laporanData, userId);
            
            res.json(formatResponse('success', 'Laporan berhasil diupload', result));
        } catch (error) {
            next(error);
        }
    }
    
    // ==================== PENGABDIAN ====================
    
    async getAllPengabdian(req, res, next) {
        try {
            const { page = 1, limit = 10, status, tahun, skema, search } = req.query;
            const userId = req.user.id_user;
            
            const result = await dosenPenelitianService.getAllPengabdian({
                page: parseInt(page),
                limit: parseInt(limit),
                status,
                tahun,
                skema,
                search,
                userId
            });
            
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
    }
    
    async getPengabdianById(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const pengabdian = await dosenPenelitianService.getPengabdianById(id, userId);
            
            const result = {
                ...pengabdian,
                file_proposal_url: pengabdian.file_proposal ? getFileUrl(pengabdian.file_proposal) : null,
                file_laporan_kemajuan_url: pengabdian.file_laporan_kemajuan ? getFileUrl(pengabdian.file_laporan_kemajuan) : null,
                file_laporan_akhir_url: pengabdian.file_laporan_akhir ? getFileUrl(pengabdian.file_laporan_akhir) : null
            };
            
            if (result.anggota) {
                result.anggota = result.anggota.map(anggota => ({
                    ...anggota,
                    foto_profil_url: anggota.user?.foto_profil ? getFileUrl(anggota.user.foto_profil) : null
                }));
            }
            
            res.json(formatResponse('success', 'Data pengabdian berhasil diambil', result));
        } catch (error) {
            next(error);
        }
    }
    
    async createPengabdian(req, res, next) {
        try {
            const pengabdianData = {
                ...req.body,
                id_ketua: req.user.id_user,
                created_by: req.user.id_user
            };
            
            if (req.body.luaran && typeof req.body.luaran === 'string') {
                pengabdianData.luaran = JSON.parse(req.body.luaran);
            }
            
            if (req.files && req.files.file_proposal) {
                pengabdianData.file_proposal = req.files.file_proposal[0].path;
            }
            
            const newPengabdian = await dosenPenelitianService.createPengabdian(pengabdianData);
            
            res.status(201).json(formatResponse('success', 'Pengabdian berhasil dibuat', newPengabdian));
        } catch (error) {
            next(error);
        }
    }
    
    async updatePengabdian(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const pengabdianData = {
                ...req.body,
                updated_by: userId
            };
            
            if (req.body.luaran && typeof req.body.luaran === 'string') {
                pengabdianData.luaran = JSON.parse(req.body.luaran);
            }
            
            if (req.files && req.files.file_proposal) {
                pengabdianData.file_proposal = req.files.file_proposal[0].path;
            }
            
            const updatedPengabdian = await dosenPenelitianService.updatePengabdian(id, pengabdianData, userId);
            
            res.json(formatResponse('success', 'Pengabdian berhasil diupdate', updatedPengabdian));
        } catch (error) {
            next(error);
        }
    }
    
    async deletePengabdian(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            await dosenPenelitianService.deletePengabdian(id, userId);
            
            res.json(formatResponse('success', 'Pengabdian berhasil dihapus'));
        } catch (error) {
            next(error);
        }
    }
    
    async submitPengabdian(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const result = await dosenPenelitianService.submitPengabdian(id, userId);
            
            res.json(formatResponse('success', 'Pengabdian berhasil disubmit untuk review', result));
        } catch (error) {
            next(error);
        }
    }
    
    async uploadLaporanPengabdian(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const laporanData = {};
            
            if (req.files) {
                if (req.files.file_laporan_kemajuan) {
                    laporanData.file_laporan_kemajuan = req.files.file_laporan_kemajuan[0].path;
                }
                if (req.files.file_laporan_akhir) {
                    laporanData.file_laporan_akhir = req.files.file_laporan_akhir[0].path;
                }
            }
            
            const result = await dosenPenelitianService.uploadLaporanPengabdian(id, laporanData, userId);
            
            res.json(formatResponse('success', 'Laporan berhasil diupload', result));
        } catch (error) {
            next(error);
        }
    }
    
    // ==================== LUARAN ====================
    
    async uploadLuaran(req, res, next) {
        try {
            const { jenis, id } = req.params;
            const userId = req.user.id_user;
            
            const luaranData = {
                id_referensi: id,
                jenis_referensi: jenis,
                tipe_luaran: req.body.tipe_luaran,
                judul: req.body.judul,
                deskripsi: req.body.deskripsi,
                link_terkait: req.body.link_terkait,
                created_by: userId
            };
            
            if (req.files && req.files.file_luaran) {
                luaranData.file_path = req.files.file_luaran[0].path;
            }
            
            const luaran = await dosenPenelitianService.uploadLuaran(luaranData);
            
            res.status(201).json(formatResponse('success', 'Luaran berhasil diupload', luaran));
        } catch (error) {
            next(error);
        }
    }
    
    async getLuaranById(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const luaran = await dosenPenelitianService.getLuaranById(id, userId);
            
            const result = {
                ...luaran,
                file_url: (luaran.file_publikasi || luaran.file_haki || luaran.file_luaran_lain) 
                    ? getFileUrl(luaran.file_publikasi || luaran.file_haki || luaran.file_luaran_lain) 
                    : null
            };
            
            res.json(formatResponse('success', 'Data luaran berhasil diambil', result));
        } catch (error) {
            next(error);
        }
    }
    
    async deleteLuaran(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            await dosenPenelitianService.deleteLuaran(id, userId);
            
            res.json(formatResponse('success', 'Luaran berhasil dihapus'));
        } catch (error) {
            next(error);
        }
    }
    
    // ==================== STATISTIK ====================
    
    async getStatistik(req, res, next) {
        try {
            const userId = req.user.id_user;
            const { tahun } = req.query;
            
            const statistik = await dosenPenelitianService.getStatistik(userId, tahun);
            
            res.json(formatResponse('success', 'Statistik berhasil diambil', statistik));
        } catch (error) {
            next(error);
        }
    }
    
    async getRingkasanStatus(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const ringkasan = await dosenPenelitianService.getRingkasanStatus(userId);
            
            res.json(formatResponse('success', 'Ringkasan status berhasil diambil', ringkasan));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new DosenPenelitianController();