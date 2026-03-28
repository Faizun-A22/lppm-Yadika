const supabase = require('../../config/database');
const fs = require('fs');
const path = require('path');

class MagangService {
    
    /**
     * Validasi apakah user sudah terdaftar magang
     */
    async cekRegistrasiExist(id_user) {
        const { data, error } = await supabase
            .from('registrasi_magang')
            .select('id_registrasi, status')
            .eq('id_user', id_user)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    /**
     * Validasi apakah user sudah punya data perusahaan
     */
    async cekPerusahaanExist(id_user) {
        const { data, error } = await supabase
            .from('magang_perusahaan')
            .select('id_perusahaan, status')
            .eq('id_user', id_user)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    /**
     * Validasi apakah user sudah upload luaran
     */
    async cekLuaranExist(id_user) {
        const { data, error } = await supabase
            .from('magang_luaran')
            .select('id_luaran, status')
            .eq('id_user', id_user)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data;
    }

    /**
     * Dapatkan semua data magang user
     */
    async getLengkapData(id_user) {
        const [registrasi, perusahaan, luaran] = await Promise.all([
            supabase
                .from('registrasi_magang')
                .select('*')
                .eq('id_user', id_user)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from('magang_perusahaan')
                .select('*')
                .eq('id_user', id_user)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from('magang_luaran')
                .select('*')
                .eq('id_user', id_user)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle()
        ]);

        return {
            registrasi: registrasi.data,
            perusahaan: perusahaan.data,
            luaran: luaran.data
        };
    }

    /**
     * Dapatkan statistik magang
     */
    async getStatistikMagang() {
        const { data, error } = await supabase
            .from('registrasi_magang')
            .select('status', { count: 'exact' });

        if (error) throw error;

        const statistik = {
            total: data.length,
            pending: data.filter(d => d.status === 'pending').length,
            approved: data.filter(d => d.status === 'approved').length,
            rejected: data.filter(d => d.status === 'rejected').length,
            verified: data.filter(d => d.status === 'verified').length
        };

        return statistik;
    }

    /**
     * Hapus file-file terkait user
     */
    async hapusSemuaFileUser(id_user) {
        const data = await this.getLengkapData(id_user);
        const filesToDelete = [];

        // Kumpulkan semua file path
        if (data.registrasi) {
            if (data.registrasi.krs_file) filesToDelete.push(data.registrasi.krs_file);
            if (data.registrasi.khs_file) filesToDelete.push(data.registrasi.khs_file);
            if (data.registrasi.payment_file) filesToDelete.push(data.registrasi.payment_file);
        }

        if (data.perusahaan) {
            if (data.perusahaan.surat_keterangan) filesToDelete.push(data.perusahaan.surat_keterangan);
            if (data.perusahaan.struktur_organisasi) filesToDelete.push(data.perusahaan.struktur_organisasi);
        }

        if (data.luaran) {
            if (data.luaran.file_mou) filesToDelete.push(data.luaran.file_mou);
            if (data.luaran.file_sertifikat) filesToDelete.push(data.luaran.file_sertifikat);
            if (data.luaran.file_logbook) filesToDelete.push(data.luaran.file_logbook);
        }

        // Hapus file fisik
        filesToDelete.forEach(filePath => {
            if (filePath && fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    console.error('Error deleting file:', filePath, err);
                }
            }
        });

        return filesToDelete.length;
    }

    /**
     * Generate nomor registrasi
     */
    generateNomorRegistrasi() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        return `MAG-${year}${month}${day}-${random}`;
    }

    /**
     * Validasi tanggal mulai dan selesai
     */
    validasiTanggalMagang(tanggal_mulai, tanggal_selesai, durasi) {
        const mulai = new Date(tanggal_mulai);
        const selesai = new Date(tanggal_selesai);
        
        if (selesai <= mulai) {
            return {
                valid: false,
                message: 'Tanggal selesai harus setelah tanggal mulai'
            };
        }

        const selisihBulan = (selesai.getFullYear() - mulai.getFullYear()) * 12 + 
                            (selesai.getMonth() - mulai.getMonth());
        
        if (selisihBulan !== durasi - 1 && selisihBulan !== durasi) {
            return {
                valid: false,
                message: `Durasi magang (${durasi} bulan) tidak sesuai dengan rentang tanggal`
            };
        }

        return { valid: true };
    }

    /**
     * Cek kuota per periode
     */
    async cekKuotaPeriode(periode) {
        const { data, error } = await supabase
            .from('programs')
            .select('kuota, pendaftar')
            .eq('jenis', 'magang')
            .eq('periode', periode)
            .eq('status', 'aktif')
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            return {
                tersedia: false,
                message: 'Periode magang tidak tersedia'
            };
        }

        if (data.pendaftar >= data.kuota) {
            return {
                tersedia: false,
                message: `Kuota magang periode ini sudah penuh (${data.pendaftar}/${data.kuota})`
            };
        }

        return {
            tersedia: true,
            kuota: data.kuota,
            pendaftar: data.pendaftar,
            sisa: data.kuota - data.pendaftar
        };
    }

    /**
     * Update counter pendaftar di tabel programs
     */
    async updateCounterPendaftar(periode, increment = true) {
        const { data: program, error: getError } = await supabase
            .from('programs')
            .select('pendaftar')
            .eq('jenis', 'magang')
            .eq('periode', periode)
            .eq('status', 'aktif')
            .single();

        if (getError) throw getError;

        const newPendaftar = increment ? program.pendaftar + 1 : Math.max(0, program.pendaftar - 1);

        const { error } = await supabase
            .from('programs')
            .update({ pendaftar: newPendaftar })
            .eq('jenis', 'magang')
            .eq('periode', periode);

        if (error) throw error;

        return newPendaftar;
    }

    /**
     * Format data untuk ditampilkan di dashboard
     */
    formatDashboardData(data) {
        const formatted = {};

        if (data.registrasi) {
            formatted.registrasi = {
                ...data.registrasi,
                status_badge: this.getStatusBadge(data.registrasi.status),
                tanggal_format: this.formatTanggal(data.registrasi.created_at)
            };
        }

        if (data.perusahaan) {
            formatted.perusahaan = {
                ...data.perusahaan,
                status_badge: this.getStatusBadge(data.perusahaan.status),
                tanggal_format: this.formatTanggal(data.perusahaan.created_at)
            };
        }

        if (data.luaran) {
            formatted.luaran = {
                ...data.luaran,
                status_badge: this.getStatusBadge(data.luaran.status),
                tanggal_format: this.formatTanggal(data.luaran.created_at)
            };
        }

        return formatted;
    }

    /**
     * Dapatkan warna badge untuk status
     */
    getStatusBadge(status) {
        const badges = {
            'draft': 'badge-gray',
            'pending': 'badge-yellow',
            'review': 'badge-blue',
            'approved': 'badge-green',
            'rejected': 'badge-red',
            'verified': 'badge-purple'
        };
        return badges[status] || 'badge-gray';
    }

    /**
     * Format tanggal Indonesia
     */
    formatTanggal(tanggal) {
        if (!tanggal) return '-';
        
        const d = new Date(tanggal);
        const months = [
            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        
        return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    // ========== METHOD CRUD UNTUK MAGANG SERVICE ==========

/**
 * Mendapatkan status magang user
 */
async getStatus(id_user) {
    try {
        const registrasi = await this.cekRegistrasiExist(id_user);
        const perusahaan = await this.cekPerusahaanExist(id_user);
        const luaran = await this.cekLuaranExist(id_user);
        
        return {
            registrasi: registrasi || null,
            perusahaan: perusahaan || null,
            luaran: luaran || null,
            overall: this.hitungOverallStatus(registrasi, perusahaan, luaran)
        };
    } catch (error) {
        console.error('Error in getStatus:', error);
        throw error;
    }
}

/**
 * Hitung overall status
 */
hitungOverallStatus(registrasi, perusahaan, luaran) {
    if (luaran?.status === 'approved' || luaran?.status === 'verified') {
        return 'completed';
    } else if (perusahaan?.status === 'approved' || perusahaan?.status === 'verified') {
        return 'active';
    } else if (registrasi?.status === 'approved' || registrasi?.status === 'verified') {
        return 'registered';
    } else if (registrasi?.status === 'pending') {
        return 'pending';
    } else {
        return 'not_started';
    }
}

/**
 * Mendapatkan data registrasi user
 */
async getRegistrasi(id_user) {
    try {
        const { data, error } = await supabase
            .from('registrasi_magang')
            .select(`
                *,
                program_studi:program_studi_input
            `)
            .eq('id_user', id_user)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error in getRegistrasi:', error);
        throw error;
    }
}

/**
 * Membuat registrasi baru
 */
async createRegistrasi(id_user, data) {
    try {
        // Ambil data user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('nama_lengkap, email, nim')
            .eq('id_user', id_user)
            .single();

        if (userError) throw userError;

        // Siapkan data untuk insert
        const registrasiData = {
            id_user: id_user,
            nim: user.nim,
            nama_lengkap: user.nama_lengkap,
            email: user.email,
            no_hp: data.no_hp,
            program_studi_input: data.program_studi,
            domisili: data.domisili,
            semester: data.semester,
            krs_file: data.krs_file?.path || data.krs_file?.filename,
            khs_file: data.khs_file?.path || data.khs_file?.filename,
            payment_file: data.payment_file?.path || data.payment_file?.filename,
            status: 'pending',
            created_at: new Date()
        };

        // Insert ke database
        const { data: result, error } = await supabase
            .from('registrasi_magang')
            .insert([registrasiData])
            .select()
            .single();

        if (error) throw error;

        // Buat notifikasi
        await this.buatNotifikasi(
            id_user,
            'Pendaftaran Magang Diterima',
            'Pendaftaran magang Anda sedang diproses. Mohon tunggu verifikasi dari admin.',
            'info'
        );

        // Log aktivitas
        await this.logAktivitas(
            id_user,
            'Mendaftar Magang',
            `Pendaftaran magang dengan nomor registrasi ${result.id_registrasi}`
        );

        return result;
    } catch (error) {
        console.error('Error in createRegistrasi:', error);
        throw error;
    }
}

/**
 * Update registrasi
 */
async updateRegistrasi(id_registrasi, id_user, data) {
    try {
        // Cek kepemilikan data
        const { data: existing, error: checkError } = await supabase
            .from('registrasi_magang')
            .select('*')
            .eq('id_registrasi', id_registrasi)
            .eq('id_user', id_user)
            .single();

        if (checkError) throw new Error('Data tidak ditemukan');

        // Siapkan data update
        const updateData = {
            no_hp: data.no_hp || existing.no_hp,
            program_studi_input: data.program_studi || existing.program_studi_input,
            domisili: data.domisili || existing.domisili,
            semester: data.semester || existing.semester,
            updated_at: new Date()
        };

        // Update file jika ada
        if (data.krs_file) {
            updateData.krs_file = data.krs_file.path || data.krs_file.filename;
        }
        if (data.khs_file) {
            updateData.khs_file = data.khs_file.path || data.khs_file.filename;
        }
        if (data.payment_file) {
            updateData.payment_file = data.payment_file.path || data.payment_file.filename;
        }

        // Update database
        const { data: result, error } = await supabase
            .from('registrasi_magang')
            .update(updateData)
            .eq('id_registrasi', id_registrasi)
            .select()
            .single();

        if (error) throw error;

        // Log aktivitas
        await this.logAktivitas(
            id_user,
            'Update Registrasi Magang',
            `Update data registrasi magang`
        );

        return result;
    } catch (error) {
        console.error('Error in updateRegistrasi:', error);
        throw error;
    }
}

/**
 * Mendapatkan data perusahaan
 */
async getPerusahaan(id_user) {
    try {
        const { data, error } = await supabase
            .from('magang_perusahaan')
            .select('*')
            .eq('id_user', id_user)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error in getPerusahaan:', error);
        throw error;
    }
}

/**
 * Mendapatkan detail perusahaan
 */
async getPerusahaanById(id_perusahaan, id_user) {
    try {
        const { data, error } = await supabase
            .from('magang_perusahaan')
            .select(`
                *,
                registrasi_magang:registrasi_magang!inner(
                    program_studi_input,
                    semester
                )
            `)
            .eq('id_perusahaan', id_perusahaan)
            .eq('id_user', id_user)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error in getPerusahaanById:', error);
        throw error;
    }
}

/**
 * Membuat data perusahaan
 */
async createPerusahaan(id_user, data) {
    try {
        const perusahaanData = {
            id_user: id_user,
            id_registrasi: data.id_registrasi,
            nama_perusahaan: data.nama_perusahaan,
            bidang_magang: data.bidang_magang,
            posisi: data.posisi,
            durasi: data.durasi,
            tanggal_mulai: data.tanggal_mulai,
            tanggal_selesai: data.tanggal_selesai,
            alamat_perusahaan: data.alamat_perusahaan,
            nama_pembimbing: data.nama_pembimbing,
            kontak_pembimbing: data.kontak_pembimbing,
            email_pembimbing: data.email_pembimbing,
            jabatan_pembimbing: data.jabatan_pembimbing,
            surat_keterangan: data.surat_keterangan?.path || data.surat_keterangan?.filename,
            struktur_organisasi: data.struktur_organisasi?.path || data.struktur_organisasi?.filename,
            status: 'pending'
        };

        const { data: result, error } = await supabase
            .from('magang_perusahaan')
            .insert([perusahaanData])
            .select()
            .single();

        if (error) throw error;

        return result;
    } catch (error) {
        console.error('Error in createPerusahaan:', error);
        throw error;
    }
}

/**
 * Update data perusahaan
 */
async updatePerusahaan(id_perusahaan, id_user, data) {
    try {
        const updateData = {
            nama_perusahaan: data.nama_perusahaan,
            bidang_magang: data.bidang_magang,
            posisi: data.posisi,
            durasi: data.durasi,
            tanggal_mulai: data.tanggal_mulai,
            tanggal_selesai: data.tanggal_selesai,
            alamat_perusahaan: data.alamat_perusahaan,
            nama_pembimbing: data.nama_pembimbing,
            kontak_pembimbing: data.kontak_pembimbing,
            email_pembimbing: data.email_pembimbing,
            jabatan_pembimbing: data.jabatan_pembimbing,
            updated_at: new Date()
        };

        if (data.surat_keterangan) {
            updateData.surat_keterangan = data.surat_keterangan.path || data.surat_keterangan.filename;
        }
        if (data.struktur_organisasi) {
            updateData.struktur_organisasi = data.struktur_organisasi.path || data.struktur_organisasi.filename;
        }

        const { data: result, error } = await supabase
            .from('magang_perusahaan')
            .update(updateData)
            .eq('id_perusahaan', id_perusahaan)
            .eq('id_user', id_user)
            .select()
            .single();

        if (error) throw error;

        return result;
    } catch (error) {
        console.error('Error in updatePerusahaan:', error);
        throw error;
    }
}

/**
 * Mendapatkan data luaran
 */
async getLuaran(id_user) {
    try {
        const { data, error } = await supabase
            .from('magang_luaran')
            .select('*')
            .eq('id_user', id_user)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error in getLuaran:', error);
        throw error;
    }
}

/**
 * Mendapatkan detail luaran
 */
async getLuaranById(id_luaran, id_user) {
    try {
        const { data, error } = await supabase
            .from('magang_luaran')
            .select(`
                *,
                magang_perusahaan!inner(
                    nama_perusahaan,
                    bidang_magang,
                    posisi
                )
            `)
            .eq('id_luaran', id_luaran)
            .eq('id_user', id_user)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error in getLuaranById:', error);
        throw error;
    }
}

/**
 * Membuat data luaran
 */
async createLuaran(id_user, data, perusahaan) {
    try {
        const luaranData = {
            id_user: id_user,
            id_perusahaan: data.id_perusahaan || perusahaan.id_perusahaan,
            judul_proyek: data.judul_proyek,
            deskripsi_pekerjaan: data.deskripsi_pekerjaan,
            link_poster: data.poster,
            link_laporan: data.laporan,
            link_foto: data.foto_kegiatan,
            file_mou: data.mou_file?.path || data.mou_file?.filename,
            file_sertifikat: data.sertifikat?.path || data.sertifikat?.filename,
            file_logbook: data.logbook?.path || data.logbook?.filename,
            keterangan: data.keterangan_magang,
            status: 'pending'
        };

        const { data: result, error } = await supabase
            .from('magang_luaran')
            .insert([luaranData])
            .select()
            .single();

        if (error) throw error;

        return result;
    } catch (error) {
        console.error('Error in createLuaran:', error);
        throw error;
    }
}

/**
 * Update data luaran
 */
async updateLuaran(id_luaran, id_user, data) {
    try {
        const updateData = {
            judul_proyek: data.judul_proyek,
            deskripsi_pekerjaan: data.deskripsi_pekerjaan,
            link_poster: data.poster,
            link_laporan: data.laporan,
            link_foto: data.foto_kegiatan,
            keterangan: data.keterangan_magang,
            updated_at: new Date()
        };

        if (data.mou_file) {
            updateData.file_mou = data.mou_file.path || data.mou_file.filename;
        }
        if (data.sertifikat) {
            updateData.file_sertifikat = data.sertifikat.path || data.sertifikat.filename;
        }
        if (data.logbook) {
            updateData.file_logbook = data.logbook.path || data.logbook.filename;
        }

        const { data: result, error } = await supabase
            .from('magang_luaran')
            .update(updateData)
            .eq('id_luaran', id_luaran)
            .eq('id_user', id_user)
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
 * Mendapatkan timeline
 */
async getTimeline(id_user) {
    try {
        const data = await this.getLengkapData(id_user);
        
        const timeline = [];
        
        if (data.registrasi) {
            timeline.push({
                tahap: 'Pendaftaran',
                tanggal: data.registrasi.created_at,
                status: data.registrasi.status,
                deskripsi: 'Pendaftaran program magang'
            });
        }
        
        if (data.perusahaan) {
            timeline.push({
                tahap: 'Data Perusahaan',
                tanggal: data.perusahaan.created_at,
                status: data.perusahaan.status,
                deskripsi: `Input data perusahaan ${data.perusahaan.nama_perusahaan}`
            });
        }
        
        if (data.luaran) {
            timeline.push({
                tahap: 'Luaran',
                tanggal: data.luaran.created_at,
                status: data.luaran.status,
                deskripsi: `Upload luaran: ${data.luaran.judul_proyek}`
            });
        }
        
        return timeline.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    } catch (error) {
        console.error('Error in getTimeline:', error);
        throw error;
    }
}

/**
 * Mendapatkan riwayat pengajuan
 */
async getRiwayat(id_user) {
    try {
        const [registrasi, perusahaan, luaran] = await Promise.all([
            supabase
                .from('registrasi_magang')
                .select('*')
                .eq('id_user', id_user)
                .order('created_at', { ascending: false }),
            supabase
                .from('magang_perusahaan')
                .select('*')
                .eq('id_user', id_user)
                .order('created_at', { ascending: false }),
            supabase
                .from('magang_luaran')
                .select('*')
                .eq('id_user', id_user)
                .order('created_at', { ascending: false })
        ]);

        const semuaRiwayat = [
            ...(registrasi.data || []).map(r => ({ ...r, jenis: 'registrasi' })),
            ...(perusahaan.data || []).map(p => ({ ...p, jenis: 'perusahaan' })),
            ...(luaran.data || []).map(l => ({ ...l, jenis: 'luaran' }))
        ];

        return semuaRiwayat.sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );
    } catch (error) {
        console.error('Error in getRiwayat:', error);
        throw error;
    }
}

/**
 * Mendapatkan daftar program studi
 */
async getProgramStudi() {
    try {
        const { data, error } = await supabase
            .from('program_studi')
            .select('id_prodi, nama_prodi, jenjang')
            .eq('status', 'aktif')
            .order('nama_prodi');

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error in getProgramStudi:', error);
        throw error;
    }
}

/**
 * Menghapus file
 */
async deleteFile(jenis, id, id_user) {
    try {
        let table, column, fileColumn;
        
        switch(jenis) {
            case 'krs':
            case 'khs':
            case 'payment':
                table = 'registrasi_magang';
                fileColumn = `${jenis}_file`;
                break;
            case 'surat_keterangan':
            case 'struktur_organisasi':
                table = 'magang_perusahaan';
                fileColumn = jenis;
                break;
            case 'mou':
            case 'sertifikat':
            case 'logbook':
                table = 'magang_luaran';
                fileColumn = `file_${jenis}`;
                break;
            default:
                throw new Error('Jenis file tidak valid');
        }

        // Ambil data file
        const { data: existing, error: getError } = await supabase
            .from(table)
            .select(fileColumn)
            .eq(`id_${table === 'registrasi_magang' ? 'registrasi' : 
                       table === 'magang_perusahaan' ? 'perusahaan' : 'luaran'}`, id)
            .eq('id_user', id_user)
            .single();

        if (getError) throw getError;

        // Hapus file fisik
        if (existing && existing[fileColumn]) {
            const filePath = existing[fileColumn];
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        // Update database
        const { error: updateError } = await supabase
            .from(table)
            .update({ [fileColumn]: null })
            .eq(`id_${table === 'registrasi_magang' ? 'registrasi' : 
                       table === 'magang_perusahaan' ? 'perusahaan' : 'luaran'}`, id)
            .eq('id_user', id_user);

        if (updateError) throw updateError;

        return { message: 'File berhasil dihapus' };
    } catch (error) {
        console.error('Error in deleteFile:', error);
        throw error;
    }
}

    /**
     * Buat notifikasi untuk user
     */
    async buatNotifikasi(id_user, judul, pesan, tipe = 'info') {
        const { error } = await supabase
            .from('notifikasi')
            .insert([
                {
                    id_user,
                    judul,
                    pesan,
                    tipe,
                    dibaca: false,
                    created_at: new Date()
                }
            ]);

        if (error) console.error('Error creating notification:', error);
    }

    /**
     * Log aktivitas user
     */
    async logAktivitas(id_user, aktivitas, keterangan = null) {
        const { error } = await supabase
            .from('log_aktivitas')
            .insert([
                {
                    id_user,
                    aktivitas,
                    keterangan,
                    created_at: new Date()
                }
            ]);

        if (error) console.error('Error logging activity:', error);
    }
}

module.exports = new MagangService();