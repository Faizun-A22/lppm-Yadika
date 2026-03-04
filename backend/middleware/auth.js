// middleware/auth.js

const jwt = require('jsonwebtoken');
const supabase = require('../config/database');

const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // PERBAIKAN: Gunakan decoded.id, bukan decoded.userId
        // Karena di JWT sign kita menggunakan field 'id'
        const { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('id_user', decoded.id)  // ← Perbaikan penting!
            .single();

        if (error || !user) {
            return res.status(403).json({
                success: false,
                message: 'User not found or invalid token'
            });
        }

        if (user.status !== 'aktif') {
            return res.status(403).json({
                success: false,
                message: 'Account is not active'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                success: false,
                message: 'Invalid token'
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({
                success: false,
                message: 'Token expired'
            });
        }
        next(error);
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access forbidden: insufficient permissions'
            });
        }

        next();
    };
};

module.exports = {
    authenticateToken,
    authorizeRoles
};