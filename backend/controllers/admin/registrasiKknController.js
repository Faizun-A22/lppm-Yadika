const supabase = require('../../config/database');
const { formatResponse, formatError, formatPaginatedResponse } = require('../../utils/responseFormatter');

const registrasiKknController = {
    async getAllRegistrasi(req, res) {
        try {
            const { page = 1, limit = 10, search = '', status = '', id_desa = '' } = req.query;
            
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
                        nama_desa
                    )
                `, { count: 'exact' });

            if (search) {
                query = query.or(`nim.ilike.%${search}%,nama_lengkap.ilike.%${search}%`);
            }

            if (status) {
                query = query.eq('status', status);
            }

            if (id_desa) {
                query = query.eq('id_desa', id_desa);
            }

            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await query
                .order('tanggal_daftar', { ascending: false })
                .range(from, to);

            if (error) throw error;

            return res.status(200).json(
                formatPaginatedResponse(
                    data || [],
                    page,
                    limit,
                    count || 0,
                    'Data registrasi KKN berhasil diambil'
                )
            );
        } catch (error) {
            console.error('Error in getAllRegistrasi:', error);
            return res.status(500).json(formatError('Gagal mengambil data registrasi KKN'));
        }
    },

    async getRegistrasiById(req, res) {
        try {
            const { id } = req.params;
            
            const { data, error } = await supabase
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
                    )
                `)
                .eq('id_registrasi', id)
                .single();

            if (error) throw error;

            if (!data) {
                return res.status(404).json(formatError('Registrasi tidak ditemukan'));
            }

            return res.status(200).json(
                formatResponse('success', 'Data registrasi berhasil diambil', data)
            );
        } catch (error) {
            console.error('Error in getRegistrasiById:', error);
            return res.status(500).json(formatError('Gagal mengambil data registrasi'));
        }
    },

    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, catatan } = req.body;

            const validStatus = ['pending', 'approved', 'rejected', 'verified'];
            if (!validStatus.includes(status)) {
                return res.status(400).json(formatError('Status tidak valid'));
            }

            const updateData = {
                status,
                catatan: catatan || null,
                updated_at: new Date()
            };

            const { data, error } = await supabase
                .from('registrasi_kkn')
                .update(updateData)
                .eq('id_registrasi', id)
                .select()
                .single();

            if (error) throw error;

            return res.status(200).json(
                formatResponse('success', `Status berhasil diubah menjadi ${status}`, data)
            );
        } catch (error) {
            console.error('Error in updateStatus:', error);
            return res.status(500).json(formatError('Gagal mengupdate status'));
        }
    },

    async deleteRegistrasi(req, res) {
        try {
            const { id } = req.params;
            
            const { error } = await supabase
                .from('registrasi_kkn')
                .delete()
                .eq('id_registrasi', id);

            if (error) throw error;

            return res.status(200).json(
                formatResponse('success', 'Registrasi berhasil dihapus')
            );
        } catch (error) {
            console.error('Error in deleteRegistrasi:', error);
            return res.status(500).json(formatError('Gagal menghapus registrasi'));
        }
    }
};

module.exports = registrasiKknController;