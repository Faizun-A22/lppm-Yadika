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
                .select('*', { count: 'exact' })  // <-- Hanya select *, tanpa join
                .eq('ketua_peneliti', userId);
            
            if (status && status !== 'all') {
                query = query.eq('status', status);
            }
            
            if (tahun) {
                query = query.eq('tahun', tahun);
            }
            
            if (skema) {
                query = query.eq('skema_penelitian', skema);
            }
            
            if (search) {
                query = query.ilike('judul', `%${search}%`);
            }
            
            query = query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            
            const { data, error, count } = await query;
            
            if (error) throw error;
            
            // Ambil anggota dan luaran terpisah (tanpa join yang bermasalah)
            const formattedData = await Promise.all((data || []).map(async (item) => {
                // Ambil anggota dengan join ke users
                const { data: anggota } = await supabase
                    .from('anggota_penelitian')
                    .select(`
                        id_anggota,
                        peran,
                        id_user,
                        user:users(id_user, nama_lengkap, nidn, email, foto_profil)
                    `)
                    .eq('id_penelitian', item.id_penelitian);
            
                const { data: luaran } = await supabase
                    .from('luaran_penelitian_pengabdian')
                    .select('*')
                    .eq('id_referensi', item.id_penelitian)
                    .eq('jenis_referensi', 'penelitian');
                
                return {
                    ...item,
                    tanggal_pengajuan: item.tanggal_pengajuan || item.created_at,
                    dana_diajukan: item.dana_diajukan || 0,
                    dana_disetujui: item.dana_disetujui || 0,
                    anggota: anggota || [],
                    luaran: luaran || []
                };
            }));
            
            return {
                data: formattedData,
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
            const { data: penelitian, error } = await supabase
                .from('penelitian')
                .select('*')  // <-- Hanya select *
                .eq('id_penelitian', id)
                .single();
            
            if (error) throw error;
            if (!penelitian) throw new Error('Penelitian tidak ditemukan');
            
            // Check if user is ketua
            let hasAccess = penelitian.ketua_peneliti === userId;
            
            // Or check if user is anggota
            if (!hasAccess) {
                const { data: anggotaCheck, error: checkError } = await supabase
                    .from('anggota_penelitian')
                    .select('id_user')
                    .eq('id_penelitian', id)
                    .eq('id_user', userId);
                    
                if (!checkError && anggotaCheck && anggotaCheck.length > 0) {
                    hasAccess = true;
                }
            }

            if (!hasAccess) {
                throw new Error('Anda tidak memiliki akses ke penelitian ini');
            }
            
            // Ambil anggota penelitian terpisah dengan join ke users
            const { data: anggota, error: anggotaError } = await supabase
                .from('anggota_penelitian')
                .select(`
                    id_anggota,
                    peran,
                    id_user,
                    user:users(id_user, nama_lengkap, nidn, email, foto_profil)
                `)
                .eq('id_penelitian', id);
            
            if (anggotaError) throw anggotaError;
            
            // Ambil review penelitian terpisah
            const { data: reviews, error: reviewsError } = await supabase
                .from('review_penelitian')
                .select('*')
                .eq('id_penelitian', id);
            
            if (reviewsError) throw reviewsError;
            
            // Ambil luaran terpisah
            const { data: luaran, error: luaranError } = await supabase
                .from('luaran_penelitian_pengabdian')
                .select('*')
                .eq('id_referensi', id)
                .eq('jenis_referensi', 'penelitian');
            
            if (luaranError) throw luaranError;
            
            penelitian.anggota = anggota || [];
            penelitian.reviews = reviews || [];
            penelitian.luaran = (luaran || []).map(l => ({
                ...l,
                file_path: l.file_publikasi || l.file_haki || l.file_luaran_lain
            }));
            
            return penelitian;
        } catch (error) {
            console.error('Error in getPenelitianById:', error);
            throw error;
        }
    }
    
    async createPenelitian(data) {
        try {
            // Cek apakah user (ketua peneliti) ada di tabel users
            const { data: userExists, error: userError } = await supabase
                .from('users')
                .select('id_user')
                .eq('id_user', data.id_ketua)
                .single();
            
            if (userError || !userExists) {
                throw new Error('User ketua peneliti tidak ditemukan');
            }
            
            const { data: penelitian, error } = await supabase
                .from('penelitian')
                .insert([{
                    judul: data.judul,
                    skema_penelitian: data.skema,
                    sumber_dana: data.jenis_pendanaan === 'internal' ? 'Dana Internal ITB Yadika' : 
                                data.jenis_pendanaan === 'eksternal' ? 'Hibah Eksternal' : 'Mandiri',
                    tahun: data.tahun,
                    durasi: data.durasi || 6,
                    ketua_peneliti: data.id_ketua,
                    dana_diajukan: data.dana_diajukan || 0,
                    file_proposal: data.file_proposal,
                    status: 'draft',
                    created_by: data.created_by,
                    created_at: new Date()
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            if (data.luaran && (typeof data.luaran === 'object' || Array.isArray(data.luaran))) {
                await this.saveLuaranTarget('penelitian', penelitian.id_penelitian, data.luaran, data.id_ketua);
            }
            
            return await this.getPenelitianById(penelitian.id_penelitian, data.id_ketua);
        } catch (error) {
            if (data.file_proposal) await deleteFile(data.file_proposal);
            console.error('Error in createPenelitian:', error);
            throw error;
        }
    }
    
    async updatePenelitian(id, data, userId) {
        try {
            const existing = await this.getPenelitianById(id, userId);
            
            if (existing.ketua_peneliti !== userId) {
                throw new Error('Hanya ketua peneliti yang dapat memperbarui data penelitian ini');
            }
            
            if (!['draft', 'revisi'].includes(existing.status)) {
                throw new Error('Penelitian tidak dapat diupdate karena sudah dalam proses review');
            }
            
            const oldFiles = {
                file_proposal: existing.file_proposal
            };
            
            const updateData = {
                judul: data.judul,
                skema_penelitian: data.skema,
                sumber_dana: data.jenis_pendanaan === 'internal' ? 'Dana Internal ITB Yadika' : 
                            data.jenis_pendanaan === 'eksternal' ? 'Hibah Eksternal' : 'Mandiri',
                tahun: data.tahun,
                durasi: data.durasi || 6,
                dana_diajukan: data.dana_diajukan || 0,
                updated_at: new Date(),
                updated_by: userId
            };
            
            if (data.file_proposal) {
                updateData.file_proposal = data.file_proposal;
            }
            
            const { error } = await supabase
                .from('penelitian')
                .update(updateData)
                .eq('id_penelitian', id);
            
            if (error) throw error;
            
            if (data.file_proposal && oldFiles.file_proposal) {
                await deleteFile(oldFiles.file_proposal);
            }
            
            if (data.luaran && (typeof data.luaran === 'object' || Array.isArray(data.luaran))) {
                await this.updateLuaranTarget('penelitian', id, data.luaran, userId);
            }
            
            return await this.getPenelitianById(id, userId);
        } catch (error) {
            if (data.file_proposal) await deleteFile(data.file_proposal);
            console.error('Error in updatePenelitian:', error);
            throw error;
        }
    }
    
    async deletePenelitian(id, userId) {
        try {
            const existing = await this.getPenelitianById(id, userId);
            
            if (existing.ketua_peneliti !== userId) {
                throw new Error('Hanya ketua peneliti yang dapat menghapus penelitian ini');
            }
            
            if (existing.status !== 'draft') {
                throw new Error('Hanya penelitian dengan status draft yang dapat dihapus');
            }
            
            if (existing.file_proposal) await deleteFile(existing.file_proposal);
            if (existing.file_laporan_kemajuan) await deleteFile(existing.file_laporan_kemajuan);
            if (existing.file_laporan_akhir) await deleteFile(existing.file_laporan_akhir);
            
            if (existing.luaran && existing.luaran.length > 0) {
                for (const luaran of existing.luaran) {
                    const filePath = luaran.file_publikasi || luaran.file_haki || luaran.file_luaran_lain;
                    if (filePath) await deleteFile(filePath);
                }
                await supabase
                    .from('luaran_penelitian_pengabdian')
                    .delete()
                    .eq('id_referensi', id)
                    .eq('jenis_referensi', 'penelitian');
            }
            
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
            
            if (existing.ketua_peneliti !== userId) {
                throw new Error('Hanya ketua peneliti yang dapat mensubmit penelitian ini');
            }
            
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
            
            return await this.getPenelitianById(id, userId);
        } catch (error) {
            console.error('Error in submitPenelitian:', error);
            throw error;
        }
    }
    
    async uploadLaporan(id, laporanData, userId) {
        try {
            const existing = await this.getPenelitianById(id, userId);
            
            if (existing.ketua_peneliti !== userId) {
                throw new Error('Hanya ketua peneliti yang dapat mengunggah laporan untuk penelitian ini');
            }
            
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
            
            const updated = await this.getPenelitianById(id, userId);
            if (updated.file_laporan_kemajuan && updated.file_laporan_akhir && updated.status === 'diterima') {
                await supabase
                    .from('penelitian')
                    .update({ status: 'completed' })
                    .eq('id_penelitian', id);
            }
            
            if (oldFiles.file_laporan_kemajuan) await deleteFile(oldFiles.file_laporan_kemajuan);
            if (oldFiles.file_laporan_akhir) await deleteFile(oldFiles.file_laporan_akhir);
            
            return await this.getPenelitianById(id, userId);
        } catch (error) {
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
                .select('*', { count: 'exact' })
                .eq('ketua_pengabdian', userId);
            
            if (status && status !== 'all') {
                query = query.eq('status', status);
            }
            
            if (tahun) {
                query = query.eq('tahun', tahun);
            }
            
            if (skema) {
                query = query.eq('skema_pengabdian', skema);
            }
            
            if (search) {
                query = query.ilike('judul', `%${search}%`);
            }
            
            query = query
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);
            
            const { data, error, count } = await query;
            
            if (error) throw error;
            
            const formattedData = await Promise.all((data || []).map(async (item) => {
                // Ambil anggota pengabdian dengan join ke users
                const { data: anggota } = await supabase
                    .from('anggota_pengabdian')
                    .select(`
                        id_anggota,
                        peran,
                        id_user,
                        user:users(id_user, nama_lengkap, nidn, email, foto_profil)
                    `)
                    .eq('id_pengabdian', item.id_pengabdian);
            
                const { data: luaran } = await supabase
                    .from('luaran_penelitian_pengabdian')
                    .select('*')
                    .eq('id_referensi', item.id_pengabdian)
                    .eq('jenis_referensi', 'pengabdian');
                
                return {
                    ...item,
                    tanggal_pengajuan: item.tanggal_pengajuan || item.created_at,
                    dana_diajukan: item.dana_diajukan || 0,
                    dana_disetujui: item.dana_disetujui || 0,
                    anggota: anggota || [],
                    luaran: luaran || []
                };
            }));
            
            return {
                data: formattedData,
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
            const { data: pengabdian, error } = await supabase
                .from('pengabdian')
                .select('*')
                .eq('id_pengabdian', id)
                .single();
            
            if (error) throw error;
            if (!pengabdian) throw new Error('Pengabdian tidak ditemukan');
            
            // Check if user is ketua
            let hasAccess = pengabdian.ketua_pengabdian === userId;
            
            // Or check if user is anggota
            if (!hasAccess) {
                const { data: anggotaCheck, error: checkError } = await supabase
                    .from('anggota_pengabdian')
                    .select('id_user')
                    .eq('id_pengabdian', id)
                    .eq('id_user', userId);
                    
                if (!checkError && anggotaCheck && anggotaCheck.length > 0) {
                    hasAccess = true;
                }
            }
            
            if (!hasAccess) {
                throw new Error('Anda tidak memiliki akses ke pengabdian ini');
            }
            
            // Ambil anggota pengabdian terpisah dengan join ke users
            const { data: anggota, error: anggotaError } = await supabase
                .from('anggota_pengabdian')
                .select(`
                    id_anggota,
                    peran,
                    id_user,
                    user:users(id_user, nama_lengkap, nidn, email, foto_profil)
                `)
                .eq('id_pengabdian', id);
            
            if (anggotaError) throw anggotaError;
            
            // Ambil review pengabdian terpisah
            const { data: reviews, error: reviewsError } = await supabase
                .from('review_pengabdian')
                .select('*')
                .eq('id_pengabdian', id);
            
            if (reviewsError) throw reviewsError;
            
            // Ambil luaran terpisah
            const { data: luaran, error: luaranError } = await supabase
                .from('luaran_penelitian_pengabdian')
                .select('*')
                .eq('id_referensi', id)
                .eq('jenis_referensi', 'pengabdian');
            
            if (luaranError) throw luaranError;
            
            pengabdian.anggota = anggota || [];
            pengabdian.reviews = reviews || [];
            pengabdian.luaran = (luaran || []).map(l => ({
                ...l,
                file_path: l.file_publikasi || l.file_haki || l.file_luaran_lain
            }));
            
            return pengabdian;
        } catch (error) {
            console.error('Error in getPengabdianById:', error);
            throw error;
        }
    }
    
    async createPengabdian(data) {
        try {
            // Cek apakah user (ketua pengabdian) ada di tabel users
            const { data: userExists, error: userError } = await supabase
                .from('users')
                .select('id_user')
                .eq('id_user', data.id_ketua)
                .single();
            
            if (userError || !userExists) {
                throw new Error('User ketua pengabdian tidak ditemukan');
            }
            
            const { data: pengabdian, error } = await supabase
                .from('pengabdian')
                .insert([{
                    judul: data.judul,
                    skema_pengabdian: data.skema,
                    lokasi: data.lokasi || '',
                    tahun: data.tahun,
                    durasi: data.durasi || 6,
                    ketua_pengabdian: data.id_ketua,
                    dana_diajukan: data.dana_diajukan || 0,
                    file_proposal: data.file_proposal,
                    status: 'draft',
                    created_by: data.created_by,
                    created_at: new Date()
                }])
                .select()
                .single();
            
            if (error) throw error;
            
            if (data.luaran && (typeof data.luaran === 'object' || Array.isArray(data.luaran))) {
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
            
            if (existing.ketua_pengabdian !== userId) {
                throw new Error('Hanya ketua pengabdian yang dapat memperbarui data pengabdian ini');
            }
            
            if (!['draft', 'revisi'].includes(existing.status)) {
                throw new Error('Pengabdian tidak dapat diupdate karena sudah dalam proses review');
            }
            
            const oldFiles = {
                file_proposal: existing.file_proposal
            };
            
            const updateData = {
                judul: data.judul,
                skema_pengabdian: data.skema,
                lokasi: data.lokasi || '',
                tahun: data.tahun,
                durasi: data.durasi || 6,
                dana_diajukan: data.dana_diajukan || 0,
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
            
            if (data.luaran && (typeof data.luaran === 'object' || Array.isArray(data.luaran))) {
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
            
            if (existing.ketua_pengabdian !== userId) {
                throw new Error('Hanya ketua pengabdian yang dapat menghapus pengabdian ini');
            }
            
            if (existing.status !== 'draft') {
                throw new Error('Hanya pengabdian dengan status draft yang dapat dihapus');
            }
            
            if (existing.file_proposal) await deleteFile(existing.file_proposal);
            if (existing.file_laporan_kemajuan) await deleteFile(existing.file_laporan_kemajuan);
            if (existing.file_laporan_akhir) await deleteFile(existing.file_laporan_akhir);
            
            if (existing.luaran && existing.luaran.length > 0) {
                for (const luaran of existing.luaran) {
                    const filePath = luaran.file_publikasi || luaran.file_haki || luaran.file_luaran_lain;
                    if (filePath) await deleteFile(filePath);
                }
                await supabase
                    .from('luaran_penelitian_pengabdian')
                    .delete()
                    .eq('id_referensi', id)
                    .eq('jenis_referensi', 'pengabdian');
            }
            
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
            
            if (existing.ketua_pengabdian !== userId) {
                throw new Error('Hanya ketua pengabdian yang dapat mensubmit pengabdian ini');
            }
            
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
            
            return await this.getPengabdianById(id, userId);
        } catch (error) {
            console.error('Error in submitPengabdian:', error);
            throw error;
        }
    }
    
    async uploadLaporanPengabdian(id, laporanData, userId) {
        try {
            const existing = await this.getPengabdianById(id, userId);
            
            if (existing.ketua_pengabdian !== userId) {
                throw new Error('Hanya ketua pengabdian yang dapat mengunggah laporan untuk pengabdian ini');
            }
            
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
    
    async uploadLuaran(data) {
        try {
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
            
            const insertData = {
                id_referensi: data.id_referensi,
                jenis_referensi: data.jenis_referensi,
                judul_luaran: data.judul,
                tipe_luaran: data.tipe_luaran,
                deskripsi: data.deskripsi,
                link_terkait: data.link_terkait,
                status: 'pending',
                created_by: data.created_by,
                created_at: new Date()
            };
            
            if (data.tipe_luaran === 'publikasi') {
                insertData.file_publikasi = data.file_path;
            } else if (data.tipe_luaran === 'haki') {
                insertData.file_haki = data.file_path;
            } else {
                insertData.file_luaran_lain = data.file_path;
            }
            
            const { data: luaran, error } = await supabase
                .from('luaran_penelitian_pengabdian')
                .insert([insertData])
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
            
            if (data.created_by !== userId) {
                throw new Error('Anda tidak memiliki akses ke luaran ini');
            }
            
            data.file_path = data.file_publikasi || data.file_haki || data.file_luaran_lain;
            
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
            
            if (tahun) {
                penelitianQuery = penelitianQuery.eq('tahun', tahun);
            }
            
            const { data: penelitianData, error: penelitianError } = await penelitianQuery;
            
            if (penelitianError) throw penelitianError;
            
            const data = penelitianData || [];
            
            const totalPenelitian = data.length;
            
            const danaDiajukanPenelitian = data.reduce((sum, p) => sum + (p.dana_diajukan || 0), 0);
            const danaDisetujuiPenelitian = data.reduce((sum, p) => sum + (p.dana_disetujui || 0), 0);
            
            const statusCountPenelitian = {
                draft: data.filter(p => p.status === 'draft').length,
                submit: data.filter(p => p.status === 'submit' || p.status === 'submitted').length,
                review: data.filter(p => p.status === 'review').length,
                revisi: data.filter(p => p.status === 'revisi' || p.status === 'revision').length,
                diterima: data.filter(p => p.status === 'diterima' || p.status === 'approved').length,
                ditolak: data.filter(p => p.status === 'ditolak').length,
                completed: data.filter(p => p.status === 'completed').length
            };
            
            // Query Pengabdian
            let pengabdianQuery = supabase
                .from('pengabdian')
                .select('status, dana_diajukan, dana_disetujui')
                .eq('ketua_pengabdian', userId);
            
            if (tahun) {
                pengabdianQuery = pengabdianQuery.eq('tahun', tahun);
            }
            
            const { data: pengabdianData, error: pengabdianError } = await pengabdianQuery;
            if (pengabdianError) throw pengabdianError;
            
            const pgbData = pengabdianData || [];
            const totalPengabdian = pgbData.length;
            
            const danaDiajukanPengabdian = pgbData.reduce((sum, p) => sum + (p.dana_diajukan || 0), 0);
            const danaDisetujuiPengabdian = pgbData.reduce((sum, p) => sum + (p.dana_disetujui || 0), 0);
            
            const statusCountPengabdian = {
                draft: pgbData.filter(p => p.status === 'draft').length,
                submit: pgbData.filter(p => p.status === 'submit' || p.status === 'submitted').length,
                review: pgbData.filter(p => p.status === 'review').length,
                revisi: pgbData.filter(p => p.status === 'revisi' || p.status === 'revision').length,
                diterima: pgbData.filter(p => p.status === 'diterima' || p.status === 'approved').length,
                ditolak: pgbData.filter(p => p.status === 'ditolak').length,
                completed: pgbData.filter(p => p.status === 'completed').length
            };
            
            // Query Luaran
            const { data: luaran, error: luaranError } = await supabase
                .from('luaran_penelitian_pengabdian')
                .select('tipe_luaran, status')
                .eq('created_by', userId);
            
            if (luaranError) throw luaranError;
            
            const luaranData = luaran || [];
            const publikasiCount = luaranData.filter(l => l.tipe_luaran === 'publikasi' && (l.status === 'verified' || l.status === 'approved' || l.status === 'diterima')).length;
            const hakiCount = luaranData.filter(l => l.tipe_luaran === 'haki' && (l.status === 'verified' || l.status === 'approved' || l.status === 'diterima')).length;
            const bukuCount = luaranData.filter(l => (l.tipe_luaran === 'karya' || l.tipe_luaran === 'buku') && (l.status === 'verified' || l.status === 'approved' || l.status === 'diterima')).length;
            
            return {
                total: {
                    penelitian: totalPenelitian,
                    pengabdian: totalPengabdian
                },
                dana: {
                    diajukan: danaDiajukanPenelitian + danaDiajukanPengabdian,
                    disetujui: danaDisetujuiPenelitian + danaDisetujuiPengabdian
                },
                status: {
                    penelitian: statusCountPenelitian,
                    pengabdian: statusCountPengabdian
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
    
    async getRingkasanStatus(userId, jenis = 'penelitian') {
        try {
            const table = jenis === 'penelitian' ? 'penelitian' : 'pengabdian';
            const ketuaField = jenis === 'penelitian' ? 'ketua_peneliti' : 'ketua_pengabdian';
            
            const { data: records, error } = await supabase
                .from(table)
                .select('status')
                .eq(ketuaField, userId);
            
            if (error) throw error;
            
            const ringkasan = {
                draft: 0,
                review: 0,
                revisi: 0,
                diterima: 0,
                completed: 0,
                ditolak: 0
            };
            
            if (records) {
                records.forEach(p => {
                    if (p.status === 'draft') ringkasan.draft++;
                    else if (p.status === 'submit' || p.status === 'submitted' || p.status === 'review') ringkasan.review++;
                    else if (p.status === 'revisi' || p.status === 'revision') ringkasan.revisi++;
                    else if (p.status === 'diterima' || p.status === 'approved') ringkasan.diterima++;
                    else if (p.status === 'completed') ringkasan.completed++;
                    else if (p.status === 'ditolak') ringkasan.ditolak++;
                });
            }
            
            return ringkasan;
        } catch (error) {
            console.error('Error in getRingkasanStatus:', error);
            throw error;
        }
    }
    
    // Helper to insert target outputs
    async saveLuaranTarget(jenis, id, luaranData, userId) {
        try {
            if (!luaranData || typeof luaranData !== 'object') return;
            
            const luaranToInsert = [];
            
            if (Array.isArray(luaranData)) {
                // Flat array structure from frontend
                luaranData.forEach(item => {
                    luaranToInsert.push({
                        id_referensi: id,
                        jenis_referensi: jenis,
                        judul_luaran: item.tipe_luaran === 'publikasi' ? `Target Publikasi: ${item.kategori || ''}` : 
                                      item.tipe_luaran === 'haki' ? `Target HKI: ${item.kategori || ''}` : 
                                      item.tipe_luaran === 'karya' || item.tipe_luaran === 'buku' ? `Target Buku/Karya` : `Target Luaran`,
                        tipe_luaran: item.tipe_luaran === 'buku' ? 'karya' : item.tipe_luaran,
                        kategori: item.kategori || null,
                        status: 'pending',
                        created_by: userId,
                        created_at: new Date()
                    });
                });
            } else {
                if (luaranData.publikasi && Array.isArray(luaranData.publikasi)) {
                    luaranData.publikasi.forEach(item => {
                        luaranToInsert.push({
                            id_referensi: id,
                            jenis_referensi: jenis,
                            judul_luaran: `Target Publikasi: ${item}`,
                            tipe_luaran: 'publikasi',
                            kategori: item,
                            status: 'pending',
                            created_by: userId,
                            created_at: new Date()
                        });
                    });
                }
                
                if (luaranData.conference && Array.isArray(luaranData.conference)) {
                    luaranData.conference.forEach(item => {
                        luaranToInsert.push({
                            id_referensi: id,
                            jenis_referensi: jenis,
                            judul_luaran: `Target Conference: ${item}`,
                            tipe_luaran: 'conference',
                            kategori: item,
                            status: 'pending',
                            created_by: userId,
                            created_at: new Date()
                        });
                    });
                }
                
                if (luaranData.haki && Array.isArray(luaranData.haki)) {
                    luaranData.haki.forEach(item => {
                        luaranToInsert.push({
                            id_referensi: id,
                            jenis_referensi: jenis,
                            judul_luaran: item.judul || `Target HKI: ${item.kategori || ''}`,
                            tipe_luaran: 'haki',
                            kategori: item.kategori,
                            status: 'pending',
                            created_by: userId,
                            created_at: new Date()
                        });
                    });
                }
                
                if (luaranData.karya && Array.isArray(luaranData.karya)) {
                    luaranData.karya.forEach(item => {
                        luaranToInsert.push({
                            id_referensi: id,
                            jenis_referensi: jenis,
                            judul_luaran: item.judul || 'Target Karya Ilmiah',
                            tipe_luaran: 'karya',
                            status: 'pending',
                            created_by: userId,
                            created_at: new Date()
                        });
                    });
                }
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
            await supabase
                .from('luaran_penelitian_pengabdian')
                .delete()
                .eq('id_referensi', id)
                .eq('jenis_referensi', jenis)
                .eq('status', 'pending')
                .is('file_publikasi', null)
                .is('file_haki', null)
                .is('file_luaran_lain', null);
            
            await this.saveLuaranTarget(jenis, id, luaranData, userId);
        } catch (error) {
            console.error('Error in updateLuaranTarget:', error);
            throw error;
        }
    }
}

module.exports = new DosenPenelitianService();