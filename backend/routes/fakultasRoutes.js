const express = require('express');
const router = express.Router();
const fakultasController = require('../controllers/fakultasController');

// Route untuk mendapatkan semua fakultas
router.get('/fakultas', fakultasController.getAllFakultas);

// Route untuk mendapatkan prodi berdasarkan fakultas
router.get('/prodi/by-fakultas/:id_fakultas', fakultasController.getProdiByFakultas);

// Route untuk mendapatkan semua prodi
router.get('/prodi', fakultasController.getAllProdi);

// Route untuk mendapatkan semua jabatan fungsional (untuk profil dosen)
router.get('/jabatan-fungsional', fakultasController.getAllJabatanFungsional);

module.exports = router;