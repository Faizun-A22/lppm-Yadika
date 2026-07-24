const supabase = require('./config/database');

async function testQuery() {
    try {
        console.log('Querying documents by ABDUL ROKHIM...');
        const { data, error } = await supabase
            .from('repository_dokumen')
            .select('id_dokumen, judul, abstrak, keywords')
            .ilike('penulis', '%ABDUL ROKHIM%');

        if (error) {
            console.error('Query failed:', error);
        } else {
            console.log('Query succeeded! Total records:', data.length);
            data.forEach((row, i) => {
                console.log(`\n--- Record ${i + 1} ---`);
                console.log(`ID: ${row.id_dokumen}`);
                console.log(`Judul: ${row.judul}`);
                console.log(`Abstrak: ${row.abstrak ? row.abstrak.substring(0, 100) + '...' : null}`);
                console.log(`Keywords: ${row.keywords}`);
            });
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

testQuery();
