const supabase = require('../config/database');

class BeritaService {
    /**
     * Get all berita with pagination and filtering
     */
    async getAllBerita({ page, limit, kategori, status, search, sortBy, sortOrder }) {
        try {
            const offset = (page - 1) * limit;
            
            // Start query
            let query = supabase
                .from('berita')
                .select(`
                    id_berita,
                    judul,
                    isi_berita,
                    gambar_thumbnail,
                    status,
                    tanggal_publish,
                    created_at,
                    updated_at,
                    kategori,
                    views,
                    id_admin
                `, { count: 'exact' });
            
            // Apply filters
            if (kategori && kategori !== 'semua') {
                query = query.eq('kategori', kategori);
            }
            
            if (status) {
                query = query.eq('status', status);
            }
            
            if (search) {
                query = query.or(`judul.ilike.%${search}%,isi_berita.ilike.%${search}%`);
            }
            
            // Apply sorting
            const sortMap = {
                'tanggal_publish': 'tanggal_publish',
                'judul': 'judul',
                'views': 'views',
                'created_at': 'created_at'
            };
            const sortColumn = sortMap[sortBy] || 'tanggal_publish';
            const order = sortOrder === 'ASC' ? { ascending: true } : { ascending: false };
            query = query.order(sortColumn, order);
            
            // Apply pagination
            query = query.range(offset, offset + limit - 1);
            
            const { data: beritaList, error, count } = await query;
            
            if (error) throw error;
            
            // Get user info for each berita
            const beritaWithUsers = await Promise.all((beritaList || []).map(async (berita) => {
                let penulis = null;
                let penulisEmail = null;
                
                if (berita.id_admin) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('nama_lengkap, email')
                        .eq('id_user', berita.id_admin)
                        .single();
                    
                    if (userData) {
                        penulis = userData.nama_lengkap;
                        penulisEmail = userData.email;
                    }
                }
                
                // Get komentar count (if komentar_berita table exists)
                let komentarCount = 0;
                try {
                    const { count: komentarCountResult } = await supabase
                        .from('komentar_berita')
                        .select('*', { count: 'exact', head: true })
                        .eq('id_berita', berita.id_berita);
                    
                    komentarCount = komentarCountResult || 0;
                } catch (err) {
                    // Table might not exist
                }
                
                return {
                    id_berita: berita.id_berita,
                    judul: berita.judul,
                    isi_berita: berita.isi_berita,
                    gambar_thumbnail: berita.gambar_thumbnail,
                    status: berita.status,
                    tanggal_publish: berita.tanggal_publish,
                    created_at: berita.created_at,
                    updated_at: berita.updated_at,
                    kategori: berita.kategori,
                    views: berita.views || 0,
                    penulis: penulis || 'Admin',
                    penulis_email: penulisEmail,
                    komentar_count: komentarCount
                };
            }));
            
            return {
                berita: beritaWithUsers,
                pagination: {
                    currentPage: page,
                    itemsPerPage: limit,
                    totalItems: count || 0,
                    totalPages: Math.ceil((count || 0) / limit)
                }
            };
        } catch (error) {
            console.error('Error in getAllBerita:', error);
            throw error;
        }
    }
    
    /**
     * Get berita by ID
     */
    async getBeritaById(id) {
        try {
            const { data: berita, error } = await supabase
                .from('berita')
                .select('*')
                .eq('id_berita', id)
                .single();
            
            if (error) throw error;
            if (!berita) return null;
            
            // Get admin/user info
            let penulis = null;
            let penulisEmail = null;
            let penulisFoto = null;
            
            if (berita.id_admin) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('id_user, nama_lengkap, email, foto_profil')
                    .eq('id_user', berita.id_admin)
                    .single();
                
                if (userData) {
                    penulis = userData.nama_lengkap;
                    penulisEmail = userData.email;
                    penulisFoto = userData.foto_profil;
                }
            }
            
            // Get komentar count (approved comments)
            let komentarCount = 0;
            try {
                const { count } = await supabase
                    .from('komentar_berita')
                    .select('*', { count: 'exact', head: true })
                    .eq('id_berita', id)
                    .eq('status', 'approved');
                
                komentarCount = count || 0;
            } catch (err) {
                // Table might not exist
            }
            
            // Get related berita (same category, different id, published)
            const { data: relatedBerita } = await supabase
                .from('berita')
                .select('id_berita, judul, gambar_thumbnail, tanggal_publish, kategori')
                .eq('kategori', berita.kategori)
                .eq('status', 'publish')
                .neq('id_berita', id)
                .order('tanggal_publish', { ascending: false })
                .limit(3);
            
            return {
                id_berita: berita.id_berita,
                judul: berita.judul,
                isi_berita: berita.isi_berita,
                gambar_thumbnail: berita.gambar_thumbnail,
                status: berita.status,
                tanggal_publish: berita.tanggal_publish,
                created_at: berita.created_at,
                updated_at: berita.updated_at,
                kategori: berita.kategori,
                views: berita.views || 0,
                admin_id: berita.id_admin,
                penulis: penulis || 'Admin',
                penulis_email: penulisEmail,
                penulis_foto: penulisFoto,
                komentar_count: komentarCount,
                related_berita: relatedBerita || []
            };
        } catch (error) {
            console.error('Error in getBeritaById:', error);
            throw error;
        }
    }
    
    /**
     * Get berita by category
     */
    async getBeritaByCategory({ kategori, page, limit }) {
        try {
            const offset = (page - 1) * limit;
            
            let query = supabase
                .from('berita')
                .select(`
                    id_berita,
                    judul,
                    isi_berita,
                    gambar_thumbnail,
                    tanggal_publish,
                    kategori,
                    views,
                    id_admin
                `, { count: 'exact' })
                .eq('kategori', kategori)
                .eq('status', 'publish')
                .order('tanggal_publish', { ascending: false })
                .range(offset, offset + limit - 1);
            
            const { data: beritaList, error, count } = await query;
            
            if (error) throw error;
            
            // Get user info for each berita
            const beritaWithUsers = await Promise.all((beritaList || []).map(async (berita) => {
                let penulis = null;
                
                if (berita.id_admin) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('nama_lengkap')
                        .eq('id_user', berita.id_admin)
                        .single();
                    
                    if (userData) {
                        penulis = userData.nama_lengkap;
                    }
                }
                
                // Create excerpt
                const excerpt = berita.isi_berita ? berita.isi_berita.substring(0, 200) : '';
                
                return {
                    id_berita: berita.id_berita,
                    judul: berita.judul,
                    isi_berita: berita.isi_berita,
                    gambar_thumbnail: berita.gambar_thumbnail,
                    tanggal_publish: berita.tanggal_publish,
                    kategori: berita.kategori,
                    views: berita.views || 0,
                    penulis: penulis || 'Admin',
                    excerpt: excerpt
                };
            }));
            
            return {
                berita: beritaWithUsers,
                pagination: {
                    currentPage: page,
                    itemsPerPage: limit,
                    totalItems: count || 0,
                    totalPages: Math.ceil((count || 0) / limit)
                }
            };
        } catch (error) {
            console.error('Error in getBeritaByCategory:', error);
            throw error;
        }
    }
    
    /**
     * Get latest berita
     */
    async getLatestBerita(limit) {
        try {
            const { data: beritaList, error } = await supabase
                .from('berita')
                .select(`
                    id_berita,
                    judul,
                    gambar_thumbnail,
                    tanggal_publish,
                    kategori,
                    views,
                    id_admin,
                    isi_berita
                `)
                .eq('status', 'publish')
                .order('tanggal_publish', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            
            // Get user info for each berita
            const beritaWithUsers = await Promise.all((beritaList || []).map(async (berita) => {
                let penulis = null;
                
                if (berita.id_admin) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('nama_lengkap')
                        .eq('id_user', berita.id_admin)
                        .single();
                    
                    if (userData) {
                        penulis = userData.nama_lengkap;
                    }
                }
                
                const excerpt = berita.isi_berita ? berita.isi_berita.substring(0, 150) : '';
                
                return {
                    id_berita: berita.id_berita,
                    judul: berita.judul,
                    gambar_thumbnail: berita.gambar_thumbnail,
                    tanggal_publish: berita.tanggal_publish,
                    kategori: berita.kategori,
                    views: berita.views || 0,
                    penulis: penulis || 'Admin',
                    excerpt: excerpt
                };
            }));
            
            return beritaWithUsers;
        } catch (error) {
            console.error('Error in getLatestBerita:', error);
            return [];
        }
    }
    
    /**
     * Get trending berita (most views)
     */
    async getTrendingBerita(limit) {
        try {
            const { data: beritaList, error } = await supabase
                .from('berita')
                .select(`
                    id_berita,
                    judul,
                    gambar_thumbnail,
                    tanggal_publish,
                    kategori,
                    views,
                    id_admin
                `)
                .eq('status', 'publish')
                .order('views', { ascending: false })
                .order('tanggal_publish', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            
            // Get user info for each berita
            const beritaWithUsers = await Promise.all((beritaList || []).map(async (berita) => {
                let penulis = null;
                
                if (berita.id_admin) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('nama_lengkap')
                        .eq('id_user', berita.id_admin)
                        .single();
                    
                    if (userData) {
                        penulis = userData.nama_lengkap;
                    }
                }
                
                return {
                    id_berita: berita.id_berita,
                    judul: berita.judul,
                    gambar_thumbnail: berita.gambar_thumbnail,
                    tanggal_publish: berita.tanggal_publish,
                    kategori: berita.kategori,
                    views: berita.views || 0,
                    penulis: penulis || 'Admin'
                };
            }));
            
            return beritaWithUsers;
        } catch (error) {
            console.error('Error in getTrendingBerita:', error);
            return [];
        }
    }
    
    /**
     * Get featured berita (for homepage)
     */
    async getFeaturedBerita(limit) {
        try {
            // Get berita with highest views for featured
            const { data: beritaList, error } = await supabase
                .from('berita')
                .select(`
                    id_berita,
                    judul,
                    gambar_thumbnail,
                    tanggal_publish,
                    kategori,
                    views,
                    id_admin,
                    isi_berita
                `)
                .eq('status', 'publish')
                .order('views', { ascending: false })
                .order('tanggal_publish', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            
            // Get user info for each berita
            const beritaWithUsers = await Promise.all((beritaList || []).map(async (berita) => {
                let penulis = null;
                
                if (berita.id_admin) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('nama_lengkap')
                        .eq('id_user', berita.id_admin)
                        .single();
                    
                    if (userData) {
                        penulis = userData.nama_lengkap;
                    }
                }
                
                const excerpt = berita.isi_berita ? berita.isi_berita.substring(0, 200) : '';
                
                return {
                    id_berita: berita.id_berita,
                    judul: berita.judul,
                    gambar_thumbnail: berita.gambar_thumbnail,
                    tanggal_publish: berita.tanggal_publish,
                    kategori: berita.kategori,
                    views: berita.views || 0,
                    penulis: penulis || 'Admin',
                    excerpt: excerpt
                };
            }));
            
            return beritaWithUsers;
        } catch (error) {
            console.error('Error in getFeaturedBerita:', error);
            return [];
        }
    }
    
    /**
     * Search berita
     */
    async searchBerita({ query, kategori, page, limit }) {
        try {
            const offset = (page - 1) * limit;
            
            let searchQuery = supabase
                .from('berita')
                .select(`
                    id_berita,
                    judul,
                    isi_berita,
                    gambar_thumbnail,
                    tanggal_publish,
                    kategori,
                    views,
                    id_admin
                `, { count: 'exact' })
                .eq('status', 'publish')
                .or(`judul.ilike.%${query}%,isi_berita.ilike.%${query}%`);
            
            if (kategori && kategori !== 'semua') {
                searchQuery = searchQuery.eq('kategori', kategori);
            }
            
            const { data: beritaList, error, count } = await searchQuery
                .order('tanggal_publish', { ascending: false })
                .range(offset, offset + limit - 1);
            
            if (error) throw error;
            
            // Get user info for each berita
            const beritaWithUsers = await Promise.all((beritaList || []).map(async (berita) => {
                let penulis = null;
                
                if (berita.id_admin) {
                    const { data: userData } = await supabase
                        .from('users')
                        .select('nama_lengkap')
                        .eq('id_user', berita.id_admin)
                        .single();
                    
                    if (userData) {
                        penulis = userData.nama_lengkap;
                    }
                }
                
                return {
                    id_berita: berita.id_berita,
                    judul: berita.judul,
                    isi_berita: berita.isi_berita,
                    gambar_thumbnail: berita.gambar_thumbnail,
                    tanggal_publish: berita.tanggal_publish,
                    kategori: berita.kategori,
                    views: berita.views || 0,
                    penulis: penulis || 'Admin'
                };
            }));
            
            return {
                berita: beritaWithUsers,
                pagination: {
                    currentPage: page,
                    itemsPerPage: limit,
                    totalItems: count || 0,
                    totalPages: Math.ceil((count || 0) / limit)
                }
            };
        } catch (error) {
            console.error('Error in searchBerita:', error);
            throw error;
        }
    }
    
    /**
     * Get berita statistics
     */
    async getBeritaStatistics() {
        try {
            // Get total counts
            const { count: totalBerita } = await supabase
                .from('berita')
                .select('*', { count: 'exact', head: true });
            
            const { count: publishedBerita } = await supabase
                .from('berita')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'publish');
            
            const { count: draftBerita } = await supabase
                .from('berita')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'draft');
            
            // Get total views
            const { data: viewsData } = await supabase
                .from('berita')
                .select('views');
            
            const totalViews = (viewsData || []).reduce((sum, b) => sum + (b.views || 0), 0);
            
            // Get unique categories count
            const { data: categoriesData } = await supabase
                .from('berita')
                .select('kategori')
                .eq('status', 'publish');
            
            const uniqueCategories = [...new Set((categoriesData || []).map(b => b.kategori).filter(Boolean))];
            
            // Get berita per category
            const categoryStats = {};
            (categoriesData || []).forEach(b => {
                if (b.kategori) {
                    if (!categoryStats[b.kategori]) {
                        categoryStats[b.kategori] = { total: 0, total_views: 0 };
                    }
                    categoryStats[b.kategori].total++;
                }
            });
            
            // Add views per category
            for (const kategori in categoryStats) {
                const { data: catViewsData } = await supabase
                    .from('berita')
                    .select('views')
                    .eq('kategori', kategori)
                    .eq('status', 'publish');
                
                categoryStats[kategori].total_views = (catViewsData || []).reduce((sum, b) => sum + (b.views || 0), 0);
            }
            
            const kategoriStats = Object.entries(categoryStats).map(([kategori, stats]) => ({
                kategori,
                total: stats.total,
                total_views: stats.total_views
            })).sort((a, b) => b.total - a.total);
            
            return {
                total_berita: totalBerita || 0,
                published_berita: publishedBerita || 0,
                draft_berita: draftBerita || 0,
                total_views: totalViews,
                total_kategori: uniqueCategories.length,
                kategori_stats: kategoriStats
            };
        } catch (error) {
            console.error('Error in getBeritaStatistics:', error);
            return {
                total_berita: 0,
                published_berita: 0,
                draft_berita: 0,
                total_views: 0,
                total_kategori: 0,
                kategori_stats: []
            };
        }
    }
    
    /**
     * Get popular tags from berita
     */
    async getPopularTags(limit) {
        try {
            // Get all published berita
            const { data: beritaList, error } = await supabase
                .from('berita')
                .select('judul, isi_berita')
                .eq('status', 'publish')
                .limit(100);
            
            if (error) throw error;
            
            // Extract words from titles and content
            const wordCount = {};
            const stopWords = ['yang', 'dan', 'untuk', 'dengan', 'dari', 'ini', 'itu', 'adalah', 'dapat', 'dalam', 'pada', 'atau', 'sebagai', 'juga', 'ke', 'oleh', 'karena', 'bahwa', 'tersebut', 'merupakan', 'bagi', 'dalam', 'tanpa', 'setelah', 'sebelum', 'serta', 'ataupun', 'para'];
            
            (beritaList || []).forEach(berita => {
                const text = `${berita.judul} ${berita.isi_berita || ''}`.toLowerCase();
                const words = text.match(/[a-z0-9]{4,}/g) || [];
                words.forEach(word => {
                    if (!stopWords.includes(word) && !/\d+/.test(word)) {
                        wordCount[word] = (wordCount[word] || 0) + 1;
                    }
                });
            });
            
            const tags = Object.entries(wordCount)
                .map(([tag, frequency]) => ({ tag, frequency }))
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, limit);
            
            return tags;
        } catch (error) {
            console.error('Error in getPopularTags:', error);
            return [];
        }
    }
    
    /**
     * Increment views
     */
    async incrementViews(id) {
        try {
            // Get current views
            const { data: berita } = await supabase
                .from('berita')
                .select('views')
                .eq('id_berita', id)
                .single();
            
            const currentViews = berita?.views || 0;
            
            // Update views
            const { error } = await supabase
                .from('berita')
                .update({ views: currentViews + 1 })
                .eq('id_berita', id);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error in incrementViews:', error);
            return false;
        }
    }
    
    /**
     * Create new berita
     */
    async createBerita(beritaData) {
        try {
            const dataToInsert = {
                judul: beritaData.judul,
                isi_berita: beritaData.isi_berita,
                kategori: beritaData.kategori,
                status: beritaData.status,
                id_admin: beritaData.id_admin,
                views: 0
            };
            
            if (beritaData.gambar_thumbnail) {
                dataToInsert.gambar_thumbnail = beritaData.gambar_thumbnail;
            }
            
            if (beritaData.status === 'publish') {
                dataToInsert.tanggal_publish = new Date().toISOString();
            }
            
            const { data, error } = await supabase
                .from('berita')
                .insert([dataToInsert])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in createBerita:', error);
            throw error;
        }
    }
    
    /**
     * Update berita
     */
    async updateBerita(id, beritaData) {
        try {
            const dataToUpdate = {};
            
            if (beritaData.judul) dataToUpdate.judul = beritaData.judul;
            if (beritaData.isi_berita) dataToUpdate.isi_berita = beritaData.isi_berita;
            if (beritaData.kategori) dataToUpdate.kategori = beritaData.kategori;
            if (beritaData.status) dataToUpdate.status = beritaData.status;
            if (beritaData.gambar_thumbnail !== undefined) dataToUpdate.gambar_thumbnail = beritaData.gambar_thumbnail;
            
            if (beritaData.status === 'publish') {
                // Check current status
                const { data: current } = await supabase
                    .from('berita')
                    .select('status')
                    .eq('id_berita', id)
                    .single();
                
                if (current && current.status !== 'publish') {
                    dataToUpdate.tanggal_publish = new Date().toISOString();
                }
            }
            
            dataToUpdate.updated_at = new Date().toISOString();
            
            const { data, error } = await supabase
                .from('berita')
                .update(dataToUpdate)
                .eq('id_berita', id)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in updateBerita:', error);
            throw error;
        }
    }
    
    /**
     * Delete berita
     */
    async deleteBerita(id) {
        try {
            const { error } = await supabase
                .from('berita')
                .delete()
                .eq('id_berita', id);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error in deleteBerita:', error);
            return false;
        }
    }
}

module.exports = new BeritaService();