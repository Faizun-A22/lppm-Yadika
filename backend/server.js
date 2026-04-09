const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');
const fakultasRoutes = require('./routes/fakultasRoutes');

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
const programRoutes = require('./routes/admin/programRoutes'); // <<< TAMBAHKAN INI
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

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files untuk upload
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);
});