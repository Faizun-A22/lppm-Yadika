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
                // Subquery: ambil id_registrasi yang sesuai dengan desa
                const { data: registrasiDesa } = await supabase
                    .from('registrasi_kkn')
                    .select('id_registrasi')
                    .eq('id_desa', desa);
                const registrasiIds = registrasiDesa?.map(r => r.id_registrasi) || [];
                if (registrasiIds.length > 0) {
                    query = query.in('id_registrasi', registrasiIds);
                } else {
                    // Tidak ada registrasi untuk desa ini
                    return res.status(200).json(
                        formatPaginatedResponse([], page, limit, 0, 'Data luaran berhasil diambil')
                    );
                }
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
            const { status, catatan } = req.body;

            if (!['approved', 'rejected'].includes(status)) {
                return res.status(400).json(formatError('Status verifikasi tidak valid'));
            }

            // Ambil detail registrasi_kkn untuk mendapatkan id_user
            const { data: luaranDetail, error: fetchError } = await supabase
                .from('luaran_kkn')
                .select('judul_kegiatan, registrasi_kkn(id_user)')
                .eq('id_luaran', id)
                .single();

            if (fetchError || !luaranDetail) {
                return res.status(404).json(formatError('Luaran KKN tidak ditemukan'));
            }

            const studentId = luaranDetail.registrasi_kkn?.id_user;
            const judulKegiatan = luaranDetail.judul_kegiatan;

            const updateData = {
                status,
                catatan_review: catatan !== undefined ? (catatan || null) : null,
                updated_at: new Date()
            };

            const { data, error } = await supabase
                .from('luaran_kkn')
                .update(updateData)
                .eq('id_luaran', id)
                .select()
                .single();

            if (error) throw error;

            // Buat notifikasi untuk mahasiswa
            try {
                if (studentId) {
                    await supabase
                        .from('notifikasi')
                        .insert([{
                            id_user: studentId,
                            judul: `Luaran KKN ${status === 'approved' ? 'Disetujui' : 'Ditolak'}`,
                            pesan: `Luaran KKN Anda dengan judul "${judulKegiatan}" telah ${status === 'approved' ? 'disetujui' : 'ditolak'}.${catatan ? ` Catatan: ${catatan}` : ''}`,
                            tipe: status === 'approved' ? 'success' : 'error',
                            dibaca: false,
                            created_at: new Date()
                        }]);
                    console.log('✅ Notification created for student:', studentId);
                }
            } catch (notifError) {
                console.error('Failed to create notification:', notifError);
            }

            return res.status(200).json(
                formatResponse('success', `Luaran berhasil ${status === 'approved' ? 'disetujui' : 'ditolak'}`, data)
            );
        } catch (error) {
            console.error('Error in verifikasiLuaran:', error);
            return res.status(500).json(formatError('Gagal memverifikasi luaran'));
        }
    },

    async deleteLuaran(req, res) {
        try {
            const { id } = req.params;

            // Hapus file MOU di server lokal jika ada
            const { data: existing } = await supabase
                .from('luaran_kkn')
                .select('file_mou')
                .eq('id_luaran', id)
                .single();

            if (existing && existing.file_mou) {
                const fs = require('fs');
                const path = require('path');
                const cleanPath = existing.file_mou.startsWith('/') ? existing.file_mou.substring(1) : existing.file_mou;
                const absolutePath = path.join(__dirname, '../..', cleanPath);
                fs.unlink(absolutePath, (err) => {
                    if (err) console.error('Gagal menghapus berkas MOU lokal:', err.message);
                });
            }

            const { error } = await supabase
                .from('luaran_kkn')
                .delete()
                .eq('id_luaran', id);

            if (error) throw error;

            return res.status(200).json(
                formatResponse('success', 'Luaran KKN berhasil dihapus')
            );
        } catch (error) {
            console.error('Error in deleteLuaran:', error);
            return res.status(500).json(formatError('Gagal menghapus luaran KKN'));
        }
    }
};

module.exports = luaranKknController;