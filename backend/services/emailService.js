// services/emailService.js

const nodemailer = require('nodemailer');

class EmailService {
  /**
   * Mengambil transporter SMTP secara dinamis dari .env
   * @private
   */
  _getTransporter() {
    const host = (process.env.SMTP_HOST || '').trim();
    const port = parseInt(process.env.SMTP_PORT, 10) || 465;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    const user = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
    const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim();

    if (host && user && pass && !user.includes('email_anda') && !pass.includes('app_password')) {
      try {
        return nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          family: 4, // Gunakan IPv4 langsung untuk menghindari delay DNS/IPv6 di VPS
          connectionTimeout: 6000,
          greetingTimeout: 6000,
          socketTimeout: 6000,
          tls: {
            rejectUnauthorized: false
          }
        });
      } catch (err) {
        console.error('❌ EmailService transporter create error:', err.message);
        return null;
      }
    }
    return null;
  }

  /**
   * Kirim email reset password dengan kode verifikasi (OTP) dan link reset
   * @param {Object} options
   * @param {string} options.to - Alamat email penerima
   * @param {string} options.name - Nama pengguna
   * @param {string} options.otp - Kode OTP 6 digit
   * @param {string} options.resetUrl - URL langsung reset password
   * @returns {Promise<Object>}
   */
  async sendResetPasswordEmail({ to, name, otp, resetUrl }) {
    const user = (process.env.SMTP_USER || '').trim();
    
    // Alamat sender HARUS menggunakan email Gmail terautentikasi agar Google TIDAK menahan/mengantrekan email 5 menit karena greylisting domain mismatch!
    let sender = user ? `"LPPM ITB Yadika" <${user}>` : '"LPPM ITB Yadika" <noreply@yadika.ac.id>';

    const subject = '🔐 Kode OTP Reset Sandi - LPPM ITB Yadika';

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; }
        .email-container { max-width: 580px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.07); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px 24px; text-align: center; color: #ffffff; }
        .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
        .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; letter-spacing: 1px; text-transform: uppercase; }
        .content { padding: 35px 30px; color: #334155; line-height: 1.6; }
        .greeting { font-size: 17px; font-weight: 700; color: #1e293b; margin-bottom: 12px; }
        .otp-box { background: #f8fafc; border: 2px dashed #667eea; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0; }
        .otp-label { font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; font-weight: 700; margin-bottom: 8px; }
        .otp-code { font-size: 34px; font-weight: 800; color: #4338ca; letter-spacing: 8px; font-family: monospace; }
        .btn-container { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff !important; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.35); }
        .expiry-note { font-size: 13px; color: #d97706; background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 10px 14px; border-radius: 6px; margin: 20px 0; }
        .footer { background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
        .url-box { font-size: 12px; color: #64748b; word-break: break-all; background: #f1f5f9; padding: 10px; border-radius: 6px; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header">
          <h1>LPPM ITB YADIKA</h1>
          <p>Lembaga Penelitian dan Pengabdian Masyarakat</p>
        </div>
        <div class="content">
          <div class="greeting">Halo, ${name || 'Pengguna'}!</div>
          <p>Kami menerima permintaan untuk mereset kata sandi akun LPPM ITB Yadika Anda yang tertaut dengan alamat email <strong>${to}</strong>.</p>
          
          <div class="otp-box">
            <div class="otp-label">Kode Verifikasi (OTP) Anda</div>
            <div class="otp-code">${otp}</div>
          </div>

          <p style="text-align: center; margin-bottom: 8px;">Atau gunakan tombol di bawah ini untuk langsung mengatur ulang kata sandi Anda:</p>
          <div class="btn-container">
            <a href="${resetUrl}" target="_blank" class="btn">Reset Kata Sandi Sekarang</a>
          </div>

          <div class="expiry-note">
            ⚠️ <strong>Penting:</strong> Kode verifikasi dan link di atas hanya berlaku selama <strong>15 menit</strong>.
          </div>

          <p style="font-size: 13px; color: #64748b;">Jika tombol di atas tidak dapat diklik, salin dan tempel tautan berikut ke browser Anda:</p>
          <div class="url-box">${resetUrl}</div>

          <p style="font-size: 13px; color: #94a3b8; margin-top: 25px;">Jika Anda tidak pernah meminta perubahan kata sandi ini, silakan abaikan email ini. Akun Anda tetap aman.</p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} LPPM Institut Teknologi dan Bisnis Yadika Pasuruan.<br>
          Email ini dibuat secara otomatis oleh sistem. Mohon tidak membalas email ini.
        </div>
      </div>
    </body>
    </html>
    `;

    console.log('\n================== [ EMAIL NOTIFICATION ] ==================');
    console.log(`✉️ To      : ${to}`);
    console.log(`👤 Name    : ${name}`);
    console.log(`🔑 OTP     : ${otp}`);
    console.log(`🔗 Link    : ${resetUrl}`);
    console.log('============================================================\n');

    const transporter = this._getTransporter();

    if (transporter) {
      try {
        // Balap pengiriman email dengan timeout 8 detik agar frontend TIDAK PERNAH memutar/hang
        const mailPromise = transporter.sendMail({
          from: sender,
          to,
          subject,
          html: htmlContent
        });

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Waktu pengiriman SMTP habis (timeout 8s)')), 8000)
        );

        const info = await Promise.race([mailPromise, timeoutPromise]);
        console.log(`✅ Email berhasil terkirim ke ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId, delivered: true };
      } catch (err) {
        console.error(`⚠️ Gagal/Timeout mengirim email ke ${to} via SMTP:`, err.message);
        return { success: true, delivered: false, error: err.message, devOtp: otp };
      }
    } else {
      console.log('ℹ️ EmailService: Menggunakan mode simulasi (log server)');
      return { 
        success: true, 
        delivered: false, 
        isSimulated: true, 
        message: 'SMTP belum dikonfigurasi, email dicatat di log server.',
        devOtp: otp,
        devResetUrl: resetUrl
      };
    }
  }
}

module.exports = new EmailService();
