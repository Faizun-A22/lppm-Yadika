const kknService = require('../../services/mahasiswa/kknService');
const { formatResponse, formatError, formatPaginatedResponse } = require('../../utils/responseFormatter');
const { deleteFile, getFileInfo } = require('../../middleware/upload');

/**
 * Controller untuk KKN Mahasiswa
 */
class KKNController {
    /**
     * Mendapatkan dashboard KKN
     */
    async getDashboard(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const dashboard = await kknService.getDashboard(userId);
            
            return res.json(formatResponse('success', 'Data dashboard berhasil diambil', dashboard));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan status KKN
     */
    async getStatus(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const status = await kknService.getStatus(userId);
            
            return res.json(formatResponse('success', 'Status KKN berhasil diambil', status));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan daftar desa yang tersedia
     */
    async getAvailableVillages(req, res, next) {
        try {
            const { search, kabupaten } = req.query;
            
            const villages = await kknService.getAvailableVillages({ search, kabupaten });
            
            return res.json(formatResponse('success', 'Data desa berhasil diambil', villages));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan riwayat pengajuan
     */
    async getRiwayat(req, res, next) {
        try {
            const userId = req.user.id_user;
            const { page = 1, limit = 10, jenis } = req.query;
            
            const result = await kknService.getRiwayat(userId, { page, limit, jenis });
            
            return res.json(formatPaginatedResponse(
                result.data,
                page,
                limit,
                result.total,
                'Riwayat pengajuan berhasil diambil'
            ));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan status proposal
     */
    async getProposalStatus(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const status = await kknService.getProposalStatus(userId);
            
            return res.json(formatResponse('success', 'Status proposal berhasil diambil', status));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan detail proposal
     */
    async getProposalDetail(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const proposal = await kknService.getProposalDetail(id, userId);
            
            return res.json(formatResponse('success', 'Detail proposal berhasil diambil', proposal));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan daftar luaran
     */
    async getLuaran(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const luaran = await kknService.getLuaran(userId);
            
            return res.json(formatResponse('success', 'Data luaran berhasil diambil', luaran));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan detail luaran
     */
    async getLuaranDetail(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const luaran = await kknService.getLuaranDetail(id, userId);
            
            return res.json(formatResponse('success', 'Detail luaran berhasil diambil', luaran));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan timeline KKN
     */
    async getTimeline(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const timeline = await kknService.getTimeline(userId);
            
            return res.json(formatResponse('success', 'Timeline berhasil diambil', timeline));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan riwayat review proposal
     */
    async getReviewHistory(req, res, next) {
        try {
            const { id_proposal } = req.params;
            const userId = req.user.id_user;
            
            const reviews = await kknService.getReviewHistory(id_proposal, userId);
            
            return res.json(formatResponse('success', 'Riwayat review berhasil diambil', reviews));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendaftar KKN
     */
    async daftarKKN(req, res, next) {
        try {
            const userId = req.user.id_user;
            const files = req.files;
            
            // Validasi file upload
            if (!files || !files.krs_file || !files.khs_file || !files.payment_file) {
                // Hapus file yang sudah terupload jika ada
                if (files) {
                    for (const key in files) {
                        for (const file of files[key]) {
                            await deleteFile(file.path);
                        }
                    }
                }
                return res.status(400).json(formatError('Semua file wajib diupload (KRS, KHS, Bukti Bayar)'));
            }
            
            const data = {
                id_prodi: req.body.id_prodi,
                id_desa: req.body.id_desa,
                no_hp: req.body.no_hp,
                semester: parseInt(req.body.semester),
                ukuran_jaket: req.body.ukuran_jaket,
                alamat: req.body.alamat || null,
                krs_file: files.krs_file[0],
                khs_file: files.khs_file[0],
                payment_file: files.payment_file[0]
            };
            
            const result = await kknService.daftarKKN(userId, data);
            
            return res.status(201).json(formatResponse('success', 'Pendaftaran KKN berhasil', result));
        } catch (error) {
            // Hapus file yang sudah terupload jika terjadi error
            if (req.files) {
                for (const key in req.files) {
                    for (const file of req.files[key]) {
                        await deleteFile(file.path);
                    }
                }
            }
            next(error);
        }
    }

    /**
     * Mengajukan proposal
     */
    async ajukanProposal(req, res, next) {
        try {
            const userId = req.user.id_user;
            const file = req.file;
            
            if (!file) {
                return res.status(400).json(formatError('File proposal wajib diupload'));
            }
            
            // Validasi ukuran file (maks 5MB)
            if (file.size > 5 * 1024 * 1024) {
                await deleteFile(file.path);
                return res.status(400).json(formatError('File proposal maksimal 5MB'));
            }
            
            const data = {
                id_desa: req.body.id_desa,
                judul_program: req.body.judul_program,
                deskripsi_program: req.body.deskripsi_program,
                estimasi_biaya: req.body.estimasi_biaya ? parseInt(req.body.estimasi_biaya) : null,
                durasi: req.body.durasi ? parseInt(req.body.durasi) : null,
                file_proposal: file
            };
            
            const result = await kknService.ajukanProposal(userId, data);
            
            return res.status(201).json(formatResponse('success', 'Proposal berhasil diajukan', result));
        } catch (error) {
            if (req.file) {
                await deleteFile(req.file.path);
            }
            next(error);
        }
    }

    /**
     * Menyimpan draft proposal
     */
    async simpanDraftProposal(req, res, next) {
        try {
            const userId = req.user.id_user;
            const file = req.file;
            
            const data = {
                id_desa: req.body.id_desa || null,
                judul_program: req.body.judul_program || null,
                deskripsi_program: req.body.deskripsi_program || null,
                estimasi_biaya: req.body.estimasi_biaya ? parseInt(req.body.estimasi_biaya) : null,
                durasi: req.body.durasi ? parseInt(req.body.durasi) : null,
                file_proposal: file
            };
            
            const result = await kknService.simpanDraftProposal(userId, data);
            
            return res.status(201).json(formatResponse('success', 'Draft proposal berhasil disimpan', result));
        } catch (error) {
            if (req.file) {
                await deleteFile(req.file.path);
            }
            next(error);
        }
    }

    /**
     * Update proposal
     */
    async updateProposal(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            const file = req.file;
            
            const data = {
                judul_program: req.body.judul_program,
                deskripsi_program: req.body.deskripsi_program,
                estimasi_biaya: req.body.estimasi_biaya ? parseInt(req.body.estimasi_biaya) : null,
                durasi: req.body.durasi ? parseInt(req.body.durasi) : null,
                file_proposal: file
            };
            
            const result = await kknService.updateProposal(id, userId, data);
            
            return res.json(formatResponse('success', 'Proposal berhasil diupdate', result));
        } catch (error) {
            if (req.file) {
                await deleteFile(req.file.path);
            }
            next(error);
        }
    }

    /**
     * Simpan luaran
     */
    async simpanLuaran(req, res, next) {
        try {
            const userId = req.user.id_user;
            const file = req.file;
            
            const data = {
                judul_kegiatan: req.body.judul_kegiatan,
                link_video: req.body.link_video || null,
                link_poster: req.body.link_poster || null,
                link_foto: req.body.link_foto || null,
                file_mou: file,
                keterangan: req.body.keterangan || null
            };
            
            const result = await kknService.simpanLuaran(userId, data);
            
            return res.status(201).json(formatResponse('success', 'Luaran berhasil disimpan', result));
        } catch (error) {
            if (req.file) {
                await deleteFile(req.file.path);
            }
            next(error);
        }
    }

    /**
     * Update luaran
     */
    async updateLuaran(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            const file = req.file;
            
            const data = {
                judul_kegiatan: req.body.judul_kegiatan,
                link_video: req.body.link_video,
                link_poster: req.body.link_poster,
                link_foto: req.body.link_foto,
                file_mou: file,
                keterangan: req.body.keterangan
            };
            
            const result = await kknService.updateLuaran(id, userId, data);
            
            return res.json(formatResponse('success', 'Luaran berhasil diupdate', result));
        } catch (error) {
            if (req.file) {
                await deleteFile(req.file.path);
            }
            next(error);
        }
    }

    /**
     * Batalkan proposal
     */
    async batalkanProposal(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const result = await kknService.batalkanProposal(id, userId);
            
            return res.json(formatResponse('success', 'Proposal berhasil dibatalkan', result));
        } catch (error) {
            next(error);
        }
    }

    /**
     * Hapus luaran
     */
    async hapusLuaran(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const result = await kknService.hapusLuaran(id, userId);
            
            return res.json(formatResponse('success', 'Luaran berhasil dihapus', result));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new KKNController();