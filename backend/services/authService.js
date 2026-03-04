// services/authService.js

const supabase = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { 
  validateEmail, 
  validatePassword, 
  validateName, 
  validateNIM, 
  validateNIDN,
  validateNoHP,
  validateProdiId 
} = require('../utils/validation');

class AuthService {
  /**
   * Register new user
   * @param {Object} userData - Data user yang akan didaftarkan
   * @returns {Object} - Hasil registrasi
   */
  async register(userData) {
    // Destructure dengan menangani baik nim maupun nidn
    const { 
      name, 
      email, 
      password, 
      isDosen, 
      nim,        // Untuk mahasiswa
      nidn,       // Untuk dosen (opsional, bisa dari frontend)
      id_prodi,
      no_hp 
    } = userData;
    
    console.log('=== REGISTER ATTEMPT ===');
    console.log('Input data:', { 
      name, 
      email, 
      isDosen, 
      nim, 
      nidn,
      id_prodi, 
      no_hp 
    });

    // ==================== VALIDASI INPUT DASAR ====================
    this._validateBasicInput(name, email, password, no_hp, id_prodi);

    // ==================== VALIDASI NIM/NIDN ====================
    const identifier = this._validateAndGetIdentifier(isDosen, nim, nidn);

    // ==================== CEK DUPLIKAT ====================
    await this._checkDuplicates(email, isDosen, identifier);

    // ==================== CEK VALIDITAS PRODI ====================
    const prodi = await this._validateProdi(id_prodi);

    // ==================== HASH PASSWORD ====================
    const hashedPassword = await this._hashPassword(password);

    // ==================== SIAPKAN DATA USER ====================
    const newUser = this._prepareUserData({
      name,
      email,
      hashedPassword,
      isDosen,
      identifier,
      id_prodi,
      no_hp,
      prodi
    });

    // ==================== INSERT KE DATABASE ====================
    const registeredUser = await this._insertUser(newUser);

    // ==================== KEMBALIKAN RESPON ====================
    return this._formatRegisterResponse(registeredUser);
  }
  
  /**
   * Login user
   * @param {string} email - Email user
   * @param {string} password - Password user
   * @param {boolean} isAdmin - Flag untuk login sebagai admin
   * @param {boolean} isDosen - Flag untuk login sebagai dosen
   * @returns {Object} - Hasil login dengan token
   */
  async login(email, password, isAdmin = false, isDosen = false) {
    console.log('=== LOGIN ATTEMPT ===');
    console.log('Input:', { email, isAdmin, isDosen });

    // ==================== VALIDASI INPUT ====================
    this._validateLoginInput(email, password);

    // ==================== CARI USER ====================
    const user = await this._findUserByEmail(email);

    // ==================== CEK STATUS AKUN ====================
    this._checkAccountStatus(user);

    // ==================== CEK ROLE ====================
    this._validateUserRole(user, isAdmin, isDosen);

    // ==================== CEK PASSWORD ====================
    await this._verifyPassword(password, user.password, email);

    // ==================== GENERATE TOKEN ====================
    const token = this._generateToken(user);

    // ==================== KEMBALIKAN RESPON ====================
    return this._formatLoginResponse(user, token);
  }
  
  /**
   * Verify JWT token
   * @param {string} token - JWT token
   * @returns {Object} - Decoded token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('Token verified for user:', decoded.email);
      return decoded;
    } catch (error) {
      console.error('Token verification failed:', error.message);
      
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Token tidak valid');
      }
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token telah kadaluarsa');
      }
      throw new Error('Gagal memverifikasi token');
    }
  }

  /**
   * Get user by ID
   * @param {number} userId - ID user
   * @returns {Object} - Data user
   */
  async getUserById(userId) {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        program_studi:program_studi(
          id_prodi,
          nama_prodi,
          jenjang,
          akreditasi,
          id_fakultas,
          fakultas:fakultas(
            id_fakultas,
            nama_fakultas
          )
        )
      `)
      .eq('id_user', userId)
      .single();

    if (error || !user) {
      throw new Error('User tidak ditemukan');
    }

    return user;
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Validasi input dasar untuk registrasi
   * @private
   */
  _validateBasicInput(name, email, password, no_hp, id_prodi) {
    if (!validateName(name)) {
      throw new Error('Nama harus memiliki minimal 3 karakter');
    }
    
    if (!validateEmail(email)) {
      throw new Error('Format email tidak valid');
    }
    
    if (!validatePassword(password)) {
      throw new Error('Password harus memiliki minimal 6 karakter');
    }
    
    if (no_hp && !validateNoHP(no_hp)) {
      throw new Error('Nomor HP harus berisi 10-15 digit angka');
    }

    if (!id_prodi) {
      throw new Error('Program studi harus dipilih');
    }

    if (!validateProdiId(id_prodi)) {
      throw new Error('Format ID program studi tidak valid');
    }
  }

  /**
   * Validasi dan dapatkan identifier (NIM untuk mahasiswa, NIDN untuk dosen)
   * @private
   */
  _validateAndGetIdentifier(isDosen, nim, nidn) {
    if (isDosen) {
      // Untuk dosen, gunakan nidn
      if (!nidn) {
        throw new Error('NIDN harus diisi untuk dosen');
      }
      if (!validateNIDN(nidn)) {
        throw new Error('NIDN harus 10 digit angka');
      }
      return { type: 'nidn', value: nidn };
    } else {
      // Untuk mahasiswa, gunakan nim
      if (!nim) {
        throw new Error('NIM harus diisi untuk mahasiswa');
      }
      if (!validateNIM(nim)) {
        throw new Error('NIM harus maksimal 15 digit angka');
      }
      return { type: 'nim', value: nim };
    }
  }

  /**
   * Cek duplikat email dan NIM/NIDN
   * @private
   */
  async _checkDuplicates(email, isDosen, identifier) {
    // Cek email
    const { data: existingUser } = await supabase
      .from('users')
      .select('email')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    
    if (existingUser) {
      throw new Error('Email sudah terdaftar');
    }
    
    // Cek NIM/NIDN
    const { data: existingIdentifier } = await supabase
      .from('users')
      .select(identifier.type)
      .eq(identifier.type, identifier.value)
      .maybeSingle();
    
    if (existingIdentifier) {
      throw new Error(
        identifier.type === 'nidn' 
          ? 'NIDN sudah terdaftar' 
          : 'NIM sudah terdaftar'
      );
    }
  }

  /**
   * Validasi program studi
   * @private
   */
  async _validateProdi(id_prodi) {
    const { data: prodi, error: prodiError } = await supabase
      .from('program_studi')
      .select(`
        id_prodi, 
        nama_prodi,
        jenjang,
        akreditasi,
        id_fakultas,
        fakultas:fakultas(
          id_fakultas,
          nama_fakultas
        )
      `)
      .eq('id_prodi', id_prodi)
      .single();

    if (prodiError || !prodi) {
      console.error('Prodi validation error:', prodiError);
      throw new Error('Program studi tidak valid atau tidak ditemukan');
    }

    console.log('Valid prodi found:', {
      id: prodi.id_prodi,
      nama: prodi.nama_prodi,
      fakultas: prodi.fakultas?.nama_fakultas
    });

    return prodi;
  }

  /**
   * Hash password
   * @private
   */
  async _hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  /**
   * Siapkan data user untuk insert
   * @private
   */
  _prepareUserData({ name, email, hashedPassword, isDosen, identifier, id_prodi, no_hp, prodi }) {
    const role = isDosen ? 'dosen' : 'mahasiswa';
    
    const newUser = {
      nama_lengkap: name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role,
      status: 'aktif',
      id_prodi: id_prodi,
      no_hp: no_hp || null
    };
    
    // Tambahkan field spesifik berdasarkan role
    if (isDosen) {
      newUser.nidn = identifier.value;
      newUser.nim = null;
      console.log('Data untuk DOSEN:', { 
        nidn: newUser.nidn,
        prodi: prodi.nama_prodi,
        fakultas: prodi.fakultas?.nama_fakultas
      });
    } else {
      newUser.nim = identifier.value;
      newUser.nidn = null;
      console.log('Data untuk MAHASISWA:', { 
        nim: newUser.nim,
        prodi: prodi.nama_prodi,
        fakultas: prodi.fakultas?.nama_fakultas
      });
    }
    
    console.log('Final user object:', JSON.stringify(newUser, null, 2));
    
    return newUser;
  }

  /**
   * Insert user ke database
   * @private
   */
  async _insertUser(newUser) {
    const { data, error } = await supabase
      .from('users')
      .insert([newUser])
      .select(`
        id_user, 
        nama_lengkap, 
        email, 
        role, 
        nim, 
        nidn, 
        id_prodi,
        no_hp, 
        status, 
        created_at,
        program_studi:program_studi(
          id_prodi,
          nama_prodi,
          jenjang,
          akreditasi,
          fakultas:fakultas(
            id_fakultas,
            nama_fakultas
          )
        )
      `);
    
    if (error) {
      console.error('Supabase insert error DETAIL:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // Handle specific error codes
      if (error.code === '23505') { // Unique violation
        throw new Error('Data sudah terdaftar di sistem');
      } else if (error.code === '23502') { // Not null violation
        throw new Error('Field wajib tidak boleh kosong: ' + error.column);
      } else if (error.code === '23503') { // Foreign key violation
        throw new Error('Program studi tidak valid');
      } else {
        throw new Error('Gagal mendaftarkan pengguna: ' + error.message);
      }
    }
    
    if (!data || data.length === 0) {
      throw new Error('Gagal mendaftarkan pengguna: Tidak ada data yang dikembalikan');
    }
    
    console.log('=== REGISTER SUCCESS ===');
    console.log('User registered:', {
      id: data[0].id_user,
      name: data[0].nama_lengkap,
      email: data[0].email,
      role: data[0].role,
      nim: data[0].nim,
      nidn: data[0].nidn,
      prodi: data[0].program_studi?.nama_prodi
    });

    return data[0];
  }

  /**
   * Format response registrasi
   * @private
   */
  _formatRegisterResponse(user) {
    return {
      success: true,
      message: 'Pendaftaran berhasil, silakan login',
      data: {
        user: {
          id: user.id_user,
          name: user.nama_lengkap,
          email: user.email,
          role: user.role,
          prodi: user.program_studi?.nama_prodi || null,
          prodi_detail: user.program_studi ? {
            id: user.program_studi.id_prodi,
            nama: user.program_studi.nama_prodi,
            jenjang: user.program_studi.jenjang,
            akreditasi: user.program_studi.akreditasi
          } : null,
          fakultas: user.program_studi?.fakultas?.nama_fakultas || null,
          fakultas_detail: user.program_studi?.fakultas ? {
            id: user.program_studi.fakultas.id_fakultas,
            nama: user.program_studi.fakultas.nama_fakultas
          } : null,
          no_hp: user.no_hp,
          nim: user.nim,
          nidn: user.nidn,
          isAdmin: user.role === 'admin',
          isDosen: user.role === 'dosen'
        }
      }
    };
  }

  /**
   * Validasi input login
   * @private
   */
  _validateLoginInput(email, password) {
    if (!validateEmail(email)) {
      throw new Error('Format email tidak valid');
    }
    
    if (!validatePassword(password)) {
      throw new Error('Password harus memiliki minimal 6 karakter');
    }
  }

  /**
   * Cari user berdasarkan email
   * @private
   */
  async _findUserByEmail(email) {
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        program_studi:program_studi(
          id_prodi,
          nama_prodi,
          jenjang,
          akreditasi,
          fakultas:fakultas(
            id_fakultas,
            nama_fakultas
          )
        )
      `)
      .eq('email', email.toLowerCase())
      .maybeSingle();
    
    if (error || !user) {
      console.log('User not found:', email);
      throw new Error('Email atau password salah');
    }
    
    console.log('User found:', { 
      id: user.id_user, 
      email: user.email, 
      role: user.role,
      status: user.status
    });

    return user;
  }

  /**
   * Cek status akun
   * @private
   */
  _checkAccountStatus(user) {
    if (user.status !== 'aktif') {
      throw new Error('Akun tidak aktif. Silakan hubungi administrator.');
    }
  }

  /**
   * Validasi role user sesuai pilihan login
   * @private
   */
  _validateUserRole(user, isAdmin, isDosen) {
    if (isAdmin && user.role !== 'admin') {
      throw new Error('Anda tidak memiliki akses sebagai admin');
    }
    
    if (isDosen && user.role !== 'dosen') {
      throw new Error('Anda tidak memiliki akses sebagai dosen');
    }
    
    if (!isAdmin && !isDosen && user.role !== 'mahasiswa') {
      throw new Error('Anda tidak memiliki akses sebagai mahasiswa');
    }
  }

  /**
   * Verifikasi password
   * @private
   */
  async _verifyPassword(inputPassword, hashedPassword, email) {
    const isMatch = await bcrypt.compare(inputPassword, hashedPassword);
    
    if (!isMatch) {
      console.log('Password mismatch for user:', email);
      throw new Error('Email atau password salah');
    }
  }

  /**
   * Generate JWT token
   * @private
   */
  _generateToken(user) {
    const tokenPayload = {
      id: user.id_user,
      email: user.email,
      role: user.role,
      name: user.nama_lengkap
    };
    
    console.log('Generating token with payload:', tokenPayload);

    return jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * Format response login
   * @private
   */
  _formatLoginResponse(user, token) {
    console.log('=== LOGIN SUCCESS ===');
    console.log('User logged in:', user.email, 'as', user.role);

    return {
      success: true,
      message: 'Login berhasil',
      data: {
        token,
        user: {
          id: user.id_user,
          name: user.nama_lengkap,
          email: user.email,
          role: user.role,
          prodi: user.program_studi?.nama_prodi || null,
          prodi_detail: user.program_studi ? {
            id: user.program_studi.id_prodi,
            nama: user.program_studi.nama_prodi,
            jenjang: user.program_studi.jenjang,
            akreditasi: user.program_studi.akreditasi
          } : null,
          fakultas: user.program_studi?.fakultas?.nama_fakultas || null,
          fakultas_detail: user.program_studi?.fakultas ? {
            id: user.program_studi.fakultas.id_fakultas,
            nama: user.program_studi.fakultas.nama_fakultas
          } : null,
          no_hp: user.no_hp,
          nim: user.nim,
          nidn: user.nidn,
          isAdmin: user.role === 'admin',
          isDosen: user.role === 'dosen'
        }
      }
    };
  }
}

module.exports = new AuthService();