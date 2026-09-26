const supabase = require('./config/database');

async function inspect() {
    try {
        console.log('Querying penelitian...');
        const { data: penData, error: penError } = await supabase
            .from('penelitian')
            .select('id_penelitian, judul, file_proposal, file_laporan_kemajuan, file_laporan_akhir, status')
            .limit(5);

        if (penError) {
            console.error('penelitian query failed:', penError);
        } else {
            console.log('Penelitian entries:');
            console.log(JSON.stringify(penData, null, 2));
        }

        console.log('Querying pengabdian...');
        const { data: pengData, error: pengError } = await supabase
            .from('pengabdian')
            .select('id_pengabdian, judul, file_proposal, file_laporan_kemajuan, file_laporan_akhir, status')
            .limit(5);

        if (pengError) {
            console.error('pengabdian query failed:', pengError);
        } else {
            console.log('Pengabdian entries:');
            console.log(JSON.stringify(pengData, null, 2));
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

inspect();
