const supabase = require('../config/database');

class RepositoryService {
    /**
     * Get journals/documents from repository_dokumen table
     */
    async getJournals({ page, limit, jenis_jurnal, tahun, search, sortBy, sortOrder }) {
        try {
            const offset = (page - 1) * limit;
            
            // Query dari repository_dokumen (bukan jurnal)
            let query = supabase
                .from('repository_dokumen')
                .select(`
                    id_dokumen,
                    judul,
                    abstrak,
                    filepath,
                    tahun,
                    penulis,
                    kategori,
                    doi,
                    link,
                    keywords,
                    downloads,
                    views,
                    created_at
                `, { count: 'exact' })
                .eq('status', 'published');  // Hanya yang sudah dipublish
            
            // Apply filters - map jenis_jurnal ke kategori
            if (jenis_jurnal) {
                let kategoriFilter = '';
                if (jenis_jurnal === 'spirit' || jenis_jurnal === 'spirit-uuid') {
                    kategoriFilter = 'jurnal';
                } else if (jenis_jurnal === 'josiati' || jenis_jurnal === 'josiati-uuid') {
                    kategoriFilter = 'jurnal';
                } else {
                    query = query.eq('kategori', jenis_jurnal);
                }
                
                if (kategoriFilter) {
                    query = query.eq('kategori', kategoriFilter);
                }
            }
            
            if (tahun) {
                query = query.eq('tahun', tahun);
            }
            
            if (search) {
                query = query.or(`judul.ilike.%${search}%,penulis.ilike.%${search}%,abstrak.ilike.%${search}%,keywords.ilike.%${search}%`);
            }
            
            // Apply sorting
            const sortMap = {
                'created_at': 'created_at',
                'judul': 'judul',
                'tahun': 'tahun'
            };
            const sortColumn = sortMap[sortBy] || 'created_at';
            const order = sortOrder === 'ASC' ? { ascending: true } : { ascending: false };
            query = query.order(sortColumn, order);
            
            // Apply pagination
            query = query.range(offset, offset + limit - 1);
            
            const { data, error, count } = await query;
            
            if (error) throw error;
            
            if (!data || data.length === 0) {
                return {
                    documents: [],
                    pagination: {
                        currentPage: page,
                        itemsPerPage: limit,
                        totalItems: 0,
                        totalPages: 0
                    }
                };
            }
            
            // Format data
            const documents = data.map(doc => ({
                id_jurnal: doc.id_dokumen,
                title: doc.judul,
                abstract: doc.abstrak || 'Tidak ada abstrak',
                file_path: doc.filepath,
                year: doc.tahun,
                authors: doc.penulis,
                journal_name: this.getJournalName(doc.kategori),
                citations: 0, // Tidak ada citation tracking di repository_dokumen
                downloads: doc.downloads || 0,
                views: doc.views || 0,
                created_at: doc.created_at,
                kategori: doc.kategori
            }));
            
            return {
                documents: documents,
                pagination: {
                    currentPage: page,
                    itemsPerPage: limit,
                    totalItems: count || 0,
                    totalPages: Math.ceil((count || 0) / limit)
                }
            };
        } catch (error) {
            console.error('Error in getJournals:', error);
            throw error;
        }
    }
    
    getJournalName(kategori) {
        const names = {
            'jurnal': 'Jurnal Ilmiah',
            'penelitian': 'Laporan Penelitian',
            'pengabdian': 'Laporan Pengabdian',
            'buku': 'Buku',
            'haki': 'HKI/Paten',
            'prosiding': 'Prosiding',
            'laporan': 'Laporan'
        };
        return names[kategori] || kategori;
    }
    
    /**
     * Get journal by ID from repository_dokumen
     */
    async getJournalById(id) {
        try {
            const { data: doc, error } = await supabase
                .from('repository_dokumen')
                .select('*')
                .eq('id_dokumen', id)
                .eq('status', 'published')
                .single();
            
            if (error) throw error;
            if (!doc) return null;
            
            // Increment view count
            await this.incrementViews(id);
            
            return {
                id_jurnal: doc.id_dokumen,
                title: doc.judul,
                abstract: doc.abstrak,
                file_path: doc.filepath,
                tahun: doc.tahun,
                authors: doc.penulis.split(',').map(p => ({ nama: p.trim() })),
                journal_name: this.getJournalName(doc.kategori),
                doi: doc.doi,
                link: doc.link,
                keywords: doc.keywords ? doc.keywords.split(',') : [],
                downloads: doc.downloads || 0,
                views: (doc.views || 0) + 1,
                created_at: doc.created_at
            };
        } catch (error) {
            console.error('Error in getJournalById:', error);
            throw error;
        }
    }
    
    /**
     * Get statistics from repository_dokumen
     */
    async getStatistics() {
        try {
            // Total documents
            const { count: totalJournals } = await supabase
                .from('repository_dokumen')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'published');
            
            // Count by kategori
            const { data: kategoriData } = await supabase
                .from('repository_dokumen')
                .select('kategori')
                .eq('status', 'published');
            
            let spiritCount = 0;
            let josiatiCount = 0;
            
            if (kategoriData) {
                spiritCount = kategoriData.filter(k => k.kategori === 'jurnal').length;
                josiatiCount = kategoriData.filter(k => k.kategori === 'jurnal').length;
            }
            
            // Total downloads
            const { data: downloadsData } = await supabase
                .from('repository_dokumen')
                .select('downloads')
                .eq('status', 'published');
            
            const totalDownloads = downloadsData?.reduce((sum, d) => sum + (d.downloads || 0), 0) || 0;
            
            return {
                total_journals: totalJournals || 0,
                spirit_count: spiritCount,
                josiati_count: josiatiCount,
                total_downloads: totalDownloads
            };
        } catch (error) {
            console.error('Error in getStatistics:', error);
            return {
                total_journals: 0,
                spirit_count: 0,
                josiati_count: 0,
                total_downloads: 0
            };
        }
    }
    
    /**
     * Get popular tags from keywords
     */
    async getPopularTags(limit) {
        try {
            const { data, error } = await supabase
                .from('repository_dokumen')
                .select('keywords')
                .eq('status', 'published')
                .not('keywords', 'is', null);
            
            if (error || !data) return [];
            
            const keywordCounts = {};
            data.forEach(item => {
                if (item.keywords) {
                    const keywords = item.keywords.split(',').map(k => k.trim().toLowerCase());
                    keywords.forEach(kw => {
                        if (kw.length > 2) {
                            keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
                        }
                    });
                }
            });
            
            const tags = Object.entries(keywordCounts)
                .map(([keyword, frequency]) => ({ keyword, frequency }))
                .sort((a, b) => b.frequency - a.frequency)
                .slice(0, limit);
            
            return tags;
        } catch (error) {
            console.error('Error in getPopularTags:', error);
            return [];
        }
    }
    
    /**
     * Get top authors
     */
    async getTopAuthors(limit) {
        try {
            const { data, error } = await supabase
                .from('repository_dokumen')
                .select('penulis, downloads, views')
                .eq('status', 'published');
            
            if (error || !data) return [];
            
            const authorMap = new Map();
            
            data.forEach(doc => {
                const authors = doc.penulis.split(',').map(a => a.trim());
                authors.forEach(author => {
                    if (!authorMap.has(author)) {
                        authorMap.set(author, { publications: 0, downloads: 0, views: 0 });
                    }
                    const stats = authorMap.get(author);
                    stats.publications++;
                    stats.downloads += doc.downloads || 0;
                    stats.views += doc.views || 0;
                });
            });
            
            const topAuthors = Array.from(authorMap.entries())
                .map(([name, stats]) => ({
                    name: name,
                    publications: stats.publications,
                    total_downloads: stats.downloads,
                    total_views: stats.views
                }))
                .sort((a, b) => b.publications - a.publications)
                .slice(0, limit);
            
            return topAuthors;
        } catch (error) {
            console.error('Error in getTopAuthors:', error);
            return [];
        }
    }
    
    /**
     * Get available years
     */
    async getYears() {
        try {
            const { data, error } = await supabase
                .from('repository_dokumen')
                .select('tahun')
                .eq('status', 'published')
                .order('tahun', { ascending: false });
            
            if (error) throw error;
            
            const years = [...new Set((data || []).map(d => d.tahun))];
            return years;
        } catch (error) {
            console.error('Error in getYears:', error);
            return [];
        }
    }
    
    /**
     * Download journal
     */
    async downloadJournal(id, userId) {
        try {
            const { data: doc, error } = await supabase
                .from('repository_dokumen')
                .select('id_dokumen, judul, filepath')
                .eq('id_dokumen', id)
                .single();
            
            if (error || !doc) {
                return { success: false, message: 'Dokumen tidak ditemukan' };
            }
            
            // Increment download count
            await supabase
                .from('repository_dokumen')
                .update({ downloads: supabase.rpc('increment', { row_id: id }) })
                .eq('id_dokumen', id);
            
            return {
                success: true,
                filepath: doc.filepath,
                filename: `${doc.judul.replace(/[^a-z0-9]/gi, '_')}.pdf`
            };
        } catch (error) {
            console.error('Error in downloadJournal:', error);
            return { success: false, message: 'Gagal mengunduh dokumen' };
        }
    }
    
    /**
     * Increment views
     */
    async incrementViews(id) {
        try {
            await supabase
                .from('repository_dokumen')
                .update({ views: supabase.rpc('increment', { row_id: id }) })
                .eq('id_dokumen', id);
            return true;
        } catch (error) {
            console.error('Error in incrementViews:', error);
            return false;
        }
    }
    
    /**
     * Increment downloads
     */
    async incrementDownloads(id) {
        try {
            await supabase
                .from('repository_dokumen')
                .update({ downloads: supabase.rpc('increment', { row_id: id }) })
                .eq('id_dokumen', id);
            return true;
        } catch (error) {
            console.error('Error in incrementDownloads:', error);
            return false;
        }
    }
}

module.exports = new RepositoryService();