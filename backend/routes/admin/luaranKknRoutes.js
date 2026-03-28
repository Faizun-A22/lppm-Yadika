const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const luaranKknController = require('../../controllers/admin/luaranKknController');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { handleValidationErrors } = require('../../utils/validation');

router.use(authenticateToken);
router.use(authorizeRoles('admin'));

router.get('/', luaranKknController.getAllLuaran);
router.put('/:id/verifikasi', luaranKknController.verifikasiLuaran);

module.exports = router;