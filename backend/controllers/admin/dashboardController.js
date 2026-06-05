const supabase = require('../../config/database');
const { formatResponse, formatError } = require('../../utils/responseFormatter');

const dashboardController = {
    async getStats(req, res) {
        try {
            // ---- Berita Stats ----
            // Tabel: berita, kolom status: 'status' (published/draft)
            const { data: beritaData, error: beritaError } = await supabase
                .from('berita')
                .select('status');
            if (beritaError) throw beritaError;

            const beritaStats = {
                total: beritaData.length,
                published: beritaData.filter(d => d.status === 'publish' || d.status === 'published' || d.status === 'aktif').length,
                draft: beritaData.filter(d => d.status === 'draft').length
            };

            // ---- Kegiatan Stats ----
            // Tabel: kegiatan, kolom status: 'status_kegiatan', tanggal: tanggal_mulai/tanggal_selesai
            const { data: kegiatanData, error: kegiatanError } = await supabase
                .from('kegiatan')
                .select('status_kegiatan, tanggal_mulai, tanggal_selesai');
            if (kegiatanError) throw kegiatanError;

            const now = new Date().toISOString();
            const kegiatanStats = {
                total: kegiatanData.length,
                upcoming: kegiatanData.filter(d =>
                    d.status_kegiatan === 'akan_datang' ||
                    d.status_kegiatan === 'upcoming' ||
                    (d.tanggal_mulai && d.tanggal_mulai > now && !d.status_kegiatan)
                ).length,
                ongoing: kegiatanData.filter(d =>
                    d.status_kegiatan === 'berlangsung' ||
                    d.status_kegiatan === 'ongoing' ||
                    (d.tanggal_mulai && d.tanggal_selesai &&
                        d.tanggal_mulai <= now && d.tanggal_selesai >= now)
                ).length,
                completed: kegiatanData.filter(d =>
                    d.status_kegiatan === 'selesai' ||
                    d.status_kegiatan === 'completed' ||
                    (d.tanggal_selesai && d.tanggal_selesai < now)
                ).length
            };

            // ---- Repository Stats ----
            // Tabel: repository_dokumen, kolom: downloads, views
            const { data: repoData, error: repoError } = await supabase
                .from('repository_dokumen')
                .select('downloads, views');
            if (repoError) throw repoError;

            const repoStats = {
                total: repoData.length,
                downloads: repoData.reduce((sum, d) => sum + (d.downloads || 0), 0),
                views: repoData.reduce((sum, d) => sum + (d.views || 0), 0)
            };

            // ---- KKN Stats ----
            const { data: kknData, error: kknError } = await supabase
                .from('registrasi_kkn')
                .select('status');
            if (kknError) throw kknError;

            const kknStats = {
                total: kknData.length,
                pending: kknData.filter(d => d.status === 'pending').length,
                approved: kknData.filter(d => d.status === 'approved').length,
                rejected: kknData.filter(d => d.status === 'rejected').length,
                verified: kknData.filter(d => d.status === 'verified').length
            };

            // ---- Magang Stats ----
            const { data: magangData, error: magangError } = await supabase
                .from('registrasi_magang')
                .select('status');
            if (magangError) throw magangError;

            const magangStats = {
                total: magangData.length,
                pending: magangData.filter(d => d.status === 'pending').length,
                approved: magangData.filter(d => d.status === 'approved').length,
                rejected: magangData.filter(d => d.status === 'rejected').length,
                verified: magangData.filter(d => d.status === 'verified').length
            };

            // ---- Desa/Village Stats ----
            const { data: desaData, error: desaError } = await supabase
                .from('desa_kkn')
                .select('kuota, kuota_terisi, status')
                .eq('status', 'aktif');
            if (desaError) throw desaError;

            const villages = {
                total: desaData.length,
                total_quota: desaData.reduce((sum, d) => sum + (d.kuota || 0), 0),
                used_quota: desaData.reduce((sum, d) => sum + (d.kuota_terisi || 0), 0)
            };

            // ---- Program Stats ----
            const { data: programData, error: programError } = await supabase
                .from('programs')
                .select('jenis, status');
            if (programError) throw programError;

            const programs = {
                total: programData.length,
                kkn: programData.filter(d => d.jenis === 'kkn').length,
                magang: programData.filter(d => d.jenis === 'magang').length,
                active: programData.filter(d => d.status === 'aktif').length
            };

            // ---- Penelitian Stats ----
            // Tabel: penelitian, kolom: status
            const { data: penelitianData, error: penelitianError } = await supabase
                .from('penelitian')
                .select('status');

            const penelitianStats = penelitianError ? { total: 0, pending: 0, approved: 0, ongoing: 0 } : {
                total: penelitianData.length,
                pending: penelitianData.filter(d => d.status === 'submitted' || d.status === 'review' || d.status === 'diajukan').length,
                approved: penelitianData.filter(d => d.status === 'approved' || d.status === 'diterima' || d.status === 'disetujui').length,
                ongoing: penelitianData.filter(d => d.status === 'ongoing' || d.status === 'berjalan' || d.status === 'aktif').length
            };

            // ---- Pengabdian Stats ----
            const { data: pengabdianData, error: pengabdianError } = await supabase
                .from('pengabdian')
                .select('status');

            const pengabdianStats = pengabdianError ? { total: 0, pending: 0, approved: 0, ongoing: 0 } : {
                total: (pengabdianData || []).length,
                pending: (pengabdianData || []).filter(d => d.status === 'submitted' || d.status === 'review' || d.status === 'diajukan').length,
                approved: (pengabdianData || []).filter(d => d.status === 'approved' || d.status === 'diterima' || d.status === 'disetujui').length,
                ongoing: (pengabdianData || []).filter(d => d.status === 'ongoing' || d.status === 'berjalan' || d.status === 'aktif').length
            };

            // ---- Recent Activities ----
            const activities = [];

            // Latest berita
            const { data: latestBerita } = await supabase
                .from('berita')
                .select('judul, created_at, status')
                .order('created_at', { ascending: false })
                .limit(3);

            if (latestBerita) {
                latestBerita.forEach(b => {
                    activities.push({
                        type: 'berita',
                        icon: 'fa-newspaper',
                        bgColor: 'bg-blue-100',
                        iconColor: 'text-blue-600',
                        text: `Berita <span class="font-semibold">"${b.judul}"</span> ${b.status === 'draft' ? 'disimpan sebagai draft' : 'telah dipublikasikan'}.`,
                        time: b.created_at
                    });
                });
            }

            // Latest kegiatan
            const { data: latestKegiatan } = await supabase
                .from('kegiatan')
                .select('nama_kegiatan, created_at, status_kegiatan')
                .order('created_at', { ascending: false })
                .limit(2);

            if (latestKegiatan) {
                latestKegiatan.forEach(k => {
                    activities.push({
                        type: 'kegiatan',
                        icon: 'fa-calendar-check',
                        bgColor: 'bg-green-100',
                        iconColor: 'text-green-600',
                        text: `Kegiatan <span class="font-semibold">"${k.nama_kegiatan}"</span> telah ditambahkan.`,
                        time: k.created_at
                    });
                });
            }

            // Latest repository documents
            const { data: latestRepo } = await supabase
                .from('repository_dokumen')
                .select('judul, created_at')
                .order('created_at', { ascending: false })
                .limit(2);

            if (latestRepo) {
                latestRepo.forEach(r => {
                    activities.push({
                        type: 'repository',
                        icon: 'fa-file-upload',
                        bgColor: 'bg-purple-100',
                        iconColor: 'text-purple-600',
                        text: `Dokumen <span class="font-semibold">"${r.judul}"</span> diunggah ke repository.`,
                        time: r.created_at
                    });
                });
            }

            // Latest KKN registrations
            const { data: latestKKN } = await supabase
                .from('registrasi_kkn')
                .select('created_at, status')
                .order('created_at', { ascending: false })
                .limit(2);

            if (latestKKN) {
                latestKKN.forEach(k => {
                    activities.push({
                        type: 'kkn',
                        icon: 'fa-user-plus',
                        bgColor: 'bg-pink-100',
                        iconColor: 'text-pink-600',
                        text: `Pendaftaran KKN baru dengan status <span class="font-semibold">${k.status}</span>.`,
                        time: k.created_at
                    });
                });
            }

            // Sort activities by time descending
            activities.sort((a, b) => new Date(b.time) - new Date(a.time));
            const topActivities = activities.slice(0, 6).map(a => ({
                ...a,
                time: formatTimeAgo(a.time)
            }));

            // ---- Pending Tasks ----
            const pendingTasks = [];

            if (kknStats.pending > 0) {
                pendingTasks.push({ title: 'Verifikasi Registrasi KKN', count: kknStats.pending, priority: 'high', link: 'manage-magang-kkn.html' });
            }
            if (magangStats.pending > 0) {
                pendingTasks.push({ title: 'Verifikasi Registrasi Magang', count: magangStats.pending, priority: 'high', link: 'manage-magang-kkn.html' });
            }
            if (penelitianStats.pending > 0) {
                pendingTasks.push({ title: 'Review Proposal Penelitian', count: penelitianStats.pending, priority: 'medium', link: 'admin_penelitian.html' });
            }
            if (beritaStats.draft > 0) {
                pendingTasks.push({ title: 'Berita Menunggu Publikasi', count: beritaStats.draft, priority: 'low', link: 'manage-kegiatan.html' });
            }

            // ---- Monthly Chart Data (per bulan tahun ini) ----
            const currentYear = new Date().getFullYear();
            const startDate = `${currentYear}-01-01`;
            const endDate = `${currentYear}-12-31`;

            const { data: beritaBulanan } = await supabase
                .from('berita')
                .select('created_at')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            const { data: kegiatanBulanan } = await supabase
                .from('kegiatan')
                .select('created_at')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            const { data: repoBulanan } = await supabase
                .from('repository_dokumen')
                .select('created_at')
                .gte('created_at', startDate)
                .lte('created_at', endDate);

            const monthlyBerita = Array(12).fill(0);
            const monthlyKegiatan = Array(12).fill(0);
            const monthlyRepo = Array(12).fill(0);

            if (beritaBulanan) {
                beritaBulanan.forEach(b => {
                    const month = new Date(b.created_at).getMonth();
                    monthlyBerita[month]++;
                });
            }
            if (kegiatanBulanan) {
                kegiatanBulanan.forEach(k => {
                    const month = new Date(k.created_at).getMonth();
                    monthlyKegiatan[month]++;
                });
            }
            if (repoBulanan) {
                repoBulanan.forEach(r => {
                    const month = new Date(r.created_at).getMonth();
                    monthlyRepo[month]++;
                });
            }

            // ---- Category Distribution (Repository) ----
            const { data: repoKategori } = await supabase
                .from('repository_dokumen')
                .select('kategori');

            const kategoriCount = {};
            if (repoKategori) {
                repoKategori.forEach(r => {
                    const kat = r.kategori || 'Lainnya';
                    kategoriCount[kat] = (kategoriCount[kat] || 0) + 1;
                });
            }

            return res.status(200).json(
                formatResponse('success', 'Statistik berhasil diambil', {
                    berita: beritaStats,
                    kegiatan: kegiatanStats,
                    repository: repoStats,
                    kkn: kknStats,
                    magang: magangStats,
                    villages,
                    programs,
                    penelitian: penelitianStats,
                    pengabdian: pengabdianStats,
                    activities: topActivities,
                    pendingTasks,
                    monthlyChart: {
                        year: currentYear,
                        berita: monthlyBerita,
                        kegiatan: monthlyKegiatan,
                        repository: monthlyRepo
                    },
                    kategoriChart: kategoriCount
                })
            );
        } catch (error) {
            console.error('Error in getStats:', error);
            return res.status(500).json(formatError('Gagal mengambil statistik'));
        }
    }
};

// Helper: format waktu relatif
function formatTimeAgo(dateStr) {
    if (!dateStr) return '-';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSecs < 60) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit yang lalu`;
    if (diffHours < 24) return `${diffHours} jam yang lalu`;
    if (diffDays < 7) return `${diffDays} hari yang lalu`;
    if (diffWeeks < 4) return `${diffWeeks} minggu yang lalu`;
    if (diffMonths < 12) return `${diffMonths} bulan yang lalu`;
    return `${Math.floor(diffMonths / 12)} tahun yang lalu`;
}

module.exports = dashboardController;