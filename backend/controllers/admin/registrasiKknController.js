const supabase = require('../../config/database');
const { formatResponse, formatError, formatPaginatedResponse } = require('../../utils/responseFormatter');
const { deleteFile } = require('../../middleware/upload');

const registrasiKknController = {
    /**
     * Get all KKN registrations with pagination and filters
     * GET /api/admin/registrasi-kkn
     */
    async getAllRegistrasi(req, res) {
        try {
            const { page = 1, limit = 10, search = '', status = '', id_desa = '', export: exportFlag } = req.query;
            
            // Build query
            let query = supabase
                .from('registrasi_kkn')
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
                    desa_kkn:desa_kkn (
                        id_desa,
                        nama_desa,
                        kabupaten,
                        kecamatan
                    )
                `, { count: 'exact' });

            // Apply filters
            if (search && search.trim() !== '') {
                query = query.or(`nim.ilike.%${search}%,nama_lengkap.ilike.%${search}%`);
            }

            if (status && status.trim() !== '') {
                query = query.eq('status', status);
            }

            if (id_desa && id_desa.trim() !== '') {
                query = query.eq('id_desa', id_desa);
            }

            // Execute query
            let data, error, count;
            
            if (exportFlag === 'true') {
                const result = await query.order('tanggal_daftar', { ascending: false });
                data = result.data;
                error = result.error;
                count = result.count;
            } else {
                // Parse pagination parameters
                const pageNum = parseInt(page);
                const limitNum = parseInt(limit);
                const from = (pageNum - 1) * limitNum;
                const to = from + limitNum - 1;
                
                const result = await query
                    .order('tanggal_daftar', { ascending: false })
                    .range(from, to);
                data = result.data;
                error = result.error;
                count = result.count;
            }

            if (error) {
                console.error('Database error in getAllRegistrasi:', error);
                return res.status(500).json(formatError('Gagal mengambil data registrasi KKN: ' + error.message));
            }

            if (exportFlag === 'true') {
                return res.status(200).json(
                    formatResponse('success', 'Data registrasi KKN untuk export berhasil diambil', data || [])
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
                    'Data registrasi KKN berhasil diambil'
                )
            );
        } catch (error) {
            console.error('Error in getAllRegistrasi:', error);
            return res.status(500).json(formatError('Gagal mengambil data registrasi KKN'));
        }
    },

    /**
     * Get single KKN registration by ID
     * GET /api/admin/registrasi-kkn/:id
     */
    async getRegistrasiById(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json(formatError('ID registrasi tidak ditemukan'));
            }
            
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
                        kabupaten,
                        kecamatan,
                        provinsi,
                        kuota,
                        nama_pembimbing_lapangan,
                        kontak_pembimbing_lapangan
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

            if (error) {
                if (error.code === 'PGRST116') {
                    return res.status(404).json(formatError('Registrasi tidak ditemukan'));
                }
                console.error('Database error in getRegistrasiById:', error);
                return res.status(500).json(formatError('Gagal mengambil data registrasi'));
            }

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

    /**
     * Update KKN registration status
     * PUT /api/admin/registrasi-kkn/:id/status
     */
    async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, catatan } = req.body;

            // Validate ID
            if (!id) {
                return res.status(400).json(formatError('ID registrasi tidak ditemukan'));
            }

            // Validate status
            const validStatus = ['pending', 'approved', 'rejected', 'verified'];
            if (!status || !validStatus.includes(status)) {
                return res.status(400).json(formatError('Status tidak valid. Status yang valid: pending, approved, rejected, verified'));
            }

            // Check if registration exists
            const { data: existing, error: checkError } = await supabase
                .from('registrasi_kkn')
                .select('id_registrasi, id_user, id_desa, status, catatan')
                .eq('id_registrasi', id)
                .single();

            if (checkError) {
                if (checkError.code === 'PGRST116') {
                    return res.status(404).json(formatError('Registrasi tidak ditemukan'));
                }
                throw checkError;
            }

            // Prepare update data
            const updateData = {
                status: status,
                catatan: catatan !== undefined ? (catatan.trim() !== '' ? catatan : null) : (existing.catatan || null),
                updated_at: new Date().toISOString()
            };

            // Add verification data if status is 'verified'
            if (status === 'verified') {
                updateData.tanggal_verifikasi = new Date().toISOString();
                updateData.diverifikasi_oleh = req.user?.userId || req.user?.id || null;
            }

            // Update status
            const { data, error } = await supabase
                .from('registrasi_kkn')
                .update(updateData)
                .eq('id_registrasi', id)
                .select()
                .single();

            if (error) {
                console.error('Database error in updateStatus:', error);
                return res.status(500).json(formatError('Gagal mengupdate status: ' + error.message));
            }

<<<<<<< HEAD
            // Create notification automatically
            try {
                if (status === 'approved' || status === 'verified') {
                    let linkWa = '';
                    let namaDesa = '';

                    if (existing.id_desa) {
                        const { data: desa } = await supabase
                            .from('desa_kkn')
                            .select('nama_desa, deskripsi')
                            .eq('id_desa', existing.id_desa)
                            .single();
                        
                        if (desa) {
                            namaDesa = desa.nama_desa;
                            const urlRegex = /(https?:\/\/chat\.whatsapp\.com\/[^\s]+|https?:\/\/wa\.me\/[^\s]+)/g;
                            const urls = desa.deskripsi ? desa.deskripsi.match(urlRegex) : null;
                            if (urls && urls.length > 0) {
                                linkWa = urls[0];
                            }
                        }
                    }

                    if (!linkWa) {
                        const groupLinks = require('../../config/groupLinks');
                        linkWa = groupLinks.kkn.default;
                    }

                    const locationText = namaDesa ? ` di Desa ${namaDesa}` : '';
                    await supabase
                        .from('notifikasi')
                        .insert([{
                            id_user: existing.id_user,
                            judul: 'Pendaftaran KKN Disetujui',
                            pesan: `Selamat! Pendaftaran KKN Anda${locationText} telah disetujui. Silakan klik tombol di bawah untuk bergabung dengan grup koordinasi WhatsApp.`,
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
                            judul: 'Pendaftaran KKN Ditolak',
                            pesan: `Mohon maaf, pendaftaran KKN Anda ditolak. Catatan: ${alasan}`,
                            tipe: 'error',
                            link: null,
                            dibaca: false,
                            created_at: new Date()
                        }]);
                }
            } catch (notifErr) {
                console.error('Failed to generate KKN status update notification:', notifErr);
=======
            // Jika status disetujui (approved), buat notifikasi otomatis untuk mahasiswa
            if (status === 'approved') {
                try {
                    // Ambil detail registrasi beserta nama desa dan link_grup desa
                    const { data: registration, error: regError } = await supabase
                        .from('registrasi_kkn')
                        .select('*, desa_kkn(nama_desa, link_grup)')
                        .eq('id_registrasi', id)
                        .single();

                    if (!regError && registration) {
                        const villageName = registration.desa_kkn?.nama_desa || 'Desa KKN';
                        const linkGrup = registration.desa_kkn?.link_grup;

                        let pesanNotif = `Pendaftaran KKN Anda di ${villageName} telah disetujui oleh admin.`;
                        if (catatan) {
                            pesanNotif += ` Catatan: "${catatan}".`;
                        }
                        if (linkGrup) {
                            pesanNotif += ` Silakan bergabung ke grup koordinasi desa melalui tautan WhatsApp berikut: ${linkGrup}`;
                        } else {
                            pesanNotif += ` Silakan hubungi koordinator desa untuk informasi koordinasi lebih lanjut.`;
                        }

                        // Insert ke tabel notifikasi
                        const { error: notifError } = await supabase
                            .from('notifikasi')
                            .insert([
                                {
                                    id_user: registration.id_user,
                                    judul: 'Pendaftaran KKN Disetujui',
                                    pesan: pesanNotif,
                                    tipe: 'success',
                                    dibaca: false,
                                    created_at: new Date()
                                }
                            ]);
                        if (notifError) console.error('Error inserting notification KKN:', notifError);
                    } else {
                        console.error('Error fetching registration for notification KKN:', regError);
                    }
                } catch (notifErr) {
                    console.error('Gagal mengirim notifikasi otomatis KKN:', notifErr);
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

    /**
     * Delete KKN registration and related data
     * DELETE /api/admin/registrasi-kkn/:id
     */
    async deleteRegistrasi(req, res) {
        try {
            const { id } = req.params;

            // Validate ID
            if (!id) {
                return res.status(400).json(formatError('ID registrasi tidak ditemukan'));
            }

            // Check if registration exists
            const { data: existing, error: checkError } = await supabase
                .from('registrasi_kkn')
                .select('id_registrasi, nim, nama_lengkap, id_desa, krs_file, khs_file, payment_file')
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

            // Delete related luaran_kkn first (if any)
            const { error: luaranError } = await supabase
                .from('luaran_kkn')
                .delete()
                .eq('id_registrasi', id);

            if (luaranError) {
                console.warn('Warning: Could not delete related luaran:', luaranError);
                // Don't throw error, continue with main deletion
            }

            // Delete the registration
            const { error } = await supabase
                .from('registrasi_kkn')
                .delete()
                .eq('id_registrasi', id);

            if (error) {
                console.error('Database error in deleteRegistrasi:', error);
                return res.status(500).json(formatError('Gagal menghapus registrasi: ' + error.message));
            }

            // Kurangi kuota_terisi desa jika ada
            if (existing.id_desa) {
                const { data: desa } = await supabase
                    .from('desa_kkn')
                    .select('kuota_terisi')
                    .eq('id_desa', existing.id_desa)
                    .single();
                
                if (desa) {
                    await supabase
                        .from('desa_kkn')
                        .update({
                            kuota_terisi: Math.max(0, (desa.kuota_terisi || 0) - 1),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id_desa', existing.id_desa);
                }
            }

            return res.status(200).json(
                formatResponse('success', `Registrasi KKN atas nama ${existing.nama_lengkap} (NIM: ${existing.nim}) berhasil dihapus`, null)
            );
        } catch (error) {
            console.error('Error in deleteRegistrasi:', error);
            return res.status(500).json(formatError('Gagal menghapus registrasi'));
        }
    },

    /**
     * Get KKN registrations by desa
     * GET /api/admin/registrasi-kkn/desa/:id_desa
     */
    async getByDesa(req, res) {
        try {
            const { id_desa } = req.params;
            const { page = 1, limit = 10, status = '' } = req.query;

            if (!id_desa) {
                return res.status(400).json(formatError('ID desa tidak ditemukan'));
            }

            const pageNum = parseInt(page);
            const limitNum = parseInt(limit);
            const from = (pageNum - 1) * limitNum;
            const to = from + limitNum - 1;

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

            if (status && status.trim() !== '') {
                query = query.eq('status', status);
            }

            const { data, error, count } = await query
                .order('tanggal_daftar', { ascending: false })
                .range(from, to);

            if (error) {
                console.error('Database error in getByDesa:', error);
                return res.status(500).json(formatError('Gagal mengambil data registrasi per desa'));
            }

            return res.status(200).json(
                formatPaginatedResponse(
                    data || [],
                    pageNum,
                    limitNum,
                    count || 0,
                    'Data registrasi KKN per desa berhasil diambil'
                )
            );
        } catch (error) {
            console.error('Error in getByDesa:', error);
            return res.status(500).json(formatError('Gagal mengambil data registrasi per desa'));
        }
    },

    /**
     * Get statistics for KKN registrations
     * GET /api/admin/registrasi-kkn/stats/summary
     */
    async getStats(req, res) {
        try {
            const { id_desa } = req.query;

            let query = supabase
                .from('registrasi_kkn')
                .select('status', { count: 'exact', head: false });

            if (id_desa && id_desa.trim() !== '') {
                query = query.eq('id_desa', id_desa);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Database error in getStats:', error);
                return res.status(500).json(formatError('Gagal mengambil statistik'));
            }

            // Calculate statistics
            const stats = {
                total: 0,
                pending: 0,
                approved: 0,
                rejected: 0,
                verified: 0
            };

            if (data) {
                stats.total = data.length;
                data.forEach(item => {
                    if (item.status === 'pending') stats.pending++;
                    else if (item.status === 'approved') stats.approved++;
                    else if (item.status === 'rejected') stats.rejected++;
                    else if (item.status === 'verified') stats.verified++;
                });
            }

            return res.status(200).json(
                formatResponse('success', 'Statistik berhasil diambil', stats)
            );
        } catch (error) {
            console.error('Error in getStats:', error);
            return res.status(500).json(formatError('Gagal mengambil statistik'));
        }
    },

    /**
     * Bulk update status for multiple registrations
     * PUT /api/admin/registrasi-kkn/bulk/status
     */
    async bulkUpdateStatus(req, res) {
        try {
            const { ids, status, catatan } = req.body;

            // Validate input
            if (!ids || !Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json(formatError('ID registrasi tidak valid'));
            }

            const validStatus = ['pending', 'approved', 'rejected', 'verified'];
            if (!status || !validStatus.includes(status)) {
                return res.status(400).json(formatError('Status tidak valid'));
            }

            // Prepare update data
            const updateData = {
                status: status,
                catatan: catatan || null,
                updated_at: new Date().toISOString()
            };

            if (status === 'verified') {
                updateData.tanggal_verifikasi = new Date().toISOString();
                updateData.diverifikasi_oleh = req.user?.userId || req.user?.id || null;
            }

            // Update all selected registrations
            const { data, error } = await supabase
                .from('registrasi_kkn')
                .update(updateData)
                .in('id_registrasi', ids)
                .select();

            if (error) {
                console.error('Database error in bulkUpdateStatus:', error);
                return res.status(500).json(formatError('Gagal melakukan update massal: ' + error.message));
            }

            return res.status(200).json(
                formatResponse('success', `${data?.length || 0} registrasi berhasil diupdate menjadi ${status}`, data)
            );
        } catch (error) {
            console.error('Error in bulkUpdateStatus:', error);
            return res.status(500).json(formatError('Gagal melakukan update massal'));
        }
    }
};

module.exports = registrasiKknController;