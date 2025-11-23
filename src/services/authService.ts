import jwt, { SignOptions } from 'jsonwebtoken';
import { UserModel } from '../models/mysql/User';
import { IUser, UserRole, JWTPayload, JWTTokenPayload } from '../types';
import { UnauthorizedError, ValidationError, ConflictError } from '../utils/errors';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { mysqlPool } from '../config/database';
import logger from '../utils/logger';

export class AuthService {
  private static JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private static JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
  private static JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
  private static JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  /**
   * Register a new user
   */
  static async register(
    email: string,
    password: string,
    role: UserRole,
    phone?: string
  ): Promise<{ user: Omit<IUser, 'password_hash'>; accessToken: string; refreshToken: string }> {
    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    // Validate password strength
    if (!this.isValidPassword(password)) {
      throw new ValidationError(
        'Password must be at least 8 characters and contain uppercase, lowercase, number, and special character'
      );
    }

    // Check if user already exists
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Create user
    const userId = await UserModel.create(email, password, role, phone);
    const user = await UserModel.findByIdSafe(userId);

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Generate tokens
    const accessToken = this.generateAccessToken({ id: userId, email, role });
    const refreshToken = this.generateRefreshToken({ id: userId, email, role });

    // Store refresh token in database
    await this.storeRefreshToken(userId, refreshToken);

    logger.info(`User registered successfully: ${email}`);

    return {
      user,
      accessToken,
      refreshToken
    };
  }

  /**
   * Login user
   */
  static async login(
    email: string,
    password: string
  ): Promise<{ user: Omit<IUser, 'password_hash'>; accessToken: string; refreshToken: string }> {
    // Find user
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Verify password
    const isValid = await UserModel.verifyPassword(password, user.password_hash);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login
    await UserModel.updateLastLogin(user.id);

    // Generate tokens
    const accessToken = this.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role
    });
    const refreshToken = this.generateRefreshToken({
      id: user.id,
      email: user.email,
      role: user.role
    });

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken);

    logger.info(`User logged in: ${email}`);

    // Remove password from response
    const { password_hash, ...safeUser } = user;

    return {
      user: safeUser,
      accessToken,
      refreshToken
    };
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.JWT_REFRESH_SECRET) as JWTPayload;

      // Check if refresh token exists in database
      const isValid = await this.isRefreshTokenValid(payload.id, refreshToken);
      if (!isValid) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Generate new access token
      const accessToken = this.generateAccessToken({
        id: payload.id,
        email: payload.email,
        role: payload.role
      });

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  }

  /**
   * Logout user (revoke refresh token)
   */
  static async logout(userId: number, refreshToken: string): Promise<void> {
    await this.revokeRefreshToken(userId, refreshToken);
    logger.info(`User logged out: ${userId}`);
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  /**
   * Generate access token
   */
  private static generateAccessToken(payload: JWTTokenPayload): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    } as SignOptions);
  }

  /**
   * Generate refresh token
   */
  private static generateRefreshToken(payload: JWTTokenPayload): string {
    return jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.JWT_REFRESH_EXPIRES_IN
    } as SignOptions);
  }

  /**
   * Store refresh token in database
   */
  private static async storeRefreshToken(userId: number, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await mysqlPool.execute<ResultSetHeader>(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, token, expiresAt]
    );
  }

  /**
   * Check if refresh token is valid
   */
  private static async isRefreshTokenValid(userId: number, token: string): Promise<boolean> {
    const [rows] = await mysqlPool.execute<RowDataPacket[]>(
      'SELECT id FROM refresh_tokens WHERE user_id = ? AND token = ? AND expires_at > NOW()',
      [userId, token]
    );
    return rows.length > 0;
  }

  /**
   * Revoke refresh token
   */
  private static async revokeRefreshToken(userId: number, token: string): Promise<void> {
    await mysqlPool.execute<ResultSetHeader>(
      'DELETE FROM refresh_tokens WHERE user_id = ? AND token = ?',
      [userId, token]
    );
  }

  /**
   * Clean up expired tokens
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const [result] = await mysqlPool.execute<ResultSetHeader>(
      'DELETE FROM refresh_tokens WHERE expires_at < NOW()'
    );
    return result.affectedRows;
  }

  /**
   * Validate email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  private static isValidPassword(password: string): boolean {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }
}