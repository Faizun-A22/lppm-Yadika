const supabase = require('../../config/database');
const bcrypt = require('bcryptjs');

// ===========================================
// GET PROFILE DOSEN
// ===========================================
exports.getProfile = async (req, res) => {
    try {
        const userId = req.user.id_user;

        // Query untuk mengambil data profil dosen dengan relasi ke prodi dan fakultas
        const { data: profile, error } = await supabase
            .from('users')
            .select(`
                id_user,
                nama_lengkap,
                email,
                nidn,
                no_hp,
                foto_profil,
                created_at,
                updated_at,
                program_studi:program_studi!users_id_prodi_fkey (
                    id_prodi,
                    nama_prodi,
                    jenjang,
                    akreditasi,
                    fakultas:fakultas!program_studi_id_fakultas_fkey (
                        id_fakultas,
                        nama_fakultas
                    )
                )
            `)
            .eq('id_user', userId)
            .eq('role', 'dosen')
            .eq('status', 'aktif')
            .single();

        if (error || !profile) {
            console.error('Error fetching profile:', error);
            return res.status(404).json({
                success: false,
                message: 'Profil dosen tidak ditemukan'
            });
        }

        // Query untuk mengambil data dosen dari tabel dosen_info
        const { data: dosenInfo, error: infoError } = await supabase
            .from('dosen_info')
            .select('*')
            .eq('id_user', userId)
            .single();

        // Query untuk mengambil riwayat pendidikan
        const { data: pendidikan, error: pendidikanError } = await supabase
            .from('dosen_pendidikan')
            .select('*')
            .eq('id_user', userId)
            .order('tahun_lulus', { ascending: false });

        // Query untuk mengambil ID peneliti
        const { data: researcherIds, error: researcherError } = await supabase
            .from('dosen_researcher_id')
            .select('*')
            .eq('id_user', userId)
            .single();

        // Format response (tanpa jabatan)
        const formattedProfile = {
            id_user: profile.id_user,
            nama_lengkap: profile.nama_lengkap,
            email: profile.email,
            nidn: profile.nidn,
            no_hp: profile.no_hp,
            foto_profil: profile.foto_profil,
            created_at: profile.created_at,
            updated_at: profile.updated_at,
            id_prodi: profile.program_studi?.id_prodi,
            nama_prodi: profile.program_studi?.nama_prodi,
            jenjang_prodi: profile.program_studi?.jenjang,
            akreditasi_prodi: profile.program_studi?.akreditasi,
            id_fakultas: profile.program_studi?.fakultas?.id_fakultas,
            nama_fakultas: profile.program_studi?.fakultas?.nama_fakultas,
            info_pribadi: dosenInfo || null,
            riwayat_pendidikan: pendidikan || [],
            researcher_ids: researcherIds || {
                scholar_id: '',
                orcid: '',
                scopus_id: '',
                sinta_id: ''
            }
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
// UPDATE PROFILE DOSEN (TANPA JABATAN)
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
            agama,
            alamat,
            scholar_id,
            orcid,
            scopus_id,
            sinta_id,
            id_prodi
        } = req.body;

        // Validasi input
        if (!nama_lengkap || !no_hp) {
            return res.status(400).json({
                success: false,
                message: 'Nama lengkap dan nomor HP harus diisi'
            });
        }

        // Update tabel users
        const updateData = {
            nama_lengkap: nama_lengkap,
            no_hp: no_hp,
            updated_at: new Date()
        };
        
        if (id_prodi && id_prodi !== '') {
            updateData.id_prodi = id_prodi;
        }

        const { error: userError } = await supabase
            .from('users')
            .update(updateData)
            .eq('id_user', userId)
            .eq('role', 'dosen');

        if (userError) throw userError;

        // Update atau insert dosen_info
        const { data: existingInfo, error: checkError } = await supabase
            .from('dosen_info')
            .select('id_info')
            .eq('id_user', userId)
            .single();

        if (existingInfo) {
            const { error: updateError } = await supabase
                .from('dosen_info')
                .update({
                    tempat_lahir: tempat_lahir || null,
                    tanggal_lahir: tanggal_lahir || null,
                    jenis_kelamin: jenis_kelamin || null,
                    agama: agama || null,
                    alamat: alamat || null,
                    updated_at: new Date()
                })
                .eq('id_user', userId);
            if (updateError) throw updateError;
        } else {
            const { error: insertError } = await supabase
                .from('dosen_info')
                .insert([{
                    id_user: userId,
                    tempat_lahir: tempat_lahir || null,
                    tanggal_lahir: tanggal_lahir || null,
                    jenis_kelamin: jenis_kelamin || null,
                    agama: agama || null,
                    alamat: alamat || null
                }]);
            if (insertError) throw insertError;
        }

        // Update researcher IDs
        const { data: existingResearcher, error: checkResearcherError } = await supabase
            .from('dosen_researcher_id')
            .select('id_researcher')
            .eq('id_user', userId)
            .single();

        if (existingResearcher) {
            const { error: updateResearcherError } = await supabase
                .from('dosen_researcher_id')
                .update({
                    scholar_id: scholar_id || null,
                    orcid: orcid || null,
                    scopus_id: scopus_id || null,
                    sinta_id: sinta_id || null,
                    updated_at: new Date()
                })
                .eq('id_user', userId);
            if (updateResearcherError) throw updateResearcherError;
        } else {
            const { error: insertResearcherError } = await supabase
                .from('dosen_researcher_id')
                .insert([{
                    id_user: userId,
                    scholar_id: scholar_id || null,
                    orcid: orcid || null,
                    scopus_id: scopus_id || null,
                    sinta_id: sinta_id || null
                }]);
            if (insertResearcherError) throw insertResearcherError;
        }

        // Log aktivitas
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: userId,
                aktivitas: 'Memperbarui profil'
            }]);

        // Ambil data terbaru
        const { data: updatedUser, error: userDataError } = await supabase
            .from('users')
            .select(`
                id_user,
                nama_lengkap,
                email,
                nidn,
                no_hp,
                foto_profil,
                program_studi:program_studi!users_id_prodi_fkey (
                    id_prodi,
                    nama_prodi,
                    fakultas:fakultas!program_studi_id_fakultas_fkey (
                        id_fakultas,
                        nama_fakultas
                    )
                )
            `)
            .eq('id_user', userId)
            .single();

        const { data: updatedInfo } = await supabase
            .from('dosen_info')
            .select('*')
            .eq('id_user', userId)
            .single();

        const { data: updatedResearcher } = await supabase
            .from('dosen_researcher_id')
            .select('*')
            .eq('id_user', userId)
            .single();

        const formattedProfile = {
            ...updatedUser,
            info_pribadi: updatedInfo || null,
            researcher_ids: updatedResearcher || {}
        };

        res.json({
            success: true,
            message: 'Profil berhasil diperbarui',
            data: formattedProfile
        });

    } catch (error) {
        console.error('Error updateProfile:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Terjadi kesalahan server',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
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
            .eq('role', 'dosen');

        if (error) throw error;

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
// GET STATISTIK KINERJA DOSEN
// ===========================================
exports.getStatistik = async (req, res) => {
    try {
        const userId = req.user.id_user;

        // Hitung penelitian
        const { count: penelitianCount, error: penelitianError } = await supabase
            .from('penelitian')
            .select('*', { count: 'exact', head: true })
            .eq('ketua_peneliti', userId);

        if (penelitianError) throw penelitianError;

        // Hitung penelitian sebagai anggota
        const { data: anggotaPenelitian, error: anggotaError } = await supabase
            .from('anggota_penelitian')
            .select('id_penelitian')
            .eq('id_user', userId);

        if (anggotaError) throw anggotaError;

        // Hitung pengabdian
        const { count: pengabdianCount, error: pengabdianError } = await supabase
            .from('pengabdian')
            .select('*', { count: 'exact', head: true })
            .eq('ketua_pengabdian', userId);

        if (pengabdianError) throw pengabdianError;

        // Hitung pengabdian sebagai anggota
        const { data: anggotaPengabdian, error: anggotaPengabdianError } = await supabase
            .from('anggota_pengabdian')
            .select('id_pengabdian')
            .eq('id_user', userId);

        if (anggotaPengabdianError) throw anggotaPengabdianError;

        // Hitung jurnal
        const { count: jurnalCount, error: jurnalError } = await supabase
            .from('jurnal')
            .select('*', { count: 'exact', head: true })
            .eq('penulis_utama', userId);

        if (jurnalError) throw jurnalError;

        // Hitung jurnal sebagai penulis
        const { data: penulisJurnal, error: penulisError } = await supabase
            .from('jurnal_penulis')
            .select('id_jurnal')
            .eq('id_user', userId);

        if (penulisError) throw penulisError;

        res.json({
            success: true,
            data: {
                penelitian: (penelitianCount || 0) + (anggotaPenelitian?.length || 0),
                pengabdian: (pengabdianCount || 0) + (anggotaPengabdian?.length || 0),
                publikasi: (jurnalCount || 0) + (penulisJurnal?.length || 0),
                mahasiswa_bimbingan: await getMahasiswaBimbinganCount(userId),
                hki: 0
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

// Helper function untuk menghitung mahasiswa bimbingan
async function getMahasiswaBimbinganCount(dosenId) {
    try {
        const { count, error } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('dosen_pembimbing', dosenId)
            .eq('role', 'mahasiswa');

        if (error) return 0;
        return count || 0;
    } catch {
        return 0;
    }
}

// ===========================================
// GET RIWAYAT PENDIDIKAN
// ===========================================
exports.getRiwayatPendidikan = async (req, res) => {
    try {
        const userId = req.user.id_user;

        const { data: pendidikan, error } = await supabase
            .from('dosen_pendidikan')
            .select('*')
            .eq('id_user', userId)
            .order('tahun_lulus', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: pendidikan
        });

    } catch (error) {
        console.error('Error getRiwayatPendidikan:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// TAMBAH RIWAYAT PENDIDIKAN
// ===========================================
exports.addRiwayatPendidikan = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const {
            jenjang,
            institusi,
            tahun_masuk,
            tahun_lulus,
            gelar,
            judul_tesis,
            bidang_studi
        } = req.body;

        // Validasi
        if (!jenjang || !institusi || !tahun_lulus) {
            return res.status(400).json({
                success: false,
                message: 'Jenjang, institusi, dan tahun lulus harus diisi'
            });
        }

        const { data, error } = await supabase
            .from('dosen_pendidikan')
            .insert([{
                id_user: userId,
                jenjang,
                institusi,
                tahun_masuk: tahun_masuk || null,
                tahun_lulus,
                gelar: gelar || null,
                judul_tesis: judul_tesis || null,
                bidang_studi: bidang_studi || null
            }])
            .select()
            .single();

        if (error) throw error;

        // Log aktivitas
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: userId,
                aktivitas: `Menambah riwayat pendidikan ${jenjang} - ${institusi}`
            }]);

        res.json({
            success: true,
            message: 'Riwayat pendidikan berhasil ditambahkan',
            data
        });

    } catch (error) {
        console.error('Error addRiwayatPendidikan:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// UPDATE RIWAYAT PENDIDIKAN
// ===========================================
exports.updateRiwayatPendidikan = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const { id_pendidikan } = req.params;
        const updates = req.body;

        // Cek kepemilikan
        const { data: existing, error: checkError } = await supabase
            .from('dosen_pendidikan')
            .select('id_pendidikan')
            .eq('id_pendidikan', id_pendidikan)
            .eq('id_user', userId)
            .single();

        if (checkError || !existing) {
            return res.status(404).json({
                success: false,
                message: 'Riwayat pendidikan tidak ditemukan'
            });
        }

        const { data, error } = await supabase
            .from('dosen_pendidikan')
            .update({
                ...updates,
                updated_at: new Date()
            })
            .eq('id_pendidikan', id_pendidikan)
            .eq('id_user', userId)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Riwayat pendidikan berhasil diperbarui',
            data
        });

    } catch (error) {
        console.error('Error updateRiwayatPendidikan:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// HAPUS RIWAYAT PENDIDIKAN
// ===========================================
exports.deleteRiwayatPendidikan = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const { id_pendidikan } = req.params;

        // Cek kepemilikan
        const { data: existing, error: checkError } = await supabase
            .from('dosen_pendidikan')
            .select('id_pendidikan')
            .eq('id_pendidikan', id_pendidikan)
            .eq('id_user', userId)
            .single();

        if (checkError || !existing) {
            return res.status(404).json({
                success: false,
                message: 'Riwayat pendidikan tidak ditemukan'
            });
        }

        const { error } = await supabase
            .from('dosen_pendidikan')
            .delete()
            .eq('id_pendidikan', id_pendidikan)
            .eq('id_user', userId);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Riwayat pendidikan berhasil dihapus'
        });

    } catch (error) {
        console.error('Error deleteRiwayatPendidikan:', error);
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
            .eq('role', 'dosen')
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
// GET PUBLIKASI TERBARU
// ===========================================
exports.getPublikasiTerbaru = async (req, res) => {
    try {
        const userId = req.user.id_user;
        const { limit = 5 } = req.query;

        // Cari jurnal sebagai penulis utama
        const { data: jurnalUtama, error: errorUtama } = await supabase
            .from('jurnal')
            .select(`
                id_jurnal,
                judul,
                abstrak,
                file_pdf,
                status,
                tanggal_publish,
                created_at,
                jenis_jurnal:jenis_jurnal (*)
            `)
            .eq('penulis_utama', userId)
            .eq('status', 'diterima')
            .order('tanggal_publish', { ascending: false })
            .limit(limit);

        if (errorUtama) {
            console.error('Error jurnalUtama:', errorUtama);
            throw errorUtama;
        }

        // Cari jurnal sebagai penulis
        const { data: jurnalPenulis, error: errorPenulis } = await supabase
            .from('jurnal_penulis')
            .select(`
                id_jurnal,
                peran,
                jurnal:jurnal (
                    id_jurnal,
                    judul,
                    abstrak,
                    file_pdf,
                    status,
                    tanggal_publish,
                    created_at,
                    jenis_jurnal:jenis_jurnal (*)
                )
            `)
            .eq('id_user', userId);

        if (errorPenulis) {
            console.error('Error jurnalPenulis:', errorPenulis);
            throw errorPenulis;
        }

        // Filter jurnal penulis yang statusnya 'diterima'
        const jurnalPenulisFiltered = (jurnalPenulis || [])
            .filter(jp => jp.jurnal && jp.jurnal.status === 'diterima')
            .map(jp => ({
                id: jp.jurnal.id_jurnal,
                judul: jp.jurnal.judul,
                abstrak: jp.jurnal.abstrak,
                tanggal: jp.jurnal.tanggal_publish || jp.jurnal.created_at,
                jenis: jp.jurnal.jenis_jurnal?.nama_jurnal || 'Jurnal',
                peran: jp.peran || 'Penulis'
            }));

        // Format jurnal utama
        const jurnalUtamaFormatted = (jurnalUtama || [])
            .filter(j => j.status === 'diterima')
            .map(j => ({
                id: j.id_jurnal,
                judul: j.judul,
                abstrak: j.abstrak,
                tanggal: j.tanggal_publish || j.created_at,
                jenis: j.jenis_jurnal?.nama_jurnal || 'Jurnal',
                peran: 'Penulis Utama'
            }));

        // Gabungkan dan urutkan berdasarkan tanggal
        const publikasi = [...jurnalUtamaFormatted, ...jurnalPenulisFiltered]
            .sort((a, b) => {
                const dateA = a.tanggal ? new Date(a.tanggal) : new Date(0);
                const dateB = b.tanggal ? new Date(b.tanggal) : new Date(0);
                return dateB - dateA;
            })
            .slice(0, parseInt(limit));

        res.json({
            success: true,
            data: publikasi
        });

    } catch (error) {
        console.error('Error getPublikasiTerbaru:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ===========================================
// EXPORT DATA KINERJA
// ===========================================
exports.exportDataKinerja = async (req, res) => {
    try {
        const userId = req.user.id_user;

        // Ambil data profil
        const profile = await exports.getProfile(req, res, true);
        
        // Ambil statistik
        const statistik = await exports.getStatistik(req, res, true);
        
        // Ambil publikasi
        const publikasi = await exports.getPublikasiTerbaru(req, res, true);
        
        // Ambil penelitian
        const { data: penelitian, error: penelitianError } = await supabase
            .from('penelitian')
            .select('*')
            .or(`ketua_peneliti.eq.${userId},anggota_penelitian.id_user.eq.${userId}`)
            .order('tahun', { ascending: false });

        if (penelitianError) throw penelitianError;

        // Ambil pengabdian
        const { data: pengabdian, error: pengabdianError } = await supabase
            .from('pengabdian')
            .select('*')
            .or(`ketua_pengabdian.eq.${userId},anggota_pengabdian.id_user.eq.${userId}`)
            .order('tahun', { ascending: false });

        if (pengabdianError) throw pengabdianError;

        const data = {
            profil: profile?.data || {},
            statistik: statistik?.data || {},
            publikasi: publikasi?.data || [],
            penelitian: penelitian || [],
            pengabdian: pengabdian || [],
            exported_at: new Date().toISOString()
        };

        res.json({
            success: true,
            data
        });

    } catch (error) {
        console.error('Error exportDataKinerja:', error);
        res.status(500).json({
            success: false,
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};