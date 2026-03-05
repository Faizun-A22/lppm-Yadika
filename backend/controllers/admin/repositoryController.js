const { validationResult } = require('express-validator');
const repositoryService = require('../../services/admin/repositoryService');
const { formatResponse, formatError } = require('../../utils/responseFormatter');
const logger = require('../../config/logger');

class RepositoryController {
    /**
     * Get dashboard statistics
     */
    async getDashboardStats(req, res) {
        try {
            const stats = await repositoryService.getDashboardStats();
            return res.json(formatResponse('success', 'Data statistik berhasil diambil', stats));
        } catch (error) {
            logger.error('Error getting dashboard stats:', error);
            return res.status(500).json(formatError('Gagal mengambil data statistik'));
        }
    }

    /**
     * Get all documents with filters and pagination
     */
    async getAllDocuments(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                search,
                kategori,
                tahun,
                status,
                sortBy = 'created_at',
                sortOrder = 'DESC'
            } = req.query;

            const filters = { search, kategori, tahun, status };
            const pagination = { page: parseInt(page), limit: parseInt(limit) };
            const sort = { sortBy, sortOrder };

            const result = await repositoryService.getAllDocuments(filters, pagination, sort);
            
            return res.json(formatResponse('success', 'Data dokumen berhasil diambil', result));
        } catch (error) {
            logger.error('Error getting documents:', error);
            return res.status(500).json(formatError('Gagal mengambil data dokumen'));
        }
    }

    /**
     * Get document by ID
     */
    async getDocumentById(req, res) {
        try {
            const { id } = req.params;
            const document = await repositoryService.getDocumentById(id);

            if (!document) {
                return res.status(404).json(formatError('Dokumen tidak ditemukan'));
            }

            return res.json(formatResponse('success', 'Data dokumen berhasil diambil', document));
        } catch (error) {
            logger.error('Error getting document by ID:', error);
            return res.status(500).json(formatError('Gagal mengambil data dokumen'));
        }
    }

    /**
     * Create new document
     */
    async createDocument(req, res) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json(formatError('Validasi gagal', errors.array()));
            }

            // Check if file is uploaded
            if (!req.file) {
                return res.status(400).json(formatError('File dokumen harus diupload'));
            }

            const documentData = {
                judul: req.body.judul,
                kategori: req.body.kategori,
                tahun: req.body.tahun,
                penulis: req.body.penulis,
                abstrak: req.body.abstrak || null,
                doi: req.body.doi || null,
                link: req.body.link || null,
                keywords: req.body.keywords || null,
                file: req.file,
                created_by: req.user.id_user // Sesuaikan dengan struktur user dari auth
            };

            const newDocument = await repositoryService.createDocument(documentData);
            
            return res.status(201).json(
                formatResponse('success', 'Dokumen berhasil diupload', newDocument)
            );
        } catch (error) {
            logger.error('Error creating document:', error);
            return res.status(500).json(formatError('Gagal mengupload dokumen'));
        }
    }

    /**
     * Update document
     */
    async updateDocument(req, res) {
        try {
            // Check validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json(formatError('Validasi gagal', errors.array()));
            }

            const { id } = req.params;

            const documentData = {
                judul: req.body.judul,
                kategori: req.body.kategori,
                tahun: req.body.tahun,
                penulis: req.body.penulis,
                abstrak: req.body.abstrak || null,
                doi: req.body.doi || null,
                link: req.body.link || null,
                keywords: req.body.keywords || null,
                file: req.file || null,
                updated_by: req.user.id_user // Sesuaikan dengan struktur user dari auth
            };

            const updatedDocument = await repositoryService.updateDocument(id, documentData);
            
            if (!updatedDocument) {
                return res.status(404).json(formatError('Dokumen tidak ditemukan'));
            }

            return res.json(
                formatResponse('success', 'Dokumen berhasil diperbarui', updatedDocument)
            );
        } catch (error) {
            logger.error('Error updating document:', error);
            return res.status(500).json(formatError('Gagal memperbarui dokumen'));
        }
    }

    /**
     * Delete document
     */
    async deleteDocument(req, res) {
        try {
            const { id } = req.params;
            
            const deleted = await repositoryService.deleteDocument(id, req.user.id_user); // Tambahkan user id
            
            if (!deleted) {
                return res.status(404).json(formatError('Dokumen tidak ditemukan'));
            }

            return res.json(formatResponse('success', 'Dokumen berhasil dihapus'));
        } catch (error) {
            logger.error('Error deleting document:', error);
            return res.status(500).json(formatError('Gagal menghapus dokumen'));
        }
    }

    /**
     * Download document
     */
    async downloadDocument(req, res) {
        try {
            const { id } = req.params;
            
            const result = await repositoryService.getDocumentFile(id);
            
            if (!result) {
                return res.status(404).json(formatError('Dokumen tidak ditemukan'));
            }

            // Increment download count
            await repositoryService.incrementDownloadCount(id);

            // Send file
            return res.download(result.filePath, result.fileName);
        } catch (error) {
            logger.error('Error downloading document:', error);
            return res.status(500).json(formatError('Gagal mengunduh dokumen'));
        }
    }

    /**
     * Increment view count
     */
    async incrementView(req, res) {
        try {
            const { id } = req.params;
            
            await repositoryService.incrementViewCount(id);
            
            return res.json(formatResponse('success', 'View count berhasil ditambahkan'));
        } catch (error) {
            logger.error('Error incrementing view:', error);
            return res.status(500).json(formatError('Gagal menambah view count'));
        }
    }

    /**
     * Increment download count
     */
    async incrementDownload(req, res) {
        try {
            const { id } = req.params;
            
            await repositoryService.incrementDownloadCount(id);
            
            return res.json(formatResponse('success', 'Download count berhasil ditambahkan'));
        } catch (error) {
            logger.error('Error incrementing download:', error);
            return res.status(500).json(formatError('Gagal menambah download count'));
        }
    }

    /**
     * Get category counts
     */
    async getCategoryCounts(req, res) {
        try {
            const counts = await repositoryService.getCategoryCounts();
            return res.json(formatResponse('success', 'Data kategori berhasil diambil', counts));
        } catch (error) {
            logger.error('Error getting category counts:', error);
            return res.status(500).json(formatError('Gagal mengambil data kategori'));
        }
    }

    /**
     * Get storage information
     */
    async getStorageInfo(req, res) {
        try {
            const storageInfo = await repositoryService.getStorageInfo();
            return res.json(formatResponse('success', 'Data storage berhasil diambil', storageInfo));
        } catch (error) {
            logger.error('Error getting storage info:', error);
            return res.status(500).json(formatError('Gagal mengambil data storage'));
        }
    }
}

module.exports = new RepositoryController();