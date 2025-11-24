init-mysql.sqlCREATE DATABASE IF NOT EXISTS unite_db;
USE unite_db;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'manager', 'agent') NOT NULL DEFAULT 'agent',
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  status ENUM('new', 'contacted', 'qualified', 'converted') DEFAULT 'new',
  source VARCHAR(100),
  assigned_to INT,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_phone_email (phone, email),
  INDEX idx_status (status),
  INDEX idx_source (source),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Call tasks table
CREATE TABLE IF NOT EXISTS call_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  lead_id INT NOT NULL,
  agent_id INT NOT NULL,
  status ENUM('pending', 'completed', 'missed') DEFAULT 'pending',
  notes TEXT,
  outcome VARCHAR(255),
  scheduled_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  idempotency_key VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (status),
  INDEX idx_lead_id (lead_id),
  INDEX idx_agent_id (agent_id),
  INDEX idx_scheduled_at (scheduled_at),
  INDEX idx_created_at (created_at),
  INDEX idx_idempotency (idempotency_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token(255)),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default admin user (password: Admin@123)
INSERT INTO users (email, password_hash, role, phone) 
VALUES (
  'admin@unite.com',
  '$2a$10$rEqN0K5pY8LKxZ5mVQz5dOXKN5yYZ5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5Y5.',
  'admin',
  '+1234567890'
) ON DUPLICATE KEY UPDATE email=email;
```

### src/models/mysql/User.ts
```typescript
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { mysqlPool } from '../../config/database';
import { IUser, UserRole } from '../../types';
import bcrypt from 'bcryptjs';

export class UserModel {
  static async create(email: string, password: string, role: UserRole, phone?: string): Promise {
    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await mysqlPool.execute(
      'INSERT INTO users (email, password_hash, role, phone) VALUES (?, ?, ?, ?)',
      [email, hashedPassword, role, phone]
    );
    return result.insertId;
  }

  static async findByEmail(email: string): Promise {
    const [rows] = await mysqlPool.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );
    return rows.length > 0 ? (rows[0] as IUser) : null;
  }

  static async findById(id: number): Promise {
    const [rows] = await mysqlPool.execute(
      'SELECT * FROM users WHERE id = ? AND is_active = TRUE',
      [id]
    );
    return rows.length > 0 ? (rows[0] as IUser) : null;
  }

  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updateLastLogin(userId: number): Promise {
    await mysqlPool.execute(
      'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [userId]
    );
  }

  static async findAgents(): Promise {
    const [rows] = await mysqlPool.execute(
      'SELECT id, email, phone, role FROM users WHERE role = ? AND is_active = TRUE',
      [UserRole.AGENT]
    );
    return rows as IUser[];
  }
}