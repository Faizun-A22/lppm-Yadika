const express = require('express');
const router = express.Router();

const multer = require('multer');
const path = require('path');

const { authenticateToken } = require('../../middleware/auth');
const kknController = require('../../controllers/mahasiswa/kknController');

// ================== MULTER CONFIG ==================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

// ================== MIDDLEWARE ==================
router.use(authenticateToken);

// ================== DASHBOARD ==================
router.get('/dashboard', kknController.getDashboard);
router.get('/status', kknController.getStatus);
router.get('/timeline', kknController.getTimeline);

// ================== DESA ==================
router.get('/desa', kknController.getAvailableVillages);

// ================== RIWAYAT ==================
router.get('/riwayat', kknController.getRiwayat);

// ================== PROPOSAL ==================
router.get('/proposal/status', kknController.getProposalStatus);
router.get('/proposal/:id', kknController.getProposalDetail);
router.get('/proposal/:id/review', kknController.getReviewHistory);

// ================== DAFTAR KKN ==================
router.post(
    '/daftar',
    upload.fields([
        { name: 'krs_file', maxCount: 1 },
        { name: 'khs_file', maxCount: 1 },
        { name: 'payment_file', maxCount: 1 }
    ]),
    kknController.daftarKKN
);

// ================== PROPOSAL ==================
router.post(
    '/proposal',
    upload.single('file_proposal'),
    kknController.ajukanProposal
);

router.post(
    '/proposal/draft',
    upload.single('file_proposal'),
    kknController.simpanDraftProposal
);

router.put(
    '/proposal/:id',
    upload.single('file_proposal'),
    kknController.updateProposal
);

router.delete('/proposal/:id', kknController.batalkanProposal);

// ================== LUARAN ==================
router.get('/luaran', kknController.getLuaran);
router.get('/luaran/:id', kknController.getLuaranDetail);

router.post(
    '/luaran',
    upload.single('mou_file'),
    kknController.simpanLuaran
);

router.put(
    '/luaran/:id',
    upload.single('mou_file'),
    kknController.updateLuaran
);

router.delete('/luaran/:id', kknController.hapusLuaran);

// ================== EXPORT ==================
module.exports = router;