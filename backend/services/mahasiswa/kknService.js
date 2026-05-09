// services/mahasiswa/kknService.js (Disesuaikan)
const supabase = require('../../config/database');
const { deleteFile } = require('../../middleware/upload');

class KKNService {
    constructor() {
        this.tableRegistrasi = 'registrasi_kkn';
        this.tableLuaran = 'luaran_kkn';
        this.tableDesa = 'desa_kkn';
        this.tableUsers = 'users';
        this.tableProgramStudi = 'program_studi';
    }

    /**
     * Mendapatkan dashboard KKN mahasiswa
     */
    async getDashboard(userId) {
        try {
            // Ambil data registrasi
            const { data: registrasi, error: regError } = await supabase
                .from(this.tableRegistrasi)
                .select(`
                    *,
                    desa_kkn (
                        id_desa,
                        nama_desa,
                        kabupaten,
                        kecamatan
                    ),
                    program_studi (
                        nama_prodi
                    )
                `)
                .eq('id_user', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (regError && regError.code !== 'PGRST116') {
                throw regError;
            }

            // Ambil data luaran
            const { data: luaran, error: luarError } = await supabase
                .from(this.tableLuaran)
                .select('*')
                .eq('id_registrasi', registrasi?.id_registrasi)
                .order('created_at', { ascending: false });

            if (luarError && luarError.code !== 'PGRST116') {
                throw luarError;
            }

            return {
                registrasi: registrasi || null,
                luaran: luaran || [],
                status_keseluruhan: this.hitungStatusKeseluruhan(registrasi)
            };
        } catch (error) {
            console.error('Error in getDashboard:', error);
            throw error;
        }
    }

    /**
     * Mendapatkan status KKN
     */
    async getStatus(userId) {
        try {
            const { data: registrasi, error } = await supabase
                .from(this.tableRegistrasi)
                .select('*')
                .eq('id_user', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            // Hitung jumlah luaran
            let jumlahLuaran = 0;
            if (registrasi) {
                const { count } = await supabase
                    .from(this.tableLuaran)
                    .select('*', { count: 'exact', head: true })
                    .eq('id_registrasi', registrasi.id_registrasi);
                jumlahLuaran = count || 0;
            }

            return {
                pendaftaran: {
                    status: registrasi?.status || 'belum_daftar',
                    tanggal: registrasi?.tanggal_daftar || null,
                    desa: registrasi?.desa_kkn?.nama_desa || null
                },
                luaran: {
                    jumlah: jumlahLuaran,
                    status: jumlahLuaran > 0 ? 'sudah_input' : 'belum_input'
                }
            };
        } catch (error) {
            console.error('Error in getStatus:', error);
            throw error;
        }
    }

    /**
     * Mendapatkan daftar desa yang tersedia
     */
    async getAvailableVillages(filters = {}) {
        try {
            let query = supabase
                .from(this.tableDesa)
                .select(`
                    id_desa,
                    nama_desa,
                    kecamatan,
                    kabupaten,
                    provinsi,
                    kuota,
                    kuota_terisi,
                    deskripsi,
                    nama_pembimbing_lapangan,
                    kontak_pembimbing_lapangan
                `)
                .eq('status', 'aktif')
                .lt('kuota_terisi', 'kuota');

            if (filters.search) {
                query = query.or(`nama_desa.ilike.%${filters.search}%,kecamatan.ilike.%${filters.search}%`);
            }

            if (filters.kabupaten) {
                query = query.eq('kabupaten', filters.kabupaten);
            }

            const { data, error } = await query.order('nama_desa');

            if (error) throw error;

            return data.map(desa => ({
                ...desa,
                sisa_kuota: desa.kuota - (desa.kuota_terisi || 0)
            }));
        } catch (error) {
            console.error('Error in getAvailableVillages:', error);
            throw error;
        }
    }

    /**
     * Mendapatkan riwayat pengajuan
     */
    async getRiwayat(userId, { page = 1, limit = 10 }) {
        try {
            const offset = (page - 1) * limit;
            
            // Ambil data registrasi
            const { data: registrasi, error: regError, count: regCount } = await supabase
                .from(this.tableRegistrasi)
                .select(`
                    *,
                    desa_kkn (nama_desa, kabupaten)
                `, { count: 'exact' })
                .eq('id_user', userId)
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (regError) throw regError;

            // Format data
            const formattedData = registrasi.map(item => ({
                id: item.id_registrasi,
                jenis: 'pendaftaran',
                tanggal: item.tanggal_daftar,
                status: item.status,
                judul: `Pendaftaran KKN - ${item.desa_kkn?.nama_desa || '-'}`,
                keterangan: `Semester ${item.angkatan || '-'}, Ukuran: ${item.ukuran_jaket || '-'}`,
                detail: item
            }));

            return {
                data: formattedData,
                total: regCount || 0
            };
        } catch (error) {
            console.error('Error in getRiwayat:', error);
            throw error;
        }
    }

    /**
     * Mendapatkan daftar luaran
     */
    async getLuaran(userId) {
        try {
            // Cari registrasi terlebih dahulu
            const { data: registrasi } = await supabase
                .from(this.tableRegistrasi)
                .select('id_registrasi')
                .eq('id_user', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!registrasi) {
                return [];
            }

            const { data, error } = await supabase
                .from(this.tableLuaran)
                .select('*')
                .eq('id_registrasi', registrasi.id_registrasi)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error in getLuaran:', error);
            throw error;
        }
    }

    /**
     * Mendapatkan detail luaran
     */
    async getLuaranDetail(id, userId) {
        try {
            const { data, error } = await supabase
                .from(this.tableLuaran)
                .select(`
                    *,
                    registrasi_kkn!inner (
                        id_user,
                        desa_kkn (nama_desa, kabupaten)
                    )
                `)
                .eq('id_luaran', id)
                .single();

            if (error) throw error;
            
            // Validasi kepemilikan
            if (data.registrasi_kkn.id_user !== userId) {
                throw new Error('Anda tidak memiliki akses ke luaran ini');
            }

            return data;
        } catch (error) {
            console.error('Error in getLuaranDetail:', error);
            throw error;
        }
    }

    /**
     * Mendapatkan timeline KKN
     */
    async getTimeline(userId) {
        try {
            const timeline = [];

            // Cek registrasi
            const { data: registrasi } = await supabase
                .from(this.tableRegistrasi)
                .select('*')
                .eq('id_user', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (registrasi) {
                timeline.push({
                    id: 1,
                    title: 'Pendaftaran KKN',
                    status: this.mapStatus(registrasi.status),
                    description: this.getRegistrasiDescription(registrasi),
                    date: registrasi.tanggal_daftar,
                    is_completed: ['approved', 'verified'].includes(registrasi.status),
                    is_active: registrasi.status === 'pending'
                });

                // Jika sudah disetujui
                if (registrasi.status === 'approved' || registrasi.status === 'verified') {
                    timeline.push({
                        id: 2,
                        title: 'Pelaksanaan KKN',
                        status: 'active',
                        description: 'KKN sedang berlangsung',
                        date: registrasi.updated_at,
                        is_completed: false,
                        is_active: true
                    });

                    // Cek luaran
                    const { count } = await supabase
                        .from(this.tableLuaran)
                        .select('*', { count: 'exact', head: true })
                        .eq('id_registrasi', registrasi.id_registrasi);

                    if (count > 0) {
                        timeline.push({
                            id: 3,
                            title: 'Input Luaran',
                            status: 'completed',
                            description: `${count} luaran telah diupload`,
                            date: null,
                            is_completed: true,
                            is_active: false
                        });
                    } else {
                        timeline.push({
                            id: 3,
                            title: 'Input Luaran',
                            status: 'pending',
                            description: 'Upload luaran setelah pelaksanaan KKN',
                            date: null,
                            is_completed: false,
                            is_active: false
                        });
                    }
                }
            } else {
                timeline.push({
                    id: 1,
                    title: 'Pendaftaran KKN',
                    status: 'pending',
                    description: 'Belum melakukan pendaftaran KKN',
                    date: null,
                    is_completed: false,
                    is_active: false
                });
            }

            return timeline;
        } catch (error) {
            console.error('Error in getTimeline:', error);
            throw error;
        }
    }

    /**
     * Mendaftar KKN
     */
    async daftarKKN(userId, data) {
        try {
            // Validasi apakah sudah pernah daftar
            const { data: existing } = await supabase
                .from(this.tableRegistrasi)
                .select('id_registrasi')
                .eq('id_user', userId)
                .in('status', ['pending', 'approved', 'verified'])
                .maybeSingle();

            if (existing) {
                throw new Error('Anda sudah memiliki pendaftaran KKN yang aktif');
            }

            // Validasi kuota desa
            const { data: desa } = await supabase
                .from(this.tableDesa)
                .select('kuota, kuota_terisi')
                .eq('id_desa', data.id_desa)
                .single();

            if (!desa) {
                throw new Error('Desa tidak ditemukan');
            }

            if (desa.kuota_terisi >= desa.kuota) {
                throw new Error('Kuota desa sudah penuh');
            }

            // Ambil data user
            const { data: user } = await supabase
                .from(this.tableUsers)
                .select('nama_lengkap, email, nim')
                .eq('id_user', userId)
                .single();

            // Simpan data registrasi
            const registrasiData = {
                id_user: userId,
                id_desa: data.id_desa,
                nim: user.nim,
                nama_lengkap: user.nama_lengkap,
                email: user.email,
                id_prodi: data.id_prodi,
                no_hp: data.no_hp,
                angkatan: data.semester,
                ukuran_jaket: data.ukuran_jaket,
                krs_file: data.krs_file ? data.krs_file.path : null,
                khs_file: data.khs_file ? data.khs_file.path : null,
                payment_file: data.payment_file ? data.payment_file.path : null,
                status: 'pending',
                tanggal_daftar: new Date(),
                created_at: new Date(),
                updated_at: new Date()
            };

            const { data: result, error } = await supabase
                .from(this.tableRegistrasi)
                .insert([registrasiData])
                .select()
                .single();

            if (error) throw error;

            return result;
        } catch (error) {
            console.error('Error in daftarKKN:', error);
            throw error;
        }
    }

    /**
     * Simpan luaran
     */
    async simpanLuaran(userId, data) {
        try {
            // Cari registrasi terbaru
            const { data: registrasi } = await supabase
                .from(this.tableRegistrasi)
                .select('id_registrasi')
                .eq('id_user', userId)
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (!registrasi) {
                throw new Error('Anda harus terdaftar KKN untuk mengupload luaran');
            }

            const luaranData = {
                id_registrasi: registrasi.id_registrasi,
                judul_kegiatan: data.judul_kegiatan,
                link_video: data.link_video,
                file_poster: data.link_poster, // Sesuaikan dengan field di database
                file_mou: data.file_mou ? data.file_mou.path : null,
                status: 'pending',
                tanggal_submit: new Date(),
                created_at: new Date(),
                updated_at: new Date()
            };

            const { data: result, error } = await supabase
                .from(this.tableLuaran)
                .insert([luaranData])
                .select()
                .single();

            if (error) throw error;

            return result;
        } catch (error) {
            console.error('Error in simpanLuaran:', error);
            throw error;
        }
    }

    /**
     * Update luaran
     */
    async updateLuaran(id, userId, data) {
        try {
            // Validasi kepemilikan
            const { data: existing } = await supabase
                .from(this.tableLuaran)
                .select(`
                    *,
                    registrasi_kkn!inner (id_user)
                `)
                .eq('id_luaran', id)
                .single();

            if (!existing) {
                throw new Error('Luaran tidak ditemukan');
            }

            if (existing.registrasi_kkn.id_user !== userId) {
                throw new Error('Anda tidak memiliki akses ke luaran ini');
            }

            if (existing.status !== 'pending') {
                throw new Error('Luaran tidak dapat diupdate karena sudah diproses');
            }

            // Hapus file lama jika ada file baru
            if (data.file_mou && existing.file_mou) {
                await deleteFile(existing.file_mou);
            }

            const updateData = {
                judul_kegiatan: data.judul_kegiatan,
                link_video: data.link_video,
                file_poster: data.link_poster,
                keterangan: data.keterangan,
                updated_at: new Date()
            };

            if (data.file_mou) {
                updateData.file_mou = data.file_mou.path;
            }

            const { data: result, error } = await supabase
                .from(this.tableLuaran)
                .update(updateData)
                .eq('id_luaran', id)
                .select()
                .single();

            if (error) throw error;

            return result;
        } catch (error) {
            console.error('Error in updateLuaran:', error);
            throw error;
        }
    }

    /**
     * Hapus luaran
     */
    async hapusLuaran(id, userId) {
        try {
            // Validasi kepemilikan
            const { data: existing } = await supabase
                .from(this.tableLuaran)
                .select(`
                    *,
                    registrasi_kkn!inner (id_user)
                `)
                .eq('id_luaran', id)
                .single();

            if (!existing) {
                throw new Error('Luaran tidak ditemukan');
            }

            if (existing.registrasi_kkn.id_user !== userId) {
                throw new Error('Anda tidak memiliki akses ke luaran ini');
            }

            if (existing.status !== 'pending') {
                throw new Error('Hanya luaran dengan status pending yang dapat dihapus');
            }

            // Hapus file
            if (existing.file_mou) {
                await deleteFile(existing.file_mou);
            }

            const { error } = await supabase
                .from(this.tableLuaran)
                .delete()
                .eq('id_luaran', id);

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error in hapusLuaran:', error);
            throw error;
        }
    }

    // ==================== HELPER METHODS ====================

    mapStatus(status) {
        const statusMap = {
            'pending': 'pending',
            'approved': 'approved',
            'rejected': 'rejected',
            'verified': 'verified'
        };
        return statusMap[status] || 'pending';
    }

    hitungStatusKeseluruhan(registrasi) {
        if (!registrasi) {
            return { status: 'pending', text: 'Belum Daftar' };
        }

        if (registrasi.status === 'pending') {
            return { status: 'pending', text: 'Menunggu Verifikasi' };
        }

        if (registrasi.status === 'approved') {
            return { status: 'active', text: 'Aktif' };
        }

        if (registrasi.status === 'verified') {
            return { status: 'completed', text: 'Selesai' };
        }

        return { status: 'pending', text: 'Dalam Proses' };
    }

    getRegistrasiDescription(registrasi) {
        if (!registrasi) return 'Belum melakukan pendaftaran KKN';
        
        switch (registrasi.status) {
            case 'pending':
                return 'Pendaftaran sedang dalam proses verifikasi';
            case 'approved':
                return 'Pendaftaran telah disetujui';
            case 'verified':
                return 'Pendaftaran telah diverifikasi';
            case 'rejected':
                return 'Pendaftaran ditolak';
            default:
                return `Status: ${registrasi.status}`;
        }
    }
}

module.exports = new KKNService();