const supabase = require('./config/database');

const rpcList = ['run_sql', 'exec_sql', 'sql_query', 'execute_sql', 'sql'];

async function probeSql() {
    // We want to try to run a query to add updated_at column to notifikasi table
    const sqlQuery = `ALTER TABLE notifikasi ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();`;
    
    for (const rpcName of rpcList) {
        try {
            console.log(`Trying RPC: ${rpcName}...`);
            const { data, error } = await supabase.rpc(rpcName, { sql: sqlQuery, query: sqlQuery });
            if (!error) {
                console.log(`🎉 SUCCESS with RPC: ${rpcName}!`);
                console.log('Result:', data);
                return;
            } else {
                console.log(`❌ Failed with RPC ${rpcName}:`, error.message);
            }
        } catch (e) {
            console.log(`Exception with RPC ${rpcName}:`, e.message);
        }
    }
    console.log('No SQL execution RPC found.');
}

probeSql();
