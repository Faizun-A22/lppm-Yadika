const supabase = require('./config/database');
const luaranKknController = require('./controllers/admin/luaranKknController');
const notifikasiController = require('./controllers/admin/notifikasiController');

async function runNotificationTest() {
    console.log('🏁 Starting Notification Verification & Read Simulation...');
    const userId = 'fbd2ae83-cddf-49e8-bf4b-858b0474eaec'; // Yudi's ID
    let testLuaranId = null;
    let testNotifId = null;

    try {
        // 1. Find a valid registrasi_kkn for Yudi
        const { data: reg } = await supabase
            .from('registrasi_kkn')
            .select('id_registrasi')
            .eq('id_user', userId)
            .limit(1)
            .single();

        if (!reg) {
            throw new Error('Yudi has no registrasi_kkn records to link to.');
        }

        // 2. Create a mock KKN luaran
        console.log('\n--- 1. Creating mock KKN luaran for Yudi ---');
        const { data: newLuaran, error: insertError } = await supabase
            .from('luaran_kkn')
            .insert([{
                id_registrasi: reg.id_registrasi,
                judul_kegiatan: 'SIMULASI KKN: Literasi Digital Kelompok Yudi',
                status: 'pending'
            }])
            .select()
            .single();

        if (insertError) throw insertError;
        testLuaranId = newLuaran.id_luaran;
        console.log(`✅ Mock Luaran created. ID: ${testLuaranId}`);

        // 3. Simulate Admin approving the Luaran
        console.log('\n--- 2. Simulating Admin verifying/approving Luaran ---');
        const reqVerify = {
            params: { id: testLuaranId },
            body: { status: 'approved', catatan: 'Bagus sekali hasil laporannya!' }
        };

        let verifyStatus = 200;
        let verifyJson = null;
        const resVerify = {
            status: function(code) { verifyStatus = code; return this; },
            json: function(data) { verifyJson = data; return this; }
        };

        await luaranKknController.verifikasiLuaran(reqVerify, resVerify);
        console.log(`Verify Response Status: ${verifyStatus}`);
        console.log('Verify Response JSON:', verifyJson);

        if (verifyStatus !== 200 || !verifyJson.success) {
            throw new Error(`Verification simulation failed: ${verifyJson?.message}`);
        }
        console.log('✅ Luaran verification simulation completed with success!');

        // 4. Check if notification is created in Database for Yudi
        console.log('\n--- 3. Verifying notification was created in database ---');
        const { data: notifs, error: notifError } = await supabase
            .from('notifikasi')
            .select('*')
            .eq('id_user', userId)
            .order('created_at', { ascending: false });

        if (notifError || notifs.length === 0) {
            throw new Error(`Failed to find notification: ${notifError?.message || 'No notifications found'}`);
        }

        const latestNotif = notifs[0];
        testNotifId = latestNotif.id_notifikasi;
        console.log('Latest notification details:');
        console.log(`   - ID: ${latestNotif.id_notifikasi}`);
        console.log(`   - Judul: ${latestNotif.judul}`);
        console.log(`   - Pesan: ${latestNotif.pesan}`);
        console.log(`   - Dibaca: ${latestNotif.dibaca}`);

        if (!latestNotif.judul.includes('Disetujui')) {
            throw new Error('Notification title mismatch, does not contain "Disetujui"');
        }
        console.log('✅ Notification creation verified successfully!');

        // 5. Simulate Student marking this notification as read
        console.log('\n--- 4. Simulating Student marking notification as read ---');
        const reqRead = {
            user: { id_user: userId },
            params: { id: testNotifId }
        };

        let readStatus = 200;
        let readJson = null;
        const resRead = {
            status: function(code) { readStatus = code; return this; },
            json: function(data) { readJson = data; return this; }
        };
        const next = (err) => {
            console.error('❌ Original controller exception:', err);
        };

        await notifikasiController.markAsRead(reqRead, resRead, next);
        console.log(`Read Response Status: ${readStatus}`);
        console.log('Read Response JSON:', readJson);

        if (readStatus !== 200 || !readJson.success) {
            throw new Error(`Mark as read simulation failed: ${readJson?.message}`);
        }

        // 6. Verify notification is deleted (or updated) from Database
        console.log('\n--- 5. Verifying notification is deleted from Database ---');
        const { data: updatedNotif, error: verifyNotifError } = await supabase
            .from('notifikasi')
            .select('id_notifikasi')
            .eq('id_notifikasi', testNotifId)
            .maybeSingle();

        if (verifyNotifError) throw verifyNotifError;
        console.log(`Notification exists in DB: ${!!updatedNotif}`);
        if (updatedNotif) {
            throw new Error('Notification was not deleted after marking as read!');
        }
        console.log('✅ Notification deletion (mark as read) verified successfully!');
        
        console.log('\n🎉 ALL NOTIFICATION SIMULATION TESTS PASSED SUCCESSFULLY!');

    } catch (e) {
        console.error('\n❌ SIMULATION TEST FAILED!');
        console.error(e.message);
    } finally {
        // 7. Cleanup mock data
        console.log('\n--- 6. Cleaning up mock data... ---');
        if (testLuaranId) {
            await supabase.from('luaran_kkn').delete().eq('id_luaran', testLuaranId);
            console.log('🧹 Cleaned up mock luaran');
        }
        if (testNotifId) {
            await supabase.from('notifikasi').delete().eq('id_notifikasi', testNotifId);
            console.log('🧹 Cleaned up mock notification');
        }
        console.log('🏁 Simulation Test Closed.');
    }
}

runNotificationTest();
