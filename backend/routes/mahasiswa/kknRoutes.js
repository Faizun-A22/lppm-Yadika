// routes/mahasiswa/kkn.js

// GET DASHBOARD - perbaiki query
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user.id_user;
        
        // Ambil data registrasi dari tabel kkn_registration
        const { data: registrasi, error: regError } = await supabase
            .from('kkn_registration')  // ← perbaiki nama tabel
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

        // Ambil data luaran dari tabel kkn_outputs
        let luaran = [];
        if (registrasi) {
            const { data: luaranData, error: luarError } = await supabase
                .from('kkn_outputs')  // ← perbaiki nama tabel
                .select('*')
                .eq('id_registrasi', registrasi.id_registrasi)
                .order('created_at', { ascending: false });
            
            if (!luarError && luaranData) {
                luaran = luaranData;
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

// GET LUARAN - perbaiki query
router.get('/luaran', async (req, res) => {
    try {
        const userId = req.user.id_user;
        
        const { data: registrasi } = await supabase
            .from('kkn_registration')  // ← perbaiki
            .select('id_registrasi')
            .eq('id_user', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!registrasi) {
            return res.json({ success: true, data: [] });
        }

        const { data, error } = await supabase
            .from('kkn_outputs')  // ← perbaiki
            .select('*')
            .eq('id_registrasi', registrasi.id_registrasi)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error getting luaran:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data luaran'
        });
    }
});

// POST DAFTAR KKN - perbaiki insert
router.post('/daftar', upload.fields([
    { name: 'krs_file', maxCount: 1 },
    { name: 'khs_file', maxCount: 1 },
    { name: 'payment_file', maxCount: 1 }
]), async (req, res) => {
    try {
        const userId = req.user.id_user;
        const files = req.files;

        // ... validasi sama ...

        // Simpan ke tabel kkn_registration
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
            .from('kkn_registration')  // ← perbaiki
            .insert([registrasiData])
            .select()
            .single();

        // ... sisanya sama
    } catch (error) {
        // ...
    }
});

// POST SIMPAN LUARAN - perbaiki insert
router.post('/luaran/simpan', upload.single('mou_file'), async (req, res) => {
    try {
        const userId = req.user.id_user;
        const file = req.file;

        // ... validasi ...

        // Cari registrasi dari tabel kkn_registration
        const { data: registrasi } = await supabase
            .from('kkn_registration')  // ← perbaiki
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
            .from('kkn_outputs')  // ← perbaiki
            .insert([luaranData])
            .select()
            .single();

        // ... sisanya sama
    } catch (error) {
        // ...
    }
});