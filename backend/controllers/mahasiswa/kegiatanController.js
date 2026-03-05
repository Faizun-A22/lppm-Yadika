const supabase = require('../../config/database');

/**
 * Get all kegiatan with pagination and filters
 */
const getAllKegiatan = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const search = req.query.search || '';
        const jenis = req.query.jenis || '';
        const sort = req.query.sort || 'tanggal_mulai';
        const order = req.query.order || 'asc';
        const start = (page - 1) * limit;
        const end = start + limit - 1;

        // Build query
        let query = supabase
            .from('kegiatan')
            .select(`
                *,
                admin:users!kegiatan_id_admin_fkey (
                    id_user,
                    nama_lengkap,
                    email,
                    foto_profil
                )
            `, { count: 'exact' });

        // Add search filter
        if (search) {
            query = query.or(`nama_kegiatan.ilike.%${search}%,deskripsi.ilike.%${search}%`);
        }

        // Add jenis filter
        if (jenis && jenis !== 'all') {
            query = query.eq('jenis_kegiatan', jenis);
        }

        // Query untuk count
        let countQuery = supabase
            .from('kegiatan')
            .select('*', { count: 'exact', head: true });

        if (search) {
            countQuery = countQuery.or(`nama_kegiatan.ilike.%${search}%,deskripsi.ilike.%${search}%`);
        }

        if (jenis && jenis !== 'all') {
            countQuery = countQuery.eq('jenis_kegiatan', jenis);
        }

        const { count, error: countError } = await countQuery;
        if (countError) throw countError;

        // Query untuk data dengan sorting
        let dataQuery = supabase
            .from('kegiatan')
            .select(`
                *,
                admin:users!kegiatan_id_admin_fkey (
                    id_user,
                    nama_lengkap,
                    email,
                    foto_profil
                )
            `);

        if (search) {
            dataQuery = dataQuery.or(`nama_kegiatan.ilike.%${search}%,deskripsi.ilike.%${search}%`);
        }

        if (jenis && jenis !== 'all') {
            dataQuery = dataQuery.eq('jenis_kegiatan', jenis);
        }

        // Apply sorting
        dataQuery = dataQuery.order(sort, { ascending: order === 'asc' });

        const { data: kegiatan, error } = await dataQuery
            .range(start, end);

        if (error) throw error;

        // Format response
        const formattedKegiatan = kegiatan.map(item => ({
            id: item.id_kegiatan,
            nama_kegiatan: item.nama_kegiatan,
            jenis_kegiatan: item.jenis_kegiatan,
            deskripsi: item.deskripsi,
            tanggal_mulai: item.tanggal_mulai,
            tanggal_selesai: item.tanggal_selesai,
            lokasi: item.lokasi,
            kapasitas: item.kapasitas,
            pendaftar: item.pendaftar || 0,
            narasumber: item.narasumber,
            poster: item.poster ? 
                `${req.protocol}://${req.get('host')}/${item.poster}` : null,
            link_pendaftaran: item.link_pendaftaran,
            status_kegiatan: item.status_kegiatan,
            sisa_kuota: (item.kapasitas || 0) - (item.pendaftar || 0),
            admin: item.admin ? {
                id: item.admin.id_user,
                nama: item.admin.nama_lengkap,
                email: item.admin.email,
                foto_profil: item.admin.foto_profil
            } : null,
            created_at: item.created_at,
            updated_at: item.updated_at
        }));

        res.json({
            success: true,
            data: formattedKegiatan,
            pagination: {
                page,
                limit,
                total: count,
                total_pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Error in getAllKegiatan:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data kegiatan',
            error: error.message
        });
    }
};

/**
 * Get kegiatan by ID
 */
const getKegiatanById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: kegiatan, error } = await supabase
            .from('kegiatan')
            .select(`
                *,
                admin:users!kegiatan_id_admin_fkey (
                    id_user,
                    nama_lengkap,
                    email,
                    foto_profil
                )
            `)
            .eq('id_kegiatan', id)
            .single();

        if (error) throw error;
        if (!kegiatan) {
            return res.status(404).json({
                success: false,
                message: 'Kegiatan tidak ditemukan'
            });
        }

        // Get pendaftar count
        const { count: pendaftarCount, error: countError } = await supabase
            .from('pendaftar_kegiatan')
            .select('*', { count: 'exact', head: true })
            .eq('id_kegiatan', id)
            .eq('status_pendaftaran', 'diterima');

        if (countError) throw countError;

        // Check if current user already registered
        const userId = req.user.id_user;
        const { data: userRegistration, error: regError } = await supabase
            .from('pendaftar_kegiatan')
            .select('*')
            .eq('id_kegiatan', id)
            .eq('id_user', userId)
            .maybeSingle();

        if (regError) throw regError;

        // Get related kegiatan (same jenis, exclude current)
        const { data: relatedKegiatan, error: relatedError } = await supabase
            .from('kegiatan')
            .select('id_kegiatan, nama_kegiatan, poster, tanggal_mulai, lokasi')
            .eq('jenis_kegiatan', kegiatan.jenis_kegiatan)
            .neq('id_kegiatan', id)
            .order('tanggal_mulai', { ascending: true })
            .limit(3);

        if (relatedError) throw relatedError;

        // Format response
        const formattedKegiatan = {
            id: kegiatan.id_kegiatan,
            nama_kegiatan: kegiatan.nama_kegiatan,
            jenis_kegiatan: kegiatan.jenis_kegiatan,
            deskripsi: kegiatan.deskripsi,
            tanggal_mulai: kegiatan.tanggal_mulai,
            tanggal_selesai: kegiatan.tanggal_selesai,
            lokasi: kegiatan.lokasi,
            kapasitas: kegiatan.kapasitas,
            pendaftar: pendaftarCount || 0,
            sisa_kuota: (kegiatan.kapasitas || 0) - (pendaftarCount || 0),
            narasumber: kegiatan.narasumber,
            poster: kegiatan.poster ? 
                `${req.protocol}://${req.get('host')}/${kegiatan.poster}` : null,
            link_pendaftaran: kegiatan.link_pendaftaran,
            status_kegiatan: kegiatan.status_kegiatan,
            user_registered: !!userRegistration,
            user_registration_status: userRegistration?.status_pendaftaran || null,
            admin: kegiatan.admin ? {
                id: kegiatan.admin.id_user,
                nama: kegiatan.admin.nama_lengkap,
                email: kegiatan.admin.email,
                foto_profil: kegiatan.admin.foto_profil
            } : null,
            related_kegiatan: relatedKegiatan.map(item => ({
                id: item.id_kegiatan,
                nama_kegiatan: item.nama_kegiatan,
                poster: item.poster ? 
                    `${req.protocol}://${req.get('host')}/${item.poster}` : null,
                tanggal_mulai: item.tanggal_mulai,
                lokasi: item.lokasi
            }))
        };

        res.json({
            success: true,
            data: formattedKegiatan
        });

    } catch (error) {
        console.error('Error in getKegiatanById:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data kegiatan',
            error: error.message
        });
    }
};

/**
 * Get kegiatan by jenis
 */
const getKegiatanByJenis = async (req, res) => {
    try {
        const { jenis } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const start = (page - 1) * limit;
        const end = start + limit - 1;

        const validJenis = ['seminar', 'workshop', 'pelatihan', 'webinar', 'konferensi', 'lainnya'];
        if (!validJenis.includes(jenis)) {
            return res.status(400).json({
                success: false,
                message: 'Jenis kegiatan tidak valid'
            });
        }

        const { data: kegiatan, error, count } = await supabase
            .from('kegiatan')
            .select(`
                *,
                admin:users!kegiatan_id_admin_fkey (
                    nama_lengkap
                )
            `, { count: 'exact' })
            .eq('jenis_kegiatan', jenis)
            .order('tanggal_mulai', { ascending: true })
            .range(start, end);

        if (error) throw error;

        const formattedKegiatan = kegiatan.map(item => ({
            id: item.id_kegiatan,
            nama_kegiatan: item.nama_kegiatan,
            jenis_kegiatan: item.jenis_kegiatan,
            deskripsi: item.deskripsi ? item.deskripsi.substring(0, 150) + '...' : null,
            tanggal_mulai: item.tanggal_mulai,
            lokasi: item.lokasi,
            poster: item.poster ? 
                `${req.protocol}://${req.get('host')}/${item.poster}` : null,
            status_kegiatan: item.status_kegiatan,
            sisa_kuota: (item.kapasitas || 0) - (item.pendaftar || 0)
        }));

        res.json({
            success: true,
            data: formattedKegiatan,
            pagination: {
                page,
                limit,
                total: count,
                total_pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Error in getKegiatanByJenis:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data kegiatan',
            error: error.message
        });
    }
};

/**
 * Get upcoming kegiatan
 */
const getUpcomingKegiatan = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;

        const { data: kegiatan, error } = await supabase
            .from('kegiatan')
            .select(`
                *,
                admin:users!kegiatan_id_admin_fkey (
                    nama_lengkap
                )
            `)
            .eq('status_kegiatan', 'upcoming')
            .gte('tanggal_mulai', new Date().toISOString())
            .order('tanggal_mulai', { ascending: true })
            .limit(limit);

        if (error) throw error;

        const formattedKegiatan = kegiatan.map(item => ({
            id: item.id_kegiatan,
            nama_kegiatan: item.nama_kegiatan,
            jenis_kegiatan: item.jenis_kegiatan,
            tanggal_mulai: item.tanggal_mulai,
            lokasi: item.lokasi,
            poster: item.poster ? 
                `${req.protocol}://${req.get('host')}/${item.poster}` : null,
            sisa_kuota: (item.kapasitas || 0) - (item.pendaftar || 0),
            kapasitas: item.kapasitas
        }));

        res.json({
            success: true,
            data: formattedKegiatan
        });

    } catch (error) {
        console.error('Error in getUpcomingKegiatan:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil kegiatan mendatang',
            error: error.message
        });
    }
};

/**
 * Register for kegiatan
 */
const registerKegiatan = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_user;
        const { catatan } = req.body;

        // Check if kegiatan exists and is open
        const { data: kegiatan, error: kegiatanError } = await supabase
            .from('kegiatan')
            .select('*')
            .eq('id_kegiatan', id)
            .single();

        if (kegiatanError) throw kegiatanError;
        if (!kegiatan) {
            return res.status(404).json({
                success: false,
                message: 'Kegiatan tidak ditemukan'
            });
        }

        // Check if already registered
        const { data: existing, error: existingError } = await supabase
            .from('pendaftar_kegiatan')
            .select('*')
            .eq('id_kegiatan', id)
            .eq('id_user', userId)
            .maybeSingle();

        if (existingError) throw existingError;
        if (existing) {
            return res.status(400).json({
                success: false,
                message: 'Anda sudah terdaftar di kegiatan ini'
            });
        }

        // Check kuota
        if (kegiatan.kapasitas && kegiatan.pendaftar >= kegiatan.kapasitas) {
            return res.status(400).json({
                success: false,
                message: 'Maaf, kuota pendaftaran sudah penuh'
            });
        }

        // Register
        const { data: pendaftaran, error: insertError } = await supabase
            .from('pendaftar_kegiatan')
            .insert([
                {
                    id_kegiatan: id,
                    id_user: userId,
                    status_pendaftaran: 'menunggu',
                    catatan: catatan || null
                }
            ])
            .select()
            .single();

        if (insertError) throw insertError;

        // Update pendaftar count
        await supabase
            .from('kegiatan')
            .update({ pendaftar: kegiatan.pendaftar + 1 })
            .eq('id_kegiatan', id);

        res.json({
            success: true,
            message: 'Berhasil mendaftar kegiatan',
            data: pendaftaran
        });

    } catch (error) {
        console.error('Error in registerKegiatan:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mendaftar kegiatan',
            error: error.message
        });
    }
};

/**
 * Check registration status
 */
const checkRegistrationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id_user;

        const { data: registration, error } = await supabase
            .from('pendaftar_kegiatan')
            .select('*')
            .eq('id_kegiatan', id)
            .eq('id_user', userId)
            .maybeSingle();

        if (error) throw error;

        res.json({
            success: true,
            data: registration ? {
                registered: true,
                status: registration.status_pendaftaran,
                tanggal_daftar: registration.tanggal_daftar,
                catatan: registration.catatan
            } : {
                registered: false
            }
        });

    } catch (error) {
        console.error('Error in checkRegistrationStatus:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengecek status pendaftaran',
            error: error.message
        });
    }
};

/**
 * Get kegiatan statistics
 */
const getKegiatanStats = async (req, res) => {
    try {
        // Get counts by status
        const { data: statusData, error: statusError } = await supabase
            .from('kegiatan')
            .select('status_kegiatan');

        if (statusError) throw statusError;

        // Hitung manual per status
        const statusCount = {};
        statusData.forEach(item => {
            statusCount[item.status_kegiatan] = (statusCount[item.status_kegiatan] || 0) + 1;
        });

        const formattedStatusStats = Object.keys(statusCount).map(status => ({
            status_kegiatan: status,
            count: statusCount[status]
        }));

        // Get counts by jenis
        const { data: jenisData, error: jenisError } = await supabase
            .from('kegiatan')
            .select('jenis_kegiatan');

        if (jenisError) throw jenisError;

        // Hitung manual per jenis
        const jenisCount = {};
        jenisData.forEach(item => {
            jenisCount[item.jenis_kegiatan] = (jenisCount[item.jenis_kegiatan] || 0) + 1;
        });

        const formattedJenisStats = Object.keys(jenisCount).map(jenis => ({
            jenis_kegiatan: jenis,
            count: jenisCount[jenis]
        }));

        // Get total pendaftar
        const { data: pendaftarData, error: pendaftarError } = await supabase
            .from('pendaftar_kegiatan')
            .select('status_pendaftaran');

        if (pendaftarError) throw pendaftarError;

        // Hitung manual per status pendaftaran
        const pendaftarCount = {};
        pendaftarData.forEach(item => {
            pendaftarCount[item.status_pendaftaran] = (pendaftarCount[item.status_pendaftaran] || 0) + 1;
        });

        const formattedPendaftarStats = Object.keys(pendaftarCount).map(status => ({
            status_pendaftaran: status,
            count: pendaftarCount[status]
        }));

        // Get upcoming kegiatan
        const { data: upcoming, error: upcomingError } = await supabase
            .from('kegiatan')
            .select('id_kegiatan, nama_kegiatan, tanggal_mulai, pendaftar, kapasitas')
            .eq('status_kegiatan', 'upcoming')
            .gte('tanggal_mulai', new Date().toISOString())
            .order('tanggal_mulai', { ascending: true })
            .limit(5);

        if (upcomingError) throw upcomingError;

        res.json({
            success: true,
            data: {
                by_status: formattedStatusStats,
                by_jenis: formattedJenisStats,
                pendaftar: formattedPendaftarStats,
                upcoming: upcoming.map(item => ({
                    id: item.id_kegiatan,
                    nama_kegiatan: item.nama_kegiatan,
                    tanggal_mulai: item.tanggal_mulai,
                    sisa_kuota: (item.kapasitas || 0) - (item.pendaftar || 0)
                }))
            }
        });

    } catch (error) {
        console.error('Error in getKegiatanStats:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil statistik kegiatan',
            error: error.message
        });
    }
};

module.exports = {
    getAllKegiatan,
    getKegiatanById,
    getKegiatanByJenis,
    getUpcomingKegiatan,
    registerKegiatan,
    checkRegistrationStatus,
    getKegiatanStats
};