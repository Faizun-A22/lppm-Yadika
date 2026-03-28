const supabase = require('../../config/database');

class FakultasController {
    /**
     * Mendapatkan semua fakultas
     */
    async getFakultas(req, res, next) {
        try {
            const { data, error } = await supabase
                .from('fakultas')
                .select('id_fakultas, kode_fakultas, nama_fakultas, status')
                .eq('status', 'aktif')
                .order('nama_fakultas');

            if (error) throw error;

            return res.status(200).json({
                success: true,
                message: 'Data fakultas berhasil didapatkan',
                data: data || []
            });
        } catch (error) {
            console.error('Error in getFakultas:', error);
            next(error);
        }
    }

    /**
     * Mendapatkan prodi berdasarkan fakultas
     */
    async getProdiByFakultas(req, res, next) {
        try {
            const { id_fakultas } = req.params;

            if (!id_fakultas) {
                return res.status(400).json({
                    success: false,
                    message: 'ID Fakultas harus diisi'
                });
            }

            const { data, error } = await supabase
                .from('program_studi')
                .select('id_prodi, kode_prodi, nama_prodi, jenjang, akreditasi')
                .eq('id_fakultas', id_fakultas)
                .eq('status', 'aktif')
                .order('nama_prodi');

            if (error) throw error;

            return res.status(200).json({
                success: true,
                message: 'Data program studi berhasil didapatkan',
                data: data || []
            });
        } catch (error) {
            console.error('Error in getProdiByFakultas:', error);
            next(error);
        }
    }

    /**
     * Mendapatkan semua prodi (tanpa filter fakultas)
     */
    async getAllProdi(req, res, next) {
        try {
            const { data, error } = await supabase
                .from('program_studi')
                .select(`
                    id_prodi,
                    kode_prodi,
                    nama_prodi,
                    jenjang,
                    akreditasi,
                    fakultas:fakultas(id_fakultas, nama_fakultas)
                `)
                .eq('status', 'aktif')
                .order('nama_prodi');

            if (error) throw error;

            return res.status(200).json({
                success: true,
                message: 'Data program studi berhasil didapatkan',
                data: data || []
            });
        } catch (error) {
            console.error('Error in getAllProdi:', error);
            next(error);
        }
    }

    /**
     * Mendapatkan detail fakultas
     */
    async getDetailFakultas(req, res, next) {
        try {
            const { id_fakultas } = req.params;

            const { data, error } = await supabase
                .from('fakultas')
                .select(`
                    *,
                    program_studi:program_studi(
                        id_prodi,
                        kode_prodi,
                        nama_prodi,
                        jenjang,
                        akreditasi
                    )
                `)
                .eq('id_fakultas', id_fakultas)
                .single();

            if (error) throw error;

            if (!data) {
                return res.status(404).json({
                    success: false,
                    message: 'Fakultas tidak ditemukan'
                });
            }

            return res.status(200).json({
                success: true,
                message: 'Detail fakultas berhasil didapatkan',
                data: data
            });
        } catch (error) {
            console.error('Error in getDetailFakultas:', error);
            next(error);
        }
    }
}

module.exports = new FakultasController();