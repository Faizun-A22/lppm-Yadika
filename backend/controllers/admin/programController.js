const supabase = require('../../config/database');
const { formatResponse, formatError, formatPaginatedResponse } = require('../../utils/responseFormatter');

const programController = {
    async getAllPrograms(req, res) {
        try {
            const { page = 1, limit = 10, search = '', jenis = '' } = req.query;
            
            let query = supabase
                .from('programs')
                .select('*', { count: 'exact' });

            if (search) {
                query = query.ilike('nama_program', `%${search}%`);
            }

            if (jenis) {
                query = query.eq('jenis', jenis);
            }

            const from = (page - 1) * limit;
            const to = from + limit - 1;

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            return res.status(200).json(
                formatPaginatedResponse(
                    data || [],
                    page,
                    limit,
                    count || 0,
                    'Data program berhasil diambil'
                )
            );
        } catch (error) {
            console.error('Error in getAllPrograms:', error);
            return res.status(500).json(formatError('Gagal mengambil data program'));
        }
    },

    async getProgramById(req, res) {
        try {
            const { id } = req.params;
            
            const { data, error } = await supabase
                .from('programs')
                .select('*')
                .eq('id_program', id)
                .single();

            if (error) throw error;

            if (!data) {
                return res.status(404).json(formatError('Program tidak ditemukan'));
            }

            return res.status(200).json(
                formatResponse('success', 'Data program berhasil diambil', data)
            );
        } catch (error) {
            console.error('Error in getProgramById:', error);
            return res.status(500).json(formatError('Gagal mengambil data program'));
        }
    },

    async createProgram(req, res) {
        try {
            const programData = {
                nama_program: req.body.nama_program,
                jenis: req.body.jenis,
                kuota: req.body.kuota,
                periode: req.body.periode,
                deskripsi: req.body.deskripsi || null,
                status: 'aktif',
                pendaftar: 0,
                created_at: new Date(),
                updated_at: new Date()
            };

            const { data, error } = await supabase
                .from('programs')
                .insert([programData])
                .select()
                .single();

            if (error) throw error;

            return res.status(201).json(
                formatResponse('success', 'Program berhasil ditambahkan', data)
            );
        } catch (error) {
            console.error('Error in createProgram:', error);
            return res.status(500).json(formatError('Gagal menambahkan program'));
        }
    },

    async updateProgram(req, res) {
        try {
            const { id } = req.params;
            
            const updateData = {
                nama_program: req.body.nama_program,
                jenis: req.body.jenis,
                kuota: req.body.kuota,
                periode: req.body.periode,
                deskripsi: req.body.deskripsi || null,
                updated_at: new Date()
            };

            const { data, error } = await supabase
                .from('programs')
                .update(updateData)
                .eq('id_program', id)
                .select()
                .single();

            if (error) throw error;

            return res.status(200).json(
                formatResponse('success', 'Program berhasil diupdate', data)
            );
        } catch (error) {
            console.error('Error in updateProgram:', error);
            return res.status(500).json(formatError('Gagal mengupdate program'));
        }
    },

    async deleteProgram(req, res) {
        try {
            const { id } = req.params;
            
            const { error } = await supabase
                .from('programs')
                .delete()
                .eq('id_program', id);

            if (error) throw error;

            return res.status(200).json(
                formatResponse('success', 'Program berhasil dihapus')
            );
        } catch (error) {
            console.error('Error in deleteProgram:', error);
            return res.status(500).json(formatError('Gagal menghapus program'));
        }
    },

    async toggleStatus(req, res) {
        try {
            const { id } = req.params;
            
            const { data: current, error: getError } = await supabase
                .from('programs')
                .select('status')
                .eq('id_program', id)
                .single();

            if (getError) throw getError;

            const newStatus = current.status === 'aktif' ? 'nonaktif' : 'aktif';

            const { data, error } = await supabase
                .from('programs')
                .update({ 
                    status: newStatus,
                    updated_at: new Date()
                })
                .eq('id_program', id)
                .select()
                .single();

            if (error) throw error;

            return res.status(200).json(
                formatResponse('success', `Status program berhasil diubah menjadi ${newStatus}`, data)
            );
        } catch (error) {
            console.error('Error in toggleStatus:', error);
            return res.status(500).json(formatError('Gagal mengubah status program'));
        }
    }
};

module.exports = programController;