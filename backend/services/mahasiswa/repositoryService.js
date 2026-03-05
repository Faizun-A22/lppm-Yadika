const supabase = require('../../config/database');
const path = require('path');
const fs = require('fs');

class RepositoryService {
    constructor() {
        this.tableName = 'repository_dokumen';
    }

    /**
     * Get repository list with pagination and filters
     */
    async getRepository({ page, limit, kategori, tahun, search, sortBy, sortOrder }) {
        try {
            let query = supabase
                .from(this.tableName)
                .select('*', { count: 'exact' })
                .eq('status', 'published');

            // Apply filters
            if (kategori && kategori !== 'all') {
                query = query.eq('kategori', kategori);
            }

            if (tahun && tahun !== 'all') {
                query = query.eq('tahun', parseInt(tahun));
            }

            if (search) {
                query = query.or(`judul.ilike.%${search}%,penulis.ilike.%${search}%,abstrak.ilike.%${search}%,keywords.ilike.%${search}%`);
            }

            // Apply sorting
            if (sortBy && sortOrder) {
                query = query.order(sortBy, { ascending: sortOrder === 'ASC' });
            } else {
                query = query.order('created_at', { ascending: false });
            }

            // Apply pagination
            const start = (page - 1) * limit;
            const end = start + limit - 1;
            query = query.range(start, end);

            const { data, error, count } = await query;

            if (error) throw error;

            // Format data
            const formattedData = data.map(doc => this.formatDocumentResponse(doc));

            return {
                documents: formattedData,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    itemsPerPage: limit
                }
            };
        } catch (error) {
            console.error('Error in getRepository:', error);
            throw error;
        }
    }

    /**
     * Get repository by ID
     */
    async getRepositoryById(id) {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select(`
                    *,
                    users:uploaded_by (
                        nama_lengkap,
                        email,
                        nidn,
                        nim,
                        foto_profil
                    )
                `)
                .eq('id_dokumen', id)
                .eq('status', 'published')
                .single();

            if (error) throw error;

            return data ? this.formatDocumentResponse(data) : null;
        } catch (error) {
            console.error('Error in getRepositoryById:', error);
            throw error;
        }
    }

    /**
     * Search repository with advanced filters
     */
    async searchRepository({ query, kategori, tahun, penulis, page, limit }) {
        try {
            let supabaseQuery = supabase
                .from(this.tableName)
                .select('*', { count: 'exact' })
                .eq('status', 'published');

            // Apply search query
            if (query) {
                supabaseQuery = supabaseQuery.or(`
                    judul.ilike.%${query}%,
                    abstrak.ilike.%${query}%,
                    keywords.ilike.%${query}%,
                    penulis.ilike.%${query}%
                `);
            }

            // Apply filters
            if (kategori && kategori !== 'all') {
                supabaseQuery = supabaseQuery.eq('kategori', kategori);
            }

            if (tahun && tahun !== 'all') {
                supabaseQuery = supabaseQuery.eq('tahun', parseInt(tahun));
            }

            if (penulis) {
                supabaseQuery = supabaseQuery.ilike('penulis', `%${penulis}%`);
            }

            // Pagination
            const start = (page - 1) * limit;
            const end = start + limit - 1;
            supabaseQuery = supabaseQuery
                .order('downloads', { ascending: false })
                .range(start, end);

            const { data, error, count } = await supabaseQuery;

            if (error) throw error;

            const formattedData = data.map(doc => this.formatDocumentResponse(doc));

            return {
                documents: formattedData,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(count / limit),
                    totalItems: count,
                    itemsPerPage: limit
                }
            };
        } catch (error) {
            console.error('Error in searchRepository:', error);
            throw error;
        }
    }

    /**
     * Get repository statistics
     */
    async getStatistics() {
        try {
            // Get main statistics from view (if view exists)
            let stats = null;
            try {
                const { data: statsData, error: statsError } = await supabase
                    .from('repository_statistik')
                    .select('*')
                    .single();

                if (!statsError) {
                    stats = statsData;
                }
            } catch (e) {
                console.log('Repository statistik view may not exist, using manual aggregation');
            }

            // Get all published documents for manual aggregation
            const { data: allDocs, error: docsError } = await supabase
                .from(this.tableName)
                .select('kategori, tahun, created_at, downloads, views, id_dokumen, judul, filesize')
                .eq('status', 'published');

            if (docsError) throw docsError;

            // Manual aggregation for categories
            const categoryCount = {};
            allDocs.forEach(doc => {
                categoryCount[doc.kategori] = (categoryCount[doc.kategori] || 0) + 1;
            });

            const categoryStats = Object.entries(categoryCount).map(([kategori, count]) => ({
                kategori,
                count
            }));

            // Manual aggregation for years
            const yearCount = {};
            allDocs.forEach(doc => {
                if (doc.tahun) {
                    yearCount[doc.tahun] = (yearCount[doc.tahun] || 0) + 1;
                }
            });

            const yearStats = Object.entries(yearCount)
                .map(([tahun, count]) => ({ 
                    tahun: parseInt(tahun), 
                    count 
                }))
                .sort((a, b) => b.tahun - a.tahun);

            // Calculate totals
            const totalDokumen = allDocs.length;
            const totalDownloads = allDocs.reduce((sum, doc) => sum + (doc.downloads || 0), 0);
            const totalViews = allDocs.reduce((sum, doc) => sum + (doc.views || 0), 0);
            const totalStorage = allDocs.reduce((sum, doc) => sum + (doc.filesize || 0), 0);

            // Get recent uploads
            const recentUploads = allDocs
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 5)
                .map(doc => ({
                    id_dokumen: doc.id_dokumen,
                    judul: doc.judul,
                    kategori: doc.kategori,
                    tahun: doc.tahun,
                    created_at: doc.created_at
                }));

            // Get most downloaded
            const mostDownloaded = allDocs
                .sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
                .slice(0, 5)
                .map(doc => ({
                    id_dokumen: doc.id_dokumen,
                    judul: doc.judul,
                    kategori: doc.kategori,
                    downloads: doc.downloads || 0
                }));

            return {
                overview: stats || {
                    total_dokumen: totalDokumen,
                    total_downloads: totalDownloads,
                    total_views: totalViews,
                    total_storage_used: totalStorage,
                    total_kategori: categoryStats.length,
                    total_tahun: yearStats.length
                },
                byCategory: categoryStats,
                byYear: yearStats,
                recentUploads,
                mostDownloaded
            };
        } catch (error) {
            console.error('Error in getStatistics:', error);
            throw error;
        }
    }

    /**
     * Get popular tags/keywords
     */
    async getPopularTags(limit = 10) {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('keywords')
                .eq('status', 'published')
                .not('keywords', 'is', null);

            if (error) throw error;

            // Process keywords
            const tagCount = new Map();
            
            data.forEach(doc => {
                if (doc.keywords) {
                    const keywords = doc.keywords.split(',').map(k => k.trim().toLowerCase());
                    keywords.forEach(keyword => {
                        if (keyword) {
                            tagCount.set(keyword, (tagCount.get(keyword) || 0) + 1);
                        }
                    });
                }
            });

            // Sort by count and take top 'limit'
            const sortedTags = Array.from(tagCount.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, limit)
                .map(([tag, count]) => ({ tag, count }));

            return sortedTags;
        } catch (error) {
            console.error('Error in getPopularTags:', error);
            throw error;
        }
    }

    /**
     * Download document
     */
    async downloadDocument(id, userId) {
        try {
            // Get document info
            const { data: doc, error } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('id_dokumen', id)
                .eq('status', 'published')
                .single();

            if (error || !doc) {
                return { success: false, message: 'Dokumen tidak ditemukan' };
            }

            // Check if file exists
            const filepath = path.join(__dirname, '../../', doc.filepath);
            if (!fs.existsSync(filepath)) {
                return { success: false, message: 'File dokumen tidak ditemukan' };
            }

            // Log download activity
            if (userId) {
                await this.logActivity(userId, 'download', id);
            }

            return {
                success: true,
                filepath,
                filename: doc.filename || `dokumen-${id}.pdf`
            };
        } catch (error) {
            console.error('Error in downloadDocument:', error);
            throw error;
        }
    }

    /**
     * Increment document views
     */
    async incrementViews(id) {
        try {
            const { error } = await supabase
                .rpc('increment_repository_views', { doc_id: id });

            if (error) {
                // Fallback: update manually if RPC doesn't exist
                const { error: updateError } = await supabase
                    .from(this.tableName)
                    .update({ views: supabase.raw('views + 1') })
                    .eq('id_dokumen', id);
                
                if (updateError) throw updateError;
            }
        } catch (error) {
            console.error('Error in incrementViews:', error);
            // Don't throw error to prevent disrupting user experience
        }
    }

    /**
     * Increment document downloads
     */
    async incrementDownloads(id) {
        try {
            const { error } = await supabase
                .rpc('increment_repository_downloads', { doc_id: id });

            if (error) {
                // Fallback: update manually if RPC doesn't exist
                const { error: updateError } = await supabase
                    .from(this.tableName)
                    .update({ downloads: supabase.raw('downloads + 1') })
                    .eq('id_dokumen', id);
                
                if (updateError) throw updateError;
            }
        } catch (error) {
            console.error('Error in incrementDownloads:', error);
            // Don't throw error to prevent disrupting user experience
        }
    }

    /**
     * Log user activity
     */
    async logActivity(userId, activity, documentId) {
        try {
            const { error } = await supabase
                .from('log_aktivitas')
                .insert([{
                    id_user: userId,
                    aktivitas: `User ${activity} document: ${documentId}`,
                    waktu: new Date().toISOString()
                }]);

            if (error) throw error;
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    /**
     * Format document response
     */
    formatDocumentResponse(doc) {
        return {
            id: doc.id_dokumen,
            judul: doc.judul,
            kategori: doc.kategori,
            tahun: doc.tahun,
            penulis: doc.penulis,
            abstrak: doc.abstrak,
            doi: doc.doi,
            link: doc.link,
            keywords: doc.keywords ? doc.keywords.split(',').map(k => k.trim()) : [],
            file: {
                filename: doc.filename,
                filepath: doc.filepath,
                filesize: this.formatFileSize(doc.filesize),
                filetype: doc.filetype || 'application/pdf'
            },
            stats: {
                downloads: doc.downloads || 0,
                views: doc.views || 0
            },
            uploaded_by: doc.users ? {
                nama: doc.users.nama_lengkap,
                email: doc.users.email,
                nidn: doc.users.nidn,
                nim: doc.users.nim,
                foto: doc.users.foto_profil
            } : null,
            created_at: doc.created_at,
            updated_at: doc.updated_at
        };
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = new RepositoryService();