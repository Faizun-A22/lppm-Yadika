const supabase = require('./config/database');

async function testQuery() {
    try {
        console.log('Running test query with !inner join...');
        const { data, error } = await supabase
            .from('pendaftar_kegiatan')
            .select(`
                id_pendaftaran,
                kegiatan:kegiatan!pendaftar_kegiatan_id_kegiatan_fkey!inner (
                    id_kegiatan,
                    nama_kegiatan,
                    jenis_kegiatan
                )
            `)
            .eq('kegiatan.jenis_kegiatan', 'magang')
            .limit(5);

        if (error) {
            console.error('Query failed:', error);
        } else {
            console.log('Query succeeded! Result:', data);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

testQuery();
