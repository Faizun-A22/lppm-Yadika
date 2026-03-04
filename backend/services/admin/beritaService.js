const supabase = require('../../config/database');
const path = require('path');
const fs = require('fs');

class BeritaService {
    // Get all berita with pagination and filters
    async getAllBerita(filters, pagination) {
        const { search, kategori, status, sortBy = 'created_at', sortOrder = 'desc' } = filters;
        const { page = 1, limit = 10 } = pagination;

        const offset = (page - 1) * limit;

        // Build base query
        let query = supabase
            .from('berita')
            .select(`
                *,
                admin:users!berita_id_admin_fkey (
                    id_user,
                    nama_lengkap,
                    email,
                    foto_profil
                )
            `, { count: 'exact' });

        // Apply filters
        if (search) {
            query = query.ilike('judul', `%${search}%`);
        }

        if (kategori) {
            query = query.eq('kategori', kategori);
        }

        if (status) {
            query = query.eq('status', status);
        }

        // Apply sorting
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });

        // Apply pagination
        query = query.range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        return {
            data: data || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        };
    }

    // Get berita by ID
async getBeritaById(id) {
    // Increment views - cara yang benar tanpa raw()
    // Pertama, ambil views saat ini
    const { data: currentData, error: fetchError } = await supabase
        .from('berita')
        .select('views')
        .eq('id_berita', id)
        .single();

    if (fetchError) throw fetchError;
    if (!currentData) throw new Error('Berita tidak ditemukan');

    // Update views dengan nilai baru
    const newViews = (currentData.views || 0) + 1;
    const { error: updateError } = await supabase
        .from('berita')
        .update({ views: newViews })
        .eq('id_berita', id);

    if (updateError) throw updateError;

    // Get berita data lengkap
    const { data, error } = await supabase
        .from('berita')
        .select(`
            *,
            admin:users!berita_id_admin_fkey (
                id_user,
                nama_lengkap,
                email,
                foto_profil
            )
        `)
        .eq('id_berita', id)
        .single();

    if (error) throw error;
    if (!data) throw new Error('Berita tidak ditemukan');

    return data;
}

    // Create new berita
    async createBerita(beritaData, file, adminId) {
        const { judul, kategori, konten, status = 'draft' } = beritaData;

        let gambar_thumbnail = null;
        if (file) {
            gambar_thumbnail = file.filename;
        }

        // Set tanggal publish if status is publish
        let tanggal_publish = null;
        if (status === 'publish') {
            tanggal_publish = new Date().toISOString();
        }

        const { data, error } = await supabase
            .from('berita')
            .insert([{
                judul,
                isi_berita: konten,
                kategori,
                gambar_thumbnail,
                id_admin: adminId,
                status,
                tanggal_publish,
                views: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            // Delete uploaded file if database error
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
                aktivitas: `Membuat berita baru: ${data.judul}`,
                waktu: new Date().toISOString()
            }]);

        return data;
    }

    // Update berita
    async updateBerita(id, beritaData, file, adminId) {
        const { judul, kategori, konten, status } = beritaData;

        // Check if berita exists
        const { data: existingBerita, error: checkError } = await supabase
            .from('berita')
            .select('*')
            .eq('id_berita', id)
            .single();

        if (checkError || !existingBerita) {
            if (file) {
                this.deleteFile(file.path);
            }
            throw new Error('Berita tidak ditemukan');
        }

        // Handle thumbnail
        let gambar_thumbnail = existingBerita.gambar_thumbnail;
        if (file) {
            // Delete old thumbnail
            if (existingBerita.gambar_thumbnail) {
                this.deleteFile(path.join('uploads/berita', existingBerita.gambar_thumbnail));
            }
            gambar_thumbnail = file.filename;
        }

        // Set publish date if status changes to publish
        let tanggal_publish = existingBerita.tanggal_publish;
        if (status === 'publish' && existingBerita.status !== 'publish') {
            tanggal_publish = new Date().toISOString();
        }

        // Update database
        const { data, error } = await supabase
            .from('berita')
            .update({
                judul,
                isi_berita: konten,
                kategori,
                gambar_thumbnail,
                status,
                tanggal_publish,
                updated_at: new Date().toISOString()
            })
            .eq('id_berita', id)
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
                aktivitas: `Mengupdate berita: ${data.judul}`,
                waktu: new Date().toISOString()
            }]);

        return data;
    }

    // Delete berita
    async deleteBerita(id, adminId) {
        // Get berita data
        const { data: berita, error: checkError } = await supabase
            .from('berita')
            .select('*')
            .eq('id_berita', id)
            .single();

        if (checkError || !berita) {
            throw new Error('Berita tidak ditemukan');
        }

        // Delete thumbnail if exists
        if (berita.gambar_thumbnail) {
            this.deleteFile(path.join('uploads/berita', berita.gambar_thumbnail));
        }

        // Delete from database
        const { error } = await supabase
            .from('berita')
            .delete()
            .eq('id_berita', id);

        if (error) throw error;

        // Log activity
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: adminId,
                aktivitas: `Menghapus berita: ${berita.judul}`,
                waktu: new Date().toISOString()
            }]);

        return berita;
    }

    // Get berita statistics
    async getBeritaStats() {
        // Get total by status using separate queries (fix for Supabase group issue)
        const { data: statusData, error: statusError } = await supabase
            .from('berita')
            .select('status');

        if (statusError) throw statusError;

        // Calculate counts manually
        const byStatus = {};
        statusData.forEach(item => {
            byStatus[item.status] = (byStatus[item.status] || 0) + 1;
        });

        // Format for response
        const byStatusArray = Object.keys(byStatus).map(status => ({
            status,
            count: byStatus[status]
        }));

        // Get total views
        const { data: viewsData, error: viewsError } = await supabase
            .from('berita')
            .select('views');

        if (viewsError) throw viewsError;

        const totalViews = viewsData.reduce((sum, item) => sum + (item.views || 0), 0);

        // Get by kategori using separate queries
        const { data: kategoriData, error: kategoriError } = await supabase
            .from('berita')
            .select('kategori');

        if (kategoriError) throw kategoriError;

        const byKategori = {};
        kategoriData.forEach(item => {
            if (item.kategori) {
                byKategori[item.kategori] = (byKategori[item.kategori] || 0) + 1;
            }
        });

        const byKategoriArray = Object.keys(byKategori).map(kategori => ({
            kategori,
            count: byKategori[kategori]
        }));

        // Get recent berita
        const { data: recent, error: recentError } = await supabase
            .from('berita')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recentError) throw recentError;

        // Get popular berita
        const { data: popular, error: popularError } = await supabase
            .from('berita')
            .select('*')
            .order('views', { ascending: false })
            .limit(5);

        if (popularError) throw popularError;

        return {
            total: statusData.length,
            by_status: byStatusArray,
            by_kategori: byKategoriArray,
            total_views: totalViews,
            recent: recent || [],
            popular: popular || []
        };
    }

    // Bulk delete berita
    async bulkDeleteBerita(ids, adminId) {
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            throw new Error('Tidak ada berita yang dipilih');
        }

        // Get berita data for thumbnails
        const { data: beritas, error: fetchError } = await supabase
            .from('berita')
            .select('id_berita, judul, gambar_thumbnail')
            .in('id_berita', ids);

        if (fetchError) throw fetchError;

        // Delete thumbnails
        for (const berita of beritas) {
            if (berita.gambar_thumbnail) {
                this.deleteFile(path.join('uploads/berita', berita.gambar_thumbnail));
            }
        }

        // Delete from database
        const { error } = await supabase
            .from('berita')
            .delete()
            .in('id_berita', ids);

        if (error) throw error;

        // Log activity
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: adminId,
                aktivitas: `Menghapus ${beritas.length} berita secara bulk`,
                waktu: new Date().toISOString()
            }]);

        return beritas.length;
    }

    // Update status berita
    async updateStatusBerita(id, status, adminId) {
        if (!['draft', 'publish', 'archived'].includes(status)) {
            throw new Error('Status tidak valid');
        }

        // Check if berita exists
        const { data: existingBerita, error: checkError } = await supabase
            .from('berita')
            .select('*')
            .eq('id_berita', id)
            .single();

        if (checkError || !existingBerita) {
            throw new Error('Berita tidak ditemukan');
        }

        // Set publish date if status changes to publish
        let tanggal_publish = existingBerita.tanggal_publish;
        if (status === 'publish' && existingBerita.status !== 'publish') {
            tanggal_publish = new Date().toISOString();
        }

        // Update status
        const { data, error } = await supabase
            .from('berita')
            .update({
                status,
                tanggal_publish,
                updated_at: new Date().toISOString()
            })
            .eq('id_berita', id)
            .select()
            .single();

        if (error) throw error;

        // Log activity
        await supabase
            .from('log_aktivitas')
            .insert([{
                id_user: adminId,
                aktivitas: `Mengupdate status berita: ${data.judul} menjadi ${status}`,
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

module.exports = new BeritaService();