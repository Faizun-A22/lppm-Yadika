const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../../middleware/auth');
const supabase = require('../../config/database');

// Semua route memerlukan autentikasi admin
router.use(authenticateToken);
router.use(authorizeRoles('admin'));

/**
 * GET /api/admin/magang/luaran
 * Mendapatkan daftar luaran magang dengan filter
 */
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, status, search } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Ambil data luaran dulu
        let luaranQuery = supabase
            .from('magang_luaran')
            .select('*', { count: 'exact' });
        
        if (status && status !== '') {
            luaranQuery = luaranQuery.eq('status', status);
        }
        
        const { data: luaranList, error: luaranError, count } = await luaranQuery
            .range(offset, offset + parseInt(limit) - 1)
            .order('created_at', { ascending: false });
        
        if (luaranError) throw luaranError;
        
        // Ambil detail untuk setiap luaran
        const formattedData = [];
        for (const luaran of luaranList || []) {
            // Ambil perusahaan
            const { data: perusahaan } = await supabase
                .from('magang_perusahaan')
                .select('nama_perusahaan, bidang_magang, posisi, status')
                .eq('id_perusahaan', luaran.id_perusahaan)
                .single();
            
            // Ambil user (mahasiswa) dengan JOIN ke program_studi
            const { data: user } = await supabase
                .from('users')
                .select(`
                    id_user,
                    nim,
                    nama_lengkap,
                    email,
                    no_hp,
                    id_prodi,
                    program_studi:program_studi (
                        id_prodi,
                        nama_prodi,
                        jenjang
                    )
                `)
                .eq('id_user', luaran.id_user)
                .single();
            
            formattedData.push({
                id_luaran: luaran.id_luaran,
                nim: user?.nim || '-',
                nama_lengkap: user?.nama_lengkap || '-',
                email: user?.email || '-',
                no_hp: user?.no_hp || '-',
                program_studi: user?.program_studi?.nama_prodi || '-',
                jenjang: user?.program_studi?.jenjang || '-',
                nama_perusahaan: perusahaan?.nama_perusahaan || '-',
                bidang_magang: perusahaan?.bidang_magang || '-',
                posisi: perusahaan?.posisi || '-',
                perusahaan_status: perusahaan?.status || '-',
                judul_proyek: luaran.judul_proyek,
                deskripsi_pekerjaan: luaran.deskripsi_pekerjaan,
                link_poster: luaran.link_poster,
                link_laporan: luaran.link_laporan,
                link_foto: luaran.link_foto,
                file_mou: luaran.file_mou,
                file_sertifikat: luaran.file_sertifikat,
                file_logbook: luaran.file_logbook,
                keterangan: luaran.keterangan,
                status: luaran.status,
                catatan: luaran.catatan,
                diverifikasi_oleh: luaran.diverifikasi_oleh,
                tanggal_verifikasi: luaran.tanggal_verifikasi,
                created_at: luaran.created_at,
                updated_at: luaran.updated_at
            });
        }
        
        // Filter search manual
        let finalData = formattedData;
        if (search && search !== '') {
            const searchLower = search.toLowerCase();
            finalData = formattedData.filter(item => 
                item.nim?.toLowerCase().includes(searchLower) ||
                item.judul_proyek?.toLowerCase().includes(searchLower) ||
                item.nama_lengkap?.toLowerCase().includes(searchLower)
            );
        }
        
        res.json({
            success: true,
            data: finalData,
            pagination: {
                currentPage: parseInt(page),
                itemsPerPage: parseInt(limit),
                totalItems: count || finalData.length,
                totalPages: Math.ceil((count || finalData.length) / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error getting magang luaran:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * GET /api/admin/magang/luaran/:id
 * Mendapatkan detail luaran magang
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Step 1: Ambil data luaran
        const { data: luaran, error: luaranError } = await supabase
            .from('magang_luaran')
            .select('*')
            .eq('id_luaran', id)
            .single();
        
        if (luaranError) throw luaranError;
        
        if (!luaran) {
            return res.status(404).json({ success: false, message: 'Luaran tidak ditemukan' });
        }
        
        // Step 2: Ambil data perusahaan
        const { data: perusahaan, error: perusahaanError } = await supabase
            .from('magang_perusahaan')
            .select('*')
            .eq('id_perusahaan', luaran.id_perusahaan)
            .single();
        
        if (perusahaanError && perusahaanError.code !== 'PGRST116') {
            console.error('Error getting perusahaan:', perusahaanError);
        }
        
        // Step 3: Ambil data user (mahasiswa) dengan JOIN ke program_studi
        const { data: user, error: userError } = await supabase
            .from('users')
            .select(`
                id_user,
                nim,
                nama_lengkap,
                email,
                no_hp,
                semester,
                id_prodi,
                program_studi:program_studi (
                    id_prodi,
                    nama_prodi,
                    jenjang,
                    kode_prodi
                )
            `)
            .eq('id_user', luaran.id_user)
            .single();
        
        if (userError && userError.code !== 'PGRST116') {
            console.error('Error getting user:', userError);
        }
        
        // Step 4: Ambil data registrasi magang untuk mendapatkan program_studi_input, domisili, dll
        const { data: registrasi, error: registrasiError } = await supabase
            .from('registrasi_magang')
            .select('program_studi_input, domisili, semester, krs_file, khs_file, payment_file')
            .eq('id_user', luaran.id_user)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        
        if (registrasiError && registrasiError.code !== 'PGRST116') {
            console.error('Error getting registrasi:', registrasiError);
        }
        
        const formattedData = {
            id_luaran: luaran.id_luaran,
            nim: user?.nim || '-',
            nama_lengkap: user?.nama_lengkap || '-',
            email: user?.email || '-',
            no_hp: user?.no_hp || '-',
            program_studi: user?.program_studi?.nama_prodi || registrasi?.program_studi_input || '-',
            jenjang: user?.program_studi?.jenjang || '-',
            semester: user?.semester || registrasi?.semester || '-',
            domisili: registrasi?.domisili || '-',
            nama_perusahaan: perusahaan?.nama_perusahaan || '-',
            bidang_magang: perusahaan?.bidang_magang || '-',
            posisi: perusahaan?.posisi || '-',
            durasi: perusahaan?.durasi || '-',
            tanggal_mulai: perusahaan?.tanggal_mulai,
            tanggal_selesai: perusahaan?.tanggal_selesai,
            alamat_perusahaan: perusahaan?.alamat_perusahaan || '-',
            nama_pembimbing: perusahaan?.nama_pembimbing || '-',
            kontak_pembimbing: perusahaan?.kontak_pembimbing || '-',
            email_pembimbing: perusahaan?.email_pembimbing || '-',
            jabatan_pembimbing: perusahaan?.jabatan_pembimbing || '-',
            judul_proyek: luaran.judul_proyek,
            deskripsi_pekerjaan: luaran.deskripsi_pekerjaan,
            link_poster: luaran.link_poster,
            link_laporan: luaran.link_laporan,
            link_foto: luaran.link_foto,
            file_mou: luaran.file_mou,
            file_sertifikat: luaran.file_sertifikat,
            file_logbook: luaran.file_logbook,
            keterangan: luaran.keterangan,
            status: luaran.status,
            catatan: luaran.catatan,
            diverifikasi_oleh: luaran.diverifikasi_oleh,
            tanggal_verifikasi: luaran.tanggal_verifikasi,
            created_at: luaran.created_at,
            updated_at: luaran.updated_at
        };
        
        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error('Error getting magang luaran detail:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

/**
 * PUT /api/admin/magang/luaran/:id/verifikasi
 * Verifikasi luaran magang
 */
router.put('/:id/verifikasi', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, catatan } = req.body;
        const adminId = req.user.id_user;
        
        // Validasi status
        const validStatus = ['pending', 'approved', 'rejected', 'verified'];
        if (!validStatus.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status tidak valid' });
        }
        
        // Update luaran
        const { data, error } = await supabase
            .from('magang_luaran')
            .update({
                status: status,
                catatan: catatan || null,
                diverifikasi_oleh: adminId,
                tanggal_verifikasi: new Date()
            })
            .eq('id_luaran', id)
            .select()
            .single();
        
        if (error) throw error;
        
        if (!data) {
            return res.status(404).json({ success: false, message: 'Luaran tidak ditemukan' });
        }
        
        // Buat notifikasi untuk mahasiswa
        if (data.id_user) {
            let judulNotif = '';
            let pesanNotif = '';
            let tipeNotif = 'info';
            
            if (status === 'approved') {
                judulNotif = 'Luaran Magang Disetujui';
                pesanNotif = 'Luaran magang Anda telah disetujui oleh admin.';
                tipeNotif = 'success';
            } else if (status === 'rejected') {
                judulNotif = 'Luaran Magang Ditolak';
                pesanNotif = `Luaran magang Anda ditolak. Catatan: ${catatan || 'Silakan perbaiki dan submit ulang.'}`;
                tipeNotif = 'error';
            } else if (status === 'verified') {
                judulNotif = 'Luaran Magang Terverifikasi';
                pesanNotif = 'Selamat! Luaran magang Anda telah diverifikasi dan dinyatakan lengkap.';
                tipeNotif = 'success';
            }
            
            if (judulNotif) {
                await supabase
                    .from('notifikasi')
                    .insert({
                        id_user: data.id_user,
                        judul: judulNotif,
                        pesan: pesanNotif,
                        tipe: tipeNotif,
                        created_at: new Date()
                    });
            }
        }
        
        res.json({ success: true, message: 'Verifikasi berhasil disimpan', data });
    } catch (error) {
        console.error('Error verifying magang luaran:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;