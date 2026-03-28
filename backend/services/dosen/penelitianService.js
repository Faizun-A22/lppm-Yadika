// services/dosen/penelitianService.js
const supabase = require('../../config/database');
const { deleteFile } = require('../../middleware/upload');

class DosenPenelitianService {
    
    // ==================== PENELITIAN ====================
    
    async getAllPenelitian({ page = 1, limit = 10, status, tahun, skema, search, userId }) {
        try {
            const offset = (page - 1) * limit;
            
            let query = supabase
                .from('penelitian')
                .select(`
                    *,
                    ketua:users!penelitian_ketua_peneliti_fkey(id_user, nama_lengkap, nidn, email, foto_profil),
                    anggota:anggota_penelitian(
                        id_anggota,
                        user:users(id_user, nama_lengkap, nidn, email, foto_profil)
                    )
                `, { count: 'exact' })
                .eq('ketua_peneliti', userId); // Perbaikan: menggunakan ketua_peneliti bukan id_ketua
            
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
                query = query.or(`judul.ilike.%${search}%`);
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
    
    async getPenelitianById(id, userId) {
        try {
            const { data, error } = await supabase
                .from('penelitian')
                .select(`
                    *,
                    ketua:users!penelitian_ketua_peneliti_fkey(id_user, nama_lengkap, nidn, email, foto_profil, no_hp),
                    anggota:anggota_penelitian(
                        id_anggota,
                        user:users(id_user, nama_lengkap, nidn, email, foto_profil, no_hp)
                    ),
                    reviews:review_penelitian(
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
            
            if (error) throw error;
            if (!data) throw new Error('Penelitian tidak ditemukan');
            
            // Verify ownership
            if (data.ketua_peneliti !== userId) {
                throw new Error('Anda tidak memiliki akses ke penelitian ini');
            }
            
            return data;
        } catch (error) {
            console.error('Error in getPenelitianById:', error);
            throw error;
        }
    }
    
    async createPenelitian(data) {
        try {
            const { data: penelitian, error } = await supabase
                .from('penelitian')
                .insert([{
                    judul: data.judul,
                    skema_penelitian: data.skema,
                    sumber_dana: data.jenis_pendanaan === 'internal' ? 'Dana Internal ITB Yadika' : 
                                data.jenis_pendanaan === 'eksternal' ? 'Hibah Eksternal' : 'Mandiri',
                    tahun: data.tahun,
                    ketua_peneliti: data.id_ketua,
                    dana_diajukan: data.dana_diajukan,
                    file_proposal: data.file_proposal,
                    status: 'draft',
                    created_by: data.created_by
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            // Simpan luaran jika ada
            if (data.luaran) {
                await this.saveLuaranTarget('penelitian', penelitian.id_penelitian, data.luaran, data.id_ketua);
            }
            
            return await this.getPenelitianById(penelitian.id_penelitian, data.id_ketua);
        } catch (error) {
            // Rollback - delete uploaded file
            if (data.file_proposal) await deleteFile(data.file_proposal);
            console.error('Error in createPenelitian:', error);
            throw error;
        }
    }
    
    async updatePenelitian(id, data, userId) {
        try {
            // Check if exists and user has access
            const existing = await this.getPenelitianById(id, userId);
            
            if (!['draft', 'revisi'].includes(existing.status)) {
                throw new Error('Penelitian tidak dapat diupdate karena sudah dalam proses review');
            }
            
            // Get old files for cleanup
            const oldFiles = {
                file_proposal: existing.file_proposal
            };
            
            const updateData = {
                judul: data.judul,
                skema_penelitian: data.skema,
                sumber_dana: data.jenis_pendanaan === 'internal' ? 'Dana Internal ITB Yadika' : 
                            data.jenis_pendanaan === 'eksternal' ? 'Hibah Eksternal' : 'Mandiri',
                tahun: data.tahun,
                dana_diajukan: data.dana_diajukan,
                updated_at: new Date(),
                updated_by: userId
            };
            
            // Update file if new one uploaded
            if (data.file_proposal) {
                updateData.file_proposal = data.file_proposal;
            }
            
            const { error } = await supabase
                .from('penelitian')
                .update(updateData)
                .eq('id_penelitian', id);
            
            if (error) throw error;
            
            // Delete old file if replaced
            if (data.file_proposal && oldFiles.file_proposal) {
                await deleteFile(oldFiles.file_proposal);
            }
            
            // Update luaran target
            if (data.luaran) {
                await this.updateLuaranTarget('penelitian', id, data.luaran, userId);
            }
            
            return await this.getPenelitianById(id, userId);
        } catch (error) {
            // Cleanup new file if error
            if (data.file_proposal) await deleteFile(data.file_proposal);
            console.error('Error in updatePenelitian:', error);
            throw error;
        }
    }
    
    async deletePenelitian(id, userId) {
        try {
            const existing = await this.getPenelitianById(id, userId);
            
            if (existing.status !== 'draft') {
                throw new Error('Hanya penelitian dengan status draft yang dapat dihapus');
            }
            
            // Delete files
            if (existing.file_proposal) await deleteFile(existing.file_proposal);
            if (existing.file_laporan_kemajuan) await deleteFile(existing.file_laporan_kemajuan);
            if (existing.file_laporan_akhir) await deleteFile(existing.file_laporan_akhir);
            
            const { error } = await supabase
                .from('penelitian')
                .delete()
                .eq('id_penelitian', id);
            
            if (error) throw error;
            
            return true;
        } catch (error) {
            console.error('Error in deletePenelitian:', error);
            throw error;
        }
    }
    
    async submitPenelitian(id, userId) {
        try {
            const existing = await this.getPenelitianById(id, userId);
            
            if (!['draft', 'revisi'].includes(existing.status)) {
                throw new Error('Penelitian sudah pernah disubmit');
            }
            
            if (!existing.file_proposal) {
                throw new Error('File proposal wajib diupload sebelum submit');
            }
            
            const { error } = await supabase
                .from('penelitian')
                .update({
                    status: 'submit',
                    tanggal_pengajuan: new Date()
                })
                .eq('id_penelitian', id);
            
            if (error) throw error;
            
            // Create notification for admin
            await createNotification({
                id_user: null, // untuk semua admin
                judul: 'Penelitian Baru Perlu Review',
                pesan: `Penelitian "${existing.judul}" telah disubmit`,
                tipe: 'info',
                link: `/admin/penelitian/${id}`
            });
            
            return await this.getPenelitianById(id, userId);
        } catch (error) {
            console.error('Error in submitPenelitian:', error);
            throw error;
        }
    }
    
    async uploadLaporan(id, laporanData, userId) {
        try {
            const existing = await this.getPenelitianById(id, userId);
            
            if (existing.status !== 'diterima' && existing.status !== 'completed') {
                throw new Error('Laporan hanya dapat diupload setelah penelitian disetujui');
            }
            
            const updateData = {};
            const oldFiles = {};
            
            if (laporanData.file_laporan_kemajuan) {
                updateData.file_laporan_kemajuan = laporanData.file_laporan_kemajuan;
                oldFiles.file_laporan_kemajuan = existing.file_laporan_kemajuan;
            }
            
            if (laporanData.file_laporan_akhir) {
                updateData.file_laporan_akhir = laporanData.file_laporan_akhir;
                oldFiles.file_laporan_akhir = existing.file_laporan_akhir;
            }
            
            if (Object.keys(updateData).length === 0) {
                throw new Error('Tidak ada file yang diupload');
            }
            
            const { error } = await supabase
                .from('penelitian')
                .update({
                    ...updateData,
                    updated_at: new Date()
                })
                .eq('id_penelitian', id);
            
            if (error) throw error;
            
            // Check if both reports are uploaded to mark as completed
            const updated = await this.getPenelitianById(id, userId);
            if (updated.file_laporan_kemajuan && updated.file_laporan_akhir && updated.status === 'diterima') {
                await supabase
                    .from('penelitian')
                    .update({ status: 'completed' })
                    .eq('id_penelitian', id);
            }
            
            // Delete old files
            if (oldFiles.file_laporan_kemajuan) await deleteFile(oldFiles.file_laporan_kemajuan);
            if (oldFiles.file_laporan_akhir) await deleteFile(oldFiles.file_laporan_akhir);
            
            return await this.getPenelitianById(id, userId);
        } catch (error) {
            // Cleanup new files if error
            if (laporanData.file_laporan_kemajuan) await deleteFile(laporanData.file_laporan_kemajuan);
            if (laporanData.file_laporan_akhir) await deleteFile(laporanData.file_laporan_akhir);
            console.error('Error in uploadLaporan:', error);
            throw error;
        }
    }
    
    // ==================== PENGABDIAN ====================
    
    async getAllPengabdian({ page = 1, limit = 10, status, tahun, skema, search, userId }) {
        try {
            const offset = (page - 1) * limit;
            
            let query = supabase
                .from('pengabdian')
                .select(`
                    *,
                    ketua:users!pengabdian_ketua_pengabdian_fkey(id_user, nama_lengkap, nidn, email, foto_profil),
                    anggota:anggota_pengabdian(
                        id_anggota,
                        user:users(id_user, nama_lengkap, nidn, email, foto_profil)
                    )
                `, { count: 'exact' })
                .eq('ketua_pengabdian', userId); // Perbaikan: menggunakan ketua_pengabdian bukan id_ketua
            
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
                query = query.or(`judul.ilike.%${search}%`);
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
    
    async getPengabdianById(id, userId) {
        try {
            const { data, error } = await supabase
                .from('pengabdian')
                .select(`
                    *,
                    ketua:users!pengabdian_ketua_pengabdian_fkey(id_user, nama_lengkap, nidn, email, foto_profil, no_hp),
                    anggota:anggota_pengabdian(
                        id_anggota,
                        user:users(id_user, nama_lengkap, nidn, email, foto_profil, no_hp)
                    ),
                    reviews:review_pengabdian(
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
            
            if (error) throw error;
            if (!data) throw new Error('Pengabdian tidak ditemukan');
            
            // Verify ownership
            if (data.ketua_pengabdian !== userId) {
                throw new Error('Anda tidak memiliki akses ke pengabdian ini');
            }
            
            return data;
        } catch (error) {
            console.error('Error in getPengabdianById:', error);
            throw error;
        }
    }
    
    async createPengabdian(data) {
        try {
            const { data: pengabdian, error } = await supabase
                .from('pengabdian')
                .insert([{
                    judul: data.judul,
                    skema_pengabdian: data.skema,
                    lokasi: data.lokasi,
                    tahun: data.tahun,
                    ketua_pengabdian: data.id_ketua,
                    dana_diajukan: data.dana_diajukan,
                    file_proposal: data.file_proposal,
                    status: 'draft',
                    created_by: data.created_by
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            // Simpan luaran jika ada
            if (data.luaran) {
                await this.saveLuaranTarget('pengabdian', pengabdian.id_pengabdian, data.luaran, data.id_ketua);
            }
            
            return await this.getPengabdianById(pengabdian.id_pengabdian, data.id_ketua);
        } catch (error) {
            if (data.file_proposal) await deleteFile(data.file_proposal);
            console.error('Error in createPengabdian:', error);
            throw error;
        }
    }
    
    async updatePengabdian(id, data, userId) {
        try {
            const existing = await this.getPengabdianById(id, userId);
            
            if (!['draft', 'revisi'].includes(existing.status)) {
                throw new Error('Pengabdian tidak dapat diupdate karena sudah dalam proses review');
            }
            
            const oldFiles = {
                file_proposal: existing.file_proposal
            };
            
            const updateData = {
                judul: data.judul,
                skema_pengabdian: data.skema,
                lokasi: data.lokasi,
                tahun: data.tahun,
                dana_diajukan: data.dana_diajukan,
                updated_at: new Date(),
                updated_by: userId
            };
            
            if (data.file_proposal) {
                updateData.file_proposal = data.file_proposal;
            }
            
            const { error } = await supabase
                .from('pengabdian')
                .update(updateData)
                .eq('id_pengabdian', id);
            
            if (error) throw error;
            
            if (data.file_proposal && oldFiles.file_proposal) {
                await deleteFile(oldFiles.file_proposal);
            }
            
            if (data.luaran) {
                await this.updateLuaranTarget('pengabdian', id, data.luaran, userId);
            }
            
            return await this.getPengabdianById(id, userId);
        } catch (error) {
            if (data.file_proposal) await deleteFile(data.file_proposal);
            console.error('Error in updatePengabdian:', error);
            throw error;
        }
    }
    
    async deletePengabdian(id, userId) {
        try {
            const existing = await this.getPengabdianById(id, userId);
            
            if (existing.status !== 'draft') {
                throw new Error('Hanya pengabdian dengan status draft yang dapat dihapus');
            }
            
            if (existing.file_proposal) await deleteFile(existing.file_proposal);
            if (existing.file_laporan_kemajuan) await deleteFile(existing.file_laporan_kemajuan);
            if (existing.file_laporan_akhir) await deleteFile(existing.file_laporan_akhir);
            
            const { error } = await supabase
                .from('pengabdian')
                .delete()
                .eq('id_pengabdian', id);
            
            if (error) throw error;
            
            return true;
        } catch (error) {
            console.error('Error in deletePengabdian:', error);
            throw error;
        }
    }
    
    async submitPengabdian(id, userId) {
        try {
            const existing = await this.getPengabdianById(id, userId);
            
            if (!['draft', 'revisi'].includes(existing.status)) {
                throw new Error('Pengabdian sudah pernah disubmit');
            }
            
            if (!existing.file_proposal) {
                throw new Error('File proposal wajib diupload sebelum submit');
            }
            
            const { error } = await supabase
                .from('pengabdian')
                .update({
                    status: 'submit',
                    tanggal_pengajuan: new Date()
                })
                .eq('id_pengabdian', id);
            
            if (error) throw error;
            
            await createNotification({
                id_user: null,
                judul: 'Pengabdian Baru Perlu Review',
                pesan: `Pengabdian "${existing.judul}" telah disubmit`,
                tipe: 'info',
                link: `/admin/pengabdian/${id}`
            });
            
            return await this.getPengabdianById(id, userId);
        } catch (error) {
            console.error('Error in submitPengabdian:', error);
            throw error;
        }
    }
    
    async uploadLaporanPengabdian(id, laporanData, userId) {
        try {
            const existing = await this.getPengabdianById(id, userId);
            
            if (existing.status !== 'diterima' && existing.status !== 'completed') {
                throw new Error('Laporan hanya dapat diupload setelah pengabdian disetujui');
            }
            
            const updateData = {};
            const oldFiles = {};
            
            if (laporanData.file_laporan_kemajuan) {
                updateData.file_laporan_kemajuan = laporanData.file_laporan_kemajuan;
                oldFiles.file_laporan_kemajuan = existing.file_laporan_kemajuan;
            }
            
            if (laporanData.file_laporan_akhir) {
                updateData.file_laporan_akhir = laporanData.file_laporan_akhir;
                oldFiles.file_laporan_akhir = existing.file_laporan_akhir;
            }
            
            if (Object.keys(updateData).length === 0) {
                throw new Error('Tidak ada file yang diupload');
            }
            
            const { error } = await supabase
                .from('pengabdian')
                .update({
                    ...updateData,
                    updated_at: new Date()
                })
                .eq('id_pengabdian', id);
            
            if (error) throw error;
            
            const updated = await this.getPengabdianById(id, userId);
            if (updated.file_laporan_kemajuan && updated.file_laporan_akhir && updated.status === 'diterima') {
                await supabase
                    .from('pengabdian')
                    .update({ status: 'completed' })
                    .eq('id_pengabdian', id);
            }
            
            if (oldFiles.file_laporan_kemajuan) await deleteFile(oldFiles.file_laporan_kemajuan);
            if (oldFiles.file_laporan_akhir) await deleteFile(oldFiles.file_laporan_akhir);
            
            return await this.getPengabdianById(id, userId);
        } catch (error) {
            if (laporanData.file_laporan_kemajuan) await deleteFile(laporanData.file_laporan_kemajuan);
            if (laporanData.file_laporan_akhir) await deleteFile(laporanData.file_laporan_akhir);
            console.error('Error in uploadLaporanPengabdian:', error);
            throw error;
        }
    }
    
    // ==================== LUARAN ====================
    
    async saveLuaranTarget(jenis, id, luaranData, userId) {
        try {
            if (!luaranData || typeof luaranData !== 'object') return;
            
            const luaranToInsert = [];
            
            // Handle publikasi
            if (luaranData.publikasi && Array.isArray(luaranData.publikasi)) {
                luaranData.publikasi.forEach(item => {
                    luaranToInsert.push({
                        id_referensi: id,
                        jenis_referensi: jenis,
                        judul_luaran: `Target Publikasi: ${item}`,
                        tipe_luaran: 'publikasi',
                        status: 'pending',
                        created_by: userId
                    });
                });
            }
            
            // Handle HAKI
            if (luaranData.haki && Array.isArray(luaranData.haki)) {
                luaranData.haki.forEach(item => {
                    luaranToInsert.push({
                        id_referensi: id,
                        jenis_referensi: jenis,
                        judul_luaran: `Target HKI: ${item}`,
                        tipe_luaran: 'haki',
                        status: 'pending',
                        created_by: userId
                    });
                });
            }
            
            // Handle Buku
            if (luaranData.buku && Array.isArray(luaranData.buku)) {
                luaranData.buku.forEach(item => {
                    luaranToInsert.push({
                        id_referensi: id,
                        jenis_referensi: jenis,
                        judul_luaran: `Target Buku: ${item}`,
                        tipe_luaran: 'buku',
                        status: 'pending',
                        created_by: userId
                    });
                });
            }
            
            // Handle pengabdian specific
            if (luaranData.pengabdian && Array.isArray(luaranData.pengabdian)) {
                luaranData.pengabdian.forEach(item => {
                    luaranToInsert.push({
                        id_referensi: id,
                        jenis_referensi: jenis,
                        judul_luaran: `Target Luaran Pengabdian: ${item}`,
                        tipe_luaran: 'pengabdian',
                        status: 'pending',
                        created_by: userId
                    });
                });
            }
            
            if (luaranToInsert.length > 0) {
                const { error } = await supabase
                    .from('luaran_penelitian_pengabdian')
                    .insert(luaranToInsert);
                
                if (error) throw error;
            }
        } catch (error) {
            console.error('Error in saveLuaranTarget:', error);
            throw error;
        }
    }
    
    async updateLuaranTarget(jenis, id, luaranData, userId) {
        try {
            // Delete existing targets
            await supabase
                .from('luaran_penelitian_pengabdian')
                .delete()
                .eq('id_referensi', id)
                .eq('jenis_referensi', jenis)
                .is('file_publikasi', null)
                .is('file_haki', null)
                .is('file_luaran_lain', null);
            
            // Save new targets
            await this.saveLuaranTarget(jenis, id, luaranData, userId);
        } catch (error) {
            console.error('Error in updateLuaranTarget:', error);
            throw error;
        }
    }
    
    async uploadLuaran(data) {
        try {
            // Verify ownership
            const table = data.jenis_referensi === 'penelitian' ? 'penelitian' : 'pengabdian';
            const idField = data.jenis_referensi === 'penelitian' ? 'id_penelitian' : 'id_pengabdian';
            const ketuaField = data.jenis_referensi === 'penelitian' ? 'ketua_peneliti' : 'ketua_pengabdian';
            
            const { data: refData, error: refError } = await supabase
                .from(table)
                .select(ketuaField)
                .eq(idField, data.id_referensi)
                .single();
            
            if (refError) throw refError;
            if (!refData) throw new Error('Referensi tidak ditemukan');
            
            if (refData[ketuaField] !== data.created_by) {
                throw new Error('Anda tidak memiliki akses ke data ini');
            }
            
            const { data: luaran, error } = await supabase
                .from('luaran_penelitian_pengabdian')
                .insert([{
                    id_referensi: data.id_referensi,
                    jenis_referensi: data.jenis_referensi,
                    judul_luaran: data.judul,
                    tipe_luaran: data.tipe_luaran,
                    deskripsi: data.deskripsi,
                    file_publikasi: data.tipe_luaran === 'publikasi' ? data.file_path : null,
                    file_haki: data.tipe_luaran === 'haki' ? data.file_path : null,
                    file_luaran_lain: !['publikasi', 'haki'].includes(data.tipe_luaran) ? data.file_path : null,
                    link_terkait: data.link_terkait,
                    status: 'pending',
                    created_by: data.created_by
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            return luaran;
        } catch (error) {
            if (data.file_path) await deleteFile(data.file_path);
            console.error('Error in uploadLuaran:', error);
            throw error;
        }
    }
    
    async getLuaranById(id, userId) {
        try {
            const { data, error } = await supabase
                .from('luaran_penelitian_pengabdian')
                .select(`
                    *,
                    uploader:created_by(id_user, nama_lengkap)
                `)
                .eq('id_luaran', id)
                .single();
            
            if (error) throw error;
            if (!data) throw new Error('Luaran tidak ditemukan');
            
            // Verify ownership
            if (data.created_by !== userId) {
                throw new Error('Anda tidak memiliki akses ke luaran ini');
            }
            
            return data;
        } catch (error) {
            console.error('Error in getLuaranById:', error);
            throw error;
        }
    }
    
    async deleteLuaran(id, userId) {
        try {
            const luaran = await this.getLuaranById(id, userId);
            
            if (luaran.status !== 'pending') {
                throw new Error('Hanya luaran dengan status pending yang dapat dihapus');
            }
            
            // Delete file
            const filePath = luaran.file_publikasi || luaran.file_haki || luaran.file_luaran_lain;
            if (filePath) {
                await deleteFile(filePath);
            }
            
            const { error } = await supabase
                .from('luaran_penelitian_pengabdian')
                .delete()
                .eq('id_luaran', id);
            
            if (error) throw error;
            
            return true;
        } catch (error) {
            console.error('Error in deleteLuaran:', error);
            throw error;
        }
    }
    
    // ==================== STATISTIK ====================
    
    async getStatistik(userId, tahun = null) {
        try {
            let penelitianQuery = supabase
                .from('penelitian')
                .select('status, dana_diajukan, dana_disetujui')
                .eq('ketua_peneliti', userId);
            
            let pengabdianQuery = supabase
                .from('pengabdian')
                .select('status, dana_diajukan, dana_disetujui')
                .eq('ketua_pengabdian', userId);
            
            if (tahun) {
                penelitianQuery = penelitianQuery.eq('tahun', tahun);
                pengabdianQuery = pengabdianQuery.eq('tahun', tahun);
            }
            
            const [penelitian, pengabdian] = await Promise.all([
                penelitianQuery,
                pengabdianQuery
            ]);
            
            if (penelitian.error) throw penelitian.error;
            if (pengabdian.error) throw pengabdian.error;
            
            const penelitianData = penelitian.data || [];
            const pengabdianData = pengabdian.data || [];
            
            // Hitung statistik
            const totalPenelitian = penelitianData.length;
            const totalPengabdian = pengabdianData.length;
            
            const danaPenelitianDiajukan = penelitianData.reduce((sum, p) => sum + (p.dana_diajukan || 0), 0);
            const danaPenelitianDisetujui = penelitianData.reduce((sum, p) => sum + (p.dana_disetujui || 0), 0);
            const danaPengabdianDiajukan = pengabdianData.reduce((sum, p) => sum + (p.dana_diajukan || 0), 0);
            const danaPengabdianDisetujui = pengabdianData.reduce((sum, p) => sum + (p.dana_disetujui || 0), 0);
            
            // Hitung per status
            const statusPenelitian = {
                draft: penelitianData.filter(p => p.status === 'draft').length,
                submit: penelitianData.filter(p => p.status === 'submit').length,
                review: penelitianData.filter(p => p.status === 'review').length,
                revisi: penelitianData.filter(p => p.status === 'revisi').length,
                diterima: penelitianData.filter(p => p.status === 'diterima').length,
                ditolak: penelitianData.filter(p => p.status === 'ditolak').length,
                completed: 0 // Sesuaikan dengan status Anda
            };
            
            const statusPengabdian = {
                draft: pengabdianData.filter(p => p.status === 'draft').length,
                submit: pengabdianData.filter(p => p.status === 'submit').length,
                review: pengabdianData.filter(p => p.status === 'review').length,
                revisi: pengabdianData.filter(p => p.status === 'revisi').length,
                diterima: pengabdianData.filter(p => p.status === 'diterima').length,
                ditolak: pengabdianData.filter(p => p.status === 'ditolak').length,
                completed: 0 // Sesuaikan dengan status Anda
            };
            
            // Hitung luaran
            const { data: luaran, error: luaranError } = await supabase
                .from('luaran_penelitian_pengabdian')
                .select('tipe_luaran, status')
                .eq('created_by', userId);
            
            if (luaranError) throw luaranError;
            
            const luaranData = luaran || [];
            const publikasiCount = luaranData.filter(l => l.tipe_luaran === 'publikasi').length;
            const hakiCount = luaranData.filter(l => l.tipe_luaran === 'haki').length;
            const bukuCount = luaranData.filter(l => l.tipe_luaran === 'buku').length;
            
            return {
                total: {
                    penelitian: totalPenelitian,
                    pengabdian: totalPengabdian,
                    semua: totalPenelitian + totalPengabdian
                },
                dana: {
                    diajukan: {
                        penelitian: danaPenelitianDiajukan,
                        pengabdian: danaPengabdianDiajukan,
                        total: danaPenelitianDiajukan + danaPengabdianDiajukan
                    },
                    disetujui: {
                        penelitian: danaPenelitianDisetujui,
                        pengabdian: danaPengabdianDisetujui,
                        total: danaPenelitianDisetujui + danaPengabdianDisetujui
                    }
                },
                status: {
                    penelitian: statusPenelitian,
                    pengabdian: statusPengabdian
                },
                luaran: {
                    publikasi: publikasiCount,
                    haki: hakiCount,
                    buku: bukuCount,
                    total: publikasiCount + hakiCount + bukuCount
                }
            };
        } catch (error) {
            console.error('Error in getStatistik:', error);
            throw error;
        }
    }
    
    async getRingkasanStatus(userId) {
        try {
            const [penelitian, pengabdian] = await Promise.all([
                supabase.from('penelitian').select('status').eq('ketua_peneliti', userId),
                supabase.from('pengabdian').select('status').eq('ketua_pengabdian', userId)
            ]);
            
            const ringkasan = {
                draft: 0,
                review: 0,
                revisi: 0,
                diterima: 0,
                completed: 0,
                ditolak: 0
            };
            
            if (!penelitian.error && penelitian.data) {
                penelitian.data.forEach(p => {
                    if (p.status === 'draft') ringkasan.draft++;
                    else if (p.status === 'submit' || p.status === 'review') ringkasan.review++;
                    else if (p.status === 'revisi') ringkasan.revisi++;
                    else if (p.status === 'diterima') ringkasan.diterima++;
                    else if (p.status === 'ditolak') ringkasan.ditolak++;
                });
            }
            
            if (!pengabdian.error && pengabdian.data) {
                pengabdian.data.forEach(p => {
                    if (p.status === 'draft') ringkasan.draft++;
                    else if (p.status === 'submit' || p.status === 'review') ringkasan.review++;
                    else if (p.status === 'revisi') ringkasan.revisi++;
                    else if (p.status === 'diterima') ringkasan.diterima++;
                    else if (p.status === 'ditolak') ringkasan.ditolak++;
                });
            }
            
            return ringkasan;
        } catch (error) {
            console.error('Error in getRingkasanStatus:', error);
            throw error;
        }
    }
}

module.exports = new DosenPenelitianService();