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
                    users:users (
                        id_user,
                        program_studi:program_studi (
                            id_prodi,
                            nama_prodi,
                            fakultas:fakultas (
                                id_fakultas,
                                nama_fakultas
                            )
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

            // Check if registration exists to get id_user
            const { data: existing, error: checkError } = await supabase
                .from('registrasi_magang')
                .select('id_registrasi, id_user, status, catatan')
                .eq('id_registrasi', id)
                .single();

            if (checkError) {
                if (checkError.code === 'PGRST116') {
                    return res.status(404).json(formatError('Registrasi tidak ditemukan'));
                }
                throw checkError;
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

<<<<<<< HEAD
            // Create notification automatically
            try {
                if (status === 'approved' || status === 'verified') {
                    let linkWa = '';

                    // Get active magang program
                    const { data: program } = await supabase
                        .from('programs')
                        .select('deskripsi')
                        .eq('jenis', 'magang')
                        .eq('status', 'aktif')
                        .limit(1)
                        .maybeSingle();
                    
                    if (program && program.deskripsi) {
                        const urlRegex = /(https?:\/\/chat\.whatsapp\.com\/[^\s]+|https?:\/\/wa\.me\/[^\s]+)/g;
                        const urls = program.deskripsi.match(urlRegex);
                        if (urls && urls.length > 0) {
                            linkWa = urls[0];
                        }
                    }

                    if (!linkWa) {
                        const groupLinks = require('../../config/groupLinks');
                        linkWa = groupLinks.magang.default;
                    }

                    await supabase
                        .from('notifikasi')
                        .insert([{
                            id_user: existing.id_user,
                            judul: 'Pendaftaran Magang Disetujui',
                            pesan: 'Selamat! Pendaftaran Magang Anda telah disetujui. Silakan klik tombol di bawah untuk bergabung dengan grup koordinasi WhatsApp.',
                            tipe: 'success',
                            link: linkWa,
                            dibaca: false,
                            created_at: new Date()
                        }]);
                } else if (status === 'rejected') {
                    const alasan = catatan || 'Silakan hubungi pihak LPPM untuk informasi lebih lanjut.';
                    await supabase
                        .from('notifikasi')
                        .insert([{
                            id_user: existing.id_user,
                            judul: 'Pendaftaran Magang Ditolak',
                            pesan: `Mohon maaf, pendaftaran Magang Anda ditolak. Catatan: ${alasan}`,
                            tipe: 'error',
                            link: null,
                            dibaca: false,
                            created_at: new Date()
                        }]);
                }
            } catch (notifErr) {
                console.error('Failed to generate Magang status update notification:', notifErr);
=======
            // Jika status disetujui (approved), buat notifikasi otomatis untuk mahasiswa
            if (status === 'approved') {
                try {
                    // Ambil detail registrasi untuk mendapatkan id_user dan nama_lengkap
                    const { data: registration, error: regError } = await supabase
                        .from('registrasi_magang')
                        .select('*')
                        .eq('id_registrasi', id)
                        .single();

                    if (!regError && registration) {
                        const linkGrup = process.env.MAGANG_WA_LINK || 'https://chat.whatsapp.com/GrupMagangYadika';

                        let pesanNotif = `Pendaftaran Magang Anda atas nama ${registration.nama_lengkap} telah disetujui oleh admin.`;
                        if (catatan) {
                            pesanNotif += ` Catatan: "${catatan}".`;
                        }
                        if (linkGrup) {
                            pesanNotif += ` Silakan bergabung ke grup koordinasi Magang melalui tautan WhatsApp berikut: ${linkGrup}`;
                        }

                        // Insert ke tabel notifikasi
                        const { error: notifError } = await supabase
                            .from('notifikasi')
                            .insert([
                                {
                                    id_user: registration.id_user,
                                    judul: 'Pendaftaran Magang Disetujui',
                                    pesan: pesanNotif,
                                    tipe: 'success',
                                    dibaca: false,
                                    created_at: new Date()
                                }
                            ]);
                        if (notifError) console.error('Error inserting notification Magang:', notifError);
                    } else {
                        console.error('Error fetching registration for notification Magang:', regError);
                    }
                } catch (notifErr) {
                    console.error('Gagal mengirim notifikasi otomatis Magang:', notifErr);
                }
>>>>>>> a9e4b1877b2882e437714e2e0fa888e2c21367e0
            }

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