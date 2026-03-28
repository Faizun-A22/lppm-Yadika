const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const registrasiKknController = require('../../controllers/admin/registrasiKknController');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const { handleValidationErrors } = require('../../utils/validation');

router.use(authenticateToken);
router.use(authorizeRoles('admin'));

router.get('/', registrasiKknController.getAllRegistrasi);
router.get('/:id', registrasiKknController.getRegistrasiById);
router.put('/:id/status', registrasiKknController.updateStatus);
router.delete('/:id', registrasiKknController.deleteRegistrasi);

module.exports = router;