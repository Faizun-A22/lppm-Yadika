const supabase = require('../config/database');
const path = require('path');
const fs = require('fs');

class KKNController {
    // Daftar KKN
    async daftarKKN(req, res) {
        try {
            const user = req.user;
            const { programStudi, semester, noHp, village, jacketSize } = req.body;
            const files = req.files;

            // Validasi input
            if (!programStudi || !semester || !noHp || !village || !jacketSize) {
                return res.status(400).json({
                    success: false,
                    message: 'Semua field harus diisi'
                });
            }

            // Validasi file
            if (!files || !files.krs || !files.khs || !files.payment) {
                return res.status(400).json({
                    success: false,
                    message: 'Semua file harus diupload'
                });
            }

            // Cek apakah sudah pernah daftar
            const { data: existingKKN } = await supabase
                .from('kkn')
                .select('*')
                .eq('nim', user.nim)
                .single();

            if (existingKKN) {
                return res.status(400).json({
                    success: false,
                    message: 'Anda sudah terdaftar KKN'
                });
            }

            // Upload files ke storage
            const krsPath = await this.uploadFile(files.krs[0], 'krs', user.nim);
            const khsPath = await this.uploadFile(files.khs[0], 'khs', user.nim);
            const paymentPath = await this.uploadFile(files.payment[0], 'payment', user.nim);

            // Simpan ke database
            const { data: kkn, error } = await supabase
                .from('kkn')
                .insert([{
                    nim: user.nim,
                    nama_lengkap: user.nama_lengkap,
                    program_studi: programStudi,
                    semester: parseInt(semester),
                    no_hp: noHp,
                    id_desa: village,
                    ukuran_jaket: jacketSize,
                    file_krs: krsPath,
                    file_khs: khsPath,
                    file_bukti_pembayaran: paymentPath,
                    status_pendaftaran: 'pending',
                    tanggal_daftar: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            // Catat riwayat
            await this.catatRiwayat(kkn.id_kkn, 'Pendaftaran KKN', 'Pendaftaran berhasil dikirim');

            res.status(201).json({
                success: true,
                message: 'Pendaftaran KKN berhasil',
                data: kkn
            });

        } catch (error) {
            console.error('Error daftarKKN:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get status KKN
    async getStatusKKN(req, res) {
        try {
            const user = req.user;

            const { data: kkn, error } = await supabase
                .from('kkn')
                .select(`
                    *,
                    desa_kkn:desa_kkn(*),
                    proposal_kkn(*),
                    luaran_kkn(*)
                `)
                .eq('nim', user.nim)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            res.status(200).json({
                success: true,
                data: kkn || null
            });

        } catch (error) {
            console.error('Error getStatusKKN:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Ajukan proposal
    async ajukanProposal(req, res) {
        try {
            const user = req.user;
            const { judul, deskripsi, biaya, durasi, idDesa } = req.body;
            const file = req.file;

            // Validasi
            if (!judul || !deskripsi || !biaya || !durasi || !idDesa || !file) {
                return res.status(400).json({
                    success: false,
                    message: 'Semua field harus diisi'
                });
            }

            // Cek KKN user
            const { data: kkn } = await supabase
                .from('kkn')
                .select('id_kkn, status_pendaftaran')
                .eq('nim', user.nim)
                .single();

            if (!kkn) {
                return res.status(400).json({
                    success: false,
                    message: 'Anda belum mendaftar KKN'
                });
            }

            if (kkn.status_pendaftaran !== 'diterima') {
                return res.status(400).json({
                    success: false,
                    message: 'Pendaftaran harus diterima terlebih dahulu'
                });
            }

            // Upload file proposal
            const proposalPath = await this.uploadFile(file, 'proposal', user.nim);

            // Simpan proposal
            const { data: proposal, error } = await supabase
                .from('proposal_kkn')
                .insert([{
                    id_kkn: kkn.id_kkn,
                    id_desa: idDesa,
                    judul_program: judul,
                    deskripsi_program: deskripsi,
                    estimasi_biaya: parseFloat(biaya),
                    durasi: parseInt(durasi),
                    file_proposal: proposalPath,
                    status: 'pending',
                    tanggal_ajuan: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            // Update status KKN
            await supabase
                .from('kkn')
                .update({ status_proposal: 'pending' })
                .eq('id_kkn', kkn.id_kkn);

            // Catat riwayat
            await this.catatRiwayat(kkn.id_kkn, 'Pengajuan Proposal', 'Proposal berhasil diajukan');

            res.status(201).json({
                success: true,
                message: 'Proposal berhasil diajukan',
                data: proposal
            });

        } catch (error) {
            console.error('Error ajukanProposal:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get proposal
    async getProposal(req, res) {
        try {
            const user = req.user;

            const { data: kkn } = await supabase
                .from('kkn')
                .select('id_kkn')
                .eq('nim', user.nim)
                .single();

            if (!kkn) {
                return res.status(200).json({
                    success: true,
                    data: null
                });
            }

            const { data: proposal, error } = await supabase
                .from('proposal_kkn')
                .select(`
                    *,
                    desa_kkn(*),
                    review_proposal:review_proposal(
                        *,
                    reviewer:users(nama_lengkap, nidn)
                )
                `)
                .eq('id_kkn', kkn.id_kkn)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            res.status(200).json({
                success: true,
                data: proposal || null
            });

        } catch (error) {
            console.error('Error getProposal:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Update proposal
    async updateProposal(req, res) {
        try {
            const user = req.user;
            const { id } = req.params;
            const { judul, deskripsi, biaya, durasi } = req.body;
            const file = req.file;

            // Cek kepemilikan proposal
            const { data: proposal } = await supabase
                .from('proposal_kkn')
                .select(`
                    *,
                    kkn:kkn(nim)
                `)
                .eq('id_proposal', id)
                .single();

            if (!proposal || proposal.kkn.nim !== user.nim) {
                return res.status(403).json({
                    success: false,
                    message: 'Anda tidak memiliki akses'
                });
            }

            if (proposal.status !== 'revisi' && proposal.status !== 'pending') {
                return res.status(400).json({
                    success: false,
                    message: 'Proposal tidak dapat diedit'
                });
            }

            const updateData = {};
            if (judul) updateData.judul_program = judul;
            if (deskripsi) updateData.deskripsi_program = deskripsi;
            if (biaya) updateData.estimasi_biaya = parseFloat(biaya);
            if (durasi) updateData.durasi = parseInt(durasi);
            
            if (file) {
                // Hapus file lama
                if (proposal.file_proposal) {
                    const oldPath = path.join(__dirname, '..', proposal.file_proposal);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
                // Upload file baru
                updateData.file_proposal = await this.uploadFile(file, 'proposal', user.nim);
            }

            updateData.status = 'pending';
            updateData.tanggal_revisi = new Date().toISOString();

            const { data, error } = await supabase
                .from('proposal_kkn')
                .update(updateData)
                .eq('id_proposal', id)
                .select()
                .single();

            if (error) throw error;

            // Update status KKN
            await supabase
                .from('kkn')
                .update({ status_proposal: 'pending' })
                .eq('id_kkn', proposal.id_kkn);

            // Catat riwayat
            await this.catatRiwayat(proposal.id_kkn, 'Revisi Proposal', 'Proposal direvisi dan diajukan ulang');

            res.status(200).json({
                success: true,
                message: 'Proposal berhasil diperbarui',
                data
            });

        } catch (error) {
            console.error('Error updateProposal:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Input luaran
    async inputLuaran(req, res) {
        try {
            const user = req.user;
            const { judul, deskripsi, linkVideo, linkPoster, linkFoto, keterangan } = req.body;
            const file = req.file;

            // Validasi
            if (!judul || !deskripsi || !linkVideo || !linkPoster || !linkFoto || !file) {
                return res.status(400).json({
                    success: false,
                    message: 'Semua field harus diisi'
                });
            }

            // Cek KKN user
            const { data: kkn } = await supabase
                .from('kkn')
                .select('id_kkn, status_proposal')
                .eq('nim', user.nim)
                .single();

            if (!kkn) {
                return res.status(400).json({
                    success: false,
                    message: 'Anda belum mendaftar KKN'
                });
            }

            if (kkn.status_proposal !== 'diterima') {
                return res.status(400).json({
                    success: false,
                    message: 'Proposal harus diterima terlebih dahulu'
                });
            }

            // Upload file MOU
            const mouPath = await this.uploadFile(file, 'mou', user.nim);

            // Simpan luaran
            const { data: luaran, error } = await supabase
                .from('luaran_kkn')
                .insert([{
                    id_kkn: kkn.id_kkn,
                    judul_kegiatan: judul,
                    deskripsi_kegiatan: deskripsi,
                    link_video: linkVideo,
                    link_poster: linkPoster,
                    link_foto: linkFoto,
                    file_mou: mouPath,
                    keterangan: keterangan,
                    status: 'pending',
                    tanggal_upload: new Date().toISOString()
                }])
                .select()
                .single();

            if (error) throw error;

            // Update status KKN
            await supabase
                .from('kkn')
                .update({ status_luaran: 'pending' })
                .eq('id_kkn', kkn.id_kkn);

            // Catat riwayat
            await this.catatRiwayat(kkn.id_kkn, 'Input Luaran', 'Luaran KKN berhasil diupload');

            res.status(201).json({
                success: true,
                message: 'Luaran berhasil disimpan',
                data: luaran
            });

        } catch (error) {
            console.error('Error inputLuaran:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get luaran
    async getLuaran(req, res) {
        try {
            const user = req.user;

            const { data: kkn } = await supabase
                .from('kkn')
                .select('id_kkn')
                .eq('nim', user.nim)
                .single();

            if (!kkn) {
                return res.status(200).json({
                    success: true,
                    data: []
                });
            }

            const { data: luaran, error } = await supabase
                .from('luaran_kkn')
                .select('*')
                .eq('id_kkn', kkn.id_kkn)
                .order('created_at', { ascending: false });

            if (error) throw error;

            res.status(200).json({
                success: true,
                data: luaran || []
            });

        } catch (error) {
            console.error('Error getLuaran:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get riwayat KKN
    async getRiwayatKKN(req, res) {
        try {
            const user = req.user;

            const { data: kkn } = await supabase
                .from('kkn')
                .select('id_kkn')
                .eq('nim', user.nim)
                .single();

            if (!kkn) {
                return res.status(200).json({
                    success: true,
                    data: []
                });
            }

            const { data: riwayat, error } = await supabase
                .from('riwayat_kkn')
                .select('*')
                .eq('id_kkn', kkn.id_kkn)
                .order('created_at', { ascending: false });

            if (error) throw error;

            res.status(200).json({
                success: true,
                data: riwayat || []
            });

        } catch (error) {
            console.error('Error getRiwayatKKN:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Get daftar desa
    async getDaftarDesa(req, res) {
        try {
            const { data: desa, error } = await supabase
                .from('desa_kkn')
                .select('*')
                .order('nama_desa');

            if (error) throw error;

            res.status(200).json({
                success: true,
                data: desa
            });

        } catch (error) {
            console.error('Error getDaftarDesa:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Pilih desa
    async pilihDesa(req, res) {
        try {
            const user = req.user;
            const { idDesa } = req.body;

            if (!idDesa) {
                return res.status(400).json({
                    success: false,
                    message: 'ID desa harus diisi'
                });
            }

            // Cek ketersediaan kuota
            const { data: desa } = await supabase
                .from('desa_kkn')
                .select('*')
                .eq('id_desa', idDesa)
                .single();

            if (!desa) {
                return res.status(404).json({
                    success: false,
                    message: 'Desa tidak ditemukan'
                });
            }

            if (desa.kuota_terisi >= desa.kuota) {
                return res.status(400).json({
                    success: false,
                    message: 'Kuota desa sudah penuh'
                });
            }

            // Update pilihan desa
            const { data: kkn, error } = await supabase
                .from('kkn')
                .update({ id_desa: idDesa })
                .eq('nim', user.nim)
                .select()
                .single();

            if (error) throw error;

            // Update kuota desa
            await supabase
                .from('desa_kkn')
                .update({ kuota_terisi: desa.kuota_terisi + 1 })
                .eq('id_desa', idDesa);

            // Catat riwayat
            await this.catatRiwayat(kkn.id_kkn, 'Pilih Desa', `Memilih desa ${desa.nama_desa}`);

            res.status(200).json({
                success: true,
                message: 'Desa berhasil dipilih',
                data: kkn
            });

        } catch (error) {
            console.error('Error pilihDesa:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Verifikasi pendaftaran (Admin/Dosen)
    async verifikasiPendaftaran(req, res) {
        try {
            const { id } = req.params;
            const { status, keterangan } = req.body;

            if (!status || !['diterima', 'ditolak', 'revisi'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Status tidak valid'
                });
            }

            // Update pendaftaran
            const { data: kkn, error } = await supabase
                .from('kkn')
                .update({ 
                    status_pendaftaran: status,
                    keterangan_pendaftaran: keterangan,
                    diverifikasi_oleh: req.user.nim,
                    tanggal_verifikasi: new Date().toISOString()
                })
                .eq('id_kkn', id)
                .select()
                .single();

            if (error) throw error;

            // Jika ditolak, update kuota desa
            if (status === 'ditolak' && kkn.id_desa) {
                const { data: desa } = await supabase
                    .from('desa_kkn')
                    .select('kuota_terisi')
                    .eq('id_desa', kkn.id_desa)
                    .single();

                if (desa) {
                    await supabase
                        .from('desa_kkn')
                        .update({ kuota_terisi: Math.max(0, desa.kuota_terisi - 1) })
                        .eq('id_desa', kkn.id_desa);
                }
            }

            // Catat riwayat
            await this.catatRiwayat(kkn.id_kkn, 'Verifikasi Pendaftaran', `Pendaftaran ${status}`);

            res.status(200).json({
                success: true,
                message: `Pendaftaran ${status}`,
                data: kkn
            });

        } catch (error) {
            console.error('Error verifikasiPendaftaran:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Verifikasi proposal (Admin/Dosen)
    async verifikasiProposal(req, res) {
        try {
            const { id } = req.params;
            const { status, catatan } = req.body;

            if (!status || !['diterima', 'ditolak', 'revisi'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Status tidak valid'
                });
            }

            // Update proposal
            const { data: proposal, error } = await supabase
                .from('proposal_kkn')
                .update({ 
                    status: status,
                    catatan_review: catatan,
                    direview_oleh: req.user.nim,
                    tanggal_review: new Date().toISOString()
                })
                .eq('id_proposal', id)
                .select()
                .single();

            if (error) throw error;

            // Update status KKN
            await supabase
                .from('kkn')
                .update({ status_proposal: status })
                .eq('id_kkn', proposal.id_kkn);

            // Simpan review
            await supabase
                .from('review_proposal')
                .insert([{
                    id_proposal: id,
                    reviewer: req.user.nim,
                    catatan: catatan,
                    rekomendasi: status,
                    tanggal_review: new Date().toISOString()
                }]);

            // Catat riwayat
            await this.catatRiwayat(proposal.id_kkn, 'Verifikasi Proposal', `Proposal ${status}`);

            res.status(200).json({
                success: true,
                message: `Proposal ${status}`,
                data: proposal
            });

        } catch (error) {
            console.error('Error verifikasiProposal:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Verifikasi luaran (Admin/Dosen)
    async verifikasiLuaran(req, res) {
        try {
            const { id } = req.params;
            const { status, catatan } = req.body;

            if (!status || !['diterima', 'ditolak', 'revisi'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Status tidak valid'
                });
            }

            // Update luaran
            const { data: luaran, error } = await supabase
                .from('luaran_kkn')
                .update({ 
                    status: status,
                    catatan_review: catatan,
                    diverifikasi_oleh: req.user.nim,
                    tanggal_verifikasi: new Date().toISOString()
                })
                .eq('id_luaran', id)
                .select()
                .single();

            if (error) throw error;

            // Update status KKN
            await supabase
                .from('kkn')
                .update({ status_luaran: status })
                .eq('id_kkn', luaran.id_kkn);

            // Jika semua luaran diterima, selesaikan KKN
            if (status === 'diterima') {
                const { data: allLuaran } = await supabase
                    .from('luaran_kkn')
                    .select('status')
                    .eq('id_kkn', luaran.id_kkn);

                const semuaDiterima = allLuaran.every(l => l.status === 'diterima');
                
                if (semuaDiterima) {
                    await supabase
                        .from('kkn')
                        .update({ 
                            status_keseluruhan: 'selesai',
                            tanggal_selesai: new Date().toISOString()
                        })
                        .eq('id_kkn', luaran.id_kkn);
                }
            }

            // Catat riwayat
            await this.catatRiwayat(luaran.id_kkn, 'Verifikasi Luaran', `Luaran ${status}`);

            res.status(200).json({
                success: true,
                message: `Luaran ${status}`,
                data: luaran
            });

        } catch (error) {
            console.error('Error verifikasiLuaran:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }

    // Helper: Upload file
    async uploadFile(file, type, nim) {
        const ext = path.extname(file.originalname);
        const fileName = `${type}_${nim}_${Date.now()}${ext}`;
        const uploadPath = path.join(__dirname, '../uploads/kkn', type, fileName);

        // Buat direktori jika belum ada
        const dir = path.dirname(uploadPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // Pindahkan file
        fs.renameSync(file.path, uploadPath);

        return `/uploads/kkn/${type}/${fileName}`;
    }

    // Helper: Catat riwayat
    async catatRiwayat(idKKN, tipe, deskripsi) {
        await supabase
            .from('riwayat_kkn')
            .insert([{
                id_kkn: idKKN,
                tipe_riwayat: tipe,
                deskripsi: deskripsi,
                created_at: new Date().toISOString()
            }]);
    }
}

module.exports = new KKNController();