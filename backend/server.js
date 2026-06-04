const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const fakultasRoutes = require('./routes/fakultasRoutes');
const prodiRoutes = require('./routes/prodiRoutes'); 

// Load env
dotenv.config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const magangRoutes = require('./routes/mahasiswa/magangRoutes');
const dosenKegiatanRoutes = require('./routes/dosen/kegiatanRoutes');
// Import admin routes
const adminBeritaRoutes = require('./routes/admin/beritaRoutes');
const adminKegiatanRoutes = require('./routes/admin/kegiatanRoutes');
const dosenBeritaRoutes = require('./routes/dosen/beritaRoutes');
const adminRepositoryRoutes = require('./routes/admin/repositoryRoutes');
const app = express();
const PORT = process.env.PORT || 3000;
const mahasiswaBeritaRoutes = require('./routes/mahasiswa/beritaRoutes');
const mahasiswaKegiatanRoutes = require('./routes/mahasiswa/kegiatanRoutes');
const mahasiswaRepositoryRoutes = require('./routes/mahasiswa/repositoryRoutes');
const dosenRepositoryRoutes = require('./routes/dosen/repositoryRoutes');
const mahasiswaProfilRoutes = require('./routes/mahasiswa/profilRoutes');
const dosenProfilRoutes = require('./routes/dosen/profilRoutes');
const desaRoutes = require('./routes/admin/desaRoutes');
const programRoutes = require('./routes/admin/programRoutes'); 
const dashboardRoutes = require('./routes/admin/dashboardRoutes'); // <<< TAMBAHKAN INI
const registrasiKknRoutes = require('./routes/admin/registrasiKknRoutes'); // <<< TAMBAHKAN INI
const registrasiMagangRoutes = require('./routes/admin/registrasiMagangRoutes'); // <<< TAMBAHKAN INI
const luaranKknRoutes = require('./routes/admin/luaranKknRoutes'); // <<< TAMBAHKAN INI
const mahasiswaKKNRoutes = require('./routes/mahasiswa/kknRoutes');
const penelitianRoutes = require('./routes/admin/penelitianRoutes');
const dosenPenelitianRoutes = require('./routes/dosen/penelitianRoutes');
const mahasiswaFakultasRoutes = require('./routes/mahasiswa/fakultasRoutes');
const perusahaanMagangRoutes = require('./routes/admin/perusahaanMagangRoutes');
const magangLuaranRoutes = require('./routes/admin/magangLuaranRoutes');
const repositoryRoutes = require('./routes/repositoryRoutes');
const beritaRoutes = require('./routes/beritaRoutes');


const { authenticateToken } = require('./middleware/auth'); 
// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
    origin: true,  
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files untuk upload
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api', fakultasRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/magang', magangRoutes);
app.use('/api/dosen/kegiatan', dosenKegiatanRoutes);
// Admin routes
app.use('/api/admin/berita', adminBeritaRoutes);
app.use('/api/admin/kegiatan', adminKegiatanRoutes);
app.use('/api/dosen/berita', dosenBeritaRoutes);
app.use('/api/mahasiswa/berita', mahasiswaBeritaRoutes);
app.use('/api/mahasiswa/kegiatan', mahasiswaKegiatanRoutes);
app.use('/api/admin/repository', adminRepositoryRoutes);
app.use('/api/mahasiswa/repository', mahasiswaRepositoryRoutes);
app.use('/api/dosen/repository', dosenRepositoryRoutes);
app.use('/api/mahasiswa/profil', mahasiswaProfilRoutes);
app.use('/api/dosen/profil', dosenProfilRoutes);
app.use('/api/admin/desa-kkn', desaRoutes);
app.use('/api/admin/programs', programRoutes); // <<< TAMBAHKAN INI
app.use('/api/admin/dashboard', dashboardRoutes); // <<< TAMBAHKAN INI
app.use('/api/admin/registrasi-kkn', registrasiKknRoutes); // <<< TAMBAHKAN INI
app.use('/api/admin/registrasi-magang', registrasiMagangRoutes); // <<< TAMBAHKAN INI
app.use('/api/admin/luaran-kkn', luaranKknRoutes);
app.use('/api/mahasiswa/kkn', mahasiswaKKNRoutes);
app.use('/api/admin/penelitian', penelitianRoutes);
app.use('/api/dosen/penelitian', dosenPenelitianRoutes);
app.use('/api/dosen/penelitian', dosenPenelitianRoutes);
app.use('/api/mahasiswa', mahasiswaFakultasRoutes);
app.use('/api/admin/magang/perusahaan', perusahaanMagangRoutes);
app.use('/api/admin/magang/luaran', magangLuaranRoutes);
app.use('/api/repository', repositoryRoutes);
app.use('/api/berita-umum', beritaRoutes);



app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// ============ TAMBAHKAN ROUTE INI ============

// Endpoint untuk desa aktif (list untuk dropdown)
app.get('/api/admin/desa-kkn/list/aktif', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { data, error } = await supabase
            .from('desa_kkn')
            .select('id_desa, nama_desa, kabupaten, kuota')
            .eq('status', 'aktif')
            .order('nama_desa');
        
        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Endpoint untuk stats dashboard
app.get('/api/admin/dashboard/stats', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        
        // Get KKN stats
        const { data: kknStats } = await supabase
            .from('registrasi_kkn')
            .select('status');
        
        // Get Magang stats
        const { data: magangStats } = await supabase
            .from('perusahaan_magang')
            .select('status');
        
        // Get Desa stats
        const { data: desaStats } = await supabase
            .from('desa_kkn')
            .select('kuota, status');
        
        // Get Program stats
        const { data: programStats } = await supabase
            .from('program_kegiatan')
            .select('jenis, status');
        
        const stats = {
            kkn: {
                total: kknStats?.length || 0,
                approved: kknStats?.filter(s => s.status === 'approved').length || 0,
                pending: kknStats?.filter(s => s.status === 'pending').length || 0,
                rejected: kknStats?.filter(s => s.status === 'rejected').length || 0,
                verified: kknStats?.filter(s => s.status === 'verified').length || 0
            },
            magang: {
                total: magangStats?.length || 0,
                approved: magangStats?.filter(s => s.status === 'approved').length || 0,
                pending: magangStats?.filter(s => s.status === 'pending').length || 0,
                rejected: magangStats?.filter(s => s.status === 'rejected').length || 0,
                verified: magangStats?.filter(s => s.status === 'verified').length || 0
            },
            villages: {
                total: desaStats?.filter(d => d.status === 'aktif').length || 0,
                total_quota: desaStats?.reduce((sum, d) => sum + (d.kuota || 0), 0) || 0
            },
            programs: {
                total: programStats?.filter(p => p.status === 'aktif').length || 0,
                kkn: programStats?.filter(p => p.jenis === 'kkn' && p.status === 'aktif').length || 0,
                magang: programStats?.filter(p => p.jenis === 'magang' && p.status === 'aktif').length || 0
            }
        };
        
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET registrasi KKN
app.get('/api/admin/registrasi-kkn', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { search = '', status = '', id_desa = '', page = 1, limit = 100 } = req.query;
        
        let query = supabase
            .from('registrasi_kkn')
            .select(`
                *,
                program_studi (id_prodi, nama_prodi),
                desa_kkn (id_desa, nama_desa, kabupaten)
            `);
        
        if (search) {
            query = query.or(`nim.ilike.%${search}%,nama_lengkap.ilike.%${search}%`);
        }
        if (status) query = query.eq('status', status);
        if (id_desa) query = query.eq('id_desa', id_desa);
        
        const from = (page - 1) * limit;
        const { data, error, count } = await query
            .order('tanggal_daftar', { ascending: false })
            .range(from, from + limit - 1);
        
        if (error) throw error;
        res.json({ success: true, data: data || [], pagination: { currentPage: parseInt(page), totalItems: count || 0, itemsPerPage: parseInt(limit) } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// UPDATE status registrasi KKN
app.put('/api/admin/registrasi-kkn/:id/status', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { id } = req.params;
        const { status, catatan } = req.body;
        
        const { data, error } = await supabase
            .from('registrasi_kkn')
            .update({ status, catatan, updated_at: new Date() })
            .eq('id_registrasi', id)
            .select();
        
        if (error) throw error;
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET registrasi magang
app.get('/api/admin/registrasi-magang', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { search = '', status = '', page = 1, limit = 100 } = req.query;
        
        let query = supabase
            .from('perusahaan_magang')
            .select(`
                *,
                users (nama_lengkap, email),
                program_studi (id_prodi, nama_prodi)
            `);
        
        if (search) {
            query = query.or(`nim.ilike.%${search}%,users.nama_lengkap.ilike.%${search}%`);
        }
        if (status) query = query.eq('status', status);
        
        const from = (page - 1) * limit;
        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        const formattedData = data?.map(item => ({
            id_registrasi: item.id_perusahaan,
            nim: item.nim,
            nama_lengkap: item.users?.nama_lengkap,
            program_studi: item.program_studi,
            nama_perusahaan: item.nama_perusahaan,
            status: item.status,
            created_at: item.created_at
        })) || [];
        
        res.json({ success: true, data: formattedData, pagination: { currentPage: parseInt(page), totalItems: count || 0, itemsPerPage: parseInt(limit) } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// UPDATE status registrasi magang
app.put('/api/admin/registrasi-magang/:id/status', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { id } = req.params;
        const { status, catatan } = req.body;
        
        const { data, error } = await supabase
            .from('perusahaan_magang')
            .update({ status, catatan, updated_at: new Date() })
            .eq('id_perusahaan', id)
            .select();
        
        if (error) throw error;
        res.json({ success: true, data: data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET perusahaan magang (untuk tabel perusahaan section)
app.get('/api/admin/magang/perusahaan', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { page = 1, limit = 10, search = '', status = '' } = req.query;
        
        let query = supabase
            .from('perusahaan_magang')
            .select(`
                *,
                users (nama_lengkap, email, no_hp),
                program_studi (nama_prodi)
            `, { count: 'exact' });
        
        if (search) {
            query = query.or(`nim.ilike.%${search}%,nama_perusahaan.ilike.%${search}%,users.nama_lengkap.ilike.%${search}%`);
        }
        if (status) query = query.eq('status', status);
        
        const from = (page - 1) * limit;
        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        res.json({ 
            success: true, 
            data: data || [], 
            pagination: { 
                currentPage: parseInt(page), 
                totalItems: count || 0, 
                itemsPerPage: parseInt(limit) 
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET single perusahaan magang detail
app.get('/api/admin/magang/perusahaan/:id', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('perusahaan_magang')
            .select(`
                *,
                users (nama_lengkap, email, no_hp),
                program_studi (id_prodi, nama_prodi, jenjang)
            `)
            .eq('id_perusahaan', id)
            .single();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT verifikasi perusahaan magang
app.put('/api/admin/magang/perusahaan/:id/verifikasi', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { id } = req.params;
        const { status, catatan } = req.body;
        
        const { data, error } = await supabase
            .from('perusahaan_magang')
            .update({ 
                status, 
                catatan, 
                updated_at: new Date(),
                diverifikasi_oleh: req.user?.userId 
            })
            .eq('id_perusahaan', id)
            .select();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET luaran magang
app.get('/api/admin/magang/luaran', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { page = 1, limit = 10, status = '', search = '' } = req.query;
        
        let query = supabase
            .from('luaran_magang')
            .select(`
                *,
                perusahaan_magang (
                    nim,
                    nama_perusahaan,
                    bid_magang,
                    users (nama_lengkap, email)
                )
            `, { count: 'exact' });
        
        if (search) {
            query = query.or(`perusahaan_magang.nim.ilike.%${search}%,judul_proyek.ilike.%${search}%`);
        }
        if (status) query = query.eq('status', status);
        
        const from = (page - 1) * limit;
        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        const formattedData = data?.map(item => ({
            id_luaran: item.id_luaran,
            nim: item.perusahaan_magang?.nim,
            nama_lengkap: item.perusahaan_magang?.users?.nama_lengkap,
            nama_perusahaan: item.perusahaan_magang?.nama_perusahaan,
            judul_proyek: item.judul_proyek,
            link_poster: item.link_poster,
            link_laporan: item.link_laporan,
            file_mou: item.file_mou,
            status: item.status,
            catatan: item.catatan,
            created_at: item.created_at
        })) || [];
        
        res.json({ 
            success: true, 
            data: formattedData, 
            pagination: { 
                currentPage: parseInt(page), 
                totalItems: count || 0, 
                itemsPerPage: parseInt(limit) 
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET single luaran magang
app.get('/api/admin/magang/luaran/:id', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('luaran_magang')
            .select(`
                *,
                perusahaan_magang (
                    *,
                    users (nama_lengkap, email, no_hp),
                    program_studi (nama_prodi, jenjang)
                )
            `)
            .eq('id_luaran', id)
            .single();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT verifikasi luaran magang
app.put('/api/admin/magang/luaran/:id/verifikasi', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { id } = req.params;
        const { status, catatan } = req.body;
        
        const { data, error } = await supabase
            .from('luaran_magang')
            .update({ 
                status, 
                catatan, 
                updated_at: new Date(),
                diverifikasi_oleh: req.user?.userId 
            })
            .eq('id_luaran', id)
            .select();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET luaran KKN
app.get('/api/admin/luaran-kkn', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { desa = '', status = '', search = '', page = 1, limit = 100 } = req.query;
        
        let query = supabase
            .from('luaran_kkn')
            .select(`
                *,
                registrasi_kkn (
                    nim,
                    nama_lengkap,
                    id_desa,
                    desa_kkn (nama_desa)
                )
            `, { count: 'exact' });
        
        if (desa) query = query.eq('registrasi_kkn.id_desa', desa);
        if (status) query = query.eq('status', status);
        if (search) query = query.or(`registrasi_kkn.nim.ilike.%${search}%,judul_kegiatan.ilike.%${search}%`);
        
        const from = (page - 1) * limit;
        const { data, error, count } = await query
            .order('tanggal_submit', { ascending: false })
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        const formattedData = data?.map(item => ({
            id_luaran: item.id_luaran,
            nim: item.registrasi_kkn?.nim,
            nama_lengkap: item.registrasi_kkn?.nama_lengkap,
            desa_name: item.registrasi_kkn?.desa_kkn?.nama_desa,
            judul_kegiatan: item.judul_kegiatan,
            link_video: item.link_video,
            file_poster: item.file_poster,
            file_mou: item.file_mou,
            status: item.status,
            catatan_review: item.catatan_review
        })) || [];
        
        res.json({ success: true, data: formattedData });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT verifikasi luaran KKN
app.put('/api/admin/luaran-kkn/:id/verifikasi', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { id } = req.params;
        const { status, notes } = req.body;
        
        const { data, error } = await supabase
            .from('luaran_kkn')
            .update({ 
                status, 
                catatan_review: notes,
                updated_at: new Date() 
            })
            .eq('id_luaran', id)
            .select();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET programs dengan pagination dan filter
app.get('/api/admin/programs', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { page = 1, limit = 10, search = '', jenis = '' } = req.query;
        
        let query = supabase
            .from('program_kegiatan')
            .select('*', { count: 'exact' });
        
        if (search) {
            query = query.ilike('nama_program', `%${search}%`);
        }
        if (jenis) {
            query = query.eq('jenis', jenis);
        }
        
        const from = (page - 1) * limit;
        const { data, error, count } = await query
            .order('created_at', { ascending: false })
            .range(from, from + limit - 1);
        
        if (error) throw error;
        
        res.json({ 
            success: true, 
            data: data || [], 
            pagination: { 
                currentPage: parseInt(page), 
                totalItems: count || 0, 
                itemsPerPage: parseInt(limit) 
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST create program
app.post('/api/admin/programs', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { nama_program, jenis, kuota, periode, deskripsi } = req.body;
        
        const { data, error } = await supabase
            .from('program_kegiatan')
            .insert({
                nama_program,
                jenis,
                kuota,
                periode,
                deskripsi,
                status: 'aktif'
            })
            .select();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT update program
app.put('/api/admin/programs/:id', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { id } = req.params;
        const { nama_program, jenis, kuota, periode, deskripsi } = req.body;
        
        const { data, error } = await supabase
            .from('program_kegiatan')
            .update({ nama_program, jenis, kuota, periode, deskripsi, updated_at: new Date() })
            .eq('id_program', id)
            .select();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET single program
app.get('/api/admin/programs/:id', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('program_kegiatan')
            .select('*')
            .eq('id_program', id)
            .single();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE program
app.delete('/api/admin/programs/:id', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { id } = req.params;
        
        const { error } = await supabase
            .from('program_kegiatan')
            .delete()
            .eq('id_program', id);
        
        if (error) throw error;
        res.json({ success: true, message: 'Program berhasil dihapus' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// PATCH toggle program status
app.patch('/api/admin/programs/:id/status', authenticateToken, async (req, res) => {
    try {
        const supabase = require('./config/database');
        const { id } = req.params;
        
        const { data: program } = await supabase
            .from('program_kegiatan')
            .select('status')
            .eq('id_program', id)
            .single();
        
        const newStatus = program?.status === 'aktif' ? 'nonaktif' : 'aktif';
        
        const { data, error } = await supabase
            .from('program_kegiatan')
            .update({ status: newStatus, updated_at: new Date() })
            .eq('id_program', id)
            .select();
        
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});


// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});