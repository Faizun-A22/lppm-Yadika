const supabase = require('../../config/database');

const desaService = {
    /**
     * Get all desa with filters
     */
    async getAllDesa({ page = 1, limit = 10, search = '', kabupaten = '', status = '' }) {
        try {
            let query = supabase
                .from('desa_kkn')
                .select(`
                    *,
                    dosen_pembimbing:users!desa_kkn_id_dosen_pembimbing_fkey (
                        id_user,
                        nama_lengkap,
                        nidn,
                        email
                    )
                `, { count: 'exact' });

            // Apply filters
            if (search) {
                query = query.or(`nama_desa.ilike.%${search}%,kecamatan.ilike.%${search}%,kabupaten.ilike.%${search}%`);
            }

            if (kabupaten) {
                query = query.eq('kabupaten', kabupaten);
            }

            if (status) {
                query = query.eq('status', status);
            }

            // Pagination
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await query
                .order('nama_desa')
                .range(from, to);

            if (error) throw error;

            return {
                data: data || [],
                total: count || 0
            };
        } catch (error) {
            console.error('Error in getAllDesa:', error);
            throw error;
        }
    },

    /**
     * Get desa by ID
     */
    async getDesaById(id) {
        try {
            const { data, error } = await supabase
                .from('desa_kkn')
                .select(`
                    *,
                    dosen_pembimbing:users!desa_kkn_id_dosen_pembimbing_fkey (
                        id_user,
                        nama_lengkap,
                        nidn,
                        email,
                        no_hp
                    ),
                    peserta:registrasi_kkn(
                        id_registrasi,
                        nim,
                        nama_lengkap,
                        status,
                        tanggal_daftar
                    )
                `)
                .eq('id_desa', id)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in getDesaById:', error);
            throw error;
        }
    },

    /**
     * Create new desa
     */
    async createDesa(desaData) {
        try {
            const { data, error } = await supabase
                .from('desa_kkn')
                .insert([desaData])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in createDesa:', error);
            throw error;
        }
    },

    /**
     * Update desa
     */
    async updateDesa(id, updateData) {
        try {
            const { data, error } = await supabase
                .from('desa_kkn')
                .update({
                    ...updateData,
                    updated_at: new Date()
                })
                .eq('id_desa', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in updateDesa:', error);
            throw error;
        }
    },

    /**
     * Delete desa
     */
    async deleteDesa(id) {
        try {
            const { error } = await supabase
                .from('desa_kkn')
                .delete()
                .eq('id_desa', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error in deleteDesa:', error);
            throw error;
        }
    },

    /**
     * Toggle desa status
     */
    async toggleStatus(id) {
        try {
            // Get current status
            const { data: current, error: getError } = await supabase
                .from('desa_kkn')
                .select('status')
                .eq('id_desa', id)
                .single();

            if (getError) throw getError;
            if (!current) throw new Error('Desa tidak ditemukan');

            // Toggle status
            const newStatus = current.status === 'aktif' ? 'nonaktif' : 'aktif';

            const { data, error } = await supabase
                .from('desa_kkn')
                .update({ 
                    status: newStatus,
                    updated_at: new Date()
                })
                .eq('id_desa', id)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in toggleStatus:', error);
            throw error;
        }
    },

    /**
     * Get active desa for dropdown
     */
    async getDesaAktif() {
        try {
            const { data, error } = await supabase
                .from('desa_kkn')
                .select(`
                    id_desa,
                    nama_desa,
                    kecamatan,
                    kabupaten,
                    provinsi,
                    kuota,
                    kuota_terisi,
                    nama_pembimbing_lapangan,
                    kontak_pembimbing_lapangan
                `)
                .eq('status', 'aktif')
                .order('nama_desa');

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error in getDesaAktif:', error);
            throw error;
        }
    },

    /**
     * Get desa statistics
     */
    async getDesaStats() {
        try {
            const { data: stats, error } = await supabase
                .rpc('get_desa_statistics');

            if (error) throw error;

            // Get kuota summary
            const { data: kuotaData, error: kuotaError } = await supabase
                .from('desa_kkn')
                .select('kuota, kuota_terisi')
                .eq('status', 'aktif');

            if (kuotaError) throw kuotaError;

            const totalKuota = kuotaData.reduce((sum, d) => sum + d.kuota, 0);
            const totalTerisi = kuotaData.reduce((sum, d) => sum + d.kuota_terisi, 0);

            return {
                total_desa: stats?.total_desa || 0,
                desa_aktif: stats?.desa_aktif || 0,
                total_kuota: totalKuota,
                total_terisi: totalTerisi,
                persentase_terisi: totalKuota > 0 ? Math.round((totalTerisi / totalKuota) * 100) : 0,
                kabupaten_list: stats?.kabupaten_list || []
            };
        } catch (error) {
            console.error('Error in getDesaStats:', error);
            throw error;
        }
    },

    /**
     * Get peserta by desa
     */
    async getPesertaDesa(id, { page = 1, limit = 10, status = '' }) {
        try {
            let query = supabase
                .from('registrasi_kkn')
                .select(`
                    id_registrasi,
                    nim,
                    nama_lengkap,
                    email,
                    no_hp,
                    angkatan,
                    ukuran_jaket,
                    status,
                    tanggal_daftar,
                    catatan,
                    krs_file,
                    khs_file,
                    payment_file,
                    program_studi:program_studi (
                        id_prodi,
                        nama_prodi
                    )
                `, { count: 'exact' })
                .eq('id_desa', id);

            if (status) {
                query = query.eq('status', status);
            }

            // Pagination
            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await query
                .order('tanggal_daftar', { ascending: false })
                .range(from, to);

            if (error) throw error;

            return {
                data: data || [],
                total: count || 0
            };
        } catch (error) {
            console.error('Error in getPesertaDesa:', error);
            throw error;
        }
    },

    /**
     * Update kuota terisi (dipanggil oleh trigger database)
     */
    async updateKuotaTerisi(id_desa, increment = true) {
        try {
            const { data, error } = await supabase
                .rpc('update_desa_kuota', {
                    p_id_desa: id_desa,
                    p_increment: increment
                });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error in updateKuotaTerisi:', error);
            throw error;
        }
    },

    /**
     * Check kuota availability
     */
    async checkKuotaTersedia(id_desa) {
        try {
            const { data, error } = await supabase
                .from('desa_kkn')
                .select('kuota, kuota_terisi')
                .eq('id_desa', id_desa)
                .single();

            if (error) throw error;

            return {
                tersedia: data.kuota_terisi < data.kuota,
                sisa: data.kuota - data.kuota_terisi,
                total: data.kuota,
                terisi: data.kuota_terisi
            };
        } catch (error) {
            console.error('Error in checkKuotaTersedia:', error);
            throw error;
        }
    },
    async getKabupatenList() {
        try {
            const { data, error } = await supabase
                .from('desa_kkn')
                .select('kabupaten')
                .eq('status', 'aktif')
                .order('kabupaten');

            if (error) throw error;

            const uniqueKabupaten = [...new Set(data.map(d => d.kabupaten))];
            
            return uniqueKabupaten.map(kab => ({
                kabupaten: kab,
                total_desa: data.filter(d => d.kabupaten === kab).length
            }));
        } catch (error) {
            console.error('Error in getKabupatenList:', error);
            throw error;
        }
    }
};

module.exports = desaService;