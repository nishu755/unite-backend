import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { mysqlPool } from '../../config/database';
import { IUser, UserRole } from '../../types';
import bcrypt from 'bcryptjs';

export class UserModel {
    static async create(
        email: string,
        password: string,
        role: UserRole,
        phone?: string
    ): Promise<number> {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            'INSERT INTO users (email, password_hash, role, phone) VALUES (?, ?, ?, ?)',
            [email, hashedPassword, role, phone || null]
        );
        return result.insertId;
    }

    static async findByEmail(email: string): Promise<IUser | null> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
            [email]
        );
        return rows.length > 0 ? (rows[0] as IUser) : null;
    }

    static async findById(id: number): Promise<IUser | null> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
            [id]
        );
        return rows.length > 0 ? (rows[0] as IUser) : null;
    }

    static async findByIdSafe(id: number): Promise<Omit<IUser, 'password_hash'> | null> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT id, email, role, phone, is_active, created_at, updated_at FROM users WHERE id = ? AND is_active = TRUE',
            [id]
        );
        return rows.length > 0 ? (rows[0] as Omit<IUser, 'password_hash'>) : null;
    }

    static async verifyPassword(
        plainPassword: string,
        hashedPassword: string
    ): Promise<boolean> {
        return bcrypt.compare(plainPassword, hashedPassword);
    }

    static async updateLastLogin(userId: number): Promise<void> {
        await mysqlPool.execute<ResultSetHeader>(
            'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [userId]
        );
    }

    static async findAgents(): Promise<Omit<IUser, 'password_hash'>[]> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT id, email, phone, role, created_at, updated_at FROM users WHERE role = ? AND is_active = TRUE',
            [UserRole.AGENT]
        );
        return rows as Omit<IUser, 'password_hash'>[];
    }

    static async findByRole(role: UserRole): Promise<Omit<IUser, 'password_hash'>[]> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT id, email, phone, role, is_active, created_at, updated_at FROM users WHERE role = ? AND is_active = TRUE',
            [role]
        );
        return rows as Omit<IUser, 'password_hash'>[];
    }

    static async update(
        id: number,
        data: Partial<Pick<IUser, 'email' | 'phone' | 'role'>>
    ): Promise<boolean> {
        const fields: string[] = [];
        const values: any[] = [];

        if (data.email !== undefined) {
            fields.push('email = ?');
            values.push(data.email);
        }
        if (data.phone !== undefined) {
            fields.push('phone = ?');
            values.push(data.phone);
        }
        if (data.role !== undefined) {
            fields.push('role = ?');
            values.push(data.role);
        }

        if (fields.length === 0) return false;

        values.push(id);
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }


    static async softDelete(id: number): Promise<boolean> {
        const [result] = await mysqlPool.execute<ResultSetHeader>(
            'UPDATE users SET is_active = FALSE WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    static async emailExists(email: string): Promise<boolean> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );
        return rows.length > 0;
    }

    static async countByRole(): Promise<Record<UserRole, number>> {
        const [rows] = await mysqlPool.execute<RowDataPacket[]>(
            'SELECT role, COUNT(*) as count FROM users WHERE is_active = TRUE GROUP BY role'
        );

        const result: Record<UserRole, number> = {
            [UserRole.ADMIN]: 0,
            [UserRole.MANAGER]: 0,
            [UserRole.AGENT]: 0,
        };

        rows.forEach((row: any) => {
            result[row.role as UserRole] = parseInt(row.count);
        });

        return result;
    }
}