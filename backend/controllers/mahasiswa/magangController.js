const magangController = require('../../services/mahasiswa/magangService');

class MagangController {
    // Get magang status
    async getMagangStatus(req, res) {
        try {
            const userId = req.user.id_user;
            const result = await magangService.getMagangStatus(userId);
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get timeline
    async getTimeline(req, res) {
        try {
            const userId = req.user.id_user;
            const result = await magangService.getTimeline(userId);
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get riwayat
    async getRiwayat(req, res) {
        try {
            const userId = req.user.id_user;
            const result = await magangService.getRiwayat(userId);
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Create pendaftaran
    async createPendaftaran(req, res) {
        try {
            const userId = req.user.id_user;
            const files = req.files;
            const data = req.body;

            const result = await magangService.createPendaftaran(userId, data, files);
            res.status(201).json({
                success: true,
                message: 'Pendaftaran berhasil dibuat',
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get pendaftaran
    async getPendaftaran(req, res) {
        try {
            const userId = req.user.id_user;
            const result = await magangService.getPendaftaran(userId);
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update pendaftaran
    async updatePendaftaran(req, res) {
        try {
            const userId = req.user.id_user;
            const pendaftaranId = req.params.id;
            const files = req.files;
            const data = req.body;

            const result = await magangService.updatePendaftaran(userId, pendaftaranId, data, files);
            res.json({
                success: true,
                message: 'Pendaftaran berhasil diperbarui',
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Create perusahaan
    async createPerusahaan(req, res) {
        try {
            const userId = req.user.id_user;
            const files = req.files;
            const data = req.body;

            const result = await magangService.createPerusahaan(userId, data, files);
            res.status(201).json({
                success: true,
                message: 'Data perusahaan berhasil disimpan',
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get all perusahaan
    async getPerusahaan(req, res) {
        try {
            const userId = req.user.id_user;
            const result = await magangService.getPerusahaan(userId);
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get perusahaan by id
    async getPerusahaanById(req, res) {
        try {
            const userId = req.user.id_user;
            const perusahaanId = req.params.id;
            const result = await magangService.getPerusahaanById(userId, perusahaanId);
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update perusahaan
    async updatePerusahaan(req, res) {
        try {
            const userId = req.user.id_user;
            const perusahaanId = req.params.id;
            const files = req.files;
            const data = req.body;

            const result = await magangService.updatePerusahaan(userId, perusahaanId, data, files);
            res.json({
                success: true,
                message: 'Data perusahaan berhasil diperbarui',
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Delete perusahaan
    async deletePerusahaan(req, res) {
        try {
            const userId = req.user.id_user;
            const perusahaanId = req.params.id;
            await magangService.deletePerusahaan(userId, perusahaanId);
            res.json({
                success: true,
                message: 'Data perusahaan berhasil dihapus'
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Create luaran
    async createLuaran(req, res) {
        try {
            const userId = req.user.id_user;
            const files = req.files;
            const data = req.body;

            const result = await magangService.createLuaran(userId, data, files);
            res.status(201).json({
                success: true,
                message: 'Luaran berhasil disimpan',
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get all luaran
    async getLuaran(req, res) {
        try {
            const userId = req.user.id_user;
            const result = await magangService.getLuaran(userId);
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get luaran by id
    async getLuaranById(req, res) {
        try {
            const userId = req.user.id_user;
            const luaranId = req.params.id;
            const result = await magangService.getLuaranById(userId, luaranId);
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update luaran
    async updateLuaran(req, res) {
        try {
            const userId = req.user.id_user;
            const luaranId = req.params.id;
            const files = req.files;
            const data = req.body;

            const result = await magangService.updateLuaran(userId, luaranId, data, files);
            res.json({
                success: true,
                message: 'Luaran berhasil diperbarui',
                data: result
            });
        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new MagangController();