import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { mysqlPool } from '../../config/database';
import { ICallTask, CallTaskStatus, AgentTaskStats, OverallTaskStats, BusiestAgent, DailyTaskSummary } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export class CallTaskModel {
    /**
     * Create a new call task with idempotency support
     */
    static async create(data: {
        lead_id: number;
        agent_id: number;
        scheduled_at?: Date;
        idempotency_key?: string;
    }): Promise<number> {
        const idempotencyKey = data.idempotency_key || uuidv4();

        try {
            const [result] = await mysqlPool.execute<ResultSetHeader>(
                `INSERT INTO call_tasks (lead_id, agent_id, scheduled_at, idempotency_key) 
         VALUES (?, ?, ?, ?)`,
                [data.lead_id, data.agent_id, data.scheduled_at || null, idempotencyKey]
            );
            return result.insertId;
        } catch (error: any) {
            if (error.code === 'ER_DUP_ENTRY') {
                // Return existing task ID for idempotent request
                const [rows] = await mysqlPool.execute<RowDataPacket[]>(
                    'SELECT id FROM call_tasks WHERE idempotency_key = ?',
                    [idempotencyKey]
                );
                return rows[0].id as number;
            }
            throw error;
        }
    }

    /**
     * Find call task by ID
     */
    static async findById(id: number): Promise<ICallTask | null> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT * FROM call_tasks WHERE id = ?',
            [id]
        );
        return rows.length > 0 ? (rows[0] as ICallTask) : null;
    }

    /**
     * Complete a call task with notes and outcome
     */
    static async complete(
        id: number,
        agentId: number,
        notes: string,
        outcome: string
    ): Promise<boolean> {
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            `UPDATE call_tasks 
       SET status = ?, notes = ?, outcome = ?, completed_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND agent_id = ? AND status = ?`,
            [CallTaskStatus.COMPLETED, notes, outcome, id, agentId, CallTaskStatus.PENDING]
        );
        return result.affectedRows > 0;
    }

    /**
     * Mark task as missed
     */
    static async markAsMissed(id: number): Promise<boolean> {
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            `UPDATE call_tasks 
     SET status = ?, completed_at = CURRENT_TIMESTAMP 
     WHERE id = ? AND status = ?`,
            [CallTaskStatus.MISSED, id, CallTaskStatus.PENDING]
        );
        return result.affectedRows > 0;
    }

    /**
     * Find tasks by agent with optional status filter
     */
    static async findByAgent(
        agentId: number,
        status?: CallTaskStatus
    ): Promise<ICallTask[]> {
        let query = 'SELECT * FROM call_tasks WHERE agent_id = ?';
        const params: any[] = [agentId];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }

        query += ' ORDER BY created_at DESC';

        const [rows] = await mysqlPool.execute<RowDataPacket[]>(query, params);
        return rows as ICallTask[];
    }

    /**
     * Find tasks by lead ID
     */
    static async findByLead(leadId: number): Promise<ICallTask[]> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT * FROM call_tasks WHERE lead_id = ? ORDER BY created_at DESC',
            [leadId]
        );
        return rows as ICallTask[];
    }

    /**
     * Get daily summary of call tasks
     */
    static async getDailySummary(date: string): Promise<DailyTaskSummary[]> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            `SELECT 
            DATE(created_at) AS date,
            agent_id,
            COUNT(*) AS total_calls,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) AS missed
        FROM call_tasks
        WHERE DATE(created_at) = ?
        GROUP BY DATE(created_at), agent_id`,
            [date]
        );
        return rows as DailyTaskSummary[];
    }


    /**
     * Get agent statistics for a date range
     */
    static async getAgentStats(
        agentId: number,
        startDate: string,
        endDate: string
    ): Promise<AgentTaskStats> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            `SELECT 
        COUNT(*) as total_calls,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
       FROM call_tasks
       WHERE agent_id = ? AND DATE(created_at) BETWEEN ? AND ?`,
            [agentId, startDate, endDate]
        );
        return rows[0] as AgentTaskStats;
    }

    /**
     * Get overall statistics for all agents
     */
    static async getOverallStats(startDate: string, endDate: string): Promise<OverallTaskStats> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            `SELECT 
        COUNT(*) as total_calls,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        COUNT(DISTINCT agent_id) as total_agents,
        COUNT(DISTINCT lead_id) as total_leads
       FROM call_tasks
       WHERE DATE(created_at) BETWEEN ? AND ?`,
            [startDate, endDate]
        );
        return rows[0] as OverallTaskStats;
    }

    /**
     * Get pending tasks that are overdue
     */
    static async getOverdueTasks(): Promise<ICallTask[]> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            `SELECT * FROM call_tasks 
       WHERE status = ? AND scheduled_at < NOW() 
       ORDER BY scheduled_at ASC`,
            [CallTaskStatus.PENDING]
        );
        return rows as ICallTask[];
    }

    /**
     * Get tasks scheduled for today
     */
    static async getTodaysTasks(agentId?: number): Promise<ICallTask[]> {
        let query = `SELECT * FROM call_tasks 
                 WHERE DATE(scheduled_at) = CURDATE() AND status = ?`;
        const params: any[] = [CallTaskStatus.PENDING];

        if (agentId) {
            query += ' AND agent_id = ?';
            params.push(agentId);
        }

        query += ' ORDER BY scheduled_at ASC';

        const [rows] = await mysqlPool.execute<RowDataPacket[]>(query, params);
        return rows as ICallTask[];
    }

    /**
     * Update task status
     */
    static async updateStatus(id: number, status: CallTaskStatus): Promise<boolean> {
        const completedAt = status !== CallTaskStatus.PENDING ? 'CURRENT_TIMESTAMP' : 'NULL';

        const [result] = await mysqlPool.execute<ResultSetHeader>(
            `UPDATE call_tasks 
       SET status = ?, completed_at = ${completedAt} 
       WHERE id = ?`,
            [status, id]
        );
        return result.affectedRows > 0;
    }

    /**
     * Reassign task to different agent
     */
    static async reassign(taskId: number, newAgentId: number): Promise<boolean> {
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            'UPDATE call_tasks SET agent_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
            [newAgentId, taskId, CallTaskStatus.PENDING]
        );
        return result.affectedRows > 0;
    }

    /**
     * Delete task
     * @returns True if deletion was successful
     */
    static async delete(id: number): Promise<boolean> {
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            'DELETE FROM call_tasks WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    /**
     * Count tasks by status
     */
    static async countByStatus(): Promise<Record<CallTaskStatus, number>> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT status, COUNT(*) as count FROM call_tasks GROUP BY status'
        );

        const result: Record<CallTaskStatus, number> = {
            [CallTaskStatus.PENDING]: 0,
            [CallTaskStatus.COMPLETED]: 0,
            [CallTaskStatus.MISSED]: 0,
        };

        rows.forEach((row: any) => {
            result[row.status as CallTaskStatus] = parseInt(row.count);
        });

        return result;
    }

    /**
     * Get busiest agent (most tasks)
     */
    static async getBusiestAgent(startDate: string, endDate: string): Promise<BusiestAgent | null> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            `SELECT 
        agent_id,
        COUNT(*) as total_tasks,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed
       FROM call_tasks
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY agent_id
       ORDER BY total_tasks DESC
       LIMIT 1`,
            [startDate, endDate]
        );
        return rows.length > 0 ? (rows[0] as BusiestAgent) : null;
    }

    /**
     * Check if task exists by idempotency key
     */
    static async findByIdempotencyKey(key: string): Promise<number | null> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT id FROM call_tasks WHERE idempotency_key = ?',
            [key]
        );
        return rows.length > 0 ? (rows[0].id as number) : null;
    }
}
