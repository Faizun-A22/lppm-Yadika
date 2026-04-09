const supabase = require('../../config/database');
const { formatResponse, formatError, formatPaginatedResponse } = require('../../utils/responseFormatter');
const { getFileUrl, deleteFile } = require('../../utils/helpers');
const path = require('path');
const fs = require('fs');

class PerusahaanMagangController {
    /**
     * Get all perusahaan magang with pagination and filters
     * GET /api/admin/magang/perusahaan
     */
    async getPerusahaanMagang(req, res, next) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const search = req.query.search || '';
            const status = req.query.status || '';
            
            const offset = (page - 1) * limit;
            
            // First, get registrasi_magang data for search filter
            let registrasiIds = [];
            if (search) {
                const { data: registrasiData, error: registrasiError } = await supabase
                    .from('registrasi_magang')
                    .select('id_registrasi, nim, nama_lengkap, email, no_hp, program_studi_input, semester, domisili')
                    .or(`nim.ilike.%${search}%,nama_lengkap.ilike.%${search}%`);
                
                if (!registrasiError && registrasiData && registrasiData.length > 0) {
                    registrasiIds = registrasiData.map(r => r.id_registrasi);
                }
            }
            
            // Build main query
            let query = supabase
                .from('magang_perusahaan')
                .select(`
                    id_perusahaan,
                    id_registrasi,
                    id_user,
                    nama_perusahaan,
                    bidang_magang,
                    posisi,
                    durasi,
                    tanggal_mulai,
                    tanggal_selesai,
                    alamat_perusahaan,
                    nama_pembimbing,
                    kontak_pembimbing,
                    email_pembimbing,
                    jabatan_pembimbing,
                    surat_keterangan,
                    struktur_organisasi,
                    status,
                    catatan,
                    diverifikasi_oleh,
                    tanggal_verifikasi,
                    created_at,
                    updated_at,
                    registrasi_magang (
                        nim,
                        nama_lengkap,
                        email,
                        no_hp,
                        program_studi_input,
                        semester,
                        domisili
                    )
                `, { count: 'exact' });
            
            // Apply search filter
            if (search && registrasiIds.length > 0) {
                query = query.or(`nama_perusahaan.ilike.%${search}%,id_registrasi.in.(${registrasiIds.join(',')})`);
            } else if (search) {
                query = query.ilike('nama_perusahaan', `%${search}%`);
            }
            
            // Apply status filter
            if (status) {
                query = query.eq('status', status);
            }
            
            // Get total count first
            const { count, error: countError } = await query;
            
            if (countError) throw countError;
            
            // Apply pagination
            query = query.range(offset, offset + limit - 1)
                .order('created_at', { ascending: false });
            
            const { data, error } = await query;
            
            if (error) throw error;
            
            // Format data
            const formattedData = [];
            for (const item of data || []) {
                // Get user info
                const { data: userData } = await supabase
                    .from('users')
                    .select('nama_lengkap, email, no_hp')
                    .eq('id_user', item.id_user)
                    .single();
                
                // Get verifier info
                let verifierData = null;
                if (item.diverifikasi_oleh) {
                    const { data: verifier } = await supabase
                        .from('users')
                        .select('nama_lengkap')
                        .eq('id_user', item.diverifikasi_oleh)
                        .single();
                    verifierData = verifier;
                }
                
                formattedData.push({
                    id_perusahaan: item.id_perusahaan,
                    id_registrasi: item.id_registrasi,
                    id_user: item.id_user,
                    nama_perusahaan: item.nama_perusahaan,
                    bidang_magang: item.bidang_magang,
                    posisi: item.posisi,
                    durasi: item.durasi,
                    tanggal_mulai: item.tanggal_mulai,
                    tanggal_selesai: item.tanggal_selesai,
                    alamat_perusahaan: item.alamat_perusahaan,
                    nama_pembimbing: item.nama_pembimbing,
                    kontak_pembimbing: item.kontak_pembimbing,
                    email_pembimbing: item.email_pembimbing,
                    jabatan_pembimbing: item.jabatan_pembimbing,
                    surat_keterangan: item.surat_keterangan ? getFileUrl(item.surat_keterangan) : null,
                    struktur_organisasi: item.struktur_organisasi ? getFileUrl(item.struktur_organisasi) : null,
                    status: item.status,
                    catatan: item.catatan,
                    diverifikasi_oleh: item.diverifikasi_oleh,
                    diverifikasi_oleh_nama: verifierData?.nama_lengkap || null,
                    tanggal_verifikasi: item.tanggal_verifikasi,
                    created_at: item.created_at,
                    updated_at: item.updated_at,
                    // Data mahasiswa
                    nim: item.registrasi_magang?.nim,
                    nama_lengkap: item.registrasi_magang?.nama_lengkap,
                    email: item.registrasi_magang?.email,
                    no_hp: item.registrasi_magang?.no_hp,
                    program_studi: item.registrasi_magang?.program_studi_input,
                    semester: item.registrasi_magang?.semester,
                    domisili: item.registrasi_magang?.domisili,
                    // Data user
                    user_nama: userData?.nama_lengkap,
                    user_email: userData?.email,
                    user_no_hp: userData?.no_hp
                });
            }
            
            return res.status(200).json(
                formatPaginatedResponse(formattedData, page, limit, count || 0, 'Data perusahaan magang berhasil diambil')
            );
            
        } catch (error) {
            console.error('Error in getPerusahaanMagang:', error);
            next(error);
        }
    }
    
    /**
     * Get single perusahaan magang by ID
     * GET /api/admin/magang/perusahaan/:id
     */
    async getPerusahaanMagangById(req, res, next) {
        try {
            const { id } = req.params;
            
            // Get perusahaan data
            const { data: perusahaanData, error: perusahaanError } = await supabase
                .from('magang_perusahaan')
                .select(`
                    id_perusahaan,
                    id_registrasi,
                    id_user,
                    nama_perusahaan,
                    bidang_magang,
                    posisi,
                    durasi,
                    tanggal_mulai,
                    tanggal_selesai,
                    alamat_perusahaan,
                    nama_pembimbing,
                    kontak_pembimbing,
                    email_pembimbing,
                    jabatan_pembimbing,
                    surat_keterangan,
                    struktur_organisasi,
                    status,
                    catatan,
                    diverifikasi_oleh,
                    tanggal_verifikasi,
                    created_at,
                    updated_at
                `)
                .eq('id_perusahaan', id)
                .single();
            
            if (perusahaanError) {
                if (perusahaanError.code === 'PGRST116') {
                    return res.status(404).json(formatError('Data perusahaan tidak ditemukan'));
                }
                throw perusahaanError;
            }
            
            // Get registrasi magang data
            const { data: registrasiData, error: registrasiError } = await supabase
                .from('registrasi_magang')
                .select(`
                    id_registrasi,
                    nim,
                    nama_lengkap,
                    email,
                    no_hp,
                    program_studi_input,
                    semester,
                    domisili,
                    krs_file,
                    khs_file,
                    payment_file,
                    status,
                    created_at
                `)
                .eq('id_registrasi', perusahaanData.id_registrasi)
                .single();
            
            if (registrasiError && registrasiError.code !== 'PGRST116') {
                console.error('Error getting registrasi data:', registrasiError);
            }
            
            // Get user info
            const { data: userData } = await supabase
                .from('users')
                .select('nama_lengkap, email, no_hp')
                .eq('id_user', perusahaanData.id_user)
                .single();
            
            // Get verifier info
            let verifierData = null;
            if (perusahaanData.diverifikasi_oleh) {
                const { data: verifier } = await supabase
                    .from('users')
                    .select('nama_lengkap')
                    .eq('id_user', perusahaanData.diverifikasi_oleh)
                    .single();
                verifierData = verifier;
            }
            
            // Format response
            const formattedData = {
                id_perusahaan: perusahaanData.id_perusahaan,
                id_registrasi: perusahaanData.id_registrasi,
                id_user: perusahaanData.id_user,
                nama_perusahaan: perusahaanData.nama_perusahaan,
                bidang_magang: perusahaanData.bidang_magang,
                posisi: perusahaanData.posisi,
                durasi: perusahaanData.durasi,
                tanggal_mulai: perusahaanData.tanggal_mulai,
                tanggal_selesai: perusahaanData.tanggal_selesai,
                alamat_perusahaan: perusahaanData.alamat_perusahaan,
                nama_pembimbing: perusahaanData.nama_pembimbing,
                kontak_pembimbing: perusahaanData.kontak_pembimbing,
                email_pembimbing: perusahaanData.email_pembimbing,
                jabatan_pembimbing: perusahaanData.jabatan_pembimbing,
                surat_keterangan: perusahaanData.surat_keterangan ? getFileUrl(perusahaanData.surat_keterangan) : null,
                struktur_organisasi: perusahaanData.struktur_organisasi ? getFileUrl(perusahaanData.struktur_organisasi) : null,
                status: perusahaanData.status,
                catatan: perusahaanData.catatan,
                diverifikasi_oleh: perusahaanData.diverifikasi_oleh,
                diverifikasi_oleh_nama: verifierData?.nama_lengkap || null,
                tanggal_verifikasi: perusahaanData.tanggal_verifikasi,
                created_at: perusahaanData.created_at,
                updated_at: perusahaanData.updated_at,
                // Data mahasiswa dari registrasi_magang
                nim: registrasiData?.nim,
                nama_lengkap: registrasiData?.nama_lengkap,
                email: registrasiData?.email,
                no_hp: registrasiData?.no_hp,
                program_studi: registrasiData?.program_studi_input,
                semester: registrasiData?.semester,
                domisili: registrasiData?.domisili,
                // Dokumen mahasiswa
                krs_file: registrasiData?.krs_file ? getFileUrl(registrasiData.krs_file) : null,
                khs_file: registrasiData?.khs_file ? getFileUrl(registrasiData.khs_file) : null,
                payment_file: registrasiData?.payment_file ? getFileUrl(registrasiData.payment_file) : null,
                registrasi_status: registrasiData?.status,
                tanggal_daftar: registrasiData?.created_at,
                // Data user
                user_nama: userData?.nama_lengkap,
                user_email: userData?.email,
                user_no_hp: userData?.no_hp
            };
            
            return res.status(200).json(
                formatResponse('success', 'Data perusahaan magang berhasil diambil', formattedData)
            );
            
        } catch (error) {
            console.error('Error in getPerusahaanMagangById:', error);
            next(error);
        }
    }
    
    /**
     * Update perusahaan magang status (verifikasi)
     * PUT /api/admin/magang/perusahaan/:id/verifikasi
     */
    async verifikasiPerusahaanMagang(req, res, next) {
        try {
            const { id } = req.params;
            const { status, catatan } = req.body;
            const adminId = req.user?.userId || req.user?.id_user;
            
            // Validasi status
            const validStatuses = ['pending', 'approved', 'rejected', 'verified'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json(formatError('Status tidak valid'));
            }
            
            // Get current data
            const { data: currentData, error: getError } = await supabase
                .from('magang_perusahaan')
                .select('id_perusahaan, id_user, nama_perusahaan, status')
                .eq('id_perusahaan', id)
                .single();
            
            if (getError) {
                if (getError.code === 'PGRST116') {
                    return res.status(404).json(formatError('Data perusahaan tidak ditemukan'));
                }
                throw getError;
            }
            
            // Update status
            const { data, error } = await supabase
                .from('magang_perusahaan')
                .update({
                    status: status,
                    catatan: catatan || null,
                    diverifikasi_oleh: adminId,
                    tanggal_verifikasi: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id_perusahaan', id)
                .select()
                .single();
            
            if (error) throw error;
            
            // Create notification for mahasiswa
            if (currentData.id_user) {
                let notificationTitle = '';
                let notificationMessage = '';
                let notificationType = '';
                
                switch (status) {
                    case 'approved':
                        notificationTitle = 'Data Perusahaan Disetujui';
                        notificationMessage = `Data perusahaan "${currentData.nama_perusahaan}" telah disetujui oleh admin. Anda dapat melanjutkan ke tahap selanjutnya.`;
                        notificationType = 'success';
                        break;
                    case 'rejected':
                        notificationTitle = 'Data Perusahaan Ditolak';
                        notificationMessage = `Data perusahaan "${currentData.nama_perusahaan}" ditolak. ${catatan ? 'Catatan: ' + catatan : 'Silakan periksa kembali data Anda.'}`;
                        notificationType = 'error';
                        break;
                    case 'verified':
                        notificationTitle = 'Data Perusahaan Terverifikasi';
                        notificationMessage = `Data perusahaan "${currentData.nama_perusahaan}" telah diverifikasi. Selamat menjalani magang!`;
                        notificationType = 'success';
                        break;
                    default:
                        notificationTitle = 'Status Data Perusahaan Diperbarui';
                        notificationMessage = `Status data perusahaan "${currentData.nama_perusahaan}" menjadi ${status}.`;
                        notificationType = 'info';
                }
                
                if (notificationTitle) {
                    await supabase
                        .from('notifikasi')
                        .insert({
                            id_user: currentData.id_user,
                            judul: notificationTitle,
                            pesan: notificationMessage,
                            tipe: notificationType,
                            link: `/mahasiswa/magang.html?tab=perusahaan`
                        });
                }
            }
            
            return res.status(200).json(
                formatResponse('success', 'Status perusahaan berhasil diperbarui', {
                    id_perusahaan: data.id_perusahaan,
                    status: data.status,
                    catatan: data.catatan,
                    diverifikasi_oleh: data.diverifikasi_oleh,
                    tanggal_verifikasi: data.tanggal_verifikasi
                })
            );
            
        } catch (error) {
            console.error('Error in verifikasiPerusahaanMagang:', error);
            next(error);
        }
    }
    
    /**
     * Delete perusahaan magang
     * DELETE /api/admin/magang/perusahaan/:id
     */
    async deletePerusahaanMagang(req, res, next) {
        try {
            const { id } = req.params;
            
            // Get data to delete files
            const { data: currentData, error: getError } = await supabase
                .from('magang_perusahaan')
                .select('surat_keterangan, struktur_organisasi')
                .eq('id_perusahaan', id)
                .single();
            
            if (getError) {
                if (getError.code === 'PGRST116') {
                    return res.status(404).json(formatError('Data perusahaan tidak ditemukan'));
                }
                throw getError;
            }
            
            // Delete files from storage
            if (currentData.surat_keterangan) {
                const filePath = path.join(__dirname, '../../uploads', currentData.surat_keterangan);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            
            if (currentData.struktur_organisasi) {
                const filePath = path.join(__dirname, '../../uploads', currentData.struktur_organisasi);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
            
            // Delete from database
            const { error } = await supabase
                .from('magang_perusahaan')
                .delete()
                .eq('id_perusahaan', id);
            
            if (error) throw error;
            
            return res.status(200).json(
                formatResponse('success', 'Data perusahaan berhasil dihapus')
            );
            
        } catch (error) {
            console.error('Error in deletePerusahaanMagang:', error);
            next(error);
        }
    }
    
    /**
     * Get statistics for perusahaan magang
     * GET /api/admin/magang/perusahaan/statistics
     */
    async getPerusahaanStatistics(req, res, next) {
        try {
            const { data, error } = await supabase
                .from('magang_perusahaan')
                .select('status', { count: 'exact' });
            
            if (error) throw error;
            
            const statistics = {
                total: data?.length || 0,
                pending: data?.filter(item => item.status === 'pending').length || 0,
                approved: data?.filter(item => item.status === 'approved').length || 0,
                rejected: data?.filter(item => item.status === 'rejected').length || 0,
                verified: data?.filter(item => item.status === 'verified').length || 0
            };
            
            return res.status(200).json(
                formatResponse('success', 'Statistik perusahaan magang berhasil diambil', statistics)
            );
            
        } catch (error) {
            console.error('Error in getPerusahaanStatistics:', error);
            next(error);
        }
    }
}

module.exports = new PerusahaanMagangController();