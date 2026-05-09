const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directories if they don't exist
const createUploadDirs = () => {
    const dirs = [
        // Magang folders
        'uploads/magang/krs',
        'uploads/magang/khs',
        'uploads/magang/pembayaran',
        'uploads/magang/surat_keterangan',
        'uploads/magang/struktur_organisasi',
        'uploads/magang/mou',
        'uploads/magang/sertifikat',
        'uploads/magang/logbook',
        'uploads/magang/others',
        
        // KKN folders - DIPERBAIKI
        'uploads/kkn/krs',
        'uploads/kkn/khs',
        'uploads/kkn/pembayaran',
        'uploads/kkn/proposal',
        'uploads/kkn/mou',
        'uploads/kkn/laporan',
        'uploads/kkn/poster',
        'uploads/kkn/video',
        'uploads/kkn/foto',
        'uploads/kkn/uploads',  // folder default untuk upload KKN
        'uploads/kkn/others',
        'uploads/kkn/luaran',   // folder untuk luaran KKN
        
        // Berita & Kegiatan folders
        'uploads/berita',
        'uploads/kegiatan',
        
        // Repository folders
        'uploads/repository/documents',
        'uploads/repository/jurnal',
        'uploads/repository/penelitian',
        'uploads/repository/pengabdian',
        'uploads/repository/buku',
        'uploads/repository/haki',
        'uploads/repository/prosiding',
        'uploads/repository/laporan',
        
        // Temporary folder
        'uploads/temp'
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Created directory: ${dir}`);
        }
    });
};

// Create directories on startup
createUploadDirs();

// Configure storage - PERBAIKI LOGIC UNTUK KKN
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'uploads/';
        
        // Cek apakah ini request KKN
        const isKKN = req.baseUrl?.includes('kkn') || 
                      req.originalUrl?.includes('/api/mahasiswa/kkn') ||
                      req.originalUrl?.includes('/api/admin/luaran-kkn') ||
                      req.originalUrl?.includes('/api/admin/registrasi-kkn');
        
        // Cek apakah ini request Magang
        const isMagang = req.baseUrl?.includes('magang') || 
                         req.originalUrl?.includes('/api/magang') ||
                         req.originalUrl?.includes('/api/admin/magang');
        
        if (isKKN) {
            uploadPath = 'uploads/kkn/';
            switch (file.fieldname) {
                case 'krs_file':
                    uploadPath += 'krs';
                    break;
                case 'khs_file':
                    uploadPath += 'khs';
                    break;
                case 'payment_file':
                case 'paymentFile':
                    uploadPath += 'pembayaran';
                    break;
                case 'proposal_file':
                case 'file_proposal':
                    uploadPath += 'proposal';
                    break;
                case 'mou_file':
                    uploadPath += 'mou';
                    break;
                case 'laporan_file':
                    uploadPath += 'laporan';
                    break;
                case 'poster_file':
                case 'file_poster':
                    uploadPath += 'poster';
                    break;
                case 'video_file':
                    uploadPath += 'video';
                    break;
                case 'foto_file':
                    uploadPath += 'foto';
                    break;
                case 'luaran_file':
                    uploadPath += 'luaran';
                    break;
                default:
                    uploadPath += 'uploads';
            }
        }
        else if (isMagang) {
            uploadPath += 'magang/';
            switch (file.fieldname) {
                case 'krs_file':
                    uploadPath += 'krs';
                    break;
                case 'khs_file':
                    uploadPath += 'khs';
                    break;
                case 'payment_file':
                    uploadPath += 'pembayaran';
                    break;
                case 'mou_file':
                    uploadPath += 'mou';
                    break;
                case 'surat_keterangan':
                    uploadPath += 'surat_keterangan';
                    break;
                case 'struktur_organisasi':
                    uploadPath += 'struktur_organisasi';
                    break;
                case 'sertifikat':
                    uploadPath += 'sertifikat';
                    break;
                case 'logbook':
                    uploadPath += 'logbook';
                    break;
                default:
                    uploadPath += 'others';
            }
        }
        else if (req.baseUrl?.includes('berita')) {
            uploadPath += 'berita';
        }
        else if (req.baseUrl?.includes('kegiatan')) {
            uploadPath += 'kegiatan';
        }
        else if (req.baseUrl?.includes('repository')) {
            uploadPath += 'repository/';
            const kategori = req.body?.kategori || req.query?.kategori || 'documents';
            
            const categoryFolders = {
                'jurnal': 'jurnal',
                'penelitian': 'penelitian',
                'pengabdian': 'pengabdian',
                'buku': 'buku',
                'haki': 'haki',
                'prosiding': 'prosiding',
                'laporan': 'laporan'
            };
            
            uploadPath += categoryFolders[kategori] || 'documents';
        }
        else {
            uploadPath += 'others';
        }
        
        // Pastikan folder tujuan sudah ada
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        console.log(`📁 Uploading file to: ${uploadPath}`); // Debug log
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        
        // Sanitize original filename
        const sanitizedName = file.originalname
            .replace(/\.[^/.]+$/, '') // Remove extension
            .replace(/[^a-zA-Z0-9]/g, '-') // Replace special chars with hyphen
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .toLowerCase()
            .substring(0, 50); // Limit length
        
        const finalName = `${sanitizedName}-${uniqueSuffix}${ext}`;
        console.log(`📄 Generated filename: ${finalName}`); // Debug log
        cb(null, finalName);
    }
});

// File filter - expanded allowed types
const fileFilter = (req, file, cb) => {
    // Allowed file types
    const allowedMimeTypes = [
        // Images
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Text
        'text/plain',
        // Archives
        'application/zip',
        'application/x-rar-compressed'
    ];
    
    const allowedExts = [
        '.jpg', '.jpeg', '.png', '.gif', '.webp',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.txt', '.zip', '.rar', '.mp4', '.mov', '.avi'  // Added video formats
    ];
    
    const extname = allowedExts.includes(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.includes(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Tipe file tidak diizinkan. Hanya file berikut yang diperbolehkan: ' + allowedExts.join(', ')));
    }
};

// Create multer upload instance with different configurations
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: fileFilter
});

// Upload for KKN with multiple files - KHUSUS UNTUK KKN
const uploadKKN = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit per file
    },
    fileFilter: fileFilter
});

// Upload untuk KKN dengan field names yang spesifik
const uploadKKNDocument = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: fileFilter
}).fields([
    { name: 'krs_file', maxCount: 1 },
    { name: 'khs_file', maxCount: 1 },
    { name: 'payment_file', maxCount: 1 },
    { name: 'paymentFile', maxCount: 1 },
    { name: 'mou_file', maxCount: 1 },
    { name: 'proposal_file', maxCount: 1 },
    { name: 'file_proposal', maxCount: 1 },
    { name: 'luaran_file', maxCount: 1 }
]);

// Special upload for repository (allows larger files)
const uploadRepository = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit for repository
    },
    fileFilter: fileFilter
});

// Error handler for multer
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File terlalu besar. Maksimum ukuran file adalah ' + 
                    (err.field === 'repository' ? '50MB' : '10MB')
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: 'Terlalu banyak file yang diupload'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    
    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message || 'Terjadi kesalahan saat upload file'
        });
    }
    
    next(err);
};

// Helper function to delete file
const deleteFile = async (filePath) => {
    try {
        if (filePath && fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
            console.log(`🗑️ Deleted file: ${filePath}`);
            return true;
        }
    } catch (error) {
        console.error('Error deleting file:', error);
    }
    return false;
};

// Helper function to get file info
const getFileInfo = (file) => {
    return {
        filename: file.filename,
        originalname: file.originalname,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        extension: path.extname(file.originalname).toLowerCase()
    };
};

// Helper function to get URL path for file
const getFileUrl = (filePath, req) => {
    if (!filePath) return null;
    const relativePath = filePath.replace(/\\/g, '/');
    return `/uploads/${relativePath.split('uploads/')[1] || relativePath}`;
};

module.exports = {
    upload,
    uploadKKN,
    uploadKKNDocument,
    uploadRepository,
    handleUploadError,
    deleteFile,
    getFileInfo,
    getFileUrl,
    createUploadDirs
};