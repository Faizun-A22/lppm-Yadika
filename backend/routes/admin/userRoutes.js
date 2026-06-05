const express = require('express');
const router = express.Router();
const userController = require('../../controllers/admin/userController');
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');

// Protect all routes with authentication and admin role check
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

// Route definitions
router.get('/', userController.getUsers);
router.delete('/:id', userController.deleteUser);

module.exports = router;
