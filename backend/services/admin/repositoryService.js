const pool = require('../../config/database');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');
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
        const client = await pool.connect();
        try {
            const queries = {
                totalDocuments: 'SELECT COUNT(*) as total FROM repository_dokumen',
                totalDownloads: 'SELECT COALESCE(SUM(downloads), 0) as total FROM repository_dokumen',
                totalViews: 'SELECT COALESCE(SUM(views), 0) as total FROM repository_dokumen',
                totalSize: 'SELECT COALESCE(SUM(filesize), 0) as total FROM repository_dokumen',
                categoryCounts: `
                    SELECT 
                        kategori,
                        COUNT(*) as jumlah,
                        COALESCE(SUM(downloads), 0) as total_downloads
                    FROM repository_dokumen
                    GROUP BY kategori
                `,
                recentUploads: `
                    SELECT 
                        id_dokumen,
                        judul,
                        kategori,
                        filesize,
                        downloads,
                        views,
                        created_at
                    FROM repository_dokumen
                    ORDER BY created_at DESC
                    LIMIT 5
                `,
                popularDownloads: `
                    SELECT 
                        judul,
                        kategori,
                        downloads
                    FROM repository_dokumen
                    ORDER BY downloads DESC
                    LIMIT 5
                `,
                yearlyStats: `
                    SELECT 
                        EXTRACT(YEAR FROM created_at) as tahun,
                        COUNT(*) as jumlah_dokumen,
                        COALESCE(SUM(downloads), 0) as total_downloads
                    FROM repository_dokumen
                    GROUP BY EXTRACT(YEAR FROM created_at)
                    ORDER BY tahun DESC
                `
            };

            const results = {};
            
            for (const [key, query] of Object.entries(queries)) {
                const { rows } = await client.query(query);
                results[key] = rows;
            }

            // Calculate most popular category
            let popularCategory = null;
            if (results.categoryCounts.length > 0) {
                popularCategory = results.categoryCounts.reduce((max, cat) => 
                    parseInt(cat.jumlah) > parseInt(max.jumlah) ? cat : max
                );
            }

            // Calculate storage usage percentage
            const usedStorage = parseInt(results.totalSize[0]?.total || 0);
            const storagePercentage = (usedStorage / this.maxStorageSize) * 100;

            return {
                total_documents: parseInt(results.totalDocuments[0]?.total || 0),
                total_downloads: parseInt(results.totalDownloads[0]?.total || 0),
                total_views: parseInt(results.totalViews[0]?.total || 0),
                storage_used: usedStorage,
                storage_total: this.maxStorageSize,
                storage_percentage: Math.min(storagePercentage, 100),
                popular_category: popularCategory,
                categories: results.categoryCounts,
                recent_uploads: results.recentUploads,
                popular_downloads: results.popularDownloads,
                yearly_stats: results.yearlyStats
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get all documents with filters
     */
    async getAllDocuments(filters, pagination, sort) {
        const client = await pool.connect();
        try {
            let query = `
                SELECT 
                    d.*,
                    u.nama_lengkap as uploaded_by_name,
                    u.email as uploaded_by_email
                FROM repository_dokumen d
                LEFT JOIN users u ON d.uploaded_by = u.id_user
                WHERE 1=1
            `;
            
            const queryParams = [];
            let paramIndex = 1;

            // Apply filters
            if (filters.search) {
                query += ` AND (
                    d.judul ILIKE $${paramIndex} OR 
                    d.penulis ILIKE $${paramIndex} OR 
                    d.keywords ILIKE $${paramIndex}
                )`;
                queryParams.push(`%${filters.search}%`);
                paramIndex++;
            }

            if (filters.kategori) {
                query += ` AND d.kategori = $${paramIndex}`;
                queryParams.push(filters.kategori);
                paramIndex++;
            }

            if (filters.tahun) {
                query += ` AND d.tahun = $${paramIndex}`;
                queryParams.push(filters.tahun);
                paramIndex++;
            }

            if (filters.status) {
                query += ` AND d.status = $${paramIndex}`;
                queryParams.push(filters.status);
                paramIndex++;
            }

            // Count total data before pagination
            const countQuery = `SELECT COUNT(*) as total FROM (${query}) as count_table`;
            const { rows: countRows } = await client.query(countQuery, queryParams);
            const totalData = parseInt(countRows[0].total);

            // Apply sorting
            const validSortColumns = ['judul', 'tahun', 'downloads', 'views', 'created_at'];
            const sortColumn = validSortColumns.includes(sort.sortBy) ? sort.sortBy : 'created_at';
            query += ` ORDER BY d.${sortColumn} ${sort.sortOrder === 'ASC' ? 'ASC' : 'DESC'}`;

            // Apply pagination
            const offset = (pagination.page - 1) * pagination.limit;
            query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
            queryParams.push(pagination.limit, offset);

            // Execute query
            const { rows } = await client.query(query, queryParams);

            return {
                data: rows,
                pagination: {
                    current_page: pagination.page,
                    per_page: pagination.limit,
                    total_data: totalData,
                    total_pages: Math.ceil(totalData / pagination.limit)
                }
            };
        } finally {
            client.release();
        }
    }

    /**
     * Get document by ID
     */
    async getDocumentById(id) {
        const client = await pool.connect();
        try {
            const query = `
                SELECT 
                    d.*,
                    u.nama_lengkap as uploaded_by_name,
                    u.email as uploaded_by_email
                FROM repository_dokumen d
                LEFT JOIN users u ON d.uploaded_by = u.id_user
                WHERE d.id_dokumen = $1
            `;
            
            const { rows } = await client.query(query, [id]);
            return rows[0] || null;
        } finally {
            client.release();
        }
    }

    /**
     * Create new document
     */
    async createDocument(data) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const id_dokumen = uuidv4();
            const fileExt = path.extname(data.file.originalname);
            const fileName = `${id_dokumen}${fileExt}`;
            const filePath = path.join(this.uploadDir, fileName);

            // Ensure upload directory exists
            await fs.mkdir(this.uploadDir, { recursive: true });

            // Save file
            await fs.writeFile(filePath, data.file.buffer);

            // Insert to database
            const query = `
                INSERT INTO repository_dokumen (
                    id_dokumen,
                    judul,
                    kategori,
                    tahun,
                    penulis,
                    abstrak,
                    doi,
                    link,
                    keywords,
                    filename,
                    filepath,
                    filesize,
                    filetype,
                    uploaded_by,
                    downloads,
                    views,
                    status,
                    created_at,
                    updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW()
                ) RETURNING *
            `;

            const values = [
                id_dokumen,
                data.judul,
                data.kategori,
                data.tahun,
                data.penulis,
                data.abstrak,
                data.doi,
                data.link,
                data.keywords,
                fileName,
                filePath,
                data.file.size,
                data.file.mimetype,
                data.created_by,
                0, // downloads
                0, // views
                'published'
            ];

            const { rows } = await client.query(query, values);

            // Log activity
            await client.query(
                `INSERT INTO log_aktivitas (id_user, aktivitas) VALUES ($1, $2)`,
                [data.created_by, `Upload dokumen baru: ${data.judul}`]
            );

            await client.query('COMMIT');
            return rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Update document
     */
    async updateDocument(id, data) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

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
                const fileExt = path.extname(data.file.originalname);
                fileName = `${id}${fileExt}`;
                filePath = path.join(this.uploadDir, fileName);
                
                await fs.writeFile(filePath, data.file.buffer);
                fileSize = data.file.size;
                fileType = data.file.mimetype;
            }

            // Update database
            const query = `
                UPDATE repository_dokumen SET
                    judul = $1,
                    kategori = $2,
                    tahun = $3,
                    penulis = $4,
                    abstrak = $5,
                    doi = $6,
                    link = $7,
                    keywords = $8,
                    filename = $9,
                    filepath = $10,
                    filesize = $11,
                    filetype = $12,
                    updated_at = NOW()
                WHERE id_dokumen = $13
                RETURNING *
            `;

            const values = [
                data.judul,
                data.kategori,
                data.tahun,
                data.penulis,
                data.abstrak,
                data.doi,
                data.link,
                data.keywords,
                fileName,
                filePath,
                fileSize,
                fileType,
                id
            ];

            const { rows } = await client.query(query, values);

            // Log activity
            await client.query(
                `INSERT INTO log_aktivitas (id_user, aktivitas) VALUES ($1, $2)`,
                [data.updated_by, `Update dokumen: ${data.judul}`]
            );

            await client.query('COMMIT');
            return rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Delete document
     */
    async deleteDocument(id) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

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
            const query = 'DELETE FROM repository_dokumen WHERE id_dokumen = $1 RETURNING id_dokumen';
            const { rows } = await client.query(query, [id]);

            if (rows.length > 0) {
                await client.query(
                    `INSERT INTO log_aktivitas (id_user, aktivitas) VALUES ($1, $2)`,
                    [document.uploaded_by, `Hapus dokumen: ${document.judul}`]
                );
            }

            await client.query('COMMIT');
            return rows.length > 0;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
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
            await fs.access(document.filepath);

            return {
                filePath: document.filepath,
                fileName: document.filename,
                document
            };
        } catch (error) {
            logger.error('Error accessing file:', error);
            return null;
        }
    }

    /**
     * Increment view count
     */
    async incrementViewCount(id) {
        const client = await pool.connect();
        try {
            const query = `
                UPDATE repository_dokumen 
                SET views = COALESCE(views, 0) + 1 
                WHERE id_dokumen = $1
            `;
            await client.query(query, [id]);
        } finally {
            client.release();
        }
    }

    /**
     * Increment download count
     */
    async incrementDownloadCount(id) {
        const client = await pool.connect();
        try {
            const query = `
                UPDATE repository_dokumen 
                SET downloads = COALESCE(downloads, 0) + 1 
                WHERE id_dokumen = $1
            `;
            await client.query(query, [id]);
        } finally {
            client.release();
        }
    }

    /**
     * Get category counts
     */
    async getCategoryCounts() {
        const client = await pool.connect();
        try {
            const query = `
                SELECT 
                    kategori,
                    COUNT(*) as jumlah,
                    COALESCE(SUM(downloads), 0) as total_downloads,
                    COALESCE(SUM(views), 0) as total_views
                FROM repository_dokumen
                GROUP BY kategori
                ORDER BY jumlah DESC
            `;
            
            const { rows } = await client.query(query);
            return rows;
        } finally {
            client.release();
        }
    }

    /**
     * Get storage information
     */
    async getStorageInfo() {
        const client = await pool.connect();
        try {
            // Get total storage used
            const { rows } = await client.query(`
                SELECT 
                    COALESCE(SUM(filesize), 0) as used,
                    COUNT(*) as total_files,
                    COUNT(DISTINCT kategori) as total_categories
                FROM repository_dokumen
            `);

            const used = parseInt(rows[0].used);
            const totalFiles = parseInt(rows[0].total_files);
            const totalCategories = parseInt(rows[0].total_categories);

            // Get storage by category
            const categoryStorage = await client.query(`
                SELECT 
                    kategori,
                    COUNT(*) as jumlah,
                    COALESCE(SUM(filesize), 0) as total_size
                FROM repository_dokumen
                GROUP BY kategori
            `);

            return {
                used_storage: used,
                total_storage: this.maxStorageSize,
                available_storage: this.maxStorageSize - used,
                usage_percentage: (used / this.maxStorageSize) * 100,
                total_files: totalFiles,
                total_categories: totalCategories,
                by_category: categoryStorage.rows
            };
        } finally {
            client.release();
        }
    }
}

module.exports = new RepositoryService();