const supabase = require('./config/database');
const bcrypt = require('bcryptjs');

async function updatePassword() {
    try {
        console.log('Hashing password for Yudi...');
        const hashedPassword = await bcrypt.hash('yudi1234', 10);
        console.log('Updating password for yudi@gmail.com in local DB...');
        const { data, error } = await supabase
            .from('users')
            .update({ password: hashedPassword })
            .eq('email', 'yudi@gmail.com');

        if (error) {
            console.error('Update failed:', error);
        } else {
            console.log('Password updated successfully for Yudi!');
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

updatePassword();
