// seed-admin.js
// ⚠️ FILE INI HANYA UNTUK REGISTRASI ADMIN SATU KALI
// Jalankan: node seed-admin.js
// SETELAH BERHASIL, HAPUS ATAU RENAME FILE INI!

const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Konfigurasi Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERROR: SUPABASE_URL atau SUPABASE_KEY tidak ditemukan di .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Data Admin yang akan didaftarkan
const adminData = {
    nama_lengkap: 'Administrator LPPM',
    email: 'admin@yadika.ac.id',
    password: 'admin1234',  // Ganti dengan password yang Anda inginkan
    role: 'admin',
    status: 'aktif',
    nidn: null,
    nim: null,
    no_hp: '081234567890',
    id_prodi: null
};

// Validasi ID Prodi (opsional - cek prodi yang tersedia)
async function getAvailableProdi() {
    console.log('\n📋 Daftar Program Studi yang tersedia:');
    const { data, error } = await supabase
        .from('program_studi')
        .select('id_prodi, nama_prodi')
        .limit(5);
    
    if (!error && data && data.length > 0) {
        console.log('   (Untuk referensi jika ingin assign admin ke prodi tertentu)');
        data.forEach(prodi => {
            console.log(`   - ${prodi.nama_prodi} (ID: ${prodi.id_prodi})`);
        });
    }
    console.log('');
}

// Fungsi utama registrasi admin
async function registerAdmin() {
    console.log('========================================');
    console.log('🔐 REGISTRASI ADMIN - ONE TIME SETUP');
    console.log('========================================\n');

    // 1. Validasi input
    if (!adminData.email || !adminData.password) {
        console.error('❌ ERROR: Email dan password harus diisi!');
        process.exit(1);
    }

    if (adminData.password.length < 6) {
        console.error('❌ ERROR: Password minimal 6 karakter!');
        process.exit(1);
    }

    // 2. Cek apakah admin sudah ada
    console.log('🔍 Mengecek apakah admin sudah terdaftar...');
    const { data: existingAdmin, error: checkError } = await supabase
        .from('users')
        .select('id_user, email, role')
        .eq('email', adminData.email)
        .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
        console.error('❌ ERROR saat cek admin:', checkError.message);
        process.exit(1);
    }

    if (existingAdmin) {
        console.log(`\n⚠️  Admin dengan email "${adminData.email}" sudah terdaftar!`);
        console.log(`   Role: ${existingAdmin.role}`);
        console.log(`   ID: ${existingAdmin.id_user}`);
        console.log('\n💡 Tidak perlu registrasi ulang.');
        console.log('💡 Jika lupa password, gunakan query UPDATE password.\n');
        
        // Tampilkan program studi yang tersedia
        await getAvailableProdi();
        
        console.log('✅ Selesai. File ini bisa dihapus.\n');
        process.exit(0);
    }

    // 3. Hash password
    console.log('🔒 Mengenkripsi password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminData.password, salt);

    // 4. Siapkan data untuk insert
    const userToInsert = {
        nama_lengkap: adminData.nama_lengkap,
        email: adminData.email.toLowerCase(),
        password: hashedPassword,
        role: adminData.role,
        status: adminData.status,
        nidn: adminData.nidn,
        nim: adminData.nim,
        no_hp: adminData.no_hp,
        id_prodi: adminData.id_prodi,
        created_at: new Date(),
        updated_at: new Date()
    };

    console.log('📝 Data admin yang akan didaftarkan:');
    console.log(`   Nama: ${userToInsert.nama_lengkap}`);
    console.log(`   Email: ${userToInsert.email}`);
    console.log(`   Role: ${userToInsert.role}`);
    console.log(`   No HP: ${userToInsert.no_hp}`);
    console.log('');

    // 5. Insert ke database
    console.log('💾 Menyimpan ke database...');
    const { data: insertedUser, error: insertError } = await supabase
        .from('users')
        .insert([userToInsert])
        .select('id_user, email, nama_lengkap, role, created_at');

    if (insertError) {
        console.error('❌ ERROR saat registrasi admin:');
        console.error(`   Code: ${insertError.code}`);
        console.error(`   Message: ${insertError.message}`);
        
        if (insertError.code === '23505') {
            console.error('\n💡 Kemungkinan: Email sudah terdaftar atau ada constraint lain.');
        } else if (insertError.code === '23502') {
            console.error('\n💡 Kemungkinan: Ada field wajib yang tidak diisi.');
        }
        
        process.exit(1);
    }

    // 6. Sukses!
    console.log('\n✅ REGISTRASI ADMIN BERHASIL!');
    console.log('========================================');
    console.log(`📧 Email: ${adminData.email}`);
    console.log(`🔑 Password: ${adminData.password}`);
    console.log(`👤 Nama: ${adminData.nama_lengkap}`);
    console.log(`🆔 User ID: ${insertedUser[0]?.id_user}`);
    console.log(`📅 Tanggal: ${new Date().toLocaleString()}`);
    console.log('========================================');
    console.log('\n⚠️  PENTING:');
    console.log('1. Simpan password ini di tempat aman!');
    console.log('2. File seed-admin.js ini harus DIHAPUS setelah berhasil!');
    console.log('3. Login dengan email dan password di atas.\n');

    // Tampilkan program studi yang tersedia (opsional)
    await getAvailableProdi();

    console.log('🔐 Setup selesai. Silakan hapus file ini.\n');
    process.exit(0);
}

// Tambahkan opsi untuk registrasi dengan password custom dari command line
function registerWithCustomPassword() {
    const args = process.argv.slice(2);
    const customPassword = args.find(arg => arg.startsWith('--password='));
    
    if (customPassword) {
        adminData.password = customPassword.split('=')[1];
        console.log(`\n📝 Menggunakan password kustom dari command line.\n`);
    }
    
    const customEmail = args.find(arg => arg.startsWith('--email='));
    if (customEmail) {
        adminData.email = customEmail.split('=')[1];
    }
    
    const customName = args.find(arg => arg.startsWith('--name='));
    if (customName) {
        adminData.nama_lengkap = customName.split('=')[1];
    }
    
    registerAdmin();
}

// Jalankan
registerWithCustomPassword();