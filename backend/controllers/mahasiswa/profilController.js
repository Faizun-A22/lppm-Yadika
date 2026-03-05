const supabase = require('../../config/database');
const bcrypt = require('bcryptjs');

// ===========================================
// GET PROFILE MAHASISWA
// ===========================================
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id_user; // Sesuaikan dengan field dari middleware auth

        // Query untuk mengambil data profil mahasiswa dengan relasi ke prodi dan fakultas
        const { data: profile, error } = await supabase
            .from('users')
            .select(`
                id_user,
                nama_lengkap,
                email,
                nim,
                no_hp,
                foto_profil,
                created_at,
                updated_at,
                program_studi:program_studi!users_id_prodi_fkey (
                    id_prodi,
                    nama_prodi,
                    jenjang,
                    fakultas:fakultas!program_studi_id_fakultas_fkey (
                        id_fakultas,
                        nama_fakultas
                    )
                )
            `)
            .eq('id_user', userId)
            .eq('role', 'mahasiswa')
            .eq('status', 'aktif')
            .single();

        if (error || !profile) {
            console.error('Error fetching profile:', error);
            return res.status(404).json({
                success: false,
                message: 'Profil mahasiswa tidak ditemukan'
            });
        }

        // Query untuk mengambil informasi pribadi tambahan
        const { data: infoPribadi, error: infoError } = await supabase
            .from('mahasiswa_info_pribadi')
            .select('*')
            .eq('id_user', userId)
            .single();

        // Format response
        const formattedProfile = {
            id_user: profile.id_user,
            nama_lengkap: profile.nama_lengkap,
            email: profile.email,
            nim: profile.nim,
            no_hp: profile.no_hp,
            foto_profil: profile.foto_profil,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
            id_prodi: profile.program_studi?.id_prodi,
            nama_prodi: profile.program_studi?.nama_prodi,
            jenjang: profile.program_studi?.jenjang,
            id_fakultas: profile.program_studi?.fakultas?.id_fakultas,
            nama_fakultas: profile.program_studi?.fakultas?.nama_fakultas,
            info_pribadi: infoPribadi || null
        };

        res.json({
            success: true,
            data: formattedProfile
        });

    } catch (error) {
        console.error('Error getProfile:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// UPDATE PROFILE MAHASISWA
// ===========================================
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const {
            nama_lengkap,
            no_hp,
            tempat_lahir,
            tanggal_lahir,
            jenis_kelamin,
            golongan_darah,
            agama,
            alamat,
            alamat_ktp
        } = req.body;

        // Validasi input
        if (!nama_lengkap || !no_hp) {
            return res.status(400).json({
                success: false,
                message: 'Nama lengkap dan nomor HP harus diisi'
            });
        }

        // Update tabel users
        const { error: userError } = await supabase
            .from('users')
            .update({
                nama_lengkap: nama_lengkap,
                no_hp: no_hp,
                updated_at: new Date()
            })
            .eq('id_user', userId)
            .eq('role', 'mahasiswa');

        if (userError) {
            throw userError;
        }

        // Cek apakah data info pribadi sudah ada
        const { data: existingInfo, error: checkError } = await supabase
            .from('mahasiswa_info_pribadi')
            .select('id_info')
            .eq('id_user', userId)
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = not found
            throw checkError;
        }

        if (existingInfo) {
            // Update data yang sudah ada
            const { error: updateError } = await supabase
                .from('mahasiswa_info_pribadi')
                .update({
                    tempat_lahir: tempat_lahir || null,
                    tanggal_lahir: tanggal_lahir || null,
                    jenis_kelamin: jenis_kelamin || null,
                    golongan_darah: golongan_darah || null,
                    agama: agama || null,
                    alamat: alamat || null,
                    alamat_ktp: alamat_ktp || null,
                    updated_at: new Date()
                })
                .eq('id_user', userId);

            if (updateError) throw updateError;
        } else {
            // Insert data baru
            const { error: insertError } = await supabase
                .from('mahasiswa_info_pribadi')
                .insert([{
                    id_user: userId,
                    tempat_lahir: tempat_lahir || null,
                    tanggal_lahir: tanggal_lahir || null,
                    jenis_kelamin: jenis_kelamin || null,
                    golongan_darah: golongan_darah || null,
                    agama: agama || null,
                    alamat: alamat || null,
                    alamat_ktp: alamat_ktp || null
                }]);

            if (insertError) throw insertError;
        }

        // Log aktivitas
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: userId,
                aktivitas: 'Memperbarui profil'
            }]);

        // Ambil data terbaru
        const updatedProfile = await exports.getProfile(req, res, true);

        res.json({
            success: true,
            message: 'Profil berhasil diperbarui',
            data: updatedProfile
        });

    } catch (error) {
        console.error('Error updateProfile:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// UPLOAD FOTO PROFIL
// ===========================================
exports.uploadFotoProfil = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Tidak ada file yang diupload'
            });
        }

        const userId = req.user.id_user;
        const fotoUrl = `/uploads/profil/${req.file.filename}`;

        const { error } = await supabase
            .from('users')
            .update({
                foto_profil: fotoUrl,
                updated_at: new Date()
            })
            .eq('id_user', userId)
            .eq('role', 'mahasiswa');

        if (error) {
            throw error;
        }

        res.json({
            success: true,
            message: 'Foto profil berhasil diupload',
            data: {
                foto_profil: fotoUrl
            }
        });

    } catch (error) {
        console.error('Error uploadFotoProfil:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// GET STATISTIK PENDAFTARAN
// ===========================================
exports.getStatistik = async (req, res) => {
    try {
        const userId = req.user.id_user;

        // Query statistik dari pendaftar_kegiatan
        const { data: pendaftaran, error } = await supabase
            .from('pendaftar_kegiatan')
            .select('status_pendaftaran')
            .eq('id_user', userId);

        if (error) throw error;

        // Hitung statistik
        const total = pendaftaran.length;
        const diterima = pendaftaran.filter(p => p.status_pendaftaran === 'diterima').length;
        const menunggu = pendaftaran.filter(p => p.status_pendaftaran === 'menunggu').length;
        const review = pendaftaran.filter(p => p.status_pendaftaran === 'review').length;
        const revisi = pendaftaran.filter(p => p.status_pendaftaran === 'revisi').length;
        const selesai = pendaftaran.filter(p => p.status_pendaftaran === 'selesai').length;
        const ditolak = pendaftaran.filter(p => p.status_pendaftaran === 'ditolak').length;

        res.json({
            success: true,
            data: {
                total_pendaftaran: total,
                total_diterima: diterima,
                total_menunggu: menunggu,
                total_review: review,
                total_revisi: revisi,
                total_selesai: selesai,
                total_ditolak: ditolak
            }
        });

    } catch (error) {
        console.error('Error getStatistik:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// GET RIWAYAT PENDAFTARAN
// ===========================================
exports.getRiwayatPendaftaran = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const { filter = 'all', page = 1, limit = 10 } = req.query;
        
        const offset = (page - 1) * limit;

        // Query dasar
        let query = supabase
            .from('pendaftar_kegiatan')
            .select(`
                id_pendaftaran,
                tanggal_daftar,
                status_pendaftaran,
                catatan,
                kegiatan:kegiatan!pendaftar_kegiatan_id_kegiatan_fkey (
                    id_kegiatan,
                    nama_kegiatan,
                    jenis_kegiatan,
                    tanggal_mulai,
                    tanggal_selesai,
                    lokasi
                )
            `, { count: 'exact' })
            .eq('id_user', userId)
            .order('tanggal_daftar', { ascending: false })
            .range(offset, offset + limit - 1);

        // Tambahkan filter jika bukan 'all'
        if (filter !== 'all') {
            query = query.eq('kegiatan.jenis_kegiatan', filter);
        }

        const { data: pendaftaran, error, count } = await query;

        if (error) throw error;

        // Format response
        const items = pendaftaran.map(p => ({
            id_pendaftaran: p.id_pendaftaran,
            program: p.kegiatan?.nama_kegiatan,
            type: p.kegiatan?.jenis_kegiatan,
            date: p.tanggal_daftar,
            status: p.status_pendaftaran,
            catatan: p.catatan,
            lokasi: p.kegiatan?.lokasi,
            tanggal_mulai: p.kegiatan?.tanggal_mulai,
            tanggal_selesai: p.kegiatan?.tanggal_selesai
        }));

        res.json({
            success: true,
            data: {
                items: items,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Error getRiwayatPendaftaran:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// UBAH PASSWORD
// ===========================================
exports.changePassword = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const { oldPassword, newPassword } = req.body;

        // Validasi input
        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Password lama dan baru harus diisi'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password baru minimal 8 karakter'
            });
        }

        // Ambil password lama dari database
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('password')
            .eq('id_user', userId)
            .eq('role', 'mahasiswa')
            .eq('status', 'aktif')
            .single();

        if (userError || !user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan'
            });
        }

        // Verifikasi password lama
        const isValid = await bcrypt.compare(oldPassword, user.password);
        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: 'Password lama salah'
            });
        }

        // Hash password baru
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        const { error: updateError } = await supabase
            .from('users')
            .update({
                password: hashedPassword,
                updated_at: new Date()
            })
            .eq('id_user', userId);

        if (updateError) throw updateError;

        // Log aktivitas
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: userId,
                aktivitas: 'Mengubah password'
            }]);

        res.json({
            success: true,
            message: 'Password berhasil diubah'
        });

    } catch (error) {
        console.error('Error changePassword:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// GET DOKUMEN MAHASISWA
// ===========================================
exports.getDokumen = async (req, res) => {
    try {
        const userId = req.user.id_user;

        const { data: dokumen, error } = await supabase
            .from('mahasiswa_dokumen')
            .select('*')
            .eq('id_user', userId)
            .order('uploaded_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: dokumen
        });

    } catch (error) {
        console.error('Error getDokumen:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// UPLOAD DOKUMEN
// ===========================================
exports.uploadDokumen = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Tidak ada file yang diupload'
            });
        }

        const userId = req.user.id_user;
        const { jenis_dokumen } = req.body;
        const filePath = `/uploads/dokumen/${req.file.filename}`;

        // Validasi jenis dokumen
        const validJenis = ['ktm', 'transkrip', 'ktp', 'kk', 'ijazah', 'sertifikat'];
        if (!validJenis.includes(jenis_dokumen)) {
            return res.status(400).json({
                success: false,
                message: 'Jenis dokumen tidak valid'
            });
        }

        // Cek apakah sudah ada dokumen dengan jenis yang sama
        const { data: existingDoc, error: checkError } = await supabase
            .from('mahasiswa_dokumen')
            .select('id_dokumen')
            .eq('id_user', userId)
            .eq('jenis_dokumen', jenis_dokumen)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

        if (existingDoc) {
            // Update dokumen yang ada
            const { error: updateError } = await supabase
                .from('mahasiswa_dokumen')
                .update({
                    file_path: filePath,
                    file_size: req.file.size,
                    file_type: req.file.mimetype,
                    status_verifikasi: 'menunggu',
                    catatan_verifikasi: null,
                    tanggal_verifikasi: null,
                    diverifikasi_oleh: null,
                    updated_at: new Date()
                })
                .eq('id_user', userId)
                .eq('jenis_dokumen', jenis_dokumen);

            if (updateError) throw updateError;
        } else {
            // Insert dokumen baru
            const { error: insertError } = await supabase
                .from('mahasiswa_dokumen')
                .insert([{
                    id_user: userId,
                    nama_dokumen: req.file.originalname,
                    jenis_dokumen: jenis_dokumen,
                    file_path: filePath,
                    file_size: req.file.size,
                    file_type: req.file.mimetype,
                    status_verifikasi: 'menunggu'
                }]);

            if (insertError) throw insertError;
        }

        // Log aktivitas
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: userId,
                aktivitas: `Mengupload dokumen ${jenis_dokumen}`
            }]);

        res.json({
            success: true,
            message: 'Dokumen berhasil diupload',
            data: {
                file_path: filePath,
                file_name: req.file.originalname,
                file_size: req.file.size,
                jenis_dokumen
            }
        });

    } catch (error) {
        console.error('Error uploadDokumen:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// HAPUS DOKUMEN
// ===========================================
exports.deleteDokumen = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const { id_dokumen } = req.params;

        // Cek kepemilikan dokumen
        const { data: existingDoc, error: checkError } = await supabase
            .from('mahasiswa_dokumen')
            .select('id_dokumen')
            .eq('id_dokumen', id_dokumen)
            .eq('id_user', userId)
            .single();

        if (checkError || !existingDoc) {
            return res.status(404).json({
                success: false,
                message: 'Dokumen tidak ditemukan'
            });
        }

        // Hapus dari database
        const { error: deleteError } = await supabase
            .from('mahasiswa_dokumen')
            .delete()
            .eq('id_dokumen', id_dokumen)
            .eq('id_user', userId);

        if (deleteError) throw deleteError;

        // Log aktivitas
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: userId,
                aktivitas: 'Menghapus dokumen'
            }]);

        res.json({
            success: true,
            message: 'Dokumen berhasil dihapus'
        });

    } catch (error) {
        console.error('Error deleteDokumen:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// DOWNLOAD DATA PRIBADI (JSON)
// ===========================================
exports.downloadDataPribadi = async (req, res) => {
    try {
        const userId = req.user.id_user;

        // Ambil data profil
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select(`
                id_user,
                nama_lengkap,
                email,
                nim,
                no_hp,
                foto_profil,
                created_at,
                program_studi:program_studi!users_id_prodi_fkey (
                    nama_prodi,
                    jenjang,
                    fakultas:fakultas!program_studi_id_fakultas_fkey (
                        nama_fakultas
                    )
                )
            `)
            .eq('id_user', userId)
            .single();

        if (profileError) throw profileError;

        // Ambil info pribadi
        const { data: infoPribadi } = await supabase
            .from('mahasiswa_info_pribadi')
            .select('*')
            .eq('id_user', userId)
            .single();

        // Ambil riwayat pendaftaran
        const { data: riwayat } = await supabase
            .from('pendaftar_kegiatan')
            .select(`
                kegiatan:nama_kegiatan,
                jenis_kegiatan,
                status_pendaftaran,
                tanggal_daftar,
                catatan
            `)
            .eq('id_user', userId)
            .order('tanggal_daftar', { ascending: false });

        // Ambil dokumen
        const { data: dokumen } = await supabase
            .from('mahasiswa_dokumen')
            .select('nama_dokumen, jenis_dokumen, uploaded_at, status_verifikasi')
            .eq('id_user', userId)
            .order('uploaded_at', { ascending: false });

        // Ambil log aktivitas
        const { data: log } = await supabase
            .from('log_aktivitas')
            .select('aktivitas, waktu')
            .eq('id_user', userId)
            .order('waktu', { ascending: false })
            .limit(50);

        const data = {
            profil: {
                ...profile,
                ...infoPribadi,
                program_studi: profile.program_studi?.nama_prodi,
                jenjang: profile.program_studi?.jenjang,
                fakultas: profile.program_studi?.fakultas?.nama_fakultas
            },
            riwayat_pendaftaran: riwayat || [],
            dokumen: dokumen || [],
            aktivitas_terbaru: log || [],
            downloaded_at: new Date().toISOString()
        };

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('Error downloadDataPribadi:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};