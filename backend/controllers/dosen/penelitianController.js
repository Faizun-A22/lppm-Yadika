// controllers/dosen/penelitianController.js
const penelitianService = require('../../services/dosen/penelitianService');

class DosenPenelitianController {
    
    // ==================== PENELITIAN ====================
    
    async getAllPenelitian(req, res) {
        try {
            const { page, limit, status, tahun, skema, search } = req.query;
            const userId = req.user.id_user;
            
            const result = await penelitianService.getAllPenelitian({
                page: parseInt(page) || 1,
                limit: parseInt(limit) || 10,
                status,
                tahun,
                skema,
                search,
                userId
            });
            
            res.json({
                success: true,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Error in getAllPenelitian:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil data penelitian',
                error: error.message
            });
        }
    }
    
    async getPenelitianById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const data = await penelitianService.getPenelitianById(id, userId);
            
            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Error in getPenelitianById:', error);
            res.status(error.message === 'Penelitian tidak ditemukan' ? 404 : 403).json({
                success: false,
                message: error.message
            });
        }
    }
    
    async createPenelitian(req, res) {
        try {
            const userId = req.user.id_user;
            
            let luaran = null;
            if (req.body.luaran) {
                try {
                    luaran = JSON.parse(req.body.luaran);
                } catch (e) {
                    luaran = req.body.luaran;
                }
            }
            
            const data = {
                judul: req.body.judul,
                skema: req.body.skema,
                jenis_pendanaan: req.body.jenis_pendanaan,
                tahun: parseInt(req.body.tahun),
                durasi: parseInt(req.body.durasi) || 6,
                dana_diajukan: parseFloat(req.body.dana_diajukan) || 0,
                file_proposal: req.files?.file_proposal?.[0]?.path || null,
                id_ketua: userId,
                created_by: userId,
                luaran
            };
            
            const result = await penelitianService.createPenelitian(data);
            
            res.status(201).json({
                success: true,
                message: 'Penelitian berhasil dibuat',
                data: result
            });
        } catch (error) {
            console.error('Error in createPenelitian:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal membuat penelitian',
                error: error.message
            });
        }
    }
    
    async updatePenelitian(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            let luaran = null;
            if (req.body.luaran) {
                try {
                    luaran = JSON.parse(req.body.luaran);
                } catch (e) {
                    luaran = req.body.luaran;
                }
            }
            
            const data = {
                judul: req.body.judul,
                skema: req.body.skema,
                jenis_pendanaan: req.body.jenis_pendanaan,
                tahun: parseInt(req.body.tahun),
                durasi: parseInt(req.body.durasi) || 6,
                dana_diajukan: parseFloat(req.body.dana_diajukan) || 0,
                file_proposal: req.files?.file_proposal?.[0]?.path || null,
                luaran
            };
            
            const result = await penelitianService.updatePenelitian(id, data, userId);
            
            res.json({
                success: true,
                message: 'Penelitian berhasil diupdate',
                data: result
            });
        } catch (error) {
            console.error('Error in updatePenelitian:', error);
            res.status(error.message.includes('tidak dapat diupdate') ? 400 : 500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    async deletePenelitian(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            await penelitianService.deletePenelitian(id, userId);
            
            res.json({
                success: true,
                message: 'Penelitian berhasil dihapus'
            });
        } catch (error) {
            console.error('Error in deletePenelitian:', error);
            res.status(error.message.includes('Hanya penelitian') ? 400 : 500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    async submitPenelitian(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const result = await penelitianService.submitPenelitian(id, userId);
            
            res.json({
                success: true,
                message: 'Penelitian berhasil disubmit ke LPPM',
                data: result
            });
        } catch (error) {
            console.error('Error in submitPenelitian:', error);
            res.status(error.message.includes('wajib diupload') ? 400 : 500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    async uploadLaporan(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const laporanData = {
                file_laporan_kemajuan: req.files?.file_laporan_kemajuan?.[0]?.path || null,
                file_laporan_akhir: req.files?.file_laporan_akhir?.[0]?.path || null
            };
            
            const result = await penelitianService.uploadLaporan(id, laporanData, userId);
            
            res.json({
                success: true,
                message: 'Laporan berhasil diupload',
                data: result
            });
        } catch (error) {
            console.error('Error in uploadLaporan:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    // ==================== LUARAN ====================
    
    async uploadLuaran(req, res) {
        try {
            const { jenis, id } = req.params;
            const userId = req.user.id_user;
            
            let filePath = null;
            if (req.files?.file_luaran?.[0]) {
                filePath = req.files.file_luaran[0].path;
            } else if (req.files?.file_hki?.[0]) {
                filePath = req.files.file_hki[0].path;
            } else if (req.files?.file_karya?.[0]) {
                filePath = req.files.file_karya[0].path;
            }
            
            const data = {
                id_referensi: parseInt(id),
                jenis_referensi: jenis === 'penelitian' ? 'penelitian' : 'pengabdian',
                judul: req.body.judul,
                tipe_luaran: req.body.tipe_luaran,
                deskripsi: req.body.deskripsi || null,
                link_terkait: req.body.link_terkait || null,
                file_path: filePath,
                created_by: userId
            };
            
            const result = await penelitianService.uploadLuaran(data);
            
            res.status(201).json({
                success: true,
                message: 'Luaran berhasil diupload',
                data: result
            });
        } catch (error) {
            console.error('Error in uploadLuaran:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    async getLuaranById(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const data = await penelitianService.getLuaranById(id, userId);
            
            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Error in getLuaranById:', error);
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }
    
    async deleteLuaran(req, res) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            await penelitianService.deleteLuaran(id, userId);
            
            res.json({
                success: true,
                message: 'Luaran berhasil dihapus'
            });
        } catch (error) {
            console.error('Error in deleteLuaran:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
    
    // ==================== STATISTIK ====================
    
    async getStatistik(req, res) {
        try {
            const userId = req.user.id_user;
            const { tahun } = req.query;
            
            const data = await penelitianService.getStatistik(userId, tahun);
            
            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Error in getStatistik:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil statistik',
                error: error.message
            });
        }
    }
    
    async getRingkasanStatus(req, res) {
        try {
            const userId = req.user.id_user;
            
            const data = await penelitianService.getRingkasanStatus(userId);
            
            res.json({
                success: true,
                data
            });
        } catch (error) {
            console.error('Error in getRingkasanStatus:', error);
            res.status(500).json({
                success: false,
                message: 'Gagal mengambil ringkasan status',
                error: error.message
            });
        }
    }
}

module.exports = new DosenPenelitianController();