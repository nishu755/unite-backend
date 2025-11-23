import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { mysqlPool } from '../../config/database';
import { ILead, LeadStatus, LeadFilters, PaginationParams } from '../../types';

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
        let query = 'SELECT * FROM leads WHERE 1=1';
        const params: any[] = [];
        const countParams: any[] = [];

        if (filters.status) {
            query += ' AND status = ?';
            params.push(filters.status);
            countParams.push(filters.status);
        }

        if (filters.source) {
            query += ' AND source = ?';
            params.push(filters.source);
            countParams.push(filters.source);
        }

        if (filters.assigned_to) {
            query += ' AND assigned_to = ?';
            params.push(filters.assigned_to);
            countParams.push(filters.assigned_to);
        }

        // Get total count
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countRows] = await mysqlPool.execute<RowDataPacket[]>(countQuery, countParams);
        const total = countRows[0].total as number;

        // Get paginated results
        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(pagination.limit, pagination.offset);

        const [rows] = await mysqlPool.execute<RowDataPacket[]>(query, params);

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
        const searchPattern = `%${searchTerm}%`;
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            `SELECT * FROM leads 
       WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? 
       ORDER BY created_at DESC LIMIT ?`,
            [searchPattern, searchPattern, searchPattern, limit]
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