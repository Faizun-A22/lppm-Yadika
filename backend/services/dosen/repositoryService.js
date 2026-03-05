const supabase = require('../../config/database');
const path = require('path');
const fs = require('fs');

class RepositoryService {
    constructor() {
        this.tableName = 'repository_dokumen';
    }

    /**
     * Get ALL repository documents (public)
     */
    async getAllRepository({ page, limit, tipe, tahun, search, sortBy, sortOrder }) {
        try {
            console.log('Fetching all repository documents');
            console.log('Filters:', { tipe, tahun, search });
            
            let query = supabase
                .from(this.tableName)
                .select(`
                    *,
                    users:uploaded_by (
                        id_user,
                        nama_lengkap,
                        email,
                        role,
                        nidn,
                        nim
                    )
                `, { count: 'exact' })
                .eq('status', 'published'); // Hanya tampilkan yang published

            // Apply filters
            if (tipe && tipe !== 'all' && tipe !== '') {
                query = query.eq('kategori', tipe);
            }

            if (tahun && tahun !== 'all' && tahun !== '') {
                query = query.eq('tahun', parseInt(tahun));
            }

            if (search && search !== '') {
                query = query.or(`
                    judul.ilike.%${search}%,
                    abstrak.ilike.%${search}%,
                    keywords.ilike.%${search}%,
                    penulis.ilike.%${search}%
                `);
            }

            // Apply sorting
            const validSortColumns = {
                'created_at': 'created_at',
                'judul': 'judul',
                'tahun': 'tahun',
                'downloads': 'downloads',
                'views': 'views',
                'penulis': 'penulis'
            };
            
            const sortColumn = validSortColumns[sortBy] || 'created_at';
            query = query.order(sortColumn, { ascending: sortOrder === 'ASC' });

            // Apply pagination
            const start = (page - 1) * limit;
            const end = start + limit - 1;
            query = query.range(start, end);

            const { data, error, count } = await query;

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            console.log(`Found ${data?.length || 0} documents, total: ${count}`);

            const formattedData = data.map(doc => this.formatPublicDocumentResponse(doc));

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
            console.error('Error in getAllRepository:', error);
            throw error;
        }
    }

    /**
     * Get user's personal repository list
     */
    async getUserRepository(userId, { page, limit, tipe, tahun, search, sortBy, sortOrder }) {
        try {
            console.log('Fetching personal repository for user:', userId);
            
            let query = supabase
                .from(this.tableName)
                .select('*', { count: 'exact' })
                .eq('uploaded_by', userId);

            if (tipe && tipe !== 'all' && tipe !== '') {
                query = query.eq('kategori', tipe);
            }

            if (tahun && tahun !== 'all' && tahun !== '') {
                query = query.eq('tahun', parseInt(tahun));
            }

            if (search && search !== '') {
                query = query.or(`judul.ilike.%${search}%,abstrak.ilike.%${search}%,keywords.ilike.%${search}%`);
            }

            const validSortColumns = {
                'created_at': 'created_at',
                'judul': 'judul',
                'tahun': 'tahun',
                'downloads': 'downloads',
                'views': 'views'
            };
            
            const sortColumn = validSortColumns[sortBy] || 'created_at';
            query = query.order(sortColumn, { ascending: sortOrder === 'ASC' });

            const start = (page - 1) * limit;
            const end = start + limit - 1;
            query = query.range(start, end);

            const { data, error, count } = await query;

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
            console.error('Error in getUserRepository:', error);
            throw error;
        }
    }

    /**
     * Get repository by ID (public)
     */
    async getRepositoryById(id) {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select(`
                    *,
                    users:uploaded_by (
                        id_user,
                        nama_lengkap,
                        email,
                        role,
                        nidn,
                        nim
                    )
                `)
                .eq('id_dokumen', id)
                .single();

            if (error) throw error;

            return data ? this.formatPublicDocumentResponse(data) : null;
        } catch (error) {
            console.error('Error in getRepositoryById:', error);
            throw error;
        }
    }

    /**
     * Search repository (public)
     */
    async searchRepository({ query: searchQuery, tipe, tahun, page, limit }) {
        try {
            let supabaseQuery = supabase
                .from(this.tableName)
                .select(`
                    *,
                    users:uploaded_by (
                        nama_lengkap,
                        role
                    )
                `, { count: 'exact' })
                .eq('status', 'published');

            if (searchQuery) {
                supabaseQuery = supabaseQuery.or(`
                    judul.ilike.%${searchQuery}%,
                    abstrak.ilike.%${searchQuery}%,
                    keywords.ilike.%${searchQuery}%,
                    penulis.ilike.%${searchQuery}%
                `);
            }

            if (tipe && tipe !== 'all') {
                supabaseQuery = supabaseQuery.eq('kategori', tipe);
            }

            if (tahun && tahun !== 'all') {
                supabaseQuery = supabaseQuery.eq('tahun', parseInt(tahun));
            }

            const start = (page - 1) * limit;
            const end = start + limit - 1;
            supabaseQuery = supabaseQuery
                .order('created_at', { ascending: false })
                .range(start, end);

            const { data, error, count } = await supabaseQuery;

            if (error) throw error;

            const formattedData = data.map(doc => this.formatPublicDocumentResponse(doc));

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
     * Create new repository entry
     */
    async createRepository(userId, data, file) {
        try {
            if (!file) {
                return {
                    success: false,
                    message: 'File harus diupload'
                };
            }

            const fileData = {
                filename: file.filename,
                originalname: file.originalname,
                filepath: file.path.replace(/\\/g, '/'),
                filesize: file.size,
                filetype: file.mimetype
            };

            const keywords = data.kata_kunci ? data.kata_kunci.join(', ') : '';
            const penulis = data.penulis ? data.penulis.join(', ') : '';

            const insertData = {
                judul: data.judul,
                kategori: data.tipe,
                tahun: data.tahun,
                penulis: penulis,
                abstrak: data.abstrak,
                keywords: keywords,
                uploaded_by: userId,
                filename: fileData.filename,
                filepath: fileData.filepath,
                filesize: fileData.filesize,
                filetype: fileData.filetype,
                status: 'published',
                downloads: 0,
                views: 0,
                created_at: new Date(),
                updated_at: new Date()
            };

            // Add optional fields
            const optionalFields = [
                'publisher', 'volume', 'terindeks', 'doi', 'konferensi', 
                'lokasi', 'penyelenggara', 'isbn', 'penerbit', 'halaman',
                'edisi', 'nomor_hki', 'tanggal_terbit', 'jenis_hki',
                'sponsor', 'kontrak', 'periode'
            ];

            optionalFields.forEach(field => {
                if (data[field]) {
                    insertData[field] = data[field];
                }
            });

            const { data: newDoc, error } = await supabase
                .from(this.tableName)
                .insert([insertData])
                .select()
                .single();

            if (error) throw error;

            return {
                success: true,
                data: this.formatDocumentResponse(newDoc)
            };
        } catch (error) {
            console.error('Error in createRepository:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Update repository (with ownership check)
     */
    async updateRepository(id, userId, data, file) {
        try {
            // Check ownership
            const { data: existing, error: checkError } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('id_dokumen', id)
                .eq('uploaded_by', userId)
                .single();

            if (checkError || !existing) {
                return {
                    success: false,
                    status: 404,
                    message: 'Dokumen tidak ditemukan atau Anda tidak memiliki akses'
                };
            }

            // Handle file upload if new file provided
            let fileData = {};
            if (file) {
                // Delete old file
                if (existing.filepath) {
                    const oldPath = path.join(__dirname, '../../', existing.filepath);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }

                fileData = {
                    filename: file.filename,
                    filepath: file.path.replace(/\\/g, '/'),
                    filesize: file.size,
                    filetype: file.mimetype
                };
            }

            const updateData = {
                updated_at: new Date()
            };

            if (data.judul) updateData.judul = data.judul;
            if (data.tipe) updateData.kategori = data.tipe;
            if (data.tahun) updateData.tahun = data.tahun;
            if (data.penulis) updateData.penulis = data.penulis.join(', ');
            if (data.abstrak) updateData.abstrak = data.abstrak;
            if (data.kata_kunci) updateData.keywords = data.kata_kunci.join(', ');
            
            // Optional fields
            const optionalFields = [
                'publisher', 'volume', 'terindeks', 'doi', 'konferensi',
                'lokasi', 'penyelenggara', 'isbn', 'penerbit', 'halaman',
                'edisi', 'nomor_hki', 'tanggal_terbit', 'jenis_hki',
                'sponsor', 'kontrak', 'periode'
            ];

            optionalFields.forEach(field => {
                if (data[field]) {
                    updateData[field] = data[field];
                }
            });

            // File data
            if (fileData.filename) {
                updateData.filename = fileData.filename;
                updateData.filepath = fileData.filepath;
                updateData.filesize = fileData.filesize;
                updateData.filetype = fileData.filetype;
            }

            const { data: updatedDoc, error } = await supabase
                .from(this.tableName)
                .update(updateData)
                .eq('id_dokumen', id)
                .select()
                .single();

            if (error) throw error;

            return {
                success: true,
                data: this.formatDocumentResponse(updatedDoc)
            };
        } catch (error) {
            console.error('Error in updateRepository:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Delete repository (with ownership check)
     */
    async deleteRepository(id, userId) {
        try {
            // Get document info to delete file
            const { data: doc, error: fetchError } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('id_dokumen', id)
                .eq('uploaded_by', userId)
                .single();

            if (fetchError || !doc) {
                return {
                    success: false,
                    status: 404,
                    message: 'Dokumen tidak ditemukan atau Anda tidak memiliki akses'
                };
            }

            // Delete file if exists
            if (doc.filepath) {
                const filePath = path.join(__dirname, '../../', doc.filepath);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }

            // Delete from database
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('id_dokumen', id);

            if (error) throw error;

            return {
                success: true
            };
        } catch (error) {
            console.error('Error in deleteRepository:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Get public statistics (all documents)
     */
    async getPublicStatistics() {
        try {
            const { data: allDocs, error } = await supabase
                .from(this.tableName)
                .select('kategori, tahun, downloads, views, filesize, uploaded_by')
                .eq('status', 'published');

            if (error) throw error;

            // Count by type
            const typeCount = {
                jurnal: 0,
                prosiding: 0,
                buku: 0,
                hki: 0,
                laporan: 0,
                skripsi: 0,
                tesis: 0
            };

            allDocs.forEach(doc => {
                if (typeCount.hasOwnProperty(doc.kategori)) {
                    typeCount[doc.kategori]++;
                }
            });

            // Count by year
            const yearCount = {};
            allDocs.forEach(doc => {
                if (doc.tahun) {
                    yearCount[doc.tahun] = (yearCount[doc.tahun] || 0) + 1;
                }
            });

            // Calculate totals
            const totalDownloads = allDocs.reduce((sum, doc) => sum + (doc.downloads || 0), 0);
            const totalViews = allDocs.reduce((sum, doc) => sum + (doc.views || 0), 0);
            const totalStorage = allDocs.reduce((sum, doc) => sum + (doc.filesize || 0), 0);

            return {
                total_dokumen: allDocs.length,
                total_downloads: totalDownloads,
                total_views: totalViews,
                total_storage: totalStorage,
                by_type: typeCount,
                by_year: Object.entries(yearCount).map(([tahun, count]) => ({ 
                    tahun: parseInt(tahun), 
                    count 
                })).sort((a, b) => b.tahun - a.tahun)
            };
        } catch (error) {
            console.error('Error in getPublicStatistics:', error);
            throw error;
        }
    }

    /**
     * Get user personal statistics
     */
    async getUserStatistics(userId) {
        try {
            const { data: allDocs, error } = await supabase
                .from(this.tableName)
                .select('kategori, tahun, downloads, views, filesize')
                .eq('uploaded_by', userId);

            if (error) throw error;

            const typeCount = {
                jurnal: 0,
                prosiding: 0,
                buku: 0,
                hki: 0,
                laporan: 0
            };

            allDocs.forEach(doc => {
                if (typeCount.hasOwnProperty(doc.kategori)) {
                    typeCount[doc.kategori]++;
                }
            });

            const yearCount = {};
            allDocs.forEach(doc => {
                if (doc.tahun) {
                    yearCount[doc.tahun] = (yearCount[doc.tahun] || 0) + 1;
                }
            });

            const totalDownloads = allDocs.reduce((sum, doc) => sum + (doc.downloads || 0), 0);
            const totalViews = allDocs.reduce((sum, doc) => sum + (doc.views || 0), 0);
            const totalStorage = allDocs.reduce((sum, doc) => sum + (doc.filesize || 0), 0);

            return {
                total_dokumen: allDocs.length,
                total_downloads: totalDownloads,
                total_views: totalViews,
                total_storage: totalStorage,
                by_type: typeCount,
                by_year: Object.entries(yearCount).map(([tahun, count]) => ({ 
                    tahun: parseInt(tahun), 
                    count 
                }))
            };
        } catch (error) {
            console.error('Error in getUserStatistics:', error);
            throw error;
        }
    }

    /**
     * Get popular tags (global)
     */
    async getPopularTags(limit = 10) {
        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('keywords')
                .not('keywords', 'is', null);

            if (error) throw error;

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
    async downloadDocument(id) {
        try {
            const { data: doc, error } = await supabase
                .from(this.tableName)
                .select('*')
                .eq('id_dokumen', id)
                .single();

            if (error || !doc) {
                return { success: false, message: 'Dokumen tidak ditemukan' };
            }

            const filepath = path.join(__dirname, '../../', doc.filepath);
            if (!fs.existsSync(filepath)) {
                return { success: false, message: 'File dokumen tidak ditemukan' };
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
     * Increment views
     */
    async incrementViews(id) {
        try {
            await supabase.rpc('increment_repository_views', { doc_id: id });
        } catch (error) {
            console.error('Error in incrementViews:', error);
            try {
                await supabase
                    .from(this.tableName)
                    .update({ views: supabase.raw('views + 1') })
                    .eq('id_dokumen', id);
            } catch (fallbackError) {
                console.error('Fallback error in incrementViews:', fallbackError);
            }
        }
    }

    /**
     * Increment downloads
     */
    async incrementDownloads(id) {
        try {
            await supabase.rpc('increment_repository_downloads', { doc_id: id });
        } catch (error) {
            console.error('Error in incrementDownloads:', error);
            try {
                await supabase
                    .from(this.tableName)
                    .update({ downloads: supabase.raw('downloads + 1') })
                    .eq('id_dokumen', id);
            } catch (fallbackError) {
                console.error('Fallback error in incrementDownloads:', fallbackError);
            }
        }
    }

    /**
     * Format document response for public view (with user info)
     */
    formatPublicDocumentResponse(doc) {
        return {
            id: doc.id_dokumen,
            judul: doc.judul,
            tipe: doc.kategori,
            tahun: doc.tahun,
            penulis: doc.penulis ? doc.penulis.split(',').map(p => p.trim()) : [],
            abstrak: doc.abstrak,
            kata_kunci: doc.keywords ? doc.keywords.split(',').map(k => k.trim()) : [],
            file: {
                filename: doc.filename,
                filepath: doc.filepath,
                filesize: this.formatFileSize(doc.filesize),
                filetype: doc.filetype
            },
            stats: {
                downloads: doc.downloads || 0,
                views: doc.views || 0
            },
            uploaded_by: doc.users ? {
                id: doc.users.id_user,
                nama: doc.users.nama_lengkap,
                role: doc.users.role,
                nidn: doc.users.nidn,
                nim: doc.users.nim
            } : {
                id: doc.uploaded_by,
                nama: 'Unknown',
                role: 'unknown'
            },
            doi: doc.doi,
            publisher: doc.publisher,
            volume: doc.volume,
            terindeks: doc.terindeks,
            konferensi: doc.konferensi,
            lokasi: doc.lokasi,
            penyelenggara: doc.penyelenggara,
            isbn: doc.isbn,
            penerbit: doc.penerbit,
            halaman: doc.halaman,
            edisi: doc.edisi,
            nomor_hki: doc.nomor_hki,
            tanggal_terbit: doc.tanggal_terbit,
            jenis_hki: doc.jenis_hki,
            sponsor: doc.sponsor,
            kontrak: doc.kontrak,
            periode: doc.periode,
            created_at: doc.created_at,
            updated_at: doc.updated_at
        };
    }

    /**
     * Format document response for personal view
     */
    formatDocumentResponse(doc) {
        return {
            id: doc.id_dokumen,
            judul: doc.judul,
            tipe: doc.kategori,
            tahun: doc.tahun,
            penulis: doc.penulis ? doc.penulis.split(',').map(p => p.trim()) : [],
            abstrak: doc.abstrak,
            kata_kunci: doc.keywords ? doc.keywords.split(',').map(k => k.trim()) : [],
            file: {
                filename: doc.filename,
                filepath: doc.filepath,
                filesize: this.formatFileSize(doc.filesize),
                filetype: doc.filetype
            },
            stats: {
                downloads: doc.downloads || 0,
                views: doc.views || 0
            },
            doi: doc.doi,
            publisher: doc.publisher,
            volume: doc.volume,
            terindeks: doc.terindeks,
            konferensi: doc.konferensi,
            lokasi: doc.lokasi,
            penyelenggara: doc.penyelenggara,
            isbn: doc.isbn,
            penerbit: doc.penerbit,
            halaman: doc.halaman,
            edisi: doc.edisi,
            nomor_hki: doc.nomor_hki,
            tanggal_terbit: doc.tanggal_terbit,
            jenis_hki: doc.jenis_hki,
            sponsor: doc.sponsor,
            kontrak: doc.kontrak,
            periode: doc.periode,
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