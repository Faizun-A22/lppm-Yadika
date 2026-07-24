const supabase = require('./config/database');

async function getEnums() {
    try {
        console.log('Querying enum values for status_submission...');
        const { data, error } = await supabase.rpc('get_enum_values', { enum_type: 'status_submission' });
        
        if (error) {
            // Fallback: Query pg_enum via custom SQL if rpc is not defined
            console.log('RPC get_enum_values not found. Querying database using direct sql query if possible...');
            
            // Let's try to update status to some random value and see the postgres error message, which list the allowed values!
            const { error: testError } = await supabase
                .from('penelitian')
                .update({ status: 'invalid_status_test_value' })
                .eq('id_penelitian', 'ff744325-42c3-4fe1-b5a6-0d1302961638');
                
            console.log('Postgres Error Message (will contain allowed enum values):');
            console.log(testError?.message);
        } else {
            console.log('Enum values:', data);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

getEnums();
