const supabase = require('../../config/database');
const { formatResponse, formatError } = require('../../utils/responseFormatter');

const dashboardController = {
    async getStats(req, res) {
        try {
            // Get KKN stats
            const { data: kknData, error: kknError } = await supabase
                .from('registrasi_kkn')
                .select('status');

            if (kknError) throw kknError;

            // Get Magang stats
            const { data: magangData, error: magangError } = await supabase
                .from('registrasi_magang')
                .select('status');

            if (magangError) throw magangError;

            // Get Desa stats
            const { data: desaData, error: desaError } = await supabase
                .from('desa_kkn')
                .select('kuota, kuota_terisi, status')
                .eq('status', 'aktif');

            if (desaError) throw desaError;

            // Get Program stats
            const { data: programData, error: programError } = await supabase
                .from('programs')
                .select('jenis');

            if (programError) throw programError;

            // Process KKN stats
            const kknStats = {
                total: kknData.length,
                pending: kknData.filter(d => d.status === 'pending').length,
                approved: kknData.filter(d => d.status === 'approved').length,
                rejected: kknData.filter(d => d.status === 'rejected').length,
                verified: kknData.filter(d => d.status === 'verified').length
            };

            // Process Magang stats
            const magangStats = {
                total: magangData.length,
                pending: magangData.filter(d => d.status === 'pending').length,
                approved: magangData.filter(d => d.status === 'approved').length,
                rejected: magangData.filter(d => d.status === 'rejected').length,
                verified: magangData.filter(d => d.status === 'verified').length
            };

            // Process Desa stats
            const villages = {
                total: desaData.length,
                total_quota: desaData.reduce((sum, d) => sum + (d.kuota || 0), 0),
                used_quota: desaData.reduce((sum, d) => sum + (d.kuota_terisi || 0), 0)
            };

            // Process Program stats
            const programs = {
                total: programData.length,
                kkn: programData.filter(d => d.jenis === 'kkn').length,
                magang: programData.filter(d => d.jenis === 'magang').length
            };

            return res.status(200).json(
                formatResponse('success', 'Statistik berhasil diambil', {
                    kkn: kknStats,
                    magang: magangStats,
                    villages,
                    programs
                })
            );
        } catch (error) {
            console.error('Error in getStats:', error);
            return res.status(500).json(formatError('Gagal mengambil statistik'));
        }
    }
};

module.exports = dashboardController;