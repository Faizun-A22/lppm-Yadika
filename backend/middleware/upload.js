const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create upload directories if they don't exist
const createUploadDirs = () => {
    const dirs = [
        'uploads/magang/krs',
        'uploads/magang/khs',
        'uploads/magang/pembayaran',
        'uploads/magang/surat_keterangan',
        'uploads/magang/struktur_organisasi',
        'uploads/magang/mou',
        'uploads/magang/sertifikat',
        'uploads/magang/logbook'
    ];

    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

createUploadDirs();

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = 'uploads/magang/';
        
        // Determine folder based on fieldname
        switch (file.fieldname) {
            case 'krs':
                uploadPath += 'krs';
                break;
            case 'khs':
                uploadPath += 'khs';
                break;
            case 'bukti_pembayaran':
                uploadPath += 'pembayaran';
                break;
            case 'surat_keterangan':
                uploadPath += 'surat_keterangan';
                break;
            case 'struktur_organisasi':
                uploadPath += 'struktur_organisasi';
                break;
            case 'mou':
                uploadPath += 'mou';
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
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only .pdf, .jpg, .jpeg, .png files are allowed'));
    }
};

// Create multer upload instance
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: fileFilter
});

// Error handler for multer
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File too large. Maximum size is 5MB'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }
    next(err);
};

module.exports = {
    upload,
    handleUploadError
};