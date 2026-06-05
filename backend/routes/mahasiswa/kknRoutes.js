const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../../middleware/auth');
const kknController = require('../../controllers/mahasiswa/kknController');
const { uploadKKNDocument, upload } = require('../../middleware/upload'); // IMPORT YANG BARU

// ================== DASHBOARD ==================
router.get('/dashboard', authenticateToken, kknController.getDashboard);
router.get('/status', authenticateToken, kknController.getStatus);
router.get('/timeline', authenticateToken, kknController.getTimeline);
router.get('/registrasi', authenticateToken, kknController.getRegistrasi);

// ================== DESA ==================
router.get('/desa', authenticateToken, kknController.getAvailableVillages);
router.get('/kabupaten-list', authenticateToken, kknController.getKabupatenList);
router.get('/program-studi', authenticateToken, kknController.getProgramStudi);

// ================== RIWAYAT ==================
router.get('/riwayat', authenticateToken, kknController.getRiwayat);

// ================== DAFTAR KKN ==================
// GUNakan uploadKKNDocument yang sudah dikonfigurasi khusus untuk KKN
router.post(
    '/daftar',
    authenticateToken,
    uploadKKNDocument,  // ← Gunakan ini
    kknController.daftarKKN
);

// ================== PROPOSAL ==================
router.post(
    '/proposal',
    authenticateToken,
    upload.single('file_proposal'),
    kknController.ajukanProposal
);

router.post(
    '/proposal/draft',
    authenticateToken,
    upload.single('file_proposal'),
    kknController.simpanDraftProposal
);

router.put(
    '/proposal/:id',
    authenticateToken,
    upload.single('file_proposal'),
    kknController.updateProposal
);

router.delete('/proposal/:id', authenticateToken, kknController.batalkanProposal);

// ================== LUARAN ==================
router.get('/luaran', authenticateToken, kknController.getLuaran);
router.get('/luaran/:id', authenticateToken, kknController.getLuaranDetail);

router.post(
    '/luaran/simpan',
    authenticateToken,
    upload.single('mou_file'),  // Gunakan upload.single untuk MOU
    kknController.simpanLuaran
);

router.put(
    '/luaran/:id',
    authenticateToken,
    upload.single('mou_file'),
    kknController.updateLuaran
);

router.delete('/luaran/:id', authenticateToken, kknController.hapusLuaran);

module.exports = router;