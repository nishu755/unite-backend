import { AuthService } from '../src/services/authService';
import { UserModel } from '../src/models/mysql/User';
import { ValidationError, ConflictError, UnauthorizedError } from '../src/utils/errors';
import jwt from 'jsonwebtoken';

jest.mock('../src/models/mysql/User');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUserId = 1;
      (UserModel.findByEmail as jest.Mock).mockResolvedValueOnce(null);
      (UserModel.create as jest.Mock).mockResolvedValueOnce(mockUserId);
      (UserModel.findByIdSafe as jest.Mock).mockResolvedValueOnce({
        id: mockUserId,
        email: 'test@example.com',
        role: 'agent',
        phone: '+1234567890',
      });

      const result = await AuthService.register(
        'test@example.com',
        'Test@1234',
        'agent',
        '+1234567890'
      );

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe(mockUserId);
    });

    it('should reject invalid email format', async () => {
      await expect(
        AuthService.register('invalid-email', 'Test@1234', 'agent')
      ).rejects.toThrow(ValidationError);
    });

    it('should reject weak password', async () => {
      await expect(
        AuthService.register('test@example.com', 'weak', 'agent')
      ).rejects.toThrow(ValidationError);
    });

    it('should reject duplicate email', async () => {
      (UserModel.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
      });

      await expect(
        AuthService.register('test@example.com', 'Test@1234', 'agent')
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('login', () => {
    it('should login user successfully', async () => {
      const hashedPassword = '$2a$10$hash';
      (UserModel.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password_hash: hashedPassword,
        role: 'agent',
      });
      (UserModel.verifyPassword as jest.Mock).mockResolvedValueOnce(true);
      (UserModel.updateLastLogin as jest.Mock).mockResolvedValueOnce(undefined);
      (UserModel.findByIdSafe as jest.Mock).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        role: 'agent',
      });

      const result = await AuthService.login('test@example.com', 'Test@1234');

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.id).toBe(1);
    });

    it('should reject invalid credentials', async () => {
      (UserModel.findByEmail as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        AuthService.login('test@example.com', 'Test@1234')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should reject wrong password', async () => {
      (UserModel.findByEmail as jest.Mock).mockResolvedValueOnce({
        id: 1,
        email: 'test@example.com',
        password_hash: '$2a$10$hash',
        role: 'agent',
      });
      (UserModel.verifyPassword as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        AuthService.login('test@example.com', 'WrongPassword')
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token successfully', async () => {
      const token = 'valid-refresh-token';
      const payload = { id: 1, email: 'test@example.com', role: 'agent' };

      jest.spyOn(jwt, 'verify').mockReturnValueOnce(payload as any);

      const result = await AuthService.refreshAccessToken(token);

      expect(result).toHaveProperty('accessToken');
    });

    it('should reject expired refresh token', async () => {
      const token = 'expired-token';

      jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
        throw new Error('Token expired');
      });

      await expect(AuthService.refreshAccessToken(token)).rejects.toThrow(
        UnauthorizedError
      );
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = 'valid-token';
      const payload = { id: 1, email: 'test@example.com', role: 'agent' };

      jest.spyOn(jwt, 'verify').mockReturnValueOnce(payload as any);

      const result = AuthService.verifyAccessToken(token);

      expect(result).toEqual(payload);
    });

    it('should reject invalid token', () => {
      jest.spyOn(jwt, 'verify').mockImplementationOnce(() => {
        throw new Error('Invalid token');
      });

      expect(() => AuthService.verifyAccessToken('invalid-token')).toThrow(
        UnauthorizedError
      );
    });
  });
});