const supabase = require('../../config/database');
const { formatResponse, formatError, formatPaginatedResponse } = require('../../utils/responseFormatter');

const luaranKknController = {
    async getAllLuaran(req, res) {
        try {
            const { page = 1, limit = 10, desa = '', status = '', search = '' } = req.query;
            
            let query = supabase
                .from('luaran_kkn')
                .select(`
                    *,
                    registrasi_kkn (
                        nim,
                        nama_lengkap,
                        id_desa,
                        desa_kkn (
                            nama_desa
                        )
                    )
                `, { count: 'exact' });

            if (desa) {
                query = query.eq('registrasi_kkn.id_desa', desa);
            }

            if (status) {
                query = query.eq('status', status);
            }

            if (search) {
                query = query.or(`registrasi_kkn.nim.ilike.%${search}%,judul_kegiatan.ilike.%${search}%`);
            }

            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await query
                .order('tanggal_submit', { ascending: false })
                .range(from, to);

            if (error) throw error;

            // Format data
            const formattedData = data.map(item => ({
                id_luaran: item.id_luaran,
                nim: item.registrasi_kkn?.nim,
                nama_lengkap: item.registrasi_kkn?.nama_lengkap,
                desa_name: item.registrasi_kkn?.desa_kkn?.nama_desa,
                judul_kegiatan: item.judul_kegiatan,
                link_video: item.link_video,
                file_poster: item.file_poster,
                file_mou: item.file_mou,
                status: item.status,
                catatan_review: item.catatan_review,
                tanggal_submit: item.tanggal_submit
            }));

            return res.status(200).json(
                formatPaginatedResponse(
                    formattedData || [],
                    page,
                    limit,
                    count || 0,
                    'Data luaran berhasil diambil'
                )
            );
        } catch (error) {
            console.error('Error in getAllLuaran:', error);
            return res.status(500).json(formatError('Gagal mengambil data luaran'));
        }
    },

    async verifikasiLuaran(req, res) {
        try {
            const { id } = req.params;
            const { status, notes } = req.body;

            if (!['approved', 'rejected'].includes(status)) {
                return res.status(400).json(formatError('Status verifikasi tidak valid'));
            }

            const updateData = {
                status,
                catatan_review: notes || null,
                updated_at: new Date()
            };

            const { data, error } = await supabase
                .from('luaran_kkn')
                .update(updateData)
                .eq('id_luaran', id)
                .select()
                .single();

            if (error) throw error;

            return res.status(200).json(
                formatResponse('success', `Luaran berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}`, data)
            );
        } catch (error) {
            console.error('Error in verifikasiLuaran:', error);
            return res.status(500).json(formatError('Gagal memverifikasi luaran'));
        }
    }
};

module.exports = luaranKknController;