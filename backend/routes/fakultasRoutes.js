// routes/fakultasRoutes.js
const express = require('express');
const router = express.Router();
const fakultasController = require('../controllers/fakultasController');

// Perbaiki path sesuai dengan yang dipanggil frontend
router.get('/fakultas', fakultasController.getAllFakultas);  // /api/fakultas
router.get('/prodi/by-fakultas/:id_fakultas', fakultasController.getProdiByFakultas);  // /api/prodi/by-fakultas/:id
router.get('/prodi', fakultasController.getAllProdi);  // /api/prodi

module.exports = router;