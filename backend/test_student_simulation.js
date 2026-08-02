const supabase = require('./config/database');
const profilController = require('./controllers/mahasiswa/profilController');

async function runStudentSimulation() {
    console.log('🏁 Starting Student File Upload Simulation Test...');
    const userId = 'fbd2ae83-cddf-49e8-bf4b-858b0474eaec'; // Yudi's ID
    let oldFoto = null;

    try {
        // 1. Fetch current profile to backup old foto_profil
        console.log('\n--- 1. Backup old photo profile ---');
        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('foto_profil')
            .eq('id_user', userId)
            .single();

        if (fetchError) {
            throw new Error(`Failed to fetch Yudi profile: ${fetchError.message}`);
        }
        oldFoto = user.foto_profil;
        console.log(`✅ Current photo profile path: ${oldFoto}`);

        // 2. Mock Request and Response for photo upload (.webp simulation)
        console.log('\n--- 2. Simulating WebP profile photo upload ---');
        const req = {
            user: { id_user: userId },
            file: {
                filename: 'test-profile-pic-yudi-simulation.webp',
                size: 512 * 1024, // 512 KB
                mimetype: 'image/webp'
            }
        };

        let responseStatus = 200;
        let responseJson = null;

        const res = {
            status: function(code) {
                responseStatus = code;
                return this;
            },
            json: function(data) {
                responseJson = data;
                return this;
            }
        };

        // Invoke the controller method
        await profilController.uploadFotoProfil(req, res);

        console.log(`Response Status: ${responseStatus}`);
        console.log('Response JSON:', responseJson);

        if (responseStatus !== 200 || !responseJson.success) {
            throw new Error(`Upload simulation failed: ${responseJson?.message || 'Unknown error'}`);
        }
        console.log('✅ Photo upload simulation completed with success response!');

        // 3. Verify in Database that the profile photo was updated
        console.log('\n--- 3. Verifying updated photo profile path in Database ---');
        const { data: updatedUser, error: verifyError } = await supabase
            .from('users')
            .select('foto_profil')
            .eq('id_user', userId)
            .single();

        if (verifyError) {
            throw new Error(`Verification query failed: ${verifyError.message}`);
        }
        console.log(`Database Foto Profil: ${updatedUser.foto_profil}`);
        if (updatedUser.foto_profil !== `/uploads/profil/test-profile-pic-yudi-simulation.webp`) {
            throw new Error(`Mismatched photo profile path in database: expected "/uploads/profil/test-profile-pic-yudi-simulation.webp" but got "${updatedUser.foto_profil}"`);
        }
        console.log('✅ Updated path in database verified successfully!');
        
        console.log('\n🎉 STUDENT FILE UPLOAD SIMULATION PASSED SUCCESSFULLY!');

    } catch (e) {
        console.error('\n❌ SIMULATION TEST FAILED!');
        console.error(e.message);
    } finally {
        // 4. Restore old photo path to keep database clean
        console.log('\n--- 4. Restoring old photo path... ---');
        const { error: restoreError } = await supabase
            .from('users')
            .update({ foto_profil: oldFoto })
            .eq('id_user', userId);

        if (restoreError) {
            console.error(`❌ Failed to restore old photo profile: ${restoreError.message}`);
        } else {
            console.log('🧹 Database restored to original state.');
        }
        console.log('🏁 Integration Test Closed.');
    }
}

runStudentSimulation();
