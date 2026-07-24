const supabase = require('./config/database');
const penelitianService = require('./services/dosen/penelitianService');
const repositoryService = require('./services/dosen/repositoryService');

async function runSimulation() {
    console.log('🏁 Starting Dosen & Admin Lifecycle Integration Test...');
    let testPenelitianId = null;
    let testDocId = null;

    try {
        // 1. Fetch Dosen User
        console.log('\n--- 1. Fetching Dosen profile for Budi ---');
        const { data: dosen, error: userError } = await supabase
            .from('users')
            .select('id_user, nama_lengkap, email')
            .eq('email', 'budi@gmail.com')
            .single();

        if (userError || !dosen) {
            throw new Error(`Failed to find Dosen Budi: ${userError?.message}`);
        }
        console.log(`✅ Found Dosen: ${dosen.nama_lengkap} (${dosen.id_user})`);

        // 2. Simulate Lecturer submitting research proposal via penelitianService
        console.log('\n--- 2. Simulating Lecturer submitting research proposal via penelitianService ---');
        const mockPenelitianData = {
            id_ketua: dosen.id_user,
            judul: 'SIMULASI PENELITIAN: Pengembangan Sistem Repository Integratif LPPM',
            skema: 'penelitian_dasar',
            tahun: 2026,
            durasi: 12,
            dana_diajukan: 15000000,
            jenis_pendanaan: 'internal',
            file_proposal: 'uploads/others/test-simulation-proposal.pdf',
            created_by: dosen.id_user
        };

        const newPenelitian = await penelitianService.createPenelitian(mockPenelitianData);

        if (!newPenelitian) {
            throw new Error('Failed to submit research proposal: Service returned empty');
        }
        testPenelitianId = newPenelitian.id_penelitian;
        console.log(`✅ Research proposal submitted successfully! ID: ${testPenelitianId}, Status: ${newPenelitian.status}`);

        // 3. Simulate Admin reviewing and approving the proposal
        console.log('\n--- 3. Simulating Admin reviewing & approving proposal ---');
        const { data: approvedPenelitian, error: approveError } = await supabase
            .from('penelitian')
            .update({ status: 'diterima' }) // Use exact 'diterima' enum value
            .eq('id_penelitian', testPenelitianId)
            .select()
            .single();

        if (approveError || !approvedPenelitian) {
            throw new Error(`Failed to approve research proposal: ${approveError?.message}`);
        }
        console.log(`✅ Research proposal approved by Admin! ID: ${approvedPenelitian.id_penelitian}, New Status: ${approvedPenelitian.status}`);

        // 4. Simulate Dosen uploading publication to repository
        console.log('\n--- 4. Simulating Dosen uploading research output/journal to Repository ---');
        const mockFile = {
            filename: 'jurnal-simulation-lppm.pdf',
            originalname: 'jurnal-simulation-lppm.pdf',
            path: 'uploads\\repository\\jurnal\\jurnal-simulation-lppm.pdf',
            size: 245000,
            mimetype: 'application/pdf'
        };

        const mockRepoData = {
            judul: 'SIMULASI JURNAL: Hasil Implementasi Sistem Repository Terintegrasi LPPM Yadika',
            tipe: 'jurnal',
            tahun: 2026,
            penulis: [dosen.nama_lengkap, 'Tim IT LPPM'],
            abstrak: 'Abstrak hasil simulasi sistem repository untuk menguji kelayakan alur integrasi dosen dan admin.',
            kata_kunci: ['simulatif', 'repository', 'lppm'],
            visibility: 'public'
        };

        const uploadResult = await repositoryService.createRepository(dosen.id_user, mockRepoData, mockFile);

        if (!uploadResult.success) {
            throw new Error(`Repository upload failed: ${uploadResult.message}`);
        }
        testDocId = uploadResult.data.id;
        console.log(`✅ Journal uploaded and published successfully to repository! ID: ${testDocId}`);

        // 5. Verify the uploaded journal is accessible in public repository search
        console.log('\n--- 5. Simulating Public user searching the Repository ---');
        const { data: searchResults, error: searchError } = await supabase
            .from('repository_dokumen')
            .select('id_dokumen, judul, penulis, status')
            .eq('id_dokumen', testDocId)
            .single();

        if (searchError || !searchResults) {
            throw new Error(`Public search failed to retrieve the journal: ${searchError?.message}`);
        }
        console.log(`✅ Public User successfully retrieved the journal detail!`);
        console.log(`   - Judul: ${searchResults.judul}`);
        console.log(`   - Penulis: ${searchResults.penulis}`);
        console.log(`   - Status Publikasi: ${searchResults.status}`);

        console.log('\n🎉 ALL SIMULATION TESTS PASSED SUCCESSFULLY!');
        console.log('   The integration from Lecturer Proposal -> Admin Approval -> Journal Publication works perfectly!');

    } catch (e) {
        console.error('\n❌ SIMULATION TEST FAILED!');
        console.error(e.message);
    } finally {
        // 6. CLEAN UP test data
        console.log('\n--- 6. Cleaning up test data from Supabase... ---');
        if (testPenelitianId) {
            const { error: cleanPenError } = await supabase
                .from('penelitian')
                .delete()
                .eq('id_penelitian', testPenelitianId);
            if (cleanPenError) console.error('Failed to cleanup penelitian:', cleanPenError.message);
            else console.log('🧹 Cleaned up mock penelitian');
        }
        if (testDocId) {
            const { error: cleanDocError } = await supabase
                .from('repository_dokumen')
                .delete()
                .eq('id_dokumen', testDocId);
            if (cleanDocError) console.error('Failed to cleanup document:', cleanDocError.message);
            else console.log('🧹 Cleaned up mock repository document');
        }
        console.log('🧹 Cleanup done. Integration Test Closed.');
    }
}

runSimulation();
