const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
const supabase = require('../../config/database');
const logger = require('../../config/logger');

class RepositoryService {
    constructor() {
        this.uploadDir = process.env.UPLOAD_DIR || 'uploads/repository';
        this.maxStorageSize = parseInt(process.env.MAX_STORAGE_SIZE) || 5 * 1024 * 1024 * 1024; // 5GB default
    }

    /**
     * Get dashboard statistics
     */
    async getDashboardStats() {
        try {
            // Total dokumen
            const { count: totalDocuments, error: countError } = await supabase
                .from('repository_dokumen')
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;

            // Total downloads
            const { data: downloadsData, error: downloadsError } = await supabase
                .from('repository_dokumen')
                .select('downloads');

            if (downloadsError) throw downloadsError;
            
            const totalDownloads = downloadsData?.reduce((sum, doc) => sum + (doc.downloads || 0), 0) || 0;

            // Total views
            const { data: viewsData, error: viewsError } = await supabase
                .from('repository_dokumen')
                .select('views');

            if (viewsError) throw viewsError;
            
            const totalViews = viewsData?.reduce((sum, doc) => sum + (doc.views || 0), 0) || 0;

            // Total size
            const { data: sizeData, error: sizeError } = await supabase
                .from('repository_dokumen')
                .select('filesize');

            if (sizeError) throw sizeError;
            
            const totalSize = sizeData?.reduce((sum, doc) => sum + (doc.filesize || 0), 0) || 0;

            // Category counts
            const { data: categoryData, error: categoryError } = await supabase
                .from('repository_dokumen')
                .select('kategori, downloads');

            if (categoryError) throw categoryError;

            // Process category counts
            const categoryMap = new Map();
            categoryData?.forEach(doc => {
                if (!categoryMap.has(doc.kategori)) {
                    categoryMap.set(doc.kategori, {
                        kategori: doc.kategori,
                        jumlah: 0,
                        total_downloads: 0
                    });
                }
                const cat = categoryMap.get(doc.kategori);
                cat.jumlah++;
                cat.total_downloads += (doc.downloads || 0);
            });

            const categoriesArray = Array.from(categoryMap.values());

            // Find most popular category
            let popularCategory = null;
            if (categoriesArray.length > 0) {
                popularCategory = categoriesArray.reduce((max, cat) => 
                    cat.jumlah > max.jumlah ? cat : max
                );
            }

            // Recent uploads
            const { data: recentUploads, error: recentError } = await supabase
                .from('repository_dokumen')
                .select(`
                    id_dokumen,
                    judul,
                    kategori,
                    filesize,
                    downloads,
                    views,
                    created_at
                `)
                .order('created_at', { ascending: false })
                .limit(5);

            if (recentError) throw recentError;

            // Popular downloads
            const { data: popularDownloads, error: popularError } = await supabase
                .from('repository_dokumen')
                .select('judul, kategori, downloads')
                .order('downloads', { ascending: false })
                .limit(5);

            if (popularError) throw popularError;

            // Yearly stats
            const { data: yearlyData, error: yearlyError } = await supabase
                .from('repository_dokumen')
                .select('created_at, downloads');

            if (yearlyError) throw yearlyError;

            const yearlyMap = new Map();
            yearlyData?.forEach(doc => {
                const year = new Date(doc.created_at).getFullYear();
                if (!yearlyMap.has(year)) {
                    yearlyMap.set(year, {
                        tahun: year,
                        jumlah_dokumen: 0,
                        total_downloads: 0
                    });
                }
                const yearStat = yearlyMap.get(year);
                yearStat.jumlah_dokumen++;
                yearStat.total_downloads += (doc.downloads || 0);
            });

            const yearlyArray = Array.from(yearlyMap.values()).sort((a, b) => b.tahun - a.tahun);

            // Calculate storage percentage
            const storagePercentage = totalSize > 0 ? (totalSize / this.maxStorageSize) * 100 : 0;

            return {
                total_documents: totalDocuments || 0,
                total_downloads: totalDownloads,
                total_views: totalViews,
                storage_used: totalSize,
                storage_total: this.maxStorageSize,
                storage_percentage: Math.min(storagePercentage, 100),
                popular_category: popularCategory,
                categories: categoriesArray,
                recent_uploads: recentUploads || [],
                popular_downloads: popularDownloads || [],
                yearly_stats: yearlyArray
            };
        } catch (error) {
            logger.error('Error in getDashboardStats:', error);
            throw error;
        }
    }

    /**
     * Get all documents with filters
     */
    async getAllDocuments(filters, pagination, sort) {
        try {
            let query = supabase
                .from('repository_dokumen')
                .select(`
                    *,
                    users!repository_dokumen_uploaded_by_fkey (
                        nama_lengkap,
                        email
                    )
                `, { count: 'exact' });

            // Apply filters
            if (filters.search) {
                query = query.or(`judul.ilike.%${filters.search}%,penulis.ilike.%${filters.search}%,keywords.ilike.%${filters.search}%`);
            }

            if (filters.kategori) {
                query = query.eq('kategori', filters.kategori);
            }

            if (filters.tahun) {
                query = query.eq('tahun', filters.tahun);
            }

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            // Apply sorting
            const sortColumn = sort.sortBy || 'created_at';
            const sortOrder = sort.sortOrder === 'ASC' ? { ascending: true } : { ascending: false };
            query = query.order(sortColumn, sortOrder);

            // Apply pagination
            const from = (pagination.page - 1) * pagination.limit;
            const to = from + pagination.limit - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) throw error;

            // Transform data to flatten user info
            const transformedData = data?.map(doc => ({
                ...doc,
                uploaded_by_name: doc.users?.nama_lengkap,
                uploaded_by_email: doc.users?.email,
                users: undefined
            })) || [];

            return {
                data: transformedData,
                pagination: {
                    current_page: pagination.page,
                    per_page: pagination.limit,
                    total_data: count || 0,
                    total_pages: Math.ceil((count || 0) / pagination.limit)
                }
            };
        } catch (error) {
            logger.error('Error in getAllDocuments:', error);
            throw error;
        }
    }

    /**
     * Get document by ID
     */
    async getDocumentById(id) {
        try {
            const { data, error } = await supabase
                .from('repository_dokumen')
                .select(`
                    *,
                    users!repository_dokumen_uploaded_by_fkey (
                        nama_lengkap,
                        email
                    )
                `)
                .eq('id_dokumen', id)
                .single();

            if (error) throw error;

            if (data) {
                data.uploaded_by_name = data.users?.nama_lengkap;
                data.uploaded_by_email = data.users?.email;
                delete data.users;
            }

            return data || null;
        } catch (error) {
            logger.error('Error in getDocumentById:', error);
            throw error;
        }
    }

    /**
     * Create new document
     */
    async createDocument(data) {
        try {
            const id_dokumen = uuidv4();
            
            // Get file info from multer
            const file = data.file;
            const fileName = file.filename;
            const filePath = file.path;
            
            // Insert to database
            const { data: newDoc, error } = await supabase
                .from('repository_dokumen')
                .insert([{
                    id_dokumen,
                    judul: data.judul,
                    kategori: data.kategori,
                    tahun: data.tahun,
                    penulis: data.penulis,
                    abstrak: data.abstrak,
                    doi: data.doi,
                    link: data.link,
                    keywords: data.keywords,
                    filename: fileName,
                    filepath: filePath,
                    filesize: file.size,
                    filetype: file.mimetype,
                    uploaded_by: data.created_by,
                    downloads: 0,
                    views: 0,
                    status: 'published',
                    created_at: new Date(),
                    updated_at: new Date()
                }])
                .select()
                .single();

            if (error) throw error;

            // Log activity
            await supabase
                .from('log_aktivitas')
                .insert([{
                    id_user: data.created_by,
                    aktivitas: `Upload dokumen baru: ${data.judul}`,
                    waktu: new Date()
                }]);

            return newDoc;
        } catch (error) {
            // If error, delete uploaded file
            if (data.file) {
                try {
                    await fs.unlink(data.file.path);
                } catch (unlinkError) {
                    logger.error('Error deleting file after failed insert:', unlinkError);
                }
            }
            logger.error('Error in createDocument:', error);
            throw error;
        }
    }

    /**
     * Update document
     */
    async updateDocument(id, data) {
        try {
            // Get existing document
            const existing = await this.getDocumentById(id);
            if (!existing) {
                return null;
            }

            let filePath = existing.filepath;
            let fileName = existing.filename;
            let fileSize = existing.filesize;
            let fileType = existing.filetype;

            // If new file uploaded
            if (data.file) {
                // Delete old file
                try {
                    await fs.unlink(existing.filepath);
                } catch (err) {
                    logger.warn('Failed to delete old file:', err);
                }

                // Save new file
                fileName = data.file.filename;
                filePath = data.file.path;
                fileSize = data.file.size;
                fileType = data.file.mimetype;
            }

            // Update database
            const { data: updatedDoc, error } = await supabase
                .from('repository_dokumen')
                .update({
                    judul: data.judul,
                    kategori: data.kategori,
                    tahun: data.tahun,
                    penulis: data.penulis,
                    abstrak: data.abstrak,
                    doi: data.doi,
                    link: data.link,
                    keywords: data.keywords,
                    filename: fileName,
                    filepath: filePath,
                    filesize: fileSize,
                    filetype: fileType,
                    updated_at: new Date()
                })
                .eq('id_dokumen', id)
                .select()
                .single();

            if (error) throw error;

            // Log activity
            await supabase
                .from('log_aktivitas')
                .insert([{
                    id_user: data.updated_by,
                    aktivitas: `Update dokumen: ${data.judul}`,
                    waktu: new Date()
                }]);

            return updatedDoc;
        } catch (error) {
            logger.error('Error in updateDocument:', error);
            throw error;
        }
    }

    /**
     * Delete document
     */
    async deleteDocument(id, userId) {
        try {
            // Get document info
            const document = await this.getDocumentById(id);
            if (!document) {
                return false;
            }

            // Delete file
            try {
                await fs.unlink(document.filepath);
            } catch (err) {
                logger.warn('Failed to delete file:', err);
            }

            // Delete from database
            const { error } = await supabase
                .from('repository_dokumen')
                .delete()
                .eq('id_dokumen', id);

            if (error) throw error;

            // Log activity
            await supabase
                .from('log_aktivitas')
                .insert([{
                    id_user: userId,
                    aktivitas: `Hapus dokumen: ${document.judul}`,
                    waktu: new Date()
                }]);

            return true;
        } catch (error) {
            logger.error('Error in deleteDocument:', error);
            throw error;
        }
    }

    /**
     * Get document file for download
     */
    async getDocumentFile(id) {
        try {
            const document = await this.getDocumentById(id);
            if (!document) {
                return null;
            }

            // Check if file exists
            try {
                await fs.access(document.filepath);
            } catch (err) {
                logger.error('File not found:', document.filepath);
                return null;
            }

            return {
                filePath: document.filepath,
                fileName: document.filename,
                document
            };
        } catch (error) {
            logger.error('Error in getDocumentFile:', error);
            return null;
        }
    }

    /**
     * Increment view count
     */
    async incrementViewCount(id) {
        try {
            const { error } = await supabase.rpc('increment_repository_views', {
                doc_id: id
            });

            if (error) {
                // Fallback: update manually
                await supabase
                    .from('repository_dokumen')
                    .update({ views: supabase.raw('views + 1') })
                    .eq('id_dokumen', id);
            }
        } catch (error) {
            logger.error('Error in incrementViewCount:', error);
        }
    }

    /**
     * Increment download count
     */
    async incrementDownloadCount(id) {
        try {
            const { error } = await supabase.rpc('increment_repository_downloads', {
                doc_id: id
            });

            if (error) {
                // Fallback: update manually
                await supabase
                    .from('repository_dokumen')
                    .update({ downloads: supabase.raw('downloads + 1') })
                    .eq('id_dokumen', id);
            }
        } catch (error) {
            logger.error('Error in incrementDownloadCount:', error);
        }
    }

    /**
     * Get category counts
     */
    async getCategoryCounts() {
        try {
            const { data, error } = await supabase
                .from('repository_dokumen')
                .select('kategori, downloads, views');

            if (error) throw error;

            const categoryMap = new Map();
            data?.forEach(doc => {
                if (!categoryMap.has(doc.kategori)) {
                    categoryMap.set(doc.kategori, {
                        kategori: doc.kategori,
                        jumlah: 0,
                        total_downloads: 0,
                        total_views: 0
                    });
                }
                const cat = categoryMap.get(doc.kategori);
                cat.jumlah++;
                cat.total_downloads += (doc.downloads || 0);
                cat.total_views += (doc.views || 0);
            });

            return Array.from(categoryMap.values());
        } catch (error) {
            logger.error('Error in getCategoryCounts:', error);
            throw error;
        }
    }

    /**
     * Get storage information
     */
    async getStorageInfo() {
        try {
            const { data, error } = await supabase
                .from('repository_dokumen')
                .select('filesize, kategori');

            if (error) throw error;

            const totalSize = data?.reduce((sum, doc) => sum + (doc.filesize || 0), 0) || 0;
            const totalFiles = data?.length || 0;

            // Get unique categories
            const categories = [...new Set(data?.map(doc => doc.kategori) || [])];
            const totalCategories = categories.length;

            // Storage by category
            const categoryMap = new Map();
            data?.forEach(doc => {
                if (!categoryMap.has(doc.kategori)) {
                    categoryMap.set(doc.kategori, {
                        kategori: doc.kategori,
                        jumlah: 0,
                        total_size: 0
                    });
                }
                const cat = categoryMap.get(doc.kategori);
                cat.jumlah++;
                cat.total_size += (doc.filesize || 0);
            });

            return {
                used_storage: totalSize,
                total_storage: this.maxStorageSize,
                available_storage: this.maxStorageSize - totalSize,
                usage_percentage: totalSize > 0 ? (totalSize / this.maxStorageSize) * 100 : 0,
                total_files: totalFiles,
                total_categories: totalCategories,
                by_category: Array.from(categoryMap.values())
            };
        } catch (error) {
            logger.error('Error in getStorageInfo:', error);
            throw error;
        }
    }
}

module.exports = new RepositoryService();