const supabase = require('../../config/database');

/**
 * Get all published berita with pagination, search, and filter
 */
const getAllBerita = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const kategori = req.query.kategori || '';
        const sort = req.query.sort || 'tanggal_publish';
        const order = req.query.order || 'desc';
        const start = (page - 1) * limit;
        const end = start + limit - 1;

        // Build query
        let query = supabase
            .from('berita')
            .select(`
                *,
                admin:users!berita_id_admin_fkey (
                    id_user,
                    nama_lengkap,
                    email,
                    foto_profil
                )
            `, { count: 'exact' })
            .eq('status', 'publish');

        // Add search filter
        if (search) {
            query = query.or(`judul.ilike.%${search}%,isi_berita.ilike.%${search}%`);
        }

        // Add category filter
        if (kategori && kategori !== 'all') {
            query = query.eq('kategori', kategori);
        }

        // Query untuk count
        let countQuery = supabase
            .from('berita')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'publish');

        if (search) {
            countQuery = countQuery.or(`judul.ilike.%${search}%,isi_berita.ilike.%${search}%`);
        }

        if (kategori && kategori !== 'all') {
            countQuery = countQuery.eq('kategori', kategori);
        }

        const { count, error: countError } = await countQuery;
        if (countError) throw countError;

        // Query untuk data dengan sorting
        let dataQuery = supabase
            .from('berita')
            .select(`
                *,
                admin:users!berita_id_admin_fkey (
                    id_user,
                    nama_lengkap,
                    email,
                    foto_profil
                )
            `)
            .eq('status', 'publish');

        if (search) {
            dataQuery = dataQuery.or(`judul.ilike.%${search}%,isi_berita.ilike.%${search}%`);
        }

        if (kategori && kategori !== 'all') {
            dataQuery = dataQuery.eq('kategori', kategori);
        }

        // Apply sorting
        dataQuery = dataQuery.order(sort, { ascending: order === 'asc' });

        const { data: berita, error } = await dataQuery
            .range(start, end);

        if (error) throw error;

        // Format response (sama seperti sebelumnya)
        const formattedBerita = berita.map(item => ({
            id: item.id_berita,
            judul: item.judul,
            isi_berita: item.isi_berita,
            kategori: item.kategori,
            thumbnail: item.gambar_thumbnail ? 
                `${req.protocol}://${req.get('host')}/${item.gambar_thumbnail}` : null,
            views: item.views || 0,
            tanggal_publish: item.tanggal_publish,
            created_at: item.created_at,
            admin: item.admin ? {
                id: item.admin.id_user,
                nama: item.admin.nama_lengkap,
                email: item.admin.email,
                foto_profil: item.admin.foto_profil
            } : null
        }));

        res.json({
            success: true,
            data: formattedBerita,
            pagination: {
                page,
                limit,
                total: count,
                total_pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Error in getAllBerita:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data berita',
            error: error.message
        });
    }
};

/**
 * Get berita by ID
 */
const getBeritaById = async (req, res) => {
    try {
        const { id } = req.params;

        // Increment views
        await supabase.rpc('increment_berita_views', {
            berita_id: id
        });

        // Get berita data
        const { data: berita, error } = await supabase
            .from('berita')
            .select(`
                *,
                admin:users!berita_id_admin_fkey (
                    id_user,
                    nama_lengkap,
                    email,
                    foto_profil
                )
            `)
            .eq('id_berita', id)
            .eq('status', 'publish')
            .single();

        if (error) throw error;
        if (!berita) {
            return res.status(404).json({
                success: false,
                message: 'Berita tidak ditemukan'
            });
        }

        // Get related berita (same category, exclude current)
        const { data: relatedBerita, error: relatedError } = await supabase
            .from('berita')
            .select('id_berita, judul, gambar_thumbnail, tanggal_publish, views')
            .eq('status', 'publish')
            .eq('kategori', berita.kategori)
            .neq('id_berita', id)
            .order('tanggal_publish', { ascending: false })
            .limit(3);

        if (relatedError) throw relatedError;

        // Format response
        const formattedBerita = {
            id: berita.id_berita,
            judul: berita.judul,
            isi_berita: berita.isi_berita,
            kategori: berita.kategori,
            thumbnail: berita.gambar_thumbnail ? 
                `${req.protocol}://${req.get('host')}/${berita.gambar_thumbnail}` : null,
            views: berita.views || 0,
            tanggal_publish: berita.tanggal_publish,
            created_at: berita.created_at,
            updated_at: berita.updated_at,
            admin: berita.admin ? {
                id: berita.admin.id_user,
                nama: berita.admin.nama_lengkap,
                email: berita.admin.email,
                foto_profil: berita.admin.foto_profil
            } : null,
            related_berita: relatedBerita.map(item => ({
                id: item.id_berita,
                judul: item.judul,
                thumbnail: item.gambar_thumbnail ? 
                    `${req.protocol}://${req.get('host')}/${item.gambar_thumbnail}` : null,
                tanggal_publish: item.tanggal_publish,
                views: item.views || 0
            }))
        };

        res.json({
            success: true,
            data: formattedBerita
        });

    } catch (error) {
        console.error('Error in getBeritaById:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data berita',
            error: error.message
        });
    }
};

/**
 * Get berita by category
 */
const getBeritaByCategory = async (req, res) => {
    try {
        const { kategori } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const start = (page - 1) * limit;
        const end = start + limit - 1;

        const validCategories = ['berita', 'pengumuman', 'kegiatan'];
        if (!validCategories.includes(kategori)) {
            return res.status(400).json({
                success: false,
                message: 'Kategori tidak valid'
            });
        }

        const { data: berita, error, count } = await supabase
            .from('berita')
            .select(`
                *,
                admin:users!berita_id_admin_fkey (
                    nama_lengkap
                )
            `, { count: 'exact' })
            .eq('status', 'publish')
            .eq('kategori', kategori)
            .order('tanggal_publish', { ascending: false })
            .range(start, end);

        if (error) throw error;

        const formattedBerita = berita.map(item => ({
            id: item.id_berita,
            judul: item.judul,
            isi_berita: item.isi_berita.length > 200 ? 
                item.isi_berita.substring(0, 200) + '...' : item.isi_berita,
            kategori: item.kategori,
            thumbnail: item.gambar_thumbnail ? 
                `${req.protocol}://${req.get('host')}/${item.gambar_thumbnail}` : null,
            views: item.views || 0,
            tanggal_publish: item.tanggal_publish,
            admin: item.admin ? item.admin.nama_lengkap : 'Admin'
        }));

        res.json({
            success: true,
            data: formattedBerita,
            pagination: {
                page,
                limit,
                total: count,
                total_pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Error in getBeritaByCategory:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data berita',
            error: error.message
        });
    }
};

/**
 * Get featured berita (important/pinned)
 */
const getFeaturedBerita = async (req, res) => {
    try {
        const { data: berita, error } = await supabase
            .from('berita')
            .select(`
                *,
                admin:users!berita_id_admin_fkey (
                    nama_lengkap
                )
            `)
            .eq('status', 'publish')
            .eq('is_featured', true)
            .order('tanggal_publish', { ascending: false })
            .limit(1);

        if (error) throw error;

        if (berita.length === 0) {
            // If no featured, get latest
            const { data: latest, error: latestError } = await supabase
                .from('berita')
                .select(`
                    *,
                    admin:users!berita_id_admin_fkey (
                        nama_lengkap
                    )
                `)
                .eq('status', 'publish')
                .order('tanggal_publish', { ascending: false })
                .limit(1);

            if (latestError) throw latestError;
            
            if (latest.length > 0) {
                const item = latest[0];
                return res.json({
                    success: true,
                    data: {
                        id: item.id_berita,
                        judul: item.judul,
                        isi_berita: item.isi_berita,
                        kategori: item.kategori,
                        thumbnail: item.gambar_thumbnail ? 
                            `${req.protocol}://${req.get('host')}/${item.gambar_thumbnail}` : null,
                        tanggal_publish: item.tanggal_publish,
                        admin: item.admin ? item.admin.nama_lengkap : 'Admin'
                    }
                });
            }
        }

        if (berita.length > 0) {
            const item = berita[0];
            res.json({
                success: true,
                data: {
                    id: item.id_berita,
                    judul: item.judul,
                    isi_berita: item.isi_berita,
                    kategori: item.kategori,
                    thumbnail: item.gambar_thumbnail ? 
                        `${req.protocol}://${req.get('host')}/${item.gambar_thumbnail}` : null,
                    tanggal_publish: item.tanggal_publish,
                    admin: item.admin ? item.admin.nama_lengkap : 'Admin'
                }
            });
        } else {
            res.json({
                success: true,
                data: null
            });
        }

    } catch (error) {
        console.error('Error in getFeaturedBerita:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil berita utama',
            error: error.message
        });
    }
};

/**
 * Get berita statistics
 */
const getBeritaStats = async (req, res) => {
    try {
        // Get total count by category - PERBAIKAN: tanpa menggunakan group()
        const { data: stats, error } = await supabase
            .from('berita')
            .select('kategori')
            .eq('status', 'publish');

        if (error) throw error;

        // Hitung manual statistik per kategori
        const categoryCount = {};
        stats.forEach(item => {
            categoryCount[item.kategori] = (categoryCount[item.kategori] || 0) + 1;
        });

        const formattedStats = Object.keys(categoryCount).map(kategori => ({
            kategori,
            count: categoryCount[kategori]
        }));

        // Get total views
        const { data: totalViews, error: viewsError } = await supabase
            .from('berita')
            .select('views')
            .eq('status', 'publish');

        if (viewsError) throw viewsError;

        const totalViewsCount = totalViews.reduce((sum, item) => sum + (item.views || 0), 0);

        // Get most viewed
        const { data: mostViewed, error: mostError } = await supabase
            .from('berita')
            .select('id_berita, judul, views')
            .eq('status', 'publish')
            .order('views', { ascending: false })
            .limit(5);

        if (mostError) throw mostError;

        // Get recent
        const { data: recent, error: recentError } = await supabase
            .from('berita')
            .select('id_berita, judul, tanggal_publish')
            .eq('status', 'publish')
            .order('tanggal_publish', { ascending: false })
            .limit(5);

        if (recentError) throw recentError;

        res.json({
            success: true,
            data: {
                by_category: formattedStats,
                total_views: totalViewsCount,
                most_viewed: mostViewed,
                recent_berita: recent
            }
        });

    } catch (error) {
        console.error('Error in getBeritaStats:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil statistik berita',
            error: error.message
        });
    }
};

module.exports = {
    getAllBerita,
    getBeritaById,
    getBeritaByCategory,
    getFeaturedBerita,
    getBeritaStats
};