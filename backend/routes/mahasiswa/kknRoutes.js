// routes/mahasiswa/kkn.js
const express = require('express');
const router = express.Router();
const supabase = require('../../config/database');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { upload } = require('../../middleware/upload');
const { getFileUrl } = require('../../utils/helpers');

// Semua route memerlukan autentikasi
router.use(authenticateToken);
router.use(authorizeRoles('mahasiswa'));

// Helper function untuk membersihkan path file
const cleanFilePath = (filePath) => {
    if (!filePath) return null;
    // Hapus 'uploads/' dari awal path jika ada
    return filePath.replace(/^uploads[\/\\]/, '');
};

// ===========================================
// GET PROGRAM STUDI
// ===========================================
router.get('/program-studi', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('program_studi')
            .select(`
                id_prodi,
                kode_prodi,
                nama_prodi,
                jenjang,
                akreditasi,
                fakultas!inner (
                    id_fakultas,
                    nama_fakultas
                )
            `)
            .eq('status', 'aktif')
            .order('nama_prodi');

        if (error) throw error;

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error fetching program studi:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data program studi'
        });
    }
});

// ===========================================
// GET STATUS KKN
// ===========================================
router.get('/status', async (req, res) => {
    try {
        const userId = req.user.id_user;
        
        const { data: registrasi, error } = await supabase
            .from('registrasi_kkn')
            .select(`
                *,
                desa_kkn (nama_desa)
            `)
            .eq('id_user', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json({
            success: true,
            data: {
                pendaftaran: {
                    status: registrasi?.status || 'belum_daftar',
                    tanggal: registrasi?.created_at || null,
                    desa: registrasi?.desa_kkn?.nama_desa || null
                }
            }
        });
    } catch (error) {
        console.error('Error getting status:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil status KKN'
        });
    }
});

// ===========================================
// GET DASHBOARD
// ===========================================
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user.id_user;
        
        // Ambil data registrasi
        const { data: registrasi, error: regError } = await supabase
            .from('registrasi_kkn')
            .select(`
                *,
                desa_kkn (
                    id_desa,
                    nama_desa,
                    kabupaten,
                    kecamatan
                ),
                program_studi (
                    nama_prodi
                )
            `)
            .eq('id_user', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (regError && regError.code !== 'PGRST116') {
            throw regError;
        }

        // Tambahkan URL file ke data registrasi
        if (registrasi) {
            registrasi.krs_url = getFileUrl(registrasi.krs_file);
            registrasi.khs_url = getFileUrl(registrasi.khs_file);
            registrasi.payment_url = getFileUrl(registrasi.payment_file);
        }

        // Ambil data luaran
        let luaran = [];
        if (registrasi) {
            const { data: luaranData, error: luarError } = await supabase
                .from('luaran_kkn')
                .select('*')
                .eq('id_registrasi', registrasi.id_registrasi)
                .order('created_at', { ascending: false });
            
            if (!luarError && luaranData) {
                // Tambahkan URL file ke setiap luaran
                luaran = luaranData.map(item => ({
                    ...item,
                    mou_url: getFileUrl(item.file_mou)
                }));
            }
        }

        res.json({
            success: true,
            data: {
                registrasi: registrasi || null,
                luaran: luaran
            }
        });
    } catch (error) {
        console.error('Error getting dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data dashboard'
        });
    }
});

// ===========================================
// GET RIWAYAT
// ===========================================
router.get('/riwayat', async (req, res) => {
    try {
        const userId = req.user.id_user;
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        // Ambil data registrasi
        const { data: registrasi, error: regError, count } = await supabase
            .from('registrasi_kkn')
            .select(`
                *,
                desa_kkn (nama_desa)
            `, { count: 'exact' })
            .eq('id_user', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (regError) throw regError;

        const formattedData = registrasi.map(item => ({
            id: item.id_registrasi,
            jenis: 'pendaftaran',
            tanggal: item.created_at,
            status: item.status,
            judul: 'Pendaftaran KKN',
            keterangan: item.desa_kkn?.nama_desa || '-',
            krs_url: getFileUrl(item.krs_file),
            khs_url: getFileUrl(item.khs_file),
            payment_url: getFileUrl(item.payment_file)
        }));

        res.json({
            success: true,
            data: formattedData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count
            }
        });
    } catch (error) {
        console.error('Error getting riwayat:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil riwayat'
        });
    }
});

// ===========================================
// GET TIMELINE
// ===========================================
router.get('/timeline', async (req, res) => {
    try {
        const userId = req.user.id_user;
        
        const { data: registrasi } = await supabase
            .from('registrasi_kkn')
            .select('*')
            .eq('id_user', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        const timeline = [];

        if (registrasi) {
            timeline.push({
                id: 1,
                title: 'Pendaftaran KKN',
                status: registrasi.status,
                description: 'Pendaftaran telah dilakukan',
                date: registrasi.created_at,
                is_completed: ['approved', 'verified'].includes(registrasi.status),
                is_active: registrasi.status === 'pending'
            });

            if (registrasi.status === 'approved' || registrasi.status === 'verified') {
                timeline.push({
                    id: 2,
                    title: 'Pelaksanaan KKN',
                    status: 'active',
                    description: 'KKN sedang berlangsung',
                    date: null,
                    is_completed: false,
                    is_active: true
                });

                // Cek luaran
                const { count } = await supabase
                    .from('luaran_kkn')
                    .select('*', { count: 'exact', head: true })
                    .eq('id_registrasi', registrasi.id_registrasi);

                timeline.push({
                    id: 3,
                    title: 'Luaran KKN',
                    status: count > 0 ? 'completed' : 'pending',
                    description: count > 0 ? `${count} luaran telah diupload` : 'Upload luaran setelah pelaksanaan',
                    date: null,
                    is_completed: count > 0,
                    is_active: false
                });
            }
        } else {
            timeline.push({
                id: 1,
                title: 'Pendaftaran KKN',
                status: 'pending',
                description: 'Belum melakukan pendaftaran',
                date: null,
                is_completed: false,
                is_active: false
            });
        }

        res.json({
            success: true,
            data: timeline
        });
    } catch (error) {
        console.error('Error getting timeline:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil timeline'
        });
    }
});

// ===========================================
// GET LUARAN
// ===========================================
router.get('/luaran', async (req, res) => {
    try {
        const userId = req.user.id_user;
        
        // Cari registrasi terlebih dahulu
        const { data: registrasi } = await supabase
            .from('registrasi_kkn')
            .select('id_registrasi')
            .eq('id_user', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!registrasi) {
            return res.json({ success: true, data: [] });
        }

        const { data, error } = await supabase
            .from('luaran_kkn')
            .select('*')
            .eq('id_registrasi', registrasi.id_registrasi)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Tambahkan URL file ke setiap luaran
        const formattedData = data.map(item => ({
            ...item,
            mou_url: getFileUrl(item.file_mou)
        }));

        res.json({
            success: true,
            data: formattedData
        });
    } catch (error) {
        console.error('Error getting luaran:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data luaran'
        });
    }
});

// ===========================================
// GET DESA TERSEDIA
// ===========================================
router.get('/desa-tersedia', async (req, res) => {
    try {
        const { search, kabupaten } = req.query;

        // Query dasar - ambil semua desa aktif
        let query = supabase
            .from('desa_kkn')
            .select(`
                id_desa,
                nama_desa,
                kecamatan,
                kabupaten,
                provinsi,
                kuota,
                kuota_terisi,
                deskripsi,
                nama_pembimbing_lapangan,
                kontak_pembimbing_lapangan,
                alamat,
                status
            `)
            .eq('status', 'aktif')
            .order('nama_desa');

        // Filter berdasarkan pencarian
        if (search) {
            query = query.or(`nama_desa.ilike.%${search}%,kecamatan.ilike.%${search}%`);
        }

        // Filter berdasarkan kabupaten
        if (kabupaten) {
            query = query.eq('kabupaten', kabupaten);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Filter desa yang masih punya kuota
        const desaDenganKuota = data.filter(desa => {
            const kuotaTerisi = desa.kuota_terisi || 0;
            const kuota = desa.kuota || 30;
            return kuotaTerisi < kuota;
        });

        // Format data
        const formattedData = desaDenganKuota.map(desa => {
            const kuotaTerisi = desa.kuota_terisi || 0;
            const kuota = desa.kuota || 30;
            const sisaKuota = kuota - kuotaTerisi;
            const persentaseTerisi = kuota > 0 ? Math.round((kuotaTerisi / kuota) * 100) : 0;

            return {
                ...desa,
                sisa_kuota: sisaKuota,
                status_kuota: sisaKuota <= 0 ? 'penuh' : 'tersedia',
                persentase_terisi: persentaseTerisi
            };
        });

        res.json({
            success: true,
            data: formattedData,
            meta: {
                total: formattedData.length,
                total_all: data.length,
                filter: {
                    search: search || null,
                    kabupaten: kabupaten || null
                }
            }
        });
    } catch (error) {
        console.error('Error fetching desa tersedia:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data desa',
            error: error.message
        });
    }
});

// ===========================================
// GET KABUPATEN LIST
// ===========================================
router.get('/kabupaten-list', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('desa_kkn')
            .select('kabupaten')
            .eq('status', 'aktif')
            .order('kabupaten');

        if (error) throw error;

        // Ambil unique kabupaten
        const kabupatenList = [...new Set(data.map(item => item.kabupaten))];

        res.json({
            success: true,
            data: kabupatenList
        });
    } catch (error) {
        console.error('Error fetching kabupaten list:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data kabupaten'
        });
    }
});

// ===========================================
// POST DAFTAR KKN
// ===========================================
router.post('/daftar', upload.fields([
    { name: 'krs_file', maxCount: 1 },
    { name: 'khs_file', maxCount: 1 },
    { name: 'payment_file', maxCount: 1 }
]), async (req, res) => {
    try {
        const userId = req.user.id_user;
        const files = req.files;

        // Validasi file
        if (!files || !files.krs_file || !files.khs_file || !files.payment_file) {
            return res.status(400).json({
                success: false,
                message: 'Semua file wajib diupload'
            });
        }

        // Validasi input
        const { id_prodi, id_desa, no_hp, semester, ukuran_jaket } = req.body;
        
        if (!id_prodi || !id_desa || !no_hp || !semester || !ukuran_jaket) {
            return res.status(400).json({
                success: false,
                message: 'Semua field wajib diisi'
            });
        }

        // Cek apakah sudah pernah daftar
        const { data: existing } = await supabase
            .from('registrasi_kkn')
            .select('id_registrasi')
            .eq('id_user', userId)
            .in('status', ['pending', 'approved', 'verified'])
            .maybeSingle();

        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Anda sudah memiliki pendaftaran yang aktif'
            });
        }

        // Cek kuota desa
        const { data: desa } = await supabase
            .from('desa_kkn')
            .select('kuota, kuota_terisi')
            .eq('id_desa', id_desa)
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

        // Ambil data user
        const { data: user } = await supabase
            .from('users')
            .select('nama_lengkap, email, nim')
            .eq('id_user', userId)
            .single();

        // Simpan registrasi dengan path yang sudah dibersihkan
        const registrasiData = {
            id_user: userId,
            id_desa: id_desa,
            nim: user.nim,
            nama_lengkap: user.nama_lengkap,
            email: user.email,
            id_prodi: id_prodi,
            no_hp: no_hp,
            angkatan: parseInt(semester),
            ukuran_jaket: ukuran_jaket,
            krs_file: cleanFilePath(files.krs_file[0].path),
            khs_file: cleanFilePath(files.khs_file[0].path),
            payment_file: cleanFilePath(files.payment_file[0].path),
            status: 'pending',
            tanggal_daftar: new Date(),
            created_at: new Date(),
            updated_at: new Date()
        };

        const { data: result, error } = await supabase
            .from('registrasi_kkn')
            .insert([registrasiData])
            .select()
            .single();

        if (error) throw error;

        // Tambahkan URL file ke response
        res.json({
            success: true,
            message: 'Pendaftaran KKN berhasil',
            data: {
                ...result,
                krs_url: getFileUrl(result.krs_file),
                khs_url: getFileUrl(result.khs_file),
                payment_url: getFileUrl(result.payment_file)
            }
        });

    } catch (error) {
        console.error('Error daftar KKN:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mendaftar KKN'
        });
    }
});

// ===========================================
// GET DETAIL REGISTRASI
// ===========================================
router.get('/riwayat/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_user;

        const { data, error } = await supabase
            .from('registrasi_kkn')
            .select(`
                *,
                desa_kkn (
                    id_desa,
                    nama_desa,
                    kecamatan,
                    kabupaten,
                    provinsi
                ),
                program_studi (
                    nama_prodi,
                    jenjang
                )
            `)
            .eq('id_registrasi', id)
            .eq('id_user', userId)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({
                success: false,
                message: 'Data tidak ditemukan'
            });
        }

        // Tambahkan URL file
        data.krs_url = getFileUrl(data.krs_file);
        data.khs_url = getFileUrl(data.khs_file);
        data.payment_url = getFileUrl(data.payment_file);

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error getting detail registrasi:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil detail registrasi'
        });
    }
});

// ===========================================
// POST LUARAN
// ===========================================
router.post('/luaran/simpan', upload.single('mou_file'), async (req, res) => {
    try {
        const userId = req.user.id_user;
        const file = req.file;

        const { judul_kegiatan, link_video, link_poster, link_foto, keterangan } = req.body;

        if (!judul_kegiatan) {
            return res.status(400).json({
                success: false,
                message: 'Judul kegiatan wajib diisi'
            });
        }

        // Cari registrasi terbaru yang sudah approved
        const { data: registrasi } = await supabase
            .from('registrasi_kkn')
            .select('id_registrasi')
            .eq('id_user', userId)
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!registrasi) {
            return res.status(400).json({
                success: false,
                message: 'Anda harus terdaftar KKN dengan status approved untuk mengupload luaran'
            });
        }

        const luaranData = {
            id_registrasi: registrasi.id_registrasi,
            judul_kegiatan: judul_kegiatan,
            link_video: link_video || null,
            link_poster: link_poster || null,
            link_foto: link_foto || null,
            file_mou: file ? cleanFilePath(file.path) : null,
            keterangan: keterangan || null,
            status: 'pending',
            tanggal_submit: new Date(),
            created_at: new Date(),
            updated_at: new Date()
        };

        const { data: result, error } = await supabase
            .from('luaran_kkn')
            .insert([luaranData])
            .select()
            .single();

        if (error) throw error;

        // Tambahkan URL file ke response
        res.json({
            success: true,
            message: 'Luaran berhasil disimpan',
            data: {
                ...result,
                mou_url: getFileUrl(result.file_mou)
            }
        });

    } catch (error) {
        console.error('Error simpan luaran:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menyimpan luaran'
        });
    }
});

// ===========================================
// GET DETAIL LUARAN
// ===========================================
router.get('/luaran/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_user;

        const { data, error } = await supabase
            .from('luaran_kkn')
            .select(`
                *,
                registrasi_kkn!inner (
                    id_user,
                    desa_kkn (
                        nama_desa,
                        kabupaten
                    )
                )
            `)
            .eq('id_luaran', id)
            .single();

        if (error) throw error;

        // Validasi kepemilikan
        if (data.registrasi_kkn.id_user !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Anda tidak memiliki akses ke luaran ini'
            });
        }

        // Tambahkan URL file
        data.mou_url = getFileUrl(data.file_mou);

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error getting detail luaran:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil detail luaran'
        });
    }
});

// ===========================================
// UPDATE LUARAN
// ===========================================
router.put('/luaran/:id', upload.single('mou_file'), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_user;
        const file = req.file;

        const { judul_kegiatan, link_video, link_poster, link_foto, keterangan } = req.body;

        // Cek kepemilikan dan status
        const { data: existing } = await supabase
            .from('luaran_kkn')
            .select(`
                *,
                registrasi_kkn!inner (id_user)
            `)
            .eq('id_luaran', id)
            .single();

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Luaran tidak ditemukan'
            });
        }

        if (existing.registrasi_kkn.id_user !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Anda tidak memiliki akses ke luaran ini'
            });
        }

        if (existing.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Luaran tidak dapat diupdate karena sudah diproses'
            });
        }

        const updateData = {
            judul_kegiatan: judul_kegiatan || existing.judul_kegiatan,
            link_video: link_video || existing.link_video,
            link_poster: link_poster || existing.link_poster,
            link_foto: link_foto || existing.link_foto,
            keterangan: keterangan || existing.keterangan,
            updated_at: new Date()
        };

        if (file) {
            updateData.file_mou = cleanFilePath(file.path);
        }

        const { data: result, error } = await supabase
            .from('luaran_kkn')
            .update(updateData)
            .eq('id_luaran', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Luaran berhasil diupdate',
            data: {
                ...result,
                mou_url: getFileUrl(result.file_mou)
            }
        });

    } catch (error) {
        console.error('Error update luaran:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengupdate luaran'
        });
    }
});

// ===========================================
// DELETE LUARAN
// ===========================================
router.delete('/luaran/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_user;

        // Cek kepemilikan dan status
        const { data: existing } = await supabase
            .from('luaran_kkn')
            .select(`
                *,
                registrasi_kkn!inner (id_user)
            `)
            .eq('id_luaran', id)
            .single();

        if (!existing) {
            return res.status(404).json({
                success: false,
                message: 'Luaran tidak ditemukan'
            });
        }

        if (existing.registrasi_kkn.id_user !== userId) {
            return res.status(403).json({
                success: false,
                message: 'Anda tidak memiliki akses ke luaran ini'
            });
        }

        if (existing.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Hanya luaran dengan status pending yang dapat dihapus'
            });
        }

        const { error } = await supabase
            .from('luaran_kkn')
            .delete()
            .eq('id_luaran', id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Luaran berhasil dihapus'
        });

    } catch (error) {
        console.error('Error delete luaran:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menghapus luaran'
        });
    }
});

module.exports = router;