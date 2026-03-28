const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const registrasiMagangController = require('../../controllers/admin/registrasiMagangController');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { handleValidationErrors } = require('../../utils/validation');

router.use(authenticateToken);
router.use(authorizeRoles('admin'));

router.get('/', registrasiMagangController.getAllRegistrasi);
router.get('/:id', registrasiMagangController.getRegistrasiById);
router.put('/:id/status', registrasiMagangController.updateStatus);
router.delete('/:id', registrasiMagangController.deleteRegistrasi);

module.exports = router;