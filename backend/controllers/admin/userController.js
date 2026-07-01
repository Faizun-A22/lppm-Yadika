const supabase = require('../../config/database');
const { formatResponse, formatError } = require('../../utils/responseFormatter');
const authService = require('../../services/authService');

const userController = {
    /**
     * Get all users with optional filtering and search
     */
    async getUsers(req, res) {
        try {
            const { role, status, search } = req.query;

            let query = supabase
                .from('users')
                .select(`
                    id_user,
                    nama_lengkap,
                    email,
                    role,
                    nim,
                    nidn,
                    no_hp,
                    status,
                    created_at,
                    program_studi:program_studi!users_id_prodi_fkey(
                        id_prodi,
                        nama_prodi,
                        jenjang
                    )
                `);

            if (role) {
                query = query.eq('role', role);
            }

            if (status) {
                query = query.eq('status', status);
            }

            if (search) {
                query = query.or(`nama_lengkap.ilike.%${search}%,email.ilike.%${search}%,nim.ilike.%${search}%,nidn.ilike.%${search}%`);
            }

            // Order by newest users first
            query = query.order('created_at', { ascending: false });

            const { data: users, error } = await query;

            if (error) {
                console.error('Database query error in getUsers:', error);
                throw error;
            }

            return res.status(200).json(
                formatResponse('success', 'Data user berhasil diambil', users)
            );
        } catch (error) {
            console.error('Error in getUsers:', error);
            return res.status(500).json(formatError('Gagal mengambil data user: ' + error.message));
        }
    },

    /**
     * Create user (Lecturer / Dosen) by Admin
     */
    async createUser(req, res) {
        try {
            const result = await authService.register(req.body);
            return res.status(201).json(
                formatResponse('success', result.message || 'User berhasil didaftarkan', result.data)
            );
        } catch (error) {
            console.error('Error in createUser:', error);
            return res.status(400).json(formatError('Gagal mendaftarkan user: ' + error.message));
        }
    },

    /**
     * Delete user or disable if references exist
     */
    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            const currentAdminId = req.user?.id_user;

            // Prevent self-deletion
            if (parseInt(id) === currentAdminId) {
                return res.status(400).json(formatError('Anda tidak dapat menghapus akun Anda sendiri'));
            }

            // Check if user exists
            const { data: user, error: fetchError } = await supabase
                .from('users')
                .select('id_user, nama_lengkap, role')
                .eq('id_user', id)
                .single();

            if (fetchError || !user) {
                return res.status(404).json(formatError('User tidak ditemukan'));
            }

            // Try hard deleting from users table
            const { error: deleteError } = await supabase
                .from('users')
                .delete()
                .eq('id_user', id);

            if (deleteError) {
                console.warn(`Hard delete failed for user id ${id} (likely due to FK constraints). Falling back to deactivation/soft delete. Error:`, deleteError.message);

                // Fallback to changing status to 'tidak aktif'
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ status: 'tidak aktif' })
                    .eq('id_user', id);

                if (updateError) {
                    console.error('Failed to deactivate user:', updateError);
                    throw new Error('Gagal menonaktifkan akun user: ' + updateError.message);
                }

                return res.status(200).json(
                    formatResponse('success', 'User memiliki data terkait di sistem (kegiatan, magang, penelitian, dll). Akun berhasil dinonaktifkan (status diubah menjadi Tidak Aktif) demi menjaga integritas data historis.')
                );
            }

            return res.status(200).json(
                formatResponse('success', 'User berhasil dihapus secara permanen dari sistem.')
            );
        } catch (error) {
            console.error('Error in deleteUser:', error);
            return res.status(500).json(formatError('Gagal memproses penghapusan user: ' + error.message));
        }
    }
};

module.exports = userController;
