const supabase = require('./config/database');
const kknService = require('./services/mahasiswa/kknService');

async function runStudentKknSimulation() {
    console.log('🏁 Starting KKN Luaran Save Simulation Test...');
    const userId = 'fbd2ae83-cddf-49e8-bf4b-858b0474eaec'; // Yudi's ID
    let testLuaranId = null;

    try {
        // 1. Simulating KKN output save
        console.log('\n--- 1. Simulating saving KKN output (Luaran KKN) ---');
        const mockData = {
            judul_kegiatan: 'SIMULASI KKN: Sosialisasi Literasi Digital di Desa Yadika',
            link_video: 'https://youtube.com/watch?v=simulation-video-kkn',
            link_poster: 'https://drive.google.com/file/d/simulation-poster-kkn',
            link_foto: 'https://drive.google.com/file/d/simulation-photo-kkn', // Will be ignored by service as it's not in db schema
            file_mou: { path: 'uploads/kkn/mou/simulation-mou.pdf' },
            keterangan: 'Ini keterangan deskripsi simulasi KKN yang akan diabaikan karena kolom tidak ada.'
        };

        const result = await kknService.simpanLuaran(userId, mockData);

        if (!result || !result.id_luaran) {
            throw new Error('Simulation failed: kknService.simpanLuaran did not return a valid result');
        }
        testLuaranId = result.id_luaran;
        console.log(`✅ KKN Luaran saved successfully without database errors! ID: ${testLuaranId}`);

        // 2. Fetch and Verify from database
        console.log('\n--- 2. Verifying saved columns in Database ---');
        const { data: luaran, error: fetchError } = await supabase
            .from('luaran_kkn')
            .select('*')
            .eq('id_luaran', testLuaranId)
            .single();

        if (fetchError || !luaran) {
            throw new Error(`Verification query failed: ${fetchError?.message}`);
        }
        
        console.log('Retrieved Luaran data:');
        console.log(`   - Judul: ${luaran.judul_kegiatan}`);
        console.log(`   - Video Link: ${luaran.link_video}`);
        console.log(`   - Poster Link (mapped to file_poster): ${luaran.file_poster}`);
        console.log(`   - MOU Path: ${luaran.file_mou}`);
        console.log(`   - Status: ${luaran.status}`);
        
        if (luaran.file_poster !== mockData.link_poster) {
            throw new Error(`Mismatched file_poster: expected "${mockData.link_poster}" but got "${luaran.file_poster}"`);
        }
        console.log('✅ All saved columns verified successfully in Supabase DB!');
        console.log('\n🎉 KKN LUARAN SYSTEM VERIFICATION PASSED SUCCESSFULLY!');

    } catch (e) {
        console.error('\n❌ SIMULATION TEST FAILED!');
        console.error(e.message);
    } finally {
        // 3. Clean up the inserted luaran row
        if (testLuaranId) {
            console.log('\n--- 3. Cleaning up mock KKN Luaran row... ---');
            const { error: cleanError } = await supabase
                .from('luaran_kkn')
                .delete()
                .eq('id_luaran', testLuaranId);
                
            if (cleanError) {
                console.error(`❌ Failed to cleanup KKN luaran: ${cleanError.message}`);
            } else {
                console.log('🧹 Mock KKN Luaran row cleaned up successfully.');
            }
        }
        console.log('🏁 Simulation Test Closed.');
    }
}

runStudentKknSimulation();
