const magangService = require('../../services/mahasiswa/magangService');
const { formatResponse, formatError } = require('../../utils/responseFormatter');
const { deleteFile } = require('../../middleware/upload');

/**
 * Controller untuk fitur magang mahasiswa
 */
class MagangController {
    /**
     * Mendapatkan status magang mahasiswa
     */
    async getStatus(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const status = await magangService.getStatus(userId);
            
            return res.status(200).json(
                formatResponse('success', 'Status magang berhasil didapatkan', status)
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan data registrasi magang
     */
    async getRegistrasi(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const registrasi = await magangService.getRegistrasi(userId);
            
            return res.status(200).json(
                formatResponse('success', 'Data registrasi berhasil didapatkan', registrasi)
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Membuat registrasi magang baru
     */
    async createRegistrasi(req, res, next) {
        try {
            const userId = req.user.id_user;
            const files = req.files;
            
            // Validasi file
            if (!files || !files.krs_file || !files.khs_file || !files.payment_file) {
                // Hapus file yang sudah diupload jika ada
                if (files) {
                    Object.values(files).flat().forEach(file => {
                        deleteFile(file.path);
                    });
                }
                
                return res.status(400).json(
                    formatError('Semua file (KRS, KHS, Bukti Pembayaran) harus diupload')
                );
            }
            
            const data = {
                ...req.body,
                krs_file: files.krs_file[0],
                khs_file: files.khs_file[0],
                payment_file: files.payment_file[0]
            };
            
            const registrasi = await magangService.createRegistrasi(userId, data);
            
            return res.status(201).json(
                formatResponse('success', 'Pendaftaran magang berhasil', registrasi)
            );
        } catch (error) {
            // Hapus file yang sudah diupload jika terjadi error
            if (req.files) {
                Object.values(req.files).flat().forEach(file => {
                    deleteFile(file.path);
                });
            }
            next(error);
        }
    }

    /**
     * Update registrasi magang
     */
    async updateRegistrasi(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            const files = req.files;
            
            const data = { ...req.body };
            
            // Tambahkan file jika ada
            if (files) {
                if (files.krs_file) data.krs_file = files.krs_file[0];
                if (files.khs_file) data.khs_file = files.khs_file[0];
                if (files.payment_file) data.payment_file = files.payment_file[0];
            }
            
            const registrasi = await magangService.updateRegistrasi(id, userId, data);
            
            return res.status(200).json(
                formatResponse('success', 'Data registrasi berhasil diupdate', registrasi)
            );
        } catch (error) {
            // Hapus file baru jika terjadi error
            if (req.files) {
                Object.values(req.files).flat().forEach(file => {
                    deleteFile(file.path);
                });
            }
            next(error);
        }
    }

    /**
     * Mendapatkan data perusahaan magang
     */
    async getPerusahaan(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const perusahaan = await magangService.getPerusahaan(userId);
            
            return res.status(200).json(
                formatResponse('success', 'Data perusahaan berhasil didapatkan', perusahaan)
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan detail perusahaan magang
     */
    async getPerusahaanById(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const perusahaan = await magangService.getPerusahaanById(id, userId);
            
            return res.status(200).json(
                formatResponse('success', 'Detail perusahaan berhasil didapatkan', perusahaan)
            );
        } catch (error) {
            next(error);
        }
    }

    // controllers/mahasiswa/magangController.js (contoh untuk perusahaan)

async createPerusahaan(req, res, next) {
    try {
        const id_user = req.user.id_user;
        const files = req.files;
        
        // Simpan hanya path relatif, bukan URL lengkap
        const perusahaanData = {
            id_user: id_user,
            id_registrasi: req.body.id_registrasi,
            nama_perusahaan: req.body.nama_perusahaan,
            bidang_magang: req.body.bidang_magang,
            posisi: req.body.posisi,
            durasi: parseInt(req.body.durasi),
            tanggal_mulai: req.body.tanggal_mulai,
            tanggal_selesai: req.body.tanggal_selesai,
            alamat_perusahaan: req.body.alamat_perusahaan,
            nama_pembimbing: req.body.nama_pembimbing,
            kontak_pembimbing: req.body.kontak_pembimbing,
            email_pembimbing: req.body.email_pembimbing || null,
            jabatan_pembimbing: req.body.jabatan_pembimbing || null,
            status: 'pending'
        };
        
        // Simpan hanya path relatif (contoh: "magang/surat_keterangan/nama-file.png")
        if (files && files.surat_keterangan) {
            // path dari multer adalah relatif terhadap root project
            // contoh: "uploads/magang/surat_keterangan/12345-file.png"
            // kita simpan tanpa "uploads/" prefix
            const suratPath = files.surat_keterangan[0].path;
            // Hapus "uploads/" dari path
            perusahaanData.surat_keterangan = suratPath.replace(/^uploads[\/\\]/, '');
        }
        
        if (files && files.struktur_organisasi) {
            const strukturPath = files.struktur_organisasi[0].path;
            perusahaanData.struktur_organisasi = strukturPath.replace(/^uploads[\/\\]/, '');
        }
        
        const result = await magangService.createPerusahaan(id_user, perusahaanData);
        
        return res.status(201).json({
            success: true,
            message: 'Data perusahaan berhasil disimpan',
            data: result
        });
    } catch (error) {
        next(error);
    }
}

    /**
     * Update data perusahaan magang
     */
    async updatePerusahaan(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            const files = req.files;
            
            const data = { ...req.body };
            
            // Tambahkan file jika ada
            if (files) {
                if (files.surat_keterangan) data.surat_keterangan = files.surat_keterangan[0];
                if (files.struktur_organisasi) data.struktur_organisasi = files.struktur_organisasi[0];
            }
            
            const perusahaan = await magangService.updatePerusahaan(id, userId, data);
            
            return res.status(200).json(
                formatResponse('success', 'Data perusahaan berhasil diupdate', perusahaan)
            );
        } catch (error) {
            // Hapus file baru jika terjadi error
            if (req.files) {
                Object.values(req.files).flat().forEach(file => {
                    deleteFile(file.path);
                });
            }
            next(error);
        }
    }

    /**
     * Mendapatkan data luaran magang
     */
    async getLuaran(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const luaran = await magangService.getLuaran(userId);
            
            return res.status(200).json(
                formatResponse('success', 'Data luaran berhasil didapatkan', luaran)
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan detail luaran magang
     */
    async getLuaranById(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            
            const luaran = await magangService.getLuaranById(id, userId);
            
            return res.status(200).json(
                formatResponse('success', 'Detail luaran berhasil didapatkan', luaran)
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Membuat data luaran magang
     */
    async createLuaran(req, res, next) {
        try {
            const userId = req.user.id_user;
            const files = req.files;
            
            // Cek apakah sudah ada data perusahaan
            const perusahaan = await magangService.getPerusahaan(userId);
            if (!perusahaan || perusahaan.length === 0) {
                return res.status(400).json(
                    formatError('Anda harus mengisi data perusahaan terlebih dahulu')
                );
            }
            
            const data = {
                ...req.body,
                mou_file: files?.mou_file ? files.mou_file[0] : null,
                sertifikat: files?.sertifikat ? files.sertifikat[0] : null,
                logbook: files?.logbook ? files.logbook[0] : null,
                poster: files?.poster ? files.poster[0] : req.body.poster || null,
                laporan: files?.laporan ? files.laporan[0] : req.body.laporan || null,
                foto_kegiatan: files?.foto_kegiatan || req.body.foto_kegiatan || []
            };
            
            const luaran = await magangService.createLuaran(userId, data, perusahaan[0]);
            
            return res.status(201).json(
                formatResponse('success', 'Data luaran berhasil disimpan', luaran)
            );
        } catch (error) {
            // Hapus file yang sudah diupload jika terjadi error
            if (req.files) {
                Object.values(req.files).flat().forEach(file => {
                    deleteFile(file.path);
                });
            }
            next(error);
        }
    }

    /**
     * Update data luaran magang
     */
    async updateLuaran(req, res, next) {
        try {
            const { id } = req.params;
            const userId = req.user.id_user;
            const files = req.files;
            
            const data = { ...req.body };
            
            // Tambahkan file jika ada
            if (files) {
                if (files.mou_file) data.mou_file = files.mou_file[0];
                if (files.sertifikat) data.sertifikat = files.sertifikat[0];
                if (files.logbook) data.logbook = files.logbook[0];
                if (files.poster) data.poster = files.poster[0];
                if (files.laporan) data.laporan = files.laporan[0];
                if (files.foto_kegiatan) data.foto_kegiatan = files.foto_kegiatan;
            }
            
            const luaran = await magangService.updateLuaran(id, userId, data);
            
            return res.status(200).json(
                formatResponse('success', 'Data luaran berhasil diupdate', luaran)
            );
        } catch (error) {
            // Hapus file baru jika terjadi error
            if (req.files) {
                Object.values(req.files).flat().forEach(file => {
                    deleteFile(file.path);
                });
            }
            next(error);
        }
    }

    /**
     * Mendapatkan timeline progress magang
     */
    async getTimeline(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const timeline = await magangService.getTimeline(userId);
            
            return res.status(200).json(
                formatResponse('success', 'Timeline berhasil didapatkan', timeline)
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan riwayat pengajuan magang
     */
    async getRiwayat(req, res, next) {
        try {
            const userId = req.user.id_user;
            
            const riwayat = await magangService.getRiwayat(userId);
            
            return res.status(200).json(
                formatResponse('success', 'Riwayat pengajuan berhasil didapatkan', riwayat)
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mendapatkan daftar program studi
     */
    async getProgramStudi(req, res, next) {
        try {
            const prodi = await magangService.getProgramStudi();
            
            return res.status(200).json(
                formatResponse('success', 'Data program studi berhasil didapatkan', prodi)
            );
        } catch (error) {
            next(error);
        }
    }

    /**
     * Menghapus file tertentu
     */
    async deleteFile(req, res, next) {
        try {
            const { jenis, id } = req.params;
            const userId = req.user.id_user;
            
            const result = await magangService.deleteFile(jenis, id, userId);
            
            return res.status(200).json(
                formatResponse('success', `File ${jenis} berhasil dihapus`, result)
            );
        } catch (error) {
            next(error);
        }
    }
}


module.exports = new MagangController();