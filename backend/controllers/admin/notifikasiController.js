const supabase = require('../../config/database');
const { formatResponse } = require('../../utils/responseFormatter');

const getNotifications = async (req, res, next) => {
    try {
        const userId = req.user.id_user;
        
        const { data, error } = await supabase
            .from('notifikasi')
            .select('*')
            .eq('id_user', userId)
            .order('created_at', { ascending: false })
            .limit(50);
        
        if (error) throw error;
        
        res.json(formatResponse('success', 'Notifikasi berhasil diambil', data || []));
    } catch (error) {
        next(error);
    }
};

const markAllAsRead = async (req, res, next) => {
    try {
        const userId = req.user.id_user;
        
        const { error } = await supabase
            .from('notifikasi')
            .update({ dibaca: true })
            .eq('id_user', userId)
            .eq('dibaca', false);
        
        if (error) throw error;
        
        res.json(formatResponse('success', 'Semua notifikasi telah dibaca'));
    } catch (error) {
        next(error);
    }
};

const markAsRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_user;
        
        const { error } = await supabase
            .from('notifikasi')
            .update({ dibaca: true })
            .eq('id_notifikasi', id)
            .eq('id_user', userId);
        
        if (error) throw error;
        
        res.json(formatResponse('success', 'Notifikasi telah dibaca'));
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getNotifications,
    markAllAsRead,
    markAsRead
};