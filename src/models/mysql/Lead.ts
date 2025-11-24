import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { mysqlPool } from '../../config/database';
import { ILead, LeadStatus, LeadFilters, PaginationParams } from '../../types';
import logger from '../../utils/logger';

export class LeadModel {
    /**
     * Create a new lead
     */
    static async create(data: {
        name: string;
        phone: string;
        email?: string;
        status?: LeadStatus;
        source?: string;
        assigned_to?: number;
        image_url?: string;
    }): Promise<number> {
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            `INSERT INTO leads (name, phone, email, status, source, assigned_to, image_url) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                data.name,
                data.phone,
                data.email || null,
                data.status || LeadStatus.NEW,
                data.source || null,
                data.assigned_to || null,
                data.image_url || null,
            ]
        );
        return result.insertId;
    }

    /**
     * Find lead by ID
     */
    static async findById(id: number): Promise<ILead | null> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT * FROM leads WHERE id = ?',
            [id]
        );
        return rows.length > 0 ? (rows[0] as ILead) : null;
    }

    /**
     * Find lead by phone or email (for duplicate checking)
     */
    static async findByPhoneOrEmail(phone: string, email?: string): Promise<ILead | null> {
        let query = 'SELECT * FROM leads WHERE phone = ?';
        const params: any[] = [phone];

        if (email) {
            query += ' OR email = ?';
            params.push(email);
        }

        const [rows] = await mysqlPool.execute<RowDataPacket[]>(query, params);
        return rows.length > 0 ? (rows[0] as ILead) : null;
    }

    /**
     * Update lead details
     */
    static async update(id: number, data: Partial<ILead>): Promise<boolean> {
        const fields: string[] = [];
        const values: any[] = [];

        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && key !== 'id' && key !== 'created_at') {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });

        if (fields.length === 0) return false;

        values.push(id);
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            `UPDATE leads SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    /**
     * Delete lead (hard delete)
     */
    static async delete(id: number): Promise<boolean> {
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            'DELETE FROM leads WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    /**
     * Soft delete lead (recommended for production)
     */
    static async softDelete(id: number): Promise<boolean> {
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            'UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['deleted', id]
        );
        return result.affectedRows > 0;
    }

    /**
     * Find all leads with filters and pagination
     */
    static async findAll(
        filters: LeadFilters,
        pagination: PaginationParams
    ): Promise<{ leads: ILead[]; total: number }> {
        const whereParts: string[] = [];
        const params: any[] = [];

        if (filters.status) {
            whereParts.push('status = ?');
            params.push(filters.status);
        }
        if (filters.source) {
            whereParts.push('source = ?');
            params.push(filters.source);
        }
        if (filters.assigned_to) {
            whereParts.push('assigned_to = ?');
            params.push(filters.assigned_to);
        }

        const whereClause = whereParts.length > 0 ? 'WHERE ' + whereParts.join(' AND ') : '';

        // Coerce pagination values to integers and validate
        const limit = Math.floor(Number(pagination.limit ?? 20));
        const offset = Math.floor(Number(pagination.offset ?? 0));

        if (limit < 0) {
            throw new Error('Invalid pagination.limit (must be a non-negative integer)');
        }
        if (offset < 0) {
            throw new Error('Invalid pagination.offset (must be a non-negative integer)');
        }

        // Get total
        const countQuery = `SELECT COUNT(*) as total FROM leads ${whereClause}`;
        const [countRows] = await mysqlPool.execute<RowDataPacket[]>(countQuery, params);
        const total = Number((countRows[0] as any).total) || 0;

        // IMPORTANT: LIMIT and OFFSET must be in the SQL string, NOT as ? parameters
        const dataQuery = `SELECT * FROM leads ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

        logger.debug('Lead.findAll - dataQuery', { dataQuery });
        logger.debug('Lead.findAll - params', params.map((p, i) => ({ index: i, value: p, type: typeof p })));

        // Execute - only filter params go to the prepared statement
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(dataQuery, params);

        return {
            leads: rows as ILead[],
            total,
        };
    }


    /**
     * Bulk create leads (for CSV import)
     */
    static async bulkCreate(leads: Array<{
        name: string;
        phone: string;
        email?: string;
        source?: string;
    }>): Promise<number> {
        if (leads.length === 0) return 0;

        const values = leads.map(lead => [
            lead.name,
            lead.phone,
            lead.email || null,
            LeadStatus.NEW,
            lead.source || 'csv_import',
            null,
            null,
        ]);

        const placeholders = leads.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatValues = values.flat();

        const [result] = await mysqlPool.execute<ResultSetHeader>(
            `INSERT IGNORE INTO leads (name, phone, email, status, source, assigned_to, image_url) 
       VALUES ${placeholders}`,
            flatValues
        );

        return result.affectedRows;
    }

    /**
     * Count leads by status
     */
    static async countByStatus(): Promise<Record<LeadStatus, number>> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT status, COUNT(*) as count FROM leads GROUP BY status'
        );

        const result: Record<LeadStatus, number> = {
            [LeadStatus.NEW]: 0,
            [LeadStatus.CONTACTED]: 0,
            [LeadStatus.QUALIFIED]: 0,
            [LeadStatus.CONVERTED]: 0,
        };

        rows.forEach((row: any) => {
            result[row.status as LeadStatus] = parseInt(row.count);
        });

        return result;
    }

    /**
     * Count leads by source
     */
    static async countBySource(): Promise<Array<{ source: string; count: number }>> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT source, COUNT(*) as count FROM leads WHERE source IS NOT NULL GROUP BY source ORDER BY count DESC'
        );

        return rows.map((row: any) => ({
            source: row.source,
            count: parseInt(row.count)
        }));
    }

    /**
     * Get unassigned leads
     */
    static async findUnassigned(limit: number = 50): Promise<ILead[]> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT * FROM leads WHERE assigned_to IS NULL ORDER BY created_at DESC LIMIT ?',
            [limit]
        );
        return rows as ILead[];
    }

    /**
     * Assign lead to agent
     */
    static async assignToAgent(leadId: number, agentId: number): Promise<boolean> {
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            'UPDATE leads SET assigned_to = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [agentId, leadId]
        );
        return result.affectedRows > 0;
    }

    /**
     * Get leads assigned to specific agent
     */
    static async findByAgent(agentId: number, status?: LeadStatus): Promise<ILead[]> {
        let query = 'SELECT * FROM leads WHERE assigned_to = ?';
        const params: any[] = [agentId];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await mysqlPool.execute<RowDataPacket[]>(query, params);
        return rows as ILead[];
    }

    /**
     * Search leads by name, phone, or email
     */
    static async search(searchTerm: string, limit: number = 20): Promise<ILead[]> {
        // Validate and coerce limit to integer
        const validLimit = Math.floor(Number(limit ?? 20));

        if (validLimit < 0) {
            throw new Error('Invalid limit (must be a non-negative integer)');
        }

        const searchPattern = `%${searchTerm}%`;

        // IMPORTANT: LIMIT must be in the SQL string, NOT as a ? parameter
        const query = `SELECT * FROM leads 
        WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? 
        ORDER BY created_at DESC LIMIT ${validLimit}`;

        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            query,
            [searchPattern, searchPattern, searchPattern]
        );

        return rows as ILead[];
    }

    /**
     * Get recent leads
     */
    static async getRecent(limit: number = 10): Promise<ILead[]> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT * FROM leads ORDER BY created_at DESC LIMIT ?',
            [limit]
        );
        return rows as ILead[];
    }

    /**
     * Check if phone number exist
     */
    static async phoneExists(phone: string): Promise<boolean> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT id FROM leads WHERE phone = ?',
            [phone]
        );
        return rows.length > 0;
    }

    /**
     * Update lead status
     */
    static async updateStatus(leadId: number, status: LeadStatus): Promise<boolean> {
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            'UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, leadId]
        );
        return result.affectedRows > 0;
    }
}