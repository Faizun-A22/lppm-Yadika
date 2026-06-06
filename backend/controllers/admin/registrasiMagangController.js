const supabase = require('../../config/database');
const { formatResponse, formatError, formatPaginatedResponse } = require('../../utils/responseFormatter');
const { deleteFile } = require('../../middleware/upload');

const registrasiMagangController = {
    async getAllRegistrasi(req, res) {
        try {
            const { page = 1, limit = 10, search = '', status = '', export: exportFlag } = req.query;

            let query = supabase
                .from('registrasi_magang')
                .select(`
                    *,
                    program_studi:program_studi (
                        id_prodi,
                        nama_prodi,
                        fakultas:fakultas (
                            id_fakultas,
                            nama_fakultas
                        )
                    ),
                    magang_perusahaan:magang_perusahaan (
                        nama_perusahaan,
                        bidang_magang,
                        posisi,
                        alamat_perusahaan
                    )
                `, { count: 'exact' });

            if (search) {
                query = query.or(`nim.ilike.%${search}%,nama_lengkap.ilike.%${search}%`);
            }

            if (status) {
                query = query.eq('status', status);
            }

            let data, error, count;

            if (exportFlag === 'true') {
                const result = await query.order('created_at', { ascending: false });
                data = result.data;
                error = result.error;
                count = result.count;
            } else {
                const pageNum = parseInt(page);
                const limitNum = parseInt(limit);
                const from = (pageNum - 1) * limitNum;
                const to = from + limitNum - 1;

                const result = await query
                    .order('created_at', { ascending: false })
                    .range(from, to);
                data = result.data;
                error = result.error;
                count = result.count;
            }

            if (error) throw error;

            if (exportFlag === 'true') {
                return res.status(200).json(
                    formatResponse('success', 'Data registrasi Magang untuk export berhasil diambil', data || [])
                );
            }

            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            return res.status(200).json(
                formatPaginatedResponse(
                    data || [],
                    pageNum,
                    limitNum,
                    count || 0,
                    'Data registrasi Magang berhasil diambil'
                )
            );
        } catch (error) {
            console.error('Error in getAllRegistrasi:', error);
            return res.status(500).json(formatError('Gagal mengambil data registrasi Magang'));
        }
    },

    async getRegistrasiById(req, res) {
        try {
            const { id } = req.params;
            
            const { data, error } = await supabase
                .from('registrasi_magang')
                .select(`
                    *,
                    program_studi:program_studi (
                        id_prodi,
                        nama_prodi
                    ),
                    users:users (
                        id_user,
                        email,
                        no_hp,
                        foto_profil
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
                .from('registrasi_magang')
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
            
            if (!id) {
                return res.status(400).json(formatError('ID registrasi tidak ditemukan'));
            }

            // Get existing registration data to delete files
            const { data: existing, error: checkError } = await supabase
                .from('registrasi_magang')
                .select('id_registrasi, krs_file, khs_file, payment_file')
                .eq('id_registrasi', id)
                .single();

            if (checkError) {
                if (checkError.code === 'PGRST116') {
                    return res.status(404).json(formatError('Registrasi tidak ditemukan'));
                }
                throw checkError;
            }

            // Hapus berkas fisik dari server jika ada
            if (existing.krs_file) await deleteFile(existing.krs_file).catch(err => console.error('Failed to delete krs_file:', err));
            if (existing.khs_file) await deleteFile(existing.khs_file).catch(err => console.error('Failed to delete khs_file:', err));
            if (existing.payment_file) await deleteFile(existing.payment_file).catch(err => console.error('Failed to delete payment_file:', err));

            const { error } = await supabase
                .from('registrasi_magang')
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

module.exports = registrasiMagangController;