const supabase = require('../../config/database');

const registrasiKknService = {
    /**
     * Get all registrations with filters
     */
    async getAllRegistrasi({ page = 1, limit = 10, search = '', status = '', id_desa = '' }) {
        try {
            let query = supabase
                .from('registrasi_kkn')
                .select(`
                    *,
                    program_studi:program_studi (
                        id_prodi,
                        nama_prodi
                    ),
                    desa_kkn:desa_kkn (
                        id_desa,
                        nama_desa,
                        kabupaten,
                        kecamatan
                    ),
                    user:users (
                        id_user,
                        email,
                        no_hp
                    )
                `, { count: 'exact' });

            // Apply filters
            if (search) {
                query = query.or(`nim.ilike.%${search}%,nama_lengkap.ilike.%${search}%`);
            }

            if (status) {
                query = query.eq('status', status);
            }

            if (id_desa) {
                query = query.eq('id_desa', id_desa);
            }

            // Pagination
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await query
                .order('tanggal_daftar', { ascending: false })
                .range(from, to);

            if (error) throw error;

            return {
                data: data || [],
                total: count || 0
            };
        } catch (error) {
            console.error('Error in getAllRegistrasi:', error);
            throw error;
        }
    },

    /**
     * Get registration by ID
     */
    async getRegistrasiById(id) {
        try {
            const { data, error } = await supabase
                .from('registrasi_kkn')
                .select(`
                    *,
                    program_studi:program_studi (
                        id_prodi,
                        nama_prodi,
                        jenjang
                    ),
                    desa_kkn:desa_kkn (
                        id_desa,
                        nama_desa,
                        kecamatan,
                        kabupaten,
                        provinsi,
                        nama_pembimbing_lapangan,
                        kontak_pembimbing_lapangan,
                        dosen_pembimbing:users!desa_kkn_id_dosen_pembimbing_fkey (
                            id_user,
                            nama_lengkap,
                            nidn
                        )
                    ),
                    user:users (
                        id_user,
                        email,
                        no_hp,
                        foto_profil
                    )
                `)
                .eq('id_registrasi', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in getRegistrasiById:', error);
            throw error;
        }
    },

    /**
     * Update registration status
     */
    async updateStatus(id, status, catatan, verified_by) {
        try {
            const updateData = {
                status,
                catatan: catatan || null,
                updated_at: new Date()
            };

            // If verified, add verification timestamp
            if (status === 'verified') {
                updateData.tanggal_verifikasi = new Date();
                updateData.diverifikasi_oleh = verified_by;
            }

            const { data, error } = await supabase
                .from('registrasi_kkn')
                .update(updateData)
                .eq('id_registrasi', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in updateStatus:', error);
            throw error;
        }
    },

    /**
     * Delete registration
     */
    async deleteRegistrasi(id) {
        try {
            const { error } = await supabase
                .from('registrasi_kkn')
                .delete()
                .eq('id_registrasi', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error in deleteRegistrasi:', error);
            throw error;
        }
    },

    /**
     * Get registrations by desa
     */
    async getByDesa(id_desa, { page = 1, limit = 10, status = '' }) {
        try {
            let query = supabase
                .from('registrasi_kkn')
                .select(`
                    *,
                    program_studi:program_studi (
                        id_prodi,
                        nama_prodi
                    )
                `, { count: 'exact' })
                .eq('id_desa', id_desa);

            if (status) {
                query = query.eq('status', status);
            }

            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await query
                .order('tanggal_daftar', { ascending: false })
                .range(from, to);

            if (error) throw error;

            return {
                data: data || [],
                total: count || 0
            };
        } catch (error) {
            console.error('Error in getByDesa:', error);
            throw error;
        }
    },

    /**
     * Get statistics by status
     */
    async getStatsByDesa(id_desa) {
        try {
            const { data, error } = await supabase
                .from('registrasi_kkn')
                .select('status, count')
                .eq('id_desa', id_desa)
                .group('status');

            if (error) throw error;

            const stats = {
                pending: 0,
                approved: 0,
                rejected: 0,
                verified: 0,
                total: 0
            };

            data.forEach(item => {
                stats[item.status] = parseInt(item.count);
                stats.total += parseInt(item.count);
            });

            return stats;
        } catch (error) {
            console.error('Error in getStatsByDesa:', error);
            throw error;
        }
    }
};

module.exports = registrasiKknService;