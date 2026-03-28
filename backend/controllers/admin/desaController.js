const desaService = require('../../services/admin/desaService');
const { formatResponse, formatError, formatPaginatedResponse } = require('../../utils/responseFormatter');

const desaController = {
    /**
     * Get all desa with pagination and filters
     */
    async getAllDesa(req, res) {
        try {
            const { page = 1, limit = 10, search = '', kabupaten, status } = req.query;
            
            const result = await desaService.getAllDesa({
                page: parseInt(page),
                limit: parseInt(limit),
                search,
                kabupaten,
                status
            });

            return res.status(200).json(
                formatPaginatedResponse(
                    result.data,
                    page,
                    limit,
                    result.total,
                    'Data desa berhasil diambil'
                )
            );
        } catch (error) {
            console.error('Error in getAllDesa:', error);
            return res.status(500).json(formatError('Gagal mengambil data desa'));
        }
    },

    /**
     * Get desa by ID
     */
    async getDesaById(req, res) {
        try {
            const { id } = req.params;
            
            const desa = await desaService.getDesaById(id);
            
            if (!desa) {
                return res.status(404).json(formatError('Desa tidak ditemukan'));
            }

            return res.status(200).json(
                formatResponse('success', 'Data desa berhasil diambil', desa)
            );
        } catch (error) {
            console.error('Error in getDesaById:', error);
            return res.status(500).json(formatError('Gagal mengambil data desa'));
        }
    },

    /**
     * Create new desa
     */
    async createDesa(req, res) {
        try {
            const desaData = {
                nama_desa: req.body.nama_desa,
                kecamatan: req.body.kecamatan,
                kabupaten: req.body.kabupaten,
                provinsi: req.body.provinsi || 'Jawa Timur',
                kuota: req.body.kuota,
                kuota_terisi: 0,
                id_dosen_pembimbing: req.body.id_dosen_pembimbing || null,
                nama_pembimbing_lapangan: req.body.nama_pembimbing_lapangan,
                kontak_pembimbing_lapangan: req.body.kontak_pembimbing_lapangan,
                alamat: req.body.alamat,
                deskripsi: req.body.deskripsi,
                status: 'aktif'
            };

            const newDesa = await desaService.createDesa(desaData);

            return res.status(201).json(
                formatResponse('success', 'Desa berhasil ditambahkan', newDesa)
            );
        } catch (error) {
            console.error('Error in createDesa:', error);
            
            if (error.code === '23505') { // Unique violation
                return res.status(400).json(formatError('Nama desa sudah ada'));
            }
            
            return res.status(500).json(formatError('Gagal menambahkan desa'));
        }
    },

    /**
     * Update desa
     */
    async updateDesa(req, res) {
        try {
            const { id } = req.params;
            
            // Cek apakah desa exists
            const existingDesa = await desaService.getDesaById(id);
            if (!existingDesa) {
                return res.status(404).json(formatError('Desa tidak ditemukan'));
            }

            // Cek kuota baru tidak boleh kurang dari kuota terisi
            if (req.body.kuota && req.body.kuota < existingDesa.kuota_terisi) {
                return res.status(400).json(
                    formatError(`Kuota baru (${req.body.kuota}) tidak boleh kurang dari kuota terisi (${existingDesa.kuota_terisi})`)
                );
            }

            const updatedDesa = await desaService.updateDesa(id, req.body);

            return res.status(200).json(
                formatResponse('success', 'Desa berhasil diupdate', updatedDesa)
            );
        } catch (error) {
            console.error('Error in updateDesa:', error);
            return res.status(500).json(formatError('Gagal mengupdate desa'));
        }
    },

    /**
     * Delete desa
     */
    async deleteDesa(req, res) {
        try {
            const { id } = req.params;
            
            // Cek apakah desa exists
            const existingDesa = await desaService.getDesaById(id);
            if (!existingDesa) {
                return res.status(404).json(formatError('Desa tidak ditemukan'));
            }

            // Cek apakah masih ada peserta aktif
            if (existingDesa.kuota_terisi > 0) {
                return res.status(400).json(
                    formatError('Tidak dapat menghapus desa yang masih memiliki peserta')
                );
            }

            await desaService.deleteDesa(id);

            return res.status(200).json(
                formatResponse('success', 'Desa berhasil dihapus')
            );
        } catch (error) {
            console.error('Error in deleteDesa:', error);
            return res.status(500).json(formatError('Gagal menghapus desa'));
        }
    },

    /**
     * Toggle desa status
     */
    async toggleStatus(req, res) {
        try {
            const { id } = req.params;
            
            const desa = await desaService.toggleStatus(id);

            return res.status(200).json(
                formatResponse('success', `Status desa berhasil diubah menjadi ${desa.status}`, desa)
            );
        } catch (error) {
            console.error('Error in toggleStatus:', error);
            
            if (error.message === 'Desa tidak ditemukan') {
                return res.status(404).json(formatError(error.message));
            }
            
            return res.status(500).json(formatError('Gagal mengubah status desa'));
        }
    },

    /**
     * Get active desa for dropdown
     */
    async getDesaAktif(req, res) {
        try {
            const desaList = await desaService.getDesaAktif();

            return res.status(200).json(
                formatResponse('success', 'Data desa aktif berhasil diambil', desaList)
            );
        } catch (error) {
            console.error('Error in getDesaAktif:', error);
            return res.status(500).json(formatError('Gagal mengambil data desa aktif'));
        }
    },

    /**
     * Get desa statistics
     */
    async getDesaStats(req, res) {
        try {
            const stats = await desaService.getDesaStats();

            return res.status(200).json(
                formatResponse('success', 'Statistik desa berhasil diambil', stats)
            );
        } catch (error) {
            console.error('Error in getDesaStats:', error);
            return res.status(500).json(formatError('Gagal mengambil statistik desa'));
        }
    },

    /**
     * Get peserta by desa
     */
    async getPesertaDesa(req, res) {
        try {
            const { id } = req.params;
            const { page = 1, limit = 10, status } = req.query;

            // Cek apakah desa exists
            const desa = await desaService.getDesaById(id);
            if (!desa) {
                return res.status(404).json(formatError('Desa tidak ditemukan'));
            }

            const result = await desaService.getPesertaDesa(id, {
                page: parseInt(page),
                limit: parseInt(limit),
                status
            });

            return res.status(200).json(
                formatPaginatedResponse(
                    result.data,
                    page,
                    limit,
                    result.total,
                    'Data peserta desa berhasil diambil'
                )
            );
        } catch (error) {
            console.error('Error in getPesertaDesa:', error);
            return res.status(500).json(formatError('Gagal mengambil data peserta'));
        }
    }
};

module.exports = desaController;