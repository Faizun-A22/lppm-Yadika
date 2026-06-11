// services/admin/penelitianService.js
const supabase = require('../../config/database');
const { deleteFile } = require('../../middleware/upload');

class PenelitianService {
    
    // ==================== PENELITIAN ====================
    
    async getAllPenelitian({ page = 1, limit = 10, status, tahun, skema, search, userId = null }) {
        try {
            const offset = (page - 1) * limit;
            
            let query = supabase
                .from('penelitian')
                .select(`
                    *,
                    ketua:ketua_peneliti(id_user, nama_lengkap, nidn, email, foto_profil),
                    anggota_penelitian(
                        id_anggota,
                        user:users(id_user, nama_lengkap, nidn, email, foto_profil),
                        peran
                    )
                `, { count: 'exact' });
            
            // Filter by user if dosen
            if (userId) {
                query = query.or(`ketua_peneliti.eq.${userId},anggota_penelitian.id_user.eq.${userId}`);
            }
            
            // Apply filters
            if (status) {
                query = query.eq('status', status);
            }
            
            if (tahun) {
                query = query.eq('tahun', tahun);
            }
            
            if (skema) {
                query = query.eq('skema_penelitian', skema);
            }
            
            if (search) {
                const { data: users } = await supabase
                    .from('users')
                    .select('id_user')
                    .ilike('nama_lengkap', `%${search}%`);
                
                const userIds = users?.map(u => u.id_user) || [];
                
                if (userIds.length > 0) {
                    query = query.or(`judul.ilike.%${search}%,ketua_peneliti.in.(${userIds.join(',')})`);
                } else {
                    query = query.ilike('judul', `%${search}%`);
                }
            }
            
            // Apply pagination
            query = query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            
            const { data, error, count } = await query;
            
            if (error) throw error;
            
            return {
                data: data || [],
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            };
        } catch (error) {
            console.error('Error in getAllPenelitian:', error);
            throw error;
        }
    }
    
    async getPenelitianById(id, userId = null) {
        try {
            let query = supabase
                .from('penelitian')
                .select(`
                    *,
                    ketua:ketua_peneliti(id_user, nama_lengkap, nidn, email, foto_profil, no_hp),
                    anggota_penelitian(
                        id_anggota,
                        user:users(id_user, nama_lengkap, nidn, email, foto_profil, no_hp),
                        peran
                    ),
                    review_penelitian(
                        id_review,
                        reviewer:users(id_user, nama_lengkap, role),
                        catatan,
                        rekomendasi,
                        tipe_review,
                        file_review,
                        tanggal_review
                    )
                `)
                .eq('id_penelitian', id)
                .single();
            
            const { data, error } = await query;
            
            if (error) throw error;
            if (!data) throw new Error('Penelitian tidak ditemukan');
            
            // Check access if dosen
            if (userId) {
                const isKetua = data.ketua_peneliti === userId;
                const isAnggota = data.anggota_penelitian?.some(a => a.id_user === userId);
                
                if (!isKetua && !isAnggota && data.status !== 'published') {
                    throw new Error('Anda tidak memiliki akses ke penelitian ini');
                }
            }
            
            return data;
        } catch (error) {
            console.error('Error in getPenelitianById:', error);
            throw error;
        }
    }
    
    async createPenelitian(data) {
        try {
            console.log('Creating penelitian with data:', data);
            
            // Start transaction
            const { data: penelitian, error: penelitianError } = await supabase
                .from('penelitian')
                .insert([{
                    judul: data.judul,
                    skema_penelitian: data.skema_penelitian,
                    sumber_dana: data.sumber_dana,
                    dana_diajukan: data.dana_diajukan,
                    dana_disetujui: data.dana_disetujui || null,
                    tahun: data.tahun,
                    ketua_peneliti: data.id_ketua,
                    file_proposal: data.file_proposal,
                    file_laporan_kemajuan: data.file_laporan_kemajuan,
                    file_laporan_akhir: data.file_laporan_akhir,
                    status: 'draft',
                    created_by: data.created_by
                }])
                .select()
                .single();
            
            if (penelitianError) {
                console.error('Error creating penelitian:', penelitianError);
                throw penelitianError;
            }
            
            console.log('Penelitian created:', penelitian.id_penelitian);
            
            // Insert anggota if any
            if (data.anggota && data.anggota.length > 0) {
                console.log('Inserting anggota:', data.anggota.length);
                
                const anggotaData = data.anggota.map(anggota => ({
                    id_penelitian: penelitian.id_penelitian,
                    id_user: anggota.id_user,
                    peran: anggota.peran || 'anggota'
                }));
                
                const { error: anggotaError } = await supabase
                    .from('anggota_penelitian')
                    .insert(anggotaData);
                
                if (anggotaError) {
                    console.error('Error inserting anggota:', anggotaError);
                    throw anggotaError;
                }
            }
            
            // Create notification for admin
            await this.createNotification({
                id_user: null, // untuk semua admin
                judul: 'Penelitian Baru',
                pesan: `Penelitian baru "${data.judul}" telah dibuat dan perlu direview`,
                tipe: 'info',
                link: `/admin/penelitian/${penelitian.id_penelitian}`
            });
            
            return await this.getPenelitianById(penelitian.id_penelitian);
        } catch (error) {
            // Rollback - delete uploaded files
            if (data.file_proposal) await deleteFile(data.file_proposal);
            if (data.file_laporan_kemajuan) await deleteFile(data.file_laporan_kemajuan);
            if (data.file_laporan_akhir) await deleteFile(data.file_laporan_akhir);
            
            console.error('Error in createPenelitian:', error);
            throw error;
        }
    }
    
    async updatePenelitian(id, data, userId) {
        try {
            console.log('Updating penelitian:', id);
            
            const isAdmin = (typeof userId === 'object' && userId !== null) ? userId.role === 'admin' : false;
            const uid = (typeof userId === 'object' && userId !== null) ? userId.id_user : userId;
            
            // Check if exists and user has access
            const existing = await this.getPenelitianById(id);
            
            if (!isAdmin && existing.ketua_peneliti !== uid) {
                throw new Error('Hanya ketua peneliti yang dapat mengupdate penelitian ini');
            }
            
            if (!isAdmin && !['draft', 'revision'].includes(existing.status)) {
                throw new Error('Penelitian tidak dapat diupdate karena sudah dalam proses review');
            }
            
            // Get old files for cleanup
            const oldFiles = {
                file_proposal: existing.file_proposal,
                file_laporan_kemajuan: existing.file_laporan_kemajuan,
                file_laporan_akhir: existing.file_laporan_akhir
            };
            
            // Update penelitian
            const updateData = {
                judul: data.judul,
                skema_penelitian: data.skema_penelitian,
                sumber_dana: data.sumber_dana,
                dana_diajukan: data.dana_diajukan,
                dana_disetujui: data.dana_disetujui,
                tahun: data.tahun,
                updated_at: new Date(),
                updated_by: uid
            };
            
            // Update files if new ones uploaded
            if (data.file_proposal) updateData.file_proposal = data.file_proposal;
            if (data.file_laporan_kemajuan) updateData.file_laporan_kemajuan = data.file_laporan_kemajuan;
            if (data.file_laporan_akhir) updateData.file_laporan_akhir = data.file_laporan_akhir;
            
            const { error: updateError } = await supabase
                .from('penelitian')
                .update(updateData)
                .eq('id_penelitian', id);
            
            if (updateError) {
                console.error('Error updating penelitian:', updateError);
                throw updateError;
            }
            
            // Delete old files if replaced
            if (data.file_proposal && oldFiles.file_proposal) {
                await deleteFile(oldFiles.file_proposal);
            }
            if (data.file_laporan_kemajuan && oldFiles.file_laporan_kemajuan) {
                await deleteFile(oldFiles.file_laporan_kemajuan);
            }
            if (data.file_laporan_akhir && oldFiles.file_laporan_akhir) {
                await deleteFile(oldFiles.file_laporan_akhir);
            }
            
            // Update anggota if provided
            if (data.anggota) {
                console.log('Updating anggota...');
                
                // Delete existing anggota
                await supabase
                    .from('anggota_penelitian')
                    .delete()
                    .eq('id_penelitian', id);
                
                // Insert new anggota
                if (data.anggota.length > 0) {
                    const anggotaData = data.anggota.map(anggota => ({
                        id_penelitian: id,
                        id_user: anggota.id_user,
                        peran: anggota.peran || 'anggota'
                    }));
                    
                    const { error: anggotaError } = await supabase
                        .from('anggota_penelitian')
                        .insert(anggotaData);
                    
                    if (anggotaError) {
                        console.error('Error updating anggota:', anggotaError);
                        throw anggotaError;
                    }
                }
            }
            
            return await this.getPenelitianById(id);
        } catch (error) {
            // Cleanup new files if error
            if (data.file_proposal) await deleteFile(data.file_proposal);
            if (data.file_laporan_kemajuan) await deleteFile(data.file_laporan_kemajuan);
            if (data.file_laporan_akhir) await deleteFile(data.file_laporan_akhir);
            
            console.error('Error in updatePenelitian:', error);
            throw error;
        }
    }
    
    async deletePenelitian(id, userId) {
        try {
            console.log('Deleting penelitian:', id);
            
            const isAdmin = (typeof userId === 'object' && userId !== null) ? userId.role === 'admin' : false;
            const uid = (typeof userId === 'object' && userId !== null) ? userId.id_user : userId;
            
            // Check if exists and user has access
            const existing = await this.getPenelitianById(id);
            
            if (!isAdmin && existing.ketua_peneliti !== uid) {
                throw new Error('Hanya ketua peneliti yang dapat menghapus penelitian ini');
            }
            
            if (!isAdmin && !['draft', 'rejected'].includes(existing.status)) {
                throw new Error('Penelitian tidak dapat dihapus karena sudah dalam proses');
            }
            
            // Delete files
            if (existing.file_proposal) await deleteFile(existing.file_proposal);
            if (existing.file_laporan_kemajuan) await deleteFile(existing.file_laporan_kemajuan);
            if (existing.file_laporan_akhir) await deleteFile(existing.file_laporan_akhir);
            
            // Delete from database (cascade will handle anggota and reviews)
            const { error } = await supabase
                .from('penelitian')
                .delete()
                .eq('id_penelitian', id);
            
            if (error) {
                console.error('Error deleting penelitian:', error);
                throw error;
            }
            
            return true;
        } catch (error) {
            console.error('Error in deletePenelitian:', error);
            throw error;
        }
    }
    
    async submitPenelitian(id, userId) {
        try {
            console.log('Submitting penelitian:', id);
            
            const isAdmin = (typeof userId === 'object' && userId !== null) ? userId.role === 'admin' : false;
            const uid = (typeof userId === 'object' && userId !== null) ? userId.id_user : userId;
            
            // Check if exists and user has access
            const existing = await this.getPenelitianById(id);
            
            if (!isAdmin && existing.ketua_peneliti !== uid) {
                throw new Error('Hanya ketua peneliti yang dapat mensubmit penelitian');
            }
            
            if (!isAdmin && existing.status !== 'draft' && existing.status !== 'revision') {
                throw new Error('Penelitian sudah pernah disubmit');
            }
            
            // Validate required files
            if (!existing.file_proposal) {
                throw new Error('File proposal wajib diupload sebelum submit');
            }
            
            // Update status
            const { error } = await supabase
                .from('penelitian')
                .update({
                    status: 'submitted',
                    tanggal_pengajuan: new Date()
                })
                .eq('id_penelitian', id);
            
            if (error) {
                console.error('Error submitting penelitian:', error);
                throw error;
            }
            
            // Create notification for admin
            await this.createNotification({
                id_user: null, // untuk semua admin
                judul: 'Penelitian Perlu Review',
                pesan: `Penelitian "${existing.judul}" telah disubmit dan perlu direview`,
                tipe: 'info',
                link: `/admin/penelitian/${id}`
            });
            
            return await this.getPenelitianById(id);
        } catch (error) {
            console.error('Error in submitPenelitian:', error);
            throw error;
        }
    }
    
    async updateStatusPenelitian(id, status, catatan, adminId) {
        try {
            console.log('========== UPDATE STATUS PENELITIAN ==========');
            console.log('1. Menerima parameter:');
            console.log('   - id:', id);
            console.log('   - status:', status);
            console.log('   - catatan:', catatan);
            console.log('   - adminId:', adminId);
            
            // Cek apakah penelitian ada
            console.log('2. Mencari penelitian dengan ID:', id);
            const { data: existing, error: findError } = await supabase
                .from('penelitian')
                .select('id_penelitian, judul, status')
                .eq('id_penelitian', id)
                .single();
            
            if (findError) {
                console.error('   ❌ Error mencari penelitian:', findError);
                throw findError;
            }
            
            if (!existing) {
                console.error('   ❌ Penelitian tidak ditemukan!');
                throw new Error('Penelitian tidak ditemukan');
            }
            
            console.log('   - Ditemukan:', existing.judul);
            console.log('   - Status saat ini:', existing.status);
            console.log('   - Akan diupdate menjadi:', status);
            
            // Update status - LANGSUNG PAKAI STATUS YANG DITERIMA
            console.log('3. Menjalankan query UPDATE...');
            const updateData = {
                status: status,
                updated_at: new Date(),
                updated_by: adminId
            };
            console.log('   - Data update:', updateData);
            
            const { data: updateResult, error: updateError } = await supabase
                .from('penelitian')
                .update(updateData)
                .eq('id_penelitian', id)
                .select();
            
            if (updateError) {
                console.error('   ❌ ERROR UPDATE:', updateError);
                console.error('   - Error code:', updateError.code);
                console.error('   - Error message:', updateError.message);
                console.error('   - Error details:', updateError.details);
                throw updateError;
            }
            
            console.log('   ✅ Update berhasil!');
            console.log('   - Hasil update:', updateResult);
            
            // Verifikasi perubahan
            console.log('4. Verifikasi perubahan:');
            const { data: afterUpdate, error: verifyError } = await supabase
                .from('penelitian')
                .select('id_penelitian, judul, status, updated_at')
                .eq('id_penelitian', id)
                .single();
            
            if (verifyError) {
                console.error('   ❌ Error verifikasi:', verifyError);
            } else {
                console.log('   - Status setelah update:', afterUpdate.status);
                console.log('   - Updated at:', afterUpdate.updated_at);
                
                if (afterUpdate.status === status) {
                    console.log('   ✅ Status berhasil diubah!');
                } else {
                    console.error('   ❌ Status tidak berubah!');
                    console.log('   - Expected:', status);
                    console.log('   - Actual:', afterUpdate.status);
                }
            }
            
            // Add to review history if catatan exists
            if (catatan) {
                console.log('5. Menambahkan review history...');
                const { error: reviewError } = await supabase
                    .from('review_penelitian')
                    .insert([{
                        id_penelitian: id,
                        reviewer_id: adminId,
                        catatan,
                        rekomendasi: status,
                        tipe_review: 'admin',
                        tanggal_review: new Date()
                    }]);
                
                if (reviewError) {
                    console.error('   ❌ Error adding review history:', reviewError);
                } else {
                    console.log('   ✅ Review history added');
                }
            }
            
            // Create notification for ketua
            try {
                await this.createNotification({
                    id_user: existing.ketua_peneliti,
                    judul: `Status Penelitian: ${status}`,
                    pesan: `Status penelitian "${existing.judul}" telah diupdate menjadi ${status}`,
                    tipe: status === 'diterima' ? 'success' : status === 'ditolak' ? 'error' : 'warning',
                    link: `/dosen/penelitian/${id}`
                });
                console.log('   ✅ Notification created for ketua');
            } catch (notifError) {
                console.error('   ❌ Failed to create notification:', notifError);
            }
            
            return afterUpdate || existing;
        } catch (error) {
            console.error('========== ERROR DI UPDATE STATUS ==========');
            console.error('Error name:', error.name);
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
            throw error;
        }
    }
    
    async getReviewHistory(id) {
        try {
            const { data, error } = await supabase
                .from('review_penelitian')
                .select(`
                    *,
                    reviewer:users(id_user, nama_lengkap, role)
                `)
                .eq('id_penelitian', id)
                .order('tanggal_review', { ascending: false });
            
            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error in getReviewHistory:', error);
            throw error;
        }
    }
    
    // ==================== PENGABDIAN ====================
    
    async getAllPengabdian({ page = 1, limit = 10, status, tahun, skema, search, userId = null }) {
        try {
            const offset = (page - 1) * limit;
            
            let query = supabase
                .from('pengabdian')
                .select(`
                    *,
                    ketua:ketua_pengabdian(id_user, nama_lengkap, nidn, email, foto_profil),
                    anggota_pengabdian(
                        id_anggota,
                        user:users(id_user, nama_lengkap, nidn, email, foto_profil),
                        peran
                    )
                `, { count: 'exact' });
            
            // Filter by user if dosen
            if (userId) {
                query = query.or(`ketua_pengabdian.eq.${userId},anggota_pengabdian.id_user.eq.${userId}`);
            }
            
            // Apply filters
            if (status) {
                query = query.eq('status', status);
            }
            
            if (tahun) {
                query = query.eq('tahun', tahun);
            }
            
            if (skema) {
                query = query.eq('skema_pengabdian', skema);
            }
            
            if (search) {
                const { data: users } = await supabase
                    .from('users')
                    .select('id_user')
                    .ilike('nama_lengkap', `%${search}%`);
                
                const userIds = users?.map(u => u.id_user) || [];
                
                if (userIds.length > 0) {
                    query = query.or(`judul.ilike.%${search}%,ketua_pengabdian.in.(${userIds.join(',')})`);
                } else {
                    query = query.ilike('judul', `%${search}%`);
                }
            }
            
            // Apply pagination
            query = query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            
            const { data, error, count } = await query;
            
            if (error) throw error;
            
            return {
                data: data || [],
                pagination: {
                    page,
                    limit,
                    total: count || 0,
                    total_pages: Math.ceil((count || 0) / limit)
                }
            };
        } catch (error) {
            console.error('Error in getAllPengabdian:', error);
            throw error;
        }
    }
    
    async getPengabdianById(id, userId = null) {
        try {
            let query = supabase
                .from('pengabdian')
                .select(`
                    *,
                    ketua:ketua_pengabdian(id_user, nama_lengkap, nidn, email, foto_profil, no_hp),
                    anggota_pengabdian(
                        id_anggota,
                        user:users(id_user, nama_lengkap, nidn, email, foto_profil, no_hp),
                        peran
                    ),
                    review_pengabdian(
                        id_review,
                        reviewer:users(id_user, nama_lengkap, role),
                        catatan,
                        rekomendasi,
                        tipe_review,
                        file_review,
                        tanggal_review
                    )
                `)
                .eq('id_pengabdian', id)
                .single();
            
            const { data, error } = await query;
            
            if (error) throw error;
            if (!data) throw new Error('Pengabdian tidak ditemukan');
            
            // Check access if dosen
            if (userId) {
                const isKetua = data.ketua_pengabdian === userId;
                const isAnggota = data.anggota_pengabdian?.some(a => a.id_user === userId);
                
                if (!isKetua && !isAnggota && data.status !== 'published') {
                    throw new Error('Anda tidak memiliki akses ke pengabdian ini');
                }
            }
            
            return data;
        } catch (error) {
            console.error('Error in getPengabdianById:', error);
            throw error;
        }
    }
    
    async createPengabdian(data) {
        try {
            console.log('Creating pengabdian with data:', data);
            
            const { data: pengabdian, error: pengabdianError } = await supabase
                .from('pengabdian')
                .insert([{
                    judul: data.judul,
                    skema_pengabdian: data.skema_pengabdian,
                    lokasi: data.lokasi,
                    dana_diajukan: data.dana_diajukan,
                    dana_disetujui: data.dana_disetujui || null,
                    tahun: data.tahun,
                    ketua_pengabdian: data.id_ketua,
                    file_proposal: data.file_proposal,
                    file_laporan_kemajuan: data.file_laporan_kemajuan,
                    file_laporan_akhir: data.file_laporan_akhir,
                    status: 'draft',
                    created_by: data.created_by
                }])
                .select()
                .single();
            
            if (pengabdianError) {
                console.error('Error creating pengabdian:', pengabdianError);
                throw pengabdianError;
            }
            
            console.log('Pengabdian created:', pengabdian.id_pengabdian);
            
            // Insert anggota if any
            if (data.anggota && data.anggota.length > 0) {
                console.log('Inserting anggota:', data.anggota.length);
                
                const anggotaData = data.anggota.map(anggota => ({
                    id_pengabdian: pengabdian.id_pengabdian,
                    id_user: anggota.id_user,
                    peran: anggota.peran || 'anggota'
                }));
                
                const { error: anggotaError } = await supabase
                    .from('anggota_pengabdian')
                    .insert(anggotaData);
                
                if (anggotaError) {
                    console.error('Error inserting anggota:', anggotaError);
                    throw anggotaError;
                }
            }
            
            // Create notification for admin
            await this.createNotification({
                id_user: null,
                judul: 'Pengabdian Baru',
                pesan: `Pengabdian baru "${data.judul}" telah dibuat dan perlu direview`,
                tipe: 'info',
                link: `/admin/pengabdian/${pengabdian.id_pengabdian}`
            });
            
            return await this.getPengabdianById(pengabdian.id_pengabdian);
        } catch (error) {
            // Rollback - delete uploaded files
            if (data.file_proposal) await deleteFile(data.file_proposal);
            if (data.file_laporan_kemajuan) await deleteFile(data.file_laporan_kemajuan);
            if (data.file_laporan_akhir) await deleteFile(data.file_laporan_akhir);
            
            console.error('Error in createPengabdian:', error);
            throw error;
        }
    }
    
    async updatePengabdian(id, data, userId) {
        try {
            console.log('Updating pengabdian:', id);
            
            const isAdmin = (typeof userId === 'object' && userId !== null) ? userId.role === 'admin' : false;
            const uid = (typeof userId === 'object' && userId !== null) ? userId.id_user : userId;
            
            const existing = await this.getPengabdianById(id);
            
            if (!isAdmin && existing.ketua_pengabdian !== uid) {
                throw new Error('Hanya ketua pengabdian yang dapat mengupdate pengabdian ini');
            }
            
            if (!isAdmin && !['draft', 'revision'].includes(existing.status)) {
                throw new Error('Pengabdian tidak dapat diupdate karena sudah dalam proses review');
            }
            
            const oldFiles = {
                file_proposal: existing.file_proposal,
                file_laporan_kemajuan: existing.file_laporan_kemajuan,
                file_laporan_akhir: existing.file_laporan_akhir
            };
            
            const updateData = {
                judul: data.judul,
                skema_pengabdian: data.skema_pengabdian,
                lokasi: data.lokasi,
                dana_diajukan: data.dana_diajukan,
                dana_disetujui: data.dana_disetujui,
                tahun: data.tahun,
                updated_at: new Date(),
                updated_by: uid
            };
            
            if (data.file_proposal) updateData.file_proposal = data.file_proposal;
            if (data.file_laporan_kemajuan) updateData.file_laporan_kemajuan = data.file_laporan_kemajuan;
            if (data.file_laporan_akhir) updateData.file_laporan_akhir = data.file_laporan_akhir;
            
            const { error: updateError } = await supabase
                .from('pengabdian')
                .update(updateData)
                .eq('id_pengabdian', id);
            
            if (updateError) {
                console.error('Error updating pengabdian:', updateError);
                throw updateError;
            }
            
            // Delete old files if replaced
            if (data.file_proposal && oldFiles.file_proposal) await deleteFile(oldFiles.file_proposal);
            if (data.file_laporan_kemajuan && oldFiles.file_laporan_kemajuan) await deleteFile(oldFiles.file_laporan_kemajuan);
            if (data.file_laporan_akhir && oldFiles.file_laporan_akhir) await deleteFile(oldFiles.file_laporan_akhir);
            
            // Update anggota
            if (data.anggota) {
                console.log('Updating anggota...');
                
                await supabase.from('anggota_pengabdian').delete().eq('id_pengabdian', id);
                
                if (data.anggota.length > 0) {
                    const anggotaData = data.anggota.map(anggota => ({
                        id_pengabdian: id,
                        id_user: anggota.id_user,
                        peran: anggota.peran || 'anggota'
                    }));
                    
                    const { error: anggotaError } = await supabase
                        .from('anggota_pengabdian')
                        .insert(anggotaData);
                    
                    if (anggotaError) {
                        console.error('Error updating anggota:', anggotaError);
                        throw anggotaError;
                    }
                }
            }
            
            return await this.getPengabdianById(id);
        } catch (error) {
            if (data.file_proposal) await deleteFile(data.file_proposal);
            if (data.file_laporan_kemajuan) await deleteFile(data.file_laporan_kemajuan);
            if (data.file_laporan_akhir) await deleteFile(data.file_laporan_akhir);
            
            console.error('Error in updatePengabdian:', error);
            throw error;
        }
    }
    
    async deletePengabdian(id, userId) {
        try {
            console.log('Deleting pengabdian:', id);
            
            const isAdmin = (typeof userId === 'object' && userId !== null) ? userId.role === 'admin' : false;
            const uid = (typeof userId === 'object' && userId !== null) ? userId.id_user : userId;
            
            const existing = await this.getPengabdianById(id);
            
            if (!isAdmin && existing.ketua_pengabdian !== uid) {
                throw new Error('Hanya ketua pengabdian yang dapat menghapus pengabdian ini');
            }
            
            if (!isAdmin && !['draft', 'rejected'].includes(existing.status)) {
                throw new Error('Pengabdian tidak dapat dihapus karena sudah dalam proses');
            }
            
            if (existing.file_proposal) await deleteFile(existing.file_proposal);
            if (existing.file_laporan_kemajuan) await deleteFile(existing.file_laporan_kemajuan);
            if (existing.file_laporan_akhir) await deleteFile(existing.file_laporan_akhir);
            
            const { error } = await supabase
                .from('pengabdian')
                .delete()
                .eq('id_pengabdian', id);
            
            if (error) {
                console.error('Error deleting pengabdian:', error);
                throw error;
            }
            
            return true;
        } catch (error) {
            console.error('Error in deletePengabdian:', error);
            throw error;
        }
    }
    
    async submitPengabdian(id, userId) {
        try {
            console.log('Submitting pengabdian:', id);
            
            const isAdmin = (typeof userId === 'object' && userId !== null) ? userId.role === 'admin' : false;
            const uid = (typeof userId === 'object' && userId !== null) ? userId.id_user : userId;
            
            const existing = await this.getPengabdianById(id);
            
            if (!isAdmin && existing.ketua_pengabdian !== uid) {
                throw new Error('Hanya ketua pengabdian yang dapat mensubmit pengabdian');
            }
            
            if (!isAdmin && !['draft', 'revision'].includes(existing.status)) {
                throw new Error('Pengabdian sudah pernah disubmit');
            }
            
            if (!existing.file_proposal) {
                throw new Error('File proposal wajib diupload sebelum submit');
            }
            
            const { error } = await supabase
                .from('pengabdian')
                .update({
                    status: 'submitted',
                    tanggal_pengajuan: new Date()
                })
                .eq('id_pengabdian', id);
            
            if (error) {
                console.error('Error submitting pengabdian:', error);
                throw error;
            }
            
            await this.createNotification({
                id_user: null,
                judul: 'Pengabdian Perlu Review',
                pesan: `Pengabdian "${existing.judul}" telah disubmit dan perlu direview`,
                tipe: 'info',
                link: `/admin/pengabdian/${id}`
            });
            
            return await this.getPengabdianById(id);
        } catch (error) {
            console.error('Error in submitPengabdian:', error);
            throw error;
        }
    }
    
    async updateStatusPengabdian(id, status, catatan, adminId) {
        try {
            console.log('=== updateStatusPengabdian called ===');
            console.log('id:', id);
            console.log('status:', status);
            console.log('adminId:', adminId);
            
            const existing = await this.getPengabdianById(id);
            console.log('Existing pengabdian:', existing.judul, 'Current status:', existing.status);
            
            const { data, error } = await supabase
                .from('pengabdian')
                .update({
                    status,
                    updated_at: new Date(),
                    updated_by: adminId
                })
                .eq('id_pengabdian', id)
                .select();
            
            if (error) {
                console.error('Supabase update error:', error);
                throw error;
            }
            
            console.log('Update successful:', data);
            
            if (catatan) {
                console.log('Adding review history with catatan:', catatan);
                const { error: reviewError } = await supabase
                    .from('review_pengabdian')
                    .insert([{
                        id_pengabdian: id,
                        reviewer_id: adminId,
                        catatan,
                        rekomendasi: status,
                        tipe_review: 'admin',
                        tanggal_review: new Date()
                    }]);
                
                if (reviewError) {
                    console.error('Error adding review history:', reviewError);
                } else {
                    console.log('Review history added');
                }
            }
            
            try {
                await this.createNotification({
                    id_user: existing.ketua_pengabdian,
                    judul: `Status Pengabdian: ${status}`,
                    pesan: `Status pengabdian "${existing.judul}" telah diupdate menjadi ${status}`,
                    tipe: status === 'diterima' ? 'success' : status === 'ditolak' ? 'error' : 'warning',
                    link: `/dosen/pengabdian/${id}`
                });
                console.log('Notification created for ketua');
            } catch (notifError) {
                console.error('Failed to create notification:', notifError);
            }
            
            return await this.getPengabdianById(id);
        } catch (error) {
            console.error('Error in updateStatusPengabdian:', error);
            throw error;
        }
    }
    
    // ==================== REVIEW ====================
    
    async addReview(jenis, id, reviewData) {
    try {
        console.log('=== addReview called ===');
        console.log('jenis:', jenis);
        console.log('id:', id);
        console.log('reviewData:', reviewData);
        
        const table = jenis === 'penelitian' ? 'review_penelitian' : 'review_pengabdian';
        const idField = jenis === 'penelitian' ? 'id_penelitian' : 'id_pengabdian';
        
        // MAPPING: Nilai Indonesia ke Inggris untuk kolom rekomendasi
        const rekomendasiMap = {
            'diterima': 'approved',
            'revisi': 'revision',
            'ditolak': 'rejected'
        };
        
        const rekomendasi = rekomendasiMap[reviewData.status_review] || reviewData.status_review;
        
        console.log('Mapping status:', reviewData.status_review, '->', rekomendasi);
        
        // Insert review - gunakan rekomendasi yang sudah di-mapping
        console.log('Inserting review into:', table);
        const { data: review, error } = await supabase
            .from(table)
            .insert([{
                [idField]: id,
                reviewer_id: reviewData.reviewer_id,
                catatan: reviewData.catatan,
                rekomendasi: rekomendasi, // PAKAI YANG SUDAH DI-MAPPING
                tipe_review: reviewData.tipe_review,
                file_review: reviewData.file_review,
                tanggal_review: new Date()
            }])
            .select()
            .single();
        
        if (error) {
            console.error('Error inserting review:', error);
            throw error;
        }
        
        console.log('Review inserted:', review);
        
        // Untuk update status penelitian, TETAP PAKAI STATUS INDONESIA
        const newStatus = reviewData.status_review; // 'diterima', 'revisi', atau 'ditolak'
        console.log('Updating status to:', newStatus);
        
        // Update status
        let updatedItem;
        if (jenis === 'penelitian') {
            console.log('Memanggil updateStatusPenelitian...');
            updatedItem = await this.updateStatusPenelitian(id, newStatus, reviewData.catatan, reviewData.reviewer_id);
        } else {
            console.log('Memanggil updateStatusPengabdian...');
            updatedItem = await this.updateStatusPengabdian(id, newStatus, reviewData.catatan, reviewData.reviewer_id);
        }
        
        console.log('Status updated successfully');
        console.log('Updated item:', updatedItem);
        
        return {
            review,
            updatedItem
        };
    } catch (error) {
        console.error('Error in addReview:', error);
        if (reviewData.file_review) await deleteFile(reviewData.file_review);
        throw error;
    }
}
    
    async getPendingReviews() {
        try {
            console.log('Getting pending reviews...');
            
            // Get penelitian pending review
            const { data: penelitian, error: error1 } = await supabase
                .from('penelitian')
                .select(`
                    id_penelitian,
                    judul,
                    ketua_peneliti,
                    ketua:ketua_peneliti(nama_lengkap),
                    status,
                    tanggal_pengajuan,
                    jenis:'penelitian'
                `)
                .in('status', ['submitted', 'review', 'review_content']);
            
            if (error1) {
                console.error('Error getting penelitian reviews:', error1);
                throw error1;
            }
            
            // Get pengabdian pending review
            const { data: pengabdian, error: error2 } = await supabase
                .from('pengabdian')
                .select(`
                    id_pengabdian,
                    judul,
                    ketua_pengabdian,
                    ketua:ketua_pengabdian(nama_lengkap),
                    status,
                    tanggal_pengajuan,
                    jenis:'pengabdian'
                `)
                .in('status', ['submitted', 'review', 'review_content']);
            
            if (error2) {
                console.error('Error getting pengabdian reviews:', error2);
                throw error2;
            }
            
            // Combine and format
            const pendingReviews = [
                ...(penelitian || []).map(p => ({
                    id: p.id_penelitian,
                    judul: p.judul,
                    ketua: p.ketua?.nama_lengkap,
                    status: p.status,
                    tanggal_pengajuan: p.tanggal_pengajuan,
                    jenis: 'penelitian',
                    tipe_review: p.status === 'submitted' ? 'admin' : 'substansi'
                })),
                ...(pengabdian || []).map(p => ({
                    id: p.id_pengabdian,
                    judul: p.judul,
                    ketua: p.ketua?.nama_lengkap,
                    status: p.status,
                    tanggal_pengajuan: p.tanggal_pengajuan,
                    jenis: 'pengabdian',
                    tipe_review: p.status === 'submitted' ? 'admin' : 'substansi'
                }))
            ];
            
            // Sort by tanggal_pengajuan (oldest first)
            pendingReviews.sort((a, b) => 
                new Date(a.tanggal_pengajuan) - new Date(b.tanggal_pengajuan)
            );
            
            console.log(`Found ${pendingReviews.length} pending reviews`);
            
            return pendingReviews;
        } catch (error) {
            console.error('Error in getPendingReviews:', error);
            throw error;
        }
    }
    
    // ==================== NOTIFICATION ====================
    
    async createNotification(notificationData) {
        try {
            console.log('Creating notification:', notificationData);
            
            // Jika id_user null, buat notifikasi untuk semua admin
            if (!notificationData.id_user) {
                // Dapatkan semua user dengan role admin
                const { data: admins, error: adminError } = await supabase
                    .from('users')
                    .select('id_user')
                    .eq('role', 'admin');
                
                if (adminError) {
                    console.error('Error getting admins:', adminError);
                    throw adminError;
                }
                
                if (admins && admins.length > 0) {
                    const notifications = admins.map(admin => ({
                        id_user: admin.id_user,
                        judul: notificationData.judul,
                        pesan: notificationData.pesan,
                        tipe: notificationData.tipe || 'info',
                        link: notificationData.link,
                        dibaca: false,
                        created_at: new Date()
                    }));
                    
                    const { error } = await supabase
                        .from('notifikasi')
                        .insert(notifications);
                    
                    if (error) {
                        console.error('Error creating notifications for admins:', error);
                        throw error;
                    }
                    
                    console.log(`Created ${notifications.length} notifications for admins`);
                }
            } else {
                // Notifikasi untuk user spesifik
                const { error } = await supabase
                    .from('notifikasi')
                    .insert([{
                        id_user: notificationData.id_user,
                        judul: notificationData.judul,
                        pesan: notificationData.pesan,
                        tipe: notificationData.tipe || 'info',
                        link: notificationData.link,
                        dibaca: false,
                        created_at: new Date()
                    }]);
                
                if (error) {
                    console.error('Error creating notification for user:', error);
                    throw error;
                }
                
                console.log('Notification created for user:', notificationData.id_user);
            }
            
            return true;
        } catch (error) {
            console.error('Error creating notification:', error);
            // Jangan throw - kita tidak ingin notifikasi gagal mengganggu operasi utama
            return false;
        }
    }
    
    // ==================== SKEMA ====================
    
    async getAllSkema({ jenis, status }) {
        try {
            let query = supabase
                .from('skema_penelitian_pengabdian')
                .select('*')
                .order('created_at');
            
            if (jenis) {
                query = query.eq('jenis', jenis);
            }
            
            if (status) {
                query = query.eq('status', status);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            
            return data || [];
        } catch (error) {
            console.error('Error in getAllSkema:', error);
            throw error;
        }
    }
    
    async getSkemaById(id) {
        try {
            const { data, error } = await supabase
                .from('skema_penelitian_pengabdian')
                .select('*')
                .eq('id_skema', id)
                .single();
            
            if (error) throw error;
            if (!data) throw new Error('Skema tidak ditemukan');
            
            return data;
        } catch (error) {
            console.error('Error in getSkemaById:', error);
            throw error;
        }
    }
    
    async createSkema(data) {
        try {
            console.log('Creating skema:', data);
            
            const { data: skema, error } = await supabase
                .from('skema_penelitian_pengabdian')
                .insert([{
                    kode_skema: data.kode_skema,
                    nama_skema: data.nama_skema,
                    jenis: data.jenis,
                    min_dana: data.min_dana,
                    max_dana: data.max_dana,
                    durasi_min: data.durasi_min,
                    durasi_max: data.durasi_max,
                    deskripsi: data.deskripsi,
                    persyaratan: data.persyaratan,
                    luaran_wajib: data.luaran_wajib,
                    status: data.status || 'aktif',
                    created_by: data.created_by
                }])
                .select()
                .single();
            
            if (error) {
                console.error('Error creating skema:', error);
                throw error;
            }
            
            console.log('Skema created:', skema.id_skema);
            
            return skema;
        } catch (error) {
            console.error('Error in createSkema:', error);
            throw error;
        }
    }
    
    async updateSkema(id, data) {
        try {
            console.log('Updating skema:', id);
            
            const { data: skema, error } = await supabase
                .from('skema_penelitian_pengabdian')
                .update({
                    kode_skema: data.kode_skema,
                    nama_skema: data.nama_skema,
                    jenis: data.jenis,
                    min_dana: data.min_dana,
                    max_dana: data.max_dana,
                    durasi_min: data.durasi_min,
                    durasi_max: data.durasi_max,
                    deskripsi: data.deskripsi,
                    persyaratan: data.persyaratan,
                    luaran_wajib: data.luaran_wajib,
                    status: data.status,
                    updated_at: new Date(),
                    updated_by: data.updated_by
                })
                .eq('id_skema', id)
                .select()
                .single();
            
            if (error) {
                console.error('Error updating skema:', error);
                throw error;
            }
            
            if (!skema) throw new Error('Skema tidak ditemukan');
            
            console.log('Skema updated:', skema.id_skema);
            
            return skema;
        } catch (error) {
            console.error('Error in updateSkema:', error);
            throw error;
        }
    }
    
    async deleteSkema(id) {
        try {
            console.log('Deleting skema:', id);
            
            const { error } = await supabase
                .from('skema_penelitian_pengabdian')
                .delete()
                .eq('id_skema', id);
            
            if (error) {
                console.error('Error deleting skema:', error);
                throw error;
            }
            
            console.log('Skema deleted successfully');
            
            return true;
        } catch (error) {
            console.error('Error in deleteSkema:', error);
            throw error;
        }
    }
    
    // ==================== STATISTIK ====================
    
    async getStatistik(tahun = null) {
        try {
            console.log('Getting statistics for tahun:', tahun);
            
            const tahunFilter = tahun ? { tahun } : {};
            
            // Get counts by status
            const { data: penelitianStats, error: error1 } = await supabase
                .from('penelitian')
                .select('status', { count: 'exact' })
                .match(tahunFilter);
            
            const { data: pengabdianStats, error: error2 } = await supabase
                .from('pengabdian')
                .select('status', { count: 'exact' })
                .match(tahunFilter);
            
            if (error1 || error2) throw error1 || error2;
            
            // Calculate totals
            const totalPenelitian = penelitianStats?.length || 0;
            const totalPengabdian = pengabdianStats?.length || 0;
            
            // Get dana totals
            const { data: danaPenelitian, error: error3 } = await supabase
                .from('penelitian')
                .select('dana_disetujui')
                .eq('status', 'approved')
                .match(tahunFilter);
            
            const { data: danaPengabdian, error: error4 } = await supabase
                .from('pengabdian')
                .select('dana_disetujui')
                .eq('status', 'approved')
                .match(tahunFilter);
            
            if (error3 || error4) throw error3 || error4;
            
            const totalDanaPenelitian = danaPenelitian?.reduce((sum, p) => sum + (p.dana_disetujui || 0), 0) || 0;
            const totalDanaPengabdian = danaPengabdian?.reduce((sum, p) => sum + (p.dana_disetujui || 0), 0) || 0;
            
            // Get luaran counts
            const { data: luaran, error: error5 } = await supabase
                .from('luaran_penelitian_pengabdian')
                .select('tipe_luaran')
                .match(tahunFilter);
            
            if (error5) throw error5;
            
            const publikasiCount = luaran?.filter(l => l.tipe_luaran === 'publikasi').length || 0;
            const hakiCount = luaran?.filter(l => l.tipe_luaran === 'haki').length || 0;
            
            // Status distribution
            const statusPenelitian = {
                draft: penelitianStats?.filter(p => p.status === 'draft').length || 0,
                submitted: penelitianStats?.filter(p => p.status === 'submitted').length || 0,
                review: penelitianStats?.filter(p => p.status === 'review').length || 0,
                review_content: penelitianStats?.filter(p => p.status === 'review_content').length || 0,
                revision: penelitianStats?.filter(p => p.status === 'revision').length || 0,
                approved: penelitianStats?.filter(p => p.status === 'approved').length || 0,
                rejected: penelitianStats?.filter(p => p.status === 'rejected').length || 0,
                completed: penelitianStats?.filter(p => p.status === 'completed').length || 0
            };
            
            const statusPengabdian = {
                draft: pengabdianStats?.filter(p => p.status === 'draft').length || 0,
                submitted: pengabdianStats?.filter(p => p.status === 'submitted').length || 0,
                review: pengabdianStats?.filter(p => p.status === 'review').length || 0,
                review_content: pengabdianStats?.filter(p => p.status === 'review_content').length || 0,
                revision: pengabdianStats?.filter(p => p.status === 'revision').length || 0,
                approved: pengabdianStats?.filter(p => p.status === 'approved').length || 0,
                rejected: pengabdianStats?.filter(p => p.status === 'rejected').length || 0,
                completed: pengabdianStats?.filter(p => p.status === 'completed').length || 0
            };
            
            const result = {
                total: {
                    penelitian: totalPenelitian,
                    pengabdian: totalPengabdian,
                    semua: totalPenelitian + totalPengabdian
                },
                dana: {
                    penelitian: totalDanaPenelitian,
                    pengabdian: totalDanaPengabdian,
                    total: totalDanaPenelitian + totalDanaPengabdian
                },
                luaran: {
                    publikasi: publikasiCount,
                    haki: hakiCount,
                    total: (publikasiCount + hakiCount)
                },
                status: {
                    penelitian: statusPenelitian,
                    pengabdian: statusPengabdian
                },
                dalam_review: {
                    admin: (statusPenelitian.submitted + statusPengabdian.submitted),
                    substansi: (statusPenelitian.review_content + statusPengabdian.review_content),
                    total: (statusPenelitian.submitted + statusPenelitian.review_content + 
                           statusPengabdian.submitted + statusPengabdian.review_content)
                }
            };
            
            console.log('Statistics retrieved successfully');
            
            return result;
        } catch (error) {
            console.error('Error in getStatistik:', error);
            throw error;
        }
    }
    
    async getRingkasanDosen({ tahun, fakultas }) {
        try {
            console.log('Getting ringkasan dosen with params:', { tahun, fakultas });

            // 1. Fetch all active faculties
            const { data: allFakultas, error: fError } = await supabase
                .from('fakultas')
                .select('*')
                .eq('status', 'aktif');
            if (fError) throw fError;

            // 2. Fetch all program studi
            const { data: allProdi, error: pError } = await supabase
                .from('program_studi')
                .select('*')
                .eq('status', 'aktif');
            if (pError) throw pError;

            // 3. Fetch all dosen users
            const { data: allDosen, error: dError } = await supabase
                .from('users')
                .select(`
                    id_user,
                    nama_lengkap,
                    nidn,
                    id_prodi,
                    program_studi(
                        id_prodi,
                        nama_prodi,
                        id_fakultas,
                        fakultas(
                            id_fakultas,
                            nama_fakultas
                        )
                    )
                `)
                .eq('role', 'dosen');
            if (dError) throw dError;

            // 4. Fetch all penelitian
            let penQuery = supabase
                .from('penelitian')
                .select(`
                    id_penelitian,
                    ketua_peneliti,
                    tahun,
                    dana_disetujui,
                    status,
                    anggota_penelitian(
                        id_user
                    )
                `);
            if (tahun) {
                penQuery = penQuery.eq('tahun', parseInt(tahun));
            }
            const { data: allPenelitian, error: penError } = await penQuery;
            if (penError) throw penError;

            // 5. Fetch all pengabdian
            let pengQuery = supabase
                .from('pengabdian')
                .select(`
                    id_pengabdian,
                    ketua_pengabdian,
                    tahun,
                    dana_disetujui,
                    status,
                    anggota_pengabdian(
                        id_user
                    )
                `);
            if (tahun) {
                pengQuery = pengQuery.eq('tahun', parseInt(tahun));
            }
            const { data: allPengabdian, error: pengError } = await pengQuery;
            if (pengError) throw pengError;

            // 6. Fetch all luaran
            const { data: allLuaran, error: luaranError } = await supabase
                .from('luaran_penelitian_pengabdian')
                .select('id_luaran, id_referensi');
            if (luaranError) throw luaranError;

            let dosenSummaries = (allDosen || []).map(user => {
                const prodi = user.program_studi || {};
                const fak = prodi.fakultas || {};

                // Find matching research
                const matchingPen = (allPenelitian || []).filter(pen => 
                    pen.ketua_peneliti === user.id_user || 
                    (pen.anggota_penelitian && pen.anggota_penelitian.some(a => a.id_user === user.id_user))
                );

                // Find matching service
                const matchingPeng = (allPengabdian || []).filter(peng => 
                    peng.ketua_pengabdian === user.id_user || 
                    (peng.anggota_pengabdian && peng.anggota_pengabdian.some(a => a.id_user === user.id_user))
                );

                const jumlah_penelitian = matchingPen.length;
                const jumlah_pengabdian = matchingPeng.length;

                const totalDanaPenelitian = matchingPen.reduce((sum, p) => sum + (parseFloat(p.dana_disetujui) || 0), 0);
                const totalDanaPengabdian = matchingPeng.reduce((sum, p) => sum + (parseFloat(p.dana_disetujui) || 0), 0);
                const totalDana = totalDanaPenelitian + totalDanaPengabdian;

                // Find luaran associated with matching research or service
                const refIds = new Set([
                    ...matchingPen.map(p => p.id_penelitian),
                    ...matchingPeng.map(p => p.id_pengabdian)
                ]);

                const matchingLuaran = (allLuaran || []).filter(l => refIds.has(l.id_referensi));
                const jumlah_luaran = matchingLuaran.length;

                return {
                    id_user: user.id_user,
                    nama_lengkap: user.nama_lengkap,
                    nidn: user.nidn,
                    nama_fakultas: fak.nama_fakultas || null,
                    id_fakultas: fak.id_fakultas || null,
                    nama_prodi: prodi.nama_prodi || null,
                    jumlah_penelitian,
                    jumlah_pengabdian,
                    total_dana: totalDana,
                    jumlah_luaran
                };
            });

            // Apply fakultas filter
            if (fakultas) {
                dosenSummaries = dosenSummaries.filter(d => d.id_fakultas === fakultas);
            }

            // Sort by total_dana DESC
            dosenSummaries.sort((a, b) => b.total_dana - a.total_dana);

            console.log(`Successfully compiled ${dosenSummaries.length} dosen summaries`);
            return dosenSummaries;
        } catch (error) {
            console.error('Error in getRingkasanDosen:', error);
            throw error;
        }
    }
    
    async getRingkasanFakultas(tahun) {
        try {
            console.log('Getting ringkasan fakultas for tahun:', tahun);

            // 1. Fetch all active faculties
            const { data: allFakultas, error: fError } = await supabase
                .from('fakultas')
                .select('*')
                .eq('status', 'aktif');
            if (fError) throw fError;

            // 2. Fetch all program studi
            const { data: allProdi, error: pError } = await supabase
                .from('program_studi')
                .select('*')
                .eq('status', 'aktif');
            if (pError) throw pError;

            // 3. Fetch all dosen users
            const { data: allDosen, error: dError } = await supabase
                .from('users')
                .select(`
                    id_user,
                    nama_lengkap,
                    nidn,
                    id_prodi,
                    program_studi(
                        id_prodi,
                        nama_prodi,
                        id_fakultas,
                        fakultas(
                            id_fakultas,
                            nama_fakultas
                        )
                    )
                `)
                .eq('role', 'dosen');
            if (dError) throw dError;

            // 4. Fetch all penelitian
            let penQuery = supabase
                .from('penelitian')
                .select(`
                    id_penelitian,
                    ketua_peneliti,
                    tahun,
                    dana_disetujui,
                    status,
                    anggota_penelitian(
                        id_user
                    )
                `);
            if (tahun) {
                penQuery = penQuery.eq('tahun', parseInt(tahun));
            }
            const { data: allPenelitian, error: penError } = await penQuery;
            if (penError) throw penError;

            // 5. Fetch all pengabdian
            let pengQuery = supabase
                .from('pengabdian')
                .select(`
                    id_pengabdian,
                    ketua_pengabdian,
                    tahun,
                    dana_disetujui,
                    status,
                    anggota_pengabdian(
                        id_user
                    )
                `);
            if (tahun) {
                pengQuery = pengQuery.eq('tahun', parseInt(tahun));
            }
            const { data: allPengabdian, error: pengError } = await pengQuery;
            if (pengError) throw pengError;

            let fakultasSummaries = (allFakultas || []).map(fak => {
                // Get all dosen users in this faculty
                const facultyDosen = (allDosen || []).filter(d => 
                    d.program_studi && d.program_studi.id_fakultas === fak.id_fakultas
                );
                const facultyDosenIds = new Set(facultyDosen.map(d => d.id_user));

                // Find matching research where either leader or any member is in this faculty
                const matchingPen = (allPenelitian || []).filter(pen => 
                    facultyDosenIds.has(pen.ketua_peneliti) ||
                    (pen.anggota_penelitian && pen.anggota_penelitian.some(a => facultyDosenIds.has(a.id_user)))
                );

                // Find matching service where either leader or any member is in this faculty
                const matchingPeng = (allPengabdian || []).filter(peng => 
                    facultyDosenIds.has(peng.ketua_pengabdian) ||
                    (peng.anggota_pengabdian && peng.anggota_pengabdian.some(a => facultyDosenIds.has(a.id_user)))
                );

                const totalDanaPenelitian = matchingPen.reduce((sum, p) => sum + (parseFloat(p.dana_disetujui) || 0), 0);
                const totalDanaPengabdian = matchingPeng.reduce((sum, p) => sum + (parseFloat(p.dana_disetujui) || 0), 0);

                return {
                    id_fakultas: fak.id_fakultas,
                    nama_fakultas: fak.nama_fakultas,
                    jumlah_penelitian: matchingPen.length,
                    jumlah_pengabdian: matchingPeng.length,
                    dana_penelitian: totalDanaPenelitian,
                    dana_pengabdian: totalDanaPengabdian,
                    jumlah_dosen: facultyDosen.length
                };
            });

            fakultasSummaries.sort((a, b) => a.nama_fakultas.localeCompare(b.nama_fakultas));

            console.log(`Successfully compiled ${fakultasSummaries.length} fakultas summaries`);
            return fakultasSummaries;
        } catch (error) {
            console.error('Error in getRingkasanFakultas:', error);
            throw error;
        }
    }
    
    // ==================== LUARAN ====================
    
    async uploadLuaran(data) {
        try {
            console.log('Uploading luaran:', data);
            
            const { data: luaran, error } = await supabase
                .from('luaran_penelitian_pengabdian')
                .insert([{
                    id_referensi: data.id_referensi,
                    jenis_referensi: data.jenis_referensi,
                    judul_luaran: data.judul_luaran,
                    tipe_luaran: data.tipe_luaran,
                    deskripsi: data.deskripsi,
                    file_publikasi: data.file_publikasi,
                    file_haki: data.file_haki,
                    file_luaran_lain: data.file_luaran_lain,
                    link_terkait: data.link_terkait,
                    status: 'pending',
                    created_by: data.created_by
                }])
                .select()
                .single();
            
            if (error) {
                console.error('Error uploading luaran:', error);
                throw error;
            }
            
            console.log('Luaran uploaded:', luaran.id_luaran);
            
            return luaran;
        } catch (error) {
            // Cleanup files
            if (data.file_publikasi) await deleteFile(data.file_publikasi);
            if (data.file_haki) await deleteFile(data.file_haki);
            if (data.file_luaran_lain) await deleteFile(data.file_luaran_lain);
            
            console.error('Error in uploadLuaran:', error);
            throw error;
        }
    }
    
    async getLuaranById(id) {
        try {
            const { data, error } = await supabase
                .from('luaran_penelitian_pengabdian')
                .select(`
                    *,
                    uploader:created_by(id_user, nama_lengkap, role)
                `)
                .eq('id_luaran', id)
                .single();
            
            if (error) {
                console.error('Error getting luaran:', error);
                throw error;
            }
            
            if (!data) throw new Error('Luaran tidak ditemukan');
            
            return data;
        } catch (error) {
            console.error('Error in getLuaranById:', error);
            throw error;
        }
    }
}

module.exports = new PenelitianService();