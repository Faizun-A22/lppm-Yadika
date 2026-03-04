const supabase = require('../../config/database');
const path = require('path');
const fs = require('fs');

class KegiatanService {
    // Helper to determine status based on dates
    determineKegiatanStatus(tanggal_mulai, tanggal_selesai) {
        const now = new Date();
        const start = new Date(tanggal_mulai);
        const end = new Date(tanggal_selesai);

        if (now < start) return 'upcoming';
        if (now >= start && now <= end) return 'ongoing';
        if (now > end) return 'completed';
        return 'upcoming';
    }

    // Get all kegiatan with pagination and filters
    async getAllKegiatan(filters, pagination) {
        const { search, jenis, status, bulan, sortBy = 'created_at', sortOrder = 'desc' } = filters;
        const { page = 1, limit = 10 } = pagination;

        const offset = (page - 1) * limit;

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

        // Apply filters
        if (search) {
            query = query.ilike('nama_kegiatan', `%${search}%`);
        }

        if (jenis) {
            query = query.eq('jenis_kegiatan', jenis);
        }

        if (status) {
            query = query.eq('status_kegiatan', status);
        }

        if (bulan) {
            const [year, month] = bulan.split('-');
            const startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, parseInt(month), 0).getDate();
            const endDate = `${year}-${month}-${lastDay}`;
            
            query = query
                .gte('tanggal_mulai', startDate)
                .lte('tanggal_mulai', endDate);
        }

        // Apply sorting
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        // Auto-update status based on dates
        const now = new Date().toISOString();
        const formattedData = await Promise.all((data || []).map(async item => {
            let status_kegiatan = item.status_kegiatan;
            if (item.status_kegiatan !== 'cancelled') {
                const calculatedStatus = this.determineKegiatanStatus(item.tanggal_mulai, item.tanggal_selesai);
                if (calculatedStatus !== item.status_kegiatan) {
                    await supabase
                        .from('kegiatan')
                        .update({ status_kegiatan: calculatedStatus })
                        .eq('id_kegiatan', item.id_kegiatan);
                    status_kegiatan = calculatedStatus;
                }
            }

            return {
                ...item,
                status_kegiatan,
                sisa_kapasitas: (item.kapasitas || 0) - (item.pendaftar || 0),
                is_pendaftaran_dibuka: status_kegiatan === 'upcoming' && 
                                      (item.pendaftar || 0) < (item.kapasitas || 0)
            };
        }));

        return {
            data: formattedData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        };
    }

    // Get kegiatan by ID
    async getKegiatanById(id) {
        const { data, error } = await supabase
            .from('kegiatan')
            .select(`
                *,
                admin:users!kegiatan_id_admin_fkey (
                    id_user,
                    nama_lengkap,
                    email,
                    foto_profil
                ),
                pendaftar_kegiatan (
                    id_pendaftaran,
                    id_user,
                    status_pendaftaran,
                    tanggal_daftar,
                    user:users (
                        id_user,
                        nama_lengkap,
                        email,
                        nim,
                        nidn,
                        no_hp
                    )
                )
            `)
            .eq('id_kegiatan', id)
            .single();

        if (error) throw error;
        if (!data) throw new Error('Kegiatan tidak ditemukan');

        // Auto-update status
        let status_kegiatan = data.status_kegiatan;
        if (data.status_kegiatan !== 'cancelled') {
            const calculatedStatus = this.determineKegiatanStatus(data.tanggal_mulai, data.tanggal_selesai);
            if (calculatedStatus !== data.status_kegiatan) {
                await supabase
                    .from('kegiatan')
                    .update({ status_kegiatan: calculatedStatus })
                    .eq('id_kegiatan', id);
                status_kegiatan = calculatedStatus;
            }
        }

        return {
            ...data,
            status_kegiatan,
            sisa_kapasitas: (data.kapasitas || 0) - (data.pendaftar || 0),
            is_pendaftaran_dibuka: status_kegiatan === 'upcoming' && 
                                  (data.pendaftar || 0) < (data.kapasitas || 0),
            total_pendaftar: data.pendaftar_kegiatan?.length || 0,
            pendaftar_terkonfirmasi: data.pendaftar_kegiatan?.filter(p => p.status_pendaftaran === 'terkonfirmasi').length || 0,
            pendaftar_menunggu: data.pendaftar_kegiatan?.filter(p => p.status_pendaftaran === 'menunggu').length || 0
        };
    }

    // Create new kegiatan
    async createKegiatan(kegiatanData, file, adminId) {
        const {
            nama_kegiatan,
            jenis_kegiatan,
            tanggal_mulai,
            tanggal_selesai,
            lokasi,
            kapasitas,
            narasumber,
            deskripsi,
            link_pendaftaran
        } = kegiatanData;

        // Handle poster
        let poster = null;
        if (file) {
            poster = file.filename;
        }

        // Determine initial status
        const status_kegiatan = this.determineKegiatanStatus(tanggal_mulai, tanggal_selesai);

        // Insert to database
        const { data, error } = await supabase
            .from('kegiatan')
            .insert([{
                nama_kegiatan,
                jenis_kegiatan,
                tanggal_mulai,
                tanggal_selesai,
                lokasi,
                kapasitas: parseInt(kapasitas) || 0,
                pendaftar: 0,
                narasumber,
                deskripsi,
                poster,
                link_pendaftaran,
                status_kegiatan,
                id_admin: adminId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            if (file) {
                this.deleteFile(file.path);
            }
            throw error;
        }

        // Log activity
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: adminId,
                aktivitas: `Membuat kegiatan baru: ${data.nama_kegiatan}`,
                waktu: new Date().toISOString()
            }]);

        return data;
    }

    // Update kegiatan
    async updateKegiatan(id, kegiatanData, file, adminId) {
        const {
            nama_kegiatan,
            jenis_kegiatan,
            tanggal_mulai,
            tanggal_selesai,
            lokasi,
            kapasitas,
            narasumber,
            deskripsi,
            link_pendaftaran,
            status_kegiatan
        } = kegiatanData;

        // Check if kegiatan exists
        const { data: existingKegiatan, error: checkError } = await supabase
            .from('kegiatan')
            .select('*')
            .eq('id_kegiatan', id)
            .single();

        if (checkError || !existingKegiatan) {
            if (file) {
                this.deleteFile(file.path);
            }
            throw new Error('Kegiatan tidak ditemukan');
        }

        // Handle poster
        let poster = existingKegiatan.poster;
        if (file) {
            if (existingKegiatan.poster) {
                this.deleteFile(path.join('uploads/kegiatan', existingKegiatan.poster));
            }
            poster = file.filename;
        }

        // Determine final status
        let finalStatus = status_kegiatan;
        if (!status_kegiatan || status_kegiatan === 'auto') {
            finalStatus = this.determineKegiatanStatus(tanggal_mulai, tanggal_selesai);
        }

        // Update database
        const { data, error } = await supabase
            .from('kegiatan')
            .update({
                nama_kegiatan,
                jenis_kegiatan,
                tanggal_mulai,
                tanggal_selesai,
                lokasi,
                kapasitas: parseInt(kapasitas) || existingKegiatan.kapasitas,
                narasumber,
                deskripsi,
                poster,
                link_pendaftaran,
                status_kegiatan: finalStatus,
                updated_at: new Date().toISOString()
            })
            .eq('id_kegiatan', id)
            .select()
            .single();

        if (error) {
            if (file) {
                this.deleteFile(file.path);
            }
            throw error;
        }

        // Log activity
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: adminId,
                aktivitas: `Mengupdate kegiatan: ${data.nama_kegiatan}`,
                waktu: new Date().toISOString()
            }]);

        return data;
    }

    // Delete kegiatan
    async deleteKegiatan(id, adminId) {
        // Check if kegiatan exists
        const { data: kegiatan, error: checkError } = await supabase
            .from('kegiatan')
            .select('*')
            .eq('id_kegiatan', id)
            .single();

        if (checkError || !kegiatan) {
            throw new Error('Kegiatan tidak ditemukan');
        }

        // Delete poster if exists
        if (kegiatan.poster) {
            this.deleteFile(path.join('uploads/kegiatan', kegiatan.poster));
        }

        // Delete related pendaftar
        await supabase
            .from('pendaftar_kegiatan')
            .delete()
            .eq('id_kegiatan', id);

        // Delete from database
        const { error } = await supabase
            .from('kegiatan')
            .delete()
            .eq('id_kegiatan', id);

        if (error) throw error;

        // Log activity
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: adminId,
                aktivitas: `Menghapus kegiatan: ${kegiatan.nama_kegiatan}`,
                waktu: new Date().toISOString()
            }]);

        return kegiatan;
    }

    // Get kegiatan statistics
    async getKegiatanStats() {
        // Get by status using separate queries (fix for Supabase group issue)
        const { data: statusData, error: statusError } = await supabase
            .from('kegiatan')
            .select('status_kegiatan');

        if (statusError) throw statusError;

        const byStatus = {};
        statusData.forEach(item => {
            byStatus[item.status_kegiatan] = (byStatus[item.status_kegiatan] || 0) + 1;
        });

        const byStatusArray = Object.keys(byStatus).map(status => ({
            status_kegiatan: status,
            count: byStatus[status]
        }));

        // Get by jenis using separate queries
        const { data: jenisData, error: jenisError } = await supabase
            .from('kegiatan')
            .select('jenis_kegiatan');

        if (jenisError) throw jenisError;

        const byJenis = {};
        jenisData.forEach(item => {
            if (item.jenis_kegiatan) {
                byJenis[item.jenis_kegiatan] = (byJenis[item.jenis_kegiatan] || 0) + 1;
            }
        });

        const byJenisArray = Object.keys(byJenis).map(jenis => ({
            jenis_kegiatan: jenis,
            count: byJenis[jenis]
        }));

        // Get total pendaftar
        const { count: totalPendaftar, error: pendaftarError } = await supabase
            .from('pendaftar_kegiatan')
            .select('*', { count: 'exact', head: true });

        if (pendaftarError) throw pendaftarError;

        // Get upcoming kegiatan (next 7 days)
        const now = new Date();
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const { data: upcoming, error: upcomingError } = await supabase
            .from('kegiatan')
            .select('*')
            .gte('tanggal_mulai', now.toISOString())
            .lte('tanggal_mulai', nextWeek.toISOString())
            .eq('status_kegiatan', 'upcoming')
            .order('tanggal_mulai', { ascending: true });

        if (upcomingError) throw upcomingError;

        // Get total kapasitas dan pendaftar
        const { data: kapasitasData, error: kapasitasError } = await supabase
            .from('kegiatan')
            .select('kapasitas, pendaftar');

        if (kapasitasError) throw kapasitasError;

        const totalKapasitas = kapasitasData.reduce((sum, item) => sum + (item.kapasitas || 0), 0);
        const totalPendaftarSemua = kapasitasData.reduce((sum, item) => sum + (item.pendaftar || 0), 0);

        return {
            total_kegiatan: kapasitasData.length,
            by_status: byStatusArray,
            by_jenis: byJenisArray,
            total_pendaftar: totalPendaftar || 0,
            upcoming_7_days: upcoming?.length || 0,
            upcoming_kegiatan: upcoming || [],
            total_kapasitas: totalKapasitas,
            total_pendaftar_semua: totalPendaftarSemua,
            persentase_pendaftar: totalKapasitas > 0 
                ? Math.round((totalPendaftarSemua / totalKapasitas) * 100) 
                : 0
        };
    }

    // Get calendar data
    async getCalendarData(month, year) {
        let startDate, endDate;
        
        if (month && year) {
            startDate = `${year}-${month.padStart(2, '0')}-01`;
            const lastDay = new Date(year, parseInt(month), 0).getDate();
            endDate = `${year}-${month.padStart(2, '0')}-${lastDay}`;
        } else {
            // Default to current month
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
            startDate = `${currentYear}-${currentMonth}-01`;
            const lastDay = new Date(currentYear, parseInt(currentMonth), 0).getDate();
            endDate = `${currentYear}-${currentMonth}-${lastDay}`;
            month = currentMonth;
            year = currentYear.toString();
        }

        // Get all kegiatan in the month
        const { data: kegiatan, error } = await supabase
            .from('kegiatan')
            .select(`
                id_kegiatan,
                nama_kegiatan,
                jenis_kegiatan,
                tanggal_mulai,
                tanggal_selesai,
                lokasi,
                status_kegiatan
            `)
            .gte('tanggal_mulai', startDate)
            .lte('tanggal_mulai', endDate)
            .order('tanggal_mulai', { ascending: true });

        if (error) throw error;

        // Group by date
        const calendarData = {};
        (kegiatan || []).forEach(item => {
            const date = item.tanggal_mulai.split('T')[0];
            if (!calendarData[date]) {
                calendarData[date] = [];
            }
            calendarData[date].push({
                id: item.id_kegiatan,
                nama: item.nama_kegiatan,
                jenis: item.jenis_kegiatan,
                waktu: new Date(item.tanggal_mulai).toLocaleTimeString('id-ID', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }),
                lokasi: item.lokasi,
                status: item.status_kegiatan
            });
        });

        return {
            month,
            year,
            calendar: calendarData
        };
    }

    // Update kegiatan status
    async updateKegiatanStatus(id, status, adminId) {
        if (!['upcoming', 'ongoing', 'completed', 'cancelled'].includes(status)) {
            throw new Error('Status tidak valid');
        }

        // Check if kegiatan exists
        const { data: existingKegiatan, error: checkError } = await supabase
            .from('kegiatan')
            .select('*')
            .eq('id_kegiatan', id)
            .single();

        if (checkError || !existingKegiatan) {
            throw new Error('Kegiatan tidak ditemukan');
        }

        // Update status
        const { data, error } = await supabase
            .from('kegiatan')
            .update({
                status_kegiatan: status,
                updated_at: new Date().toISOString()
            })
            .eq('id_kegiatan', id)
            .select()
            .single();

        if (error) throw error;

        // Log activity
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: adminId,
                aktivitas: `Mengupdate status kegiatan: ${data.nama_kegiatan} menjadi ${status}`,
                waktu: new Date().toISOString()
            }]);

        return data;
    }

    // Helper to delete file
    deleteFile(filePath) {
        const fullPath = path.join(__dirname, '../../', filePath);
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
        }
    }
}

module.exports = new KegiatanService();