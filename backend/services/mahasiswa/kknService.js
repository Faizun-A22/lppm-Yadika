// services/mahasiswa/kknService.js - VERSI PAKAI RAW SQL

const { createClient } = require('@supabase/supabase-js');
const { deleteFile } = require('../../middleware/upload');

// Gunakan connection pool langsung
const pool = require('../../config/database');

class KKNService {
    constructor() {
        // Tidak perlu define table names karena pakai raw SQL
    }

    /**
     * Mendapatkan dashboard KKN mahasiswa
     */
    async getDashboard(userId) {
        try {
            console.log('getDashboard untuk userId:', userId);
            
            // Query registrasi terbaru
            const registrasiQuery = `
                SELECT 
                    r.*,
                    d.id_desa,
                    d.nama_desa,
                    d.kecamatan,
                    d.kabupaten,
                    p.nama_prodi
                FROM registrasi_kkn r
                LEFT JOIN desa_kkn d ON r.id_desa = d.id_desa
                LEFT JOIN program_studi p ON r.id_prodi = p.id_prodi
                WHERE r.id_user = $1
                ORDER BY r.created_at DESC
                LIMIT 1
            `;
            
            const registrasiResult = await pool.query(registrasiQuery, [userId]);
            const registrasi = registrasiResult.rows[0] || null;
            
            // Query luaran
            let luaran = [];
            if (registrasi) {
                const luaranQuery = `
                    SELECT * FROM luaran_kkn 
                    WHERE id_registrasi = $1 
                    ORDER BY created_at DESC
                `;
                const luaranResult = await pool.query(luaranQuery, [registrasi.id_registrasi]);
                luaran = luaranResult.rows;
            }
            
            return {
                registrasi: registrasi,
                luaran: luaran,
                status_keseluruhan: this.hitungStatusKeseluruhan(registrasi)
            };
        } catch (error) {
            console.error('Error in getDashboard:', error);
            throw error;
        }
    }

    /**
     * Mendapatkan status KKN
     */
    async getStatus(userId) {
        try {
            const query = `
                SELECT 
                    status,
                    tanggal_daftar,
                    id_desa
                FROM registrasi_kkn
                WHERE id_user = $1
                ORDER BY created_at DESC
                LIMIT 1
            `;
            
            const result = await pool.query(query, [userId]);
            const registrasi = result.rows[0];
            
            // Hitung jumlah luaran
            let jumlahLuaran = 0;
            if (registrasi) {
                const countResult = await pool.query(
                    'SELECT COUNT(*) as count FROM luaran_kkn WHERE id_registrasi = $1',
                    [registrasi.id_registrasi]
                );
                jumlahLuaran = parseInt(countResult.rows[0].count) || 0;
            }
            
            return {
                pendaftaran: {
                    status: registrasi?.status || 'belum_daftar',
                    tanggal: registrasi?.tanggal_daftar || null,
                    desa: registrasi?.id_desa || null
                },
                luaran: {
                    jumlah: jumlahLuaran,
                    status: jumlahLuaran > 0 ? 'sudah_input' : 'belum_input'
                }
            };
        } catch (error) {
            console.error('Error in getStatus:', error);
            throw error;
        }
    }

    /**
     * Mendapatkan daftar desa yang tersedia - FIXED VERSION
     */
    async getAvailableVillages(filters = {}) {
        try {
            console.log('getAvailableVillages dengan filter:', filters);
            
            let query = `
                SELECT 
                    d.id_desa,
                    d.nama_desa,
                    d.kecamatan,
                    d.kabupaten,
                    d.provinsi,
                    CAST(d.kuota AS INTEGER) as kuota,
                    COALESCE(d.kuota_terisi, 0) as kuota_terisi,
                    d.deskripsi,
                    u.nama_lengkap as nama_pembimbing_lapangan
                FROM desa_kkn d
                LEFT JOIN users u ON d.id_dosen_pembimbing = u.id_user
                WHERE d.status = 'aktif'
                AND d.kuota > COALESCE(d.kuota_terisi, 0)
            `;
            
            const params = [];
            let paramCount = 1;
            
            if (filters.search) {
                query += ` AND (d.nama_desa ILIKE $${paramCount} OR d.kecamatan ILIKE $${paramCount})`;
                params.push(`%${filters.search}%`);
                paramCount++;
            }
            
            if (filters.kabupaten) {
                query += ` AND d.kabupaten = $${paramCount}`;
                params.push(filters.kabupaten);
                paramCount++;
            }
            
            query += ` ORDER BY d.nama_desa ASC LIMIT 50`;
            
            console.log('Executing query:', query);
            console.log('Params:', params);
            
            const result = await pool.query(query, params);
            
            const formattedData = result.rows.map(row => {
                const kuota = parseInt(row.kuota) || 0;
                const kuotaTerisi = parseInt(row.kuota_terisi) || 0;
                const sisaKuota = kuota - kuotaTerisi;
                const persentaseTerisi = kuota > 0 ? (kuotaTerisi / kuota * 100) : 0;
                
                return {
                    id_desa: row.id_desa,
                    nama_desa: row.nama_desa,
                    kecamatan: row.kecamatan,
                    kabupaten: row.kabupaten,
                    provinsi: row.provinsi,
                    kuota: kuota,
                    kuota_terisi: kuotaTerisi,
                    sisa_kuota: sisaKuota,
                    persentase_terisi: Math.round(persentaseTerisi),
                    deskripsi: row.deskripsi,
                    nama_pembimbing_lapangan: row.nama_pembimbing_lapangan || 'Belum ditentukan'
                };
            });
            
            console.log(`Ditemukan ${formattedData.length} desa tersedia`);
            return formattedData;
        } catch (error) {
            console.error('Error in getAvailableVillages:', error);
            throw error;
        }
    }

    /**
     * Mendapatkan riwayat pengajuan
     */
    async getRiwayat(userId, { page = 1, limit = 10, jenis = null }) {
        try {
            const offset = (page - 1) * limit;
            
            const query = `
                SELECT 
                    r.id_registrasi as id,
                    'pendaftaran' as jenis,
                    r.tanggal_daftar as tanggal,
                    r.status,
                    r.angkatan as semester,
                    d.nama_desa,
                    r.ukuran_jaket,
                    r.no_hp
                FROM registrasi_kkn r
                LEFT JOIN desa_kkn d ON r.id_desa = d.id_desa
                WHERE r.id_user = $1
                ORDER BY r.created_at DESC
                LIMIT $2 OFFSET $3
            `;
            
            const result = await pool.query(query, [userId, limit, offset]);
            
            // Get total count
            const countResult = await pool.query(
                'SELECT COUNT(*) as total FROM registrasi_kkn WHERE id_user = $1',
                [userId]
            );
            
            const formattedData = result.rows.map(item => ({
                id: item.id,
                jenis: item.jenis,
                tanggal: item.tanggal,
                status: item.status,
                judul: `Pendaftaran KKN`,
                keterangan: `Semester ${item.semester || '-'}, Desa: ${item.nama_desa || '-'}, Ukuran: ${item.ukuran_jaket || '-'}`,
                detail: item
            }));
            
            return {
                data: formattedData,
                total: parseInt(countResult.rows[0].total) || 0
            };
        } catch (error) {
            console.error('Error in getRiwayat:', error);
            throw error;
        }
    }

    /**
     * Mendapatkan daftar luaran
     */
    async getLuaran(userId) {
        try {
            // Cari registrasi terlebih dahulu
            const registrasiQuery = `
                SELECT id_registrasi 
                FROM registrasi_kkn 
                WHERE id_user = $1 
                ORDER BY created_at DESC 
                LIMIT 1
            `;
            const registrasiResult = await pool.query(registrasiQuery, [userId]);
            
            if (!registrasiResult.rows[0]) {
                return [];
            }
            
            const luaranQuery = `
                SELECT * FROM luaran_kkn 
                WHERE id_registrasi = $1 
                ORDER BY created_at DESC
            `;
            const luaranResult = await pool.query(luaranQuery, [registrasiResult.rows[0].id_registrasi]);
            
            return luaranResult.rows;
        } catch (error) {
            console.error('Error in getLuaran:', error);
            throw error;
        }
    }

    /**
     * Mendapatkan timeline KKN
     */
    async getTimeline(userId) {
        try {
            const timeline = [];
            
            const registrasiQuery = `
                SELECT * FROM registrasi_kkn 
                WHERE id_user = $1 
                ORDER BY created_at DESC 
                LIMIT 1
            `;
            const registrasiResult = await pool.query(registrasiQuery, [userId]);
            const registrasi = registrasiResult.rows[0];
            
            if (registrasi) {
                timeline.push({
                    id: 1,
                    title: 'Pendaftaran KKN',
                    status: registrasi.status,
                    description: this.getRegistrasiDescription(registrasi),
                    date: registrasi.tanggal_daftar,
                    is_completed: ['approved', 'verified'].includes(registrasi.status),
                    is_active: registrasi.status === 'pending'
                });
                
                if (registrasi.status === 'approved' || registrasi.status === 'verified') {
                    timeline.push({
                        id: 2,
                        title: 'Pelaksanaan KKN',
                        status: 'active',
                        description: 'KKN sedang berlangsung',
                        date: registrasi.updated_at,
                        is_completed: false,
                        is_active: true
                    });
                    
                    const countResult = await pool.query(
                        'SELECT COUNT(*) as count FROM luaran_kkn WHERE id_registrasi = $1',
                        [registrasi.id_registrasi]
                    );
                    const count = parseInt(countResult.rows[0].count) || 0;
                    
                    timeline.push({
                        id: 3,
                        title: 'Input Luaran',
                        status: count > 0 ? 'completed' : 'pending',
                        description: count > 0 ? `${count} luaran telah diupload` : 'Upload luaran setelah pelaksanaan KKN',
                        date: null,
                        is_completed: count > 0,
                        is_active: false
                    });
                }
            } else {
                timeline.push({
                    id: 1,
                    title: 'Pendaftaran KKN',
                    status: 'pending',
                    description: 'Belum melakukan pendaftaran KKN',
                    date: null,
                    is_completed: false,
                    is_active: false
                });
            }
            
            return timeline;
        } catch (error) {
            console.error('Error in getTimeline:', error);
            throw error;
        }
    }

    // ==================== HELPER METHODS ====================
    
    hitungStatusKeseluruhan(registrasi) {
        if (!registrasi) {
            return { status: 'pending', text: 'Belum Daftar' };
        }
        const statusMap = {
            'pending': { status: 'pending', text: 'Menunggu Verifikasi' },
            'approved': { status: 'active', text: 'Aktif' },
            'verified': { status: 'completed', text: 'Selesai' },
            'rejected': { status: 'rejected', text: 'Ditolak' }
        };
        return statusMap[registrasi.status] || { status: 'pending', text: 'Dalam Proses' };
    }
    
    getRegistrasiDescription(registrasi) {
        if (!registrasi) return 'Belum melakukan pendaftaran KKN';
        const descMap = {
            'pending': 'Pendaftaran sedang dalam proses verifikasi',
            'approved': 'Pendaftaran telah disetujui',
            'verified': 'Pendaftaran telah diverifikasi',
            'rejected': 'Pendaftaran ditolak'
        };
        return descMap[registrasi.status] || `Status: ${registrasi.status}`;
    }
}

module.exports = new KKNService();