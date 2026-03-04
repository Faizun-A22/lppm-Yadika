const express = require('express');
const router = express.Router();
const magangController = require('../../controllers/mahasiswa/magangController');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { upload } = require('../../middleware/upload');
const {
    pendaftaranMagangValidation,
    perusahaanMagangValidation,
    luaranMagangValidation,
    handleValidationErrors
} = require('../../utils/validation');

// All routes require authentication and mahasiswa role
router.use(authenticateToken);
router.use(authorizeRoles('mahasiswa'));

// Get magang status and data
router.get('/status', magangController.getMagangStatus);
router.get('/timeline', magangController.getTimeline);
router.get('/riwayat', magangController.getRiwayat);

// Pendaftaran routes
router.post('/pendaftaran',
    upload.fields([
        { name: 'krs', maxCount: 1 },
        { name: 'khs', maxCount: 1 },
        { name: 'bukti_pembayaran', maxCount: 1 }
    ]),
    pendaftaranMagangValidation,
    handleValidationErrors,
    magangController.createPendaftaran
);

router.get('/pendaftaran', magangController.getPendaftaran);
router.put('/pendaftaran/:id',
    upload.fields([
        { name: 'krs', maxCount: 1 },
        { name: 'khs', maxCount: 1 },
        { name: 'bukti_pembayaran', maxCount: 1 }
    ]),
    magangController.updatePendaftaran
);

// Perusahaan routes
router.post('/perusahaan',
    upload.fields([
        { name: 'surat_keterangan', maxCount: 1 },
        { name: 'struktur_organisasi', maxCount: 1 }
    ]),
    perusahaanMagangValidation,
    handleValidationErrors,
    magangController.createPerusahaan
);

router.get('/perusahaan', magangController.getPerusahaan);
router.get('/perusahaan/:id', magangController.getPerusahaanById);
router.put('/perusahaan/:id',
    upload.fields([
        { name: 'surat_keterangan', maxCount: 1 },
        { name: 'struktur_organisasi', maxCount: 1 }
    ]),
    magangController.updatePerusahaan
);
router.delete('/perusahaan/:id', magangController.deletePerusahaan);

// Luaran routes
router.post('/luaran',
    upload.fields([
        { name: 'mou', maxCount: 1 },
        { name: 'sertifikat', maxCount: 1 },
        { name: 'logbook', maxCount: 1 }
    ]),
    luaranMagangValidation,
    handleValidationErrors,
    magangController.createLuaran
);

router.get('/luaran', magangController.getLuaran);
router.get('/luaran/:id', magangController.getLuaranById);
router.put('/luaran/:id',
    upload.fields([
        { name: 'mou', maxCount: 1 },
        { name: 'sertifikat', maxCount: 1 },
        { name: 'logbook', maxCount: 1 }
    ]),
    magangController.updateLuaran
);

module.exports = router;