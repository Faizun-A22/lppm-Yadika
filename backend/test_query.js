const supabase = require('./config/database');

async function testQuery() {
    try {
        console.log('Querying notifications for Yudi...');
        const { data, error } = await supabase
            .from('notifikasi')
            .select('*')
            .eq('id_user', 'fbd2ae83-cddf-49e8-bf4b-858b0474eaec');

        if (error) {
            console.error('Query failed:', error);
        } else {
            console.log(`Found ${data.length} notifications:`);
            console.log(data);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

testQuery();
