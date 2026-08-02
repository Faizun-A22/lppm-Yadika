const supabase = require('./config/database');

async function testQuery() {
    try {
        console.log('Inserting mock row to luaran_kkn to inspect columns...');
        // Let's find a valid id_registrasi first
        const { data: reg } = await supabase
            .from('registrasi_kkn')
            .select('id_registrasi')
            .limit(1)
            .single();
            
        if (!reg) {
            console.log('No registrasi_kkn record found to link to');
            return;
        }
        
        const { data, error } = await supabase
            .from('luaran_kkn')
            .insert([{
                id_registrasi: reg.id_registrasi,
                judul_kegiatan: 'Test Mock Judul',
                status: 'pending'
            }])
            .select();
            
        if (error) {
            console.error('Insert failed:', error);
        } else {
            console.log('Insert succeeded! Record columns:', Object.keys(data[0] || {}));
            console.log('Record data:', data[0]);
            
            // Clean up immediately
            await supabase
                .from('luaran_kkn')
                .delete()
                .eq('id_luaran', data[0].id_luaran);
            console.log('Cleaned up mock row');
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

testQuery();
