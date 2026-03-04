const supabase = require('../config/database');

class FakultasController {
  // Get all fakultas
  async getAllFakultas(req, res) {
    try {
      console.log('Mencoba mengambil data fakultas...');
      
      const { data, error } = await supabase
        .from('fakultas')
        .select('*')
        .eq('status', 'aktif')
        .order('nama_fakultas');

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Data fakultas ditemukan:', data?.length || 0, 'record');

      res.status(200).json({
        success: true,
        data: data || []
      });
    } catch (error) {
      console.error('Error getting fakultas:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil data fakultas: ' + error.message,
        data: []
      });
    }
  }

  // Get prodi by fakultas ID
  async getProdiByFakultas(req, res) {
    try {
      const { id_fakultas } = req.params;
      
      console.log('Mencari prodi untuk fakultas:', id_fakultas);

      const { data, error } = await supabase
        .from('program_studi')
        .select('*')
        .eq('id_fakultas', id_fakultas)
        .eq('status', 'aktif')
        .order('nama_prodi');

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Data prodi ditemukan:', data?.length || 0, 'record');

      res.status(200).json({
        success: true,
        data: data || []
      });
    } catch (error) {
      console.error('Error getting prodi:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil data program studi: ' + error.message,
        data: []
      });
    }
  }

  // Get all prodi
  async getAllProdi(req, res) {
    try {
      const { data, error } = await supabase
        .from('program_studi')
        .select(`
          *,
          fakultas:fakultas(nama_fakultas, kode_fakultas)
        `)
        .eq('status', 'aktif')
        .order('nama_prodi');

      if (error) throw error;

      res.status(200).json({
        success: true,
        data: data || []
      });
    } catch (error) {
      console.error('Error getting all prodi:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengambil data program studi',
        data: []
      });
    }
  }
}

module.exports = new FakultasController();