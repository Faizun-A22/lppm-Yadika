const supabase = require('../../config/database');
const path = require('path');
const fs = require('fs').promises;

class MagangService {
    // Helper to get magang id by user id
    async getMagangIdByUserId(userId) {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('nim')
            .eq('id_user', userId)
            .single();

        if (userError || !user) {
            throw new Error('User tidak ditemukan');
        }

        const { data: magang, error: magangError } = await supabase
            .from('magang')
            .select('id_magang')
            .eq('nim', user.nim)
            .single();

        if (magangError) {
            // Create magang record if not exists
            const { data: newMagang, error: createError } = await supabase
                .from('magang')
                .insert([{ nim: user.nim }])
                .select()
                .single();

            if (createError) throw createError;
            return newMagang.id_magang;
        }

        return magang.id_magang;
    }

    // Get magang status
    async getMagangStatus(userId) {
        const magangId = await this.getMagangIdByUserId(userId);

        // Get pendaftaran
        const { data: pendaftaran } = await supabase
            .from('pendaftaran_magang')
            .select('*')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Get perusahaan
        const { data: perusahaan } = await supabase
            .from('perusahaan_magang')
            .select('*')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        // Get luaran
        const { data: luaran } = await supabase
            .from('luaran_magang')
            .select('*')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: false });

        return {
            hasRegistration: !!pendaftaran,
            registration: pendaftaran || null,
            perusahaan: perusahaan || null,
            outputs: luaran || []
        };
    }

    // Get timeline
    async getTimeline(userId) {
        const magangId = await this.getMagangIdByUserId(userId);

        const { data: riwayat, error } = await supabase
            .from('riwayat_magang')
            .select('*')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return riwayat;
    }

    // Get riwayat
    async getRiwayat(userId) {
        const magangId = await this.getMagangIdByUserId(userId);

        const { data: pendaftaran } = await supabase
            .from('pendaftaran_magang')
            .select('*')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: false });

        const { data: perusahaan } = await supabase
            .from('perusahaan_magang')
            .select('*')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: false });

        const { data: luaran } = await supabase
            .from('luaran_magang')
            .select('*')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: false });

        return {
            pendaftaran: pendaftaran || [],
            perusahaan: perusahaan || [],
            luaran: luaran || []
        };
    }

    // Create pendaftaran
    async createPendaftaran(userId, data, files) {
        const magangId = await this.getMagangIdByUserId(userId);

        // Check if already has pendaftaran
        const { data: existing } = await supabase
            .from('pendaftaran_magang')
            .select('id_pendaftaran')
            .eq('id_magang', magangId)
            .single();

        if (existing) {
            throw new Error('Anda sudah memiliki pendaftaran aktif');
        }

        // Upload files
        const filePaths = {};
        const fileFields = ['krs', 'khs', 'bukti_pembayaran'];

        for (const field of fileFields) {
            if (files[field] && files[field][0]) {
                const file = files[field][0];
                filePaths[field] = `/uploads/magang/${field}/${file.filename}`;
            } else {
                throw new Error(`File ${field} wajib diupload`);
            }
        }

        // Get user NIM
        const { data: user } = await supabase
            .from('users')
            .select('nim, nama_lengkap, email')
            .eq('id_user', userId)
            .single();

        // Insert pendaftaran
        const { data: pendaftaran, error } = await supabase
            .from('pendaftaran_magang')
            .insert([{
                id_magang: magangId,
                program_studi: data.program_studi,
                semester: parseInt(data.semester),
                no_hp: data.no_hp,
                domisili: data.domisili,
                file_krs: filePaths.krs,
                file_khs: filePaths.khs,
                file_bukti_pembayaran: filePaths.bukti_pembayaran,
                status: 'pending'
            }])
            .select()
            .single();

        if (error) throw error;

        // Update magang status
        await supabase
            .from('magang')
            .update({ status_magang: 'pendaftaran_diproses' })
            .eq('id_magang', magangId);

        return pendaftaran;
    }

    // Get pendaftaran
    async getPendaftaran(userId) {
        const magangId = await this.getMagangIdByUserId(userId);

        const { data, error } = await supabase
            .from('pendaftaran_magang')
            .select('*')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    // Update pendaftaran
    async updatePendaftaran(userId, pendaftaranId, data, files) {
        const magangId = await this.getMagangIdByUserId(userId);

        // Check ownership
        const { data: existing } = await supabase
            .from('pendaftaran_magang')
            .select('*')
            .eq('id_pendaftaran', pendaftaranId)
            .eq('id_magang', magangId)
            .single();

        if (!existing) {
            throw new Error('Pendaftaran tidak ditemukan');
        }

        if (existing.status !== 'pending') {
            throw new Error('Tidak dapat mengubah pendaftaran yang sudah diproses');
        }

        // Prepare update data
        const updateData = {
            program_studi: data.program_studi || existing.program_studi,
            semester: data.semester ? parseInt(data.semester) : existing.semester,
            no_hp: data.no_hp || existing.no_hp,
            domisili: data.domisili || existing.domisili
        };

        // Handle file updates
        const fileFields = ['krs', 'khs', 'bukti_pembayaran'];
        for (const field of fileFields) {
            if (files[field] && files[field][0]) {
                const file = files[field][0];
                updateData[`file_${field}`] = `/uploads/magang/${field}/${file.filename}`;
                
                // Delete old file
                if (existing[`file_${field}`]) {
                    try {
                        const oldPath = path.join(__dirname, '..', existing[`file_${field}`]);
                        await fs.unlink(oldPath);
                    } catch (err) {
                        console.error('Error deleting old file:', err);
                    }
                }
            }
        }

        const { data: updated, error } = await supabase
            .from('pendaftaran_magang')
            .update(updateData)
            .eq('id_pendaftaran', pendaftaranId)
            .select()
            .single();

        if (error) throw error;
        return updated;
    }

    // Create perusahaan
    async createPerusahaan(userId, data, files) {
        const magangId = await this.getMagangIdByUserId(userId);

        // Check if pendaftaran is approved
        const { data: pendaftaran } = await supabase
            .from('pendaftaran_magang')
            .select('status')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!pendaftaran || pendaftaran.status !== 'verified') {
            throw new Error('Pendaftaran harus diverifikasi terlebih dahulu');
        }

        // Upload files
        const filePaths = {};

        if (!files.surat_keterangan || !files.surat_keterangan[0]) {
            throw new Error('File surat keterangan wajib diupload');
        }

        filePaths.surat_keterangan = `/uploads/magang/surat_keterangan/${files.surat_keterangan[0].filename}`;

        if (files.struktur_organisasi && files.struktur_organisasi[0]) {
            filePaths.struktur_organisasi = `/uploads/magang/struktur_organisasi/${files.struktur_organisasi[0].filename}`;
        }

        // Insert perusahaan
        const { data: perusahaan, error } = await supabase
            .from('perusahaan_magang')
            .insert([{
                id_magang: magangId,
                nama_perusahaan: data.nama_perusahaan,
                bidang_perusahaan: data.bidang_perusahaan,
                posisi_magang: data.posisi_magang,
                durasi_magang: parseInt(data.durasi_magang),
                tanggal_mulai: data.tanggal_mulai,
                tanggal_selesai: data.tanggal_selesai,
                alamat_perusahaan: data.alamat_perusahaan,
                nama_pembimbing_lapangan: data.nama_pembimbing_lapangan,
                kontak_pembimbing: data.kontak_pembimbing,
                email_pembimbing: data.email_pembimbing,
                jabatan_pembimbing: data.jabatan_pembimbing,
                file_surat_keterangan: filePaths.surat_keterangan,
                file_struktur_organisasi: filePaths.struktur_organisasi,
                status: 'pending'
            }])
            .select()
            .single();

        if (error) throw error;

        // Update magang status
        await supabase
            .from('magang')
            .update({ status_magang: 'data_perusahaan_diproses' })
            .eq('id_magang', magangId);

        return perusahaan;
    }

    // Get all perusahaan
    async getPerusahaan(userId) {
        const magangId = await this.getMagangIdByUserId(userId);

        const { data, error } = await supabase
            .from('perusahaan_magang')
            .select('*')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    // Get perusahaan by id
    async getPerusahaanById(userId, perusahaanId) {
        const magangId = await this.getMagangIdByUserId(userId);

        const { data, error } = await supabase
            .from('perusahaan_magang')
            .select('*')
            .eq('id_perusahaan', perusahaanId)
            .eq('id_magang', magangId)
            .single();

        if (error) throw error;
        return data;
    }

    // Update perusahaan
    async updatePerusahaan(userId, perusahaanId, data, files) {
        const magangId = await this.getMagangIdByUserId(userId);

        // Check ownership and status
        const { data: existing } = await supabase
            .from('perusahaan_magang')
            .select('*')
            .eq('id_perusahaan', perusahaanId)
            .eq('id_magang', magangId)
            .single();

        if (!existing) {
            throw new Error('Data perusahaan tidak ditemukan');
        }

        if (existing.status !== 'pending') {
            throw new Error('Tidak dapat mengubah data yang sudah diproses');
        }

        // Prepare update data
        const updateData = {
            nama_perusahaan: data.nama_perusahaan || existing.nama_perusahaan,
            bidang_perusahaan: data.bidang_perusahaan || existing.bidang_perusahaan,
            posisi_magang: data.posisi_magang || existing.posisi_magang,
            durasi_magang: data.durasi_magang ? parseInt(data.durasi_magang) : existing.durasi_magang,
            tanggal_mulai: data.tanggal_mulai || existing.tanggal_mulai,
            tanggal_selesai: data.tanggal_selesai || existing.tanggal_selesai,
            alamat_perusahaan: data.alamat_perusahaan || existing.alamat_perusahaan,
            nama_pembimbing_lapangan: data.nama_pembimbing_lapangan || existing.nama_pembimbing_lapangan,
            kontak_pembimbing: data.kontak_pembimbing || existing.kontak_pembimbing,
            email_pembimbing: data.email_pembimbing || existing.email_pembimbing,
            jabatan_pembimbing: data.jabatan_pembimbing || existing.jabatan_pembimbing
        };

        // Handle file updates
        if (files.surat_keterangan && files.surat_keterangan[0]) {
            updateData.file_surat_keterangan = `/uploads/magang/surat_keterangan/${files.surat_keterangan[0].filename}`;
            
            // Delete old file
            try {
                const oldPath = path.join(__dirname, '..', existing.file_surat_keterangan);
                await fs.unlink(oldPath);
            } catch (err) {
                console.error('Error deleting old file:', err);
            }
        }

        if (files.struktur_organisasi && files.struktur_organisasi[0]) {
            updateData.file_struktur_organisasi = `/uploads/magang/struktur_organisasi/${files.struktur_organisasi[0].filename}`;
            
            // Delete old file if exists
            if (existing.file_struktur_organisasi) {
                try {
                    const oldPath = path.join(__dirname, '..', existing.file_struktur_organisasi);
                    await fs.unlink(oldPath);
                } catch (err) {
                    console.error('Error deleting old file:', err);
                }
            }
        }

        const { data: updated, error } = await supabase
            .from('perusahaan_magang')
            .update(updateData)
            .eq('id_perusahaan', perusahaanId)
            .select()
            .single();

        if (error) throw error;
        return updated;
    }

    // Delete perusahaan
    async deletePerusahaan(userId, perusahaanId) {
        const magangId = await this.getMagangIdByUserId(userId);

        // Check ownership and status
        const { data: existing } = await supabase
            .from('perusahaan_magang')
            .select('*')
            .eq('id_perusahaan', perusahaanId)
            .eq('id_magang', magangId)
            .single();

        if (!existing) {
            throw new Error('Data perusahaan tidak ditemukan');
        }

        if (existing.status !== 'pending') {
            throw new Error('Tidak dapat menghapus data yang sudah diproses');
        }

        // Delete files
        const filesToDelete = [existing.file_surat_keterangan];
        if (existing.file_struktur_organisasi) {
            filesToDelete.push(existing.file_struktur_organisasi);
        }

        for (const filePath of filesToDelete) {
            try {
                const fullPath = path.join(__dirname, '..', filePath);
                await fs.unlink(fullPath);
            } catch (err) {
                console.error('Error deleting file:', err);
            }
        }

        // Delete record
        const { error } = await supabase
            .from('perusahaan_magang')
            .delete()
            .eq('id_perusahaan', perusahaanId);

        if (error) throw error;

        // Update magang status
        await supabase
            .from('magang')
            .update({ status_magang: 'pendaftaran_diterima' })
            .eq('id_magang', magangId);

        return true;
    }

    // Create luaran
    async createLuaran(userId, data, files) {
        const magangId = await this.getMagangIdByUserId(userId);

        // Check if perusahaan is approved
        const { data: perusahaan } = await supabase
            .from('perusahaan_magang')
            .select('status')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (!perusahaan || perusahaan.status !== 'verified') {
            throw new Error('Data perusahaan harus diverifikasi terlebih dahulu');
        }

        // Upload files
        const filePaths = {};

        const requiredFiles = ['mou', 'sertifikat'];
        for (const field of requiredFiles) {
            if (!files[field] || !files[field][0]) {
                throw new Error(`File ${field} wajib diupload`);
            }
            filePaths[field] = `/uploads/magang/${field}/${files[field][0].filename}`;
        }

        if (files.logbook && files.logbook[0]) {
            filePaths.logbook = `/uploads/magang/logbook/${files.logbook[0].filename}`;
        }

        // Insert luaran
        const { data: luaran, error } = await supabase
            .from('luaran_magang')
            .insert([{
                id_magang: magangId,
                judul_proyek: data.judul_proyek,
                deskripsi_pekerjaan: data.deskripsi_pekerjaan,
                link_poster_presentasi: data.link_poster_presentasi,
                link_laporan: data.link_laporan,
                link_foto_kegiatan: data.link_foto_kegiatan,
                file_mou: filePaths.mou,
                file_sertifikat: filePaths.sertifikat,
                file_logbook: filePaths.logbook,
                keterangan_tambahan: data.keterangan_tambahan,
                status: 'pending'
            }])
            .select()
            .single();

        if (error) throw error;

        // Update magang status
        await supabase
            .from('magang')
            .update({ status_magang: 'luaran_diproses' })
            .eq('id_magang', magangId);

        return luaran;
    }

    // Get all luaran
    async getLuaran(userId) {
        const magangId = await this.getMagangIdByUserId(userId);

        const { data, error } = await supabase
            .from('luaran_magang')
            .select('*')
            .eq('id_magang', magangId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    // Get luaran by id
    async getLuaranById(userId, luaranId) {
        const magangId = await this.getMagangIdByUserId(userId);

        const { data, error } = await supabase
            .from('luaran_magang')
            .select('*')
            .eq('id_luaran', luaranId)
            .eq('id_magang', magangId)
            .single();

        if (error) throw error;
        return data;
    }

    // Update luaran
    async updateLuaran(userId, luaranId, data, files) {
        const magangId = await this.getMagangIdByUserId(userId);

        // Check ownership and status
        const { data: existing } = await supabase
            .from('luaran_magang')
            .select('*')
            .eq('id_luaran', luaranId)
            .eq('id_magang', magangId)
            .single();

        if (!existing) {
            throw new Error('Data luaran tidak ditemukan');
        }

        if (existing.status !== 'pending') {
            throw new Error('Tidak dapat mengubah luaran yang sudah diproses');
        }

        // Prepare update data
        const updateData = {
            judul_proyek: data.judul_proyek || existing.judul_proyek,
            deskripsi_pekerjaan: data.deskripsi_pekerjaan || existing.deskripsi_pekerjaan,
            link_poster_presentasi: data.link_poster_presentasi || existing.link_poster_presentasi,
            link_laporan: data.link_laporan || existing.link_laporan,
            link_foto_kegiatan: data.link_foto_kegiatan || existing.link_foto_kegiatan,
            keterangan_tambahan: data.keterangan_tambahan || existing.keterangan_tambahan
        };

        // Handle file updates
        const fileFields = ['mou', 'sertifikat', 'logbook'];
        for (const field of fileFields) {
            if (files[field] && files[field][0]) {
                const file = files[field][0];
                updateData[`file_${field}`] = `/uploads/magang/${field}/${file.filename}`;
                
                // Delete old file if exists
                if (existing[`file_${field}`]) {
                    try {
                        const oldPath = path.join(__dirname, '..', existing[`file_${field}`]);
                        await fs.unlink(oldPath);
                    } catch (err) {
                        console.error('Error deleting old file:', err);
                    }
                }
            }
        }

        const { data: updated, error } = await supabase
            .from('luaran_magang')
            .update(updateData)
            .eq('id_luaran', luaranId)
            .select()
            .single();

        if (error) throw error;
        return updated;
    }
}

module.exports = new MagangService();