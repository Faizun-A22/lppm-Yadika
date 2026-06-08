const supabase = require('./config/database');

async function test() {
    try {
        const { data, count, error } = await supabase
            .from('registrasi_kkn')
            .select('*', { count: 'exact' });
        
        console.log('=== KKN Registrations Test ===');
        console.log('Exact count in database:', count);
        console.log('Returned data length:', data ? data.length : 0);
        if (error) {
            console.error('Error:', error);
        }

        const { data: dataMagang, count: countMagang, error: errorMagang } = await supabase
            .from('registrasi_magang')
            .select('*', { count: 'exact' });
        
        console.log('=== Magang Registrations Test ===');
        console.log('Exact count in database:', countMagang);
        console.log('Returned data length:', dataMagang ? dataMagang.length : 0);
        if (errorMagang) {
            console.error('Error:', errorMagang);
        }
    } catch (err) {
        console.error('Exception:', err);
    }
}

test();
