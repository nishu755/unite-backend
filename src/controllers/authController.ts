import { Response } from 'express';
import { AuthRequest } from '../types';
import { AuthService } from '../services/authService';
import { UserRole } from '../types';
import { ApiResponse } from '../types';
import logger from '../utils/logger';

export class AuthController {

    static async register(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { email, password, role, phone } = req.body;

            const result = await AuthService.register(
                email,
                password,
                role as UserRole,
                phone
            );

            const response: ApiResponse = {
                success: true,
                data: result,
                message: 'User registered successfully',
                correlationId: req.correlationId
            };

            res.status(201).json(response);
        } catch (error: any) {
            logger.error('Registration error:', error);
            throw error;
        }
    }


    static async login(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { email, password } = req.body;

            const result = await AuthService.login(email, password);

            const response: ApiResponse = {
                success: true,
                data: result,
                message: 'Login successful',
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Login error:', error);
            throw error;
        }
    }


    static async refresh(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { refreshToken } = req.body;

            const result = await AuthService.refreshAccessToken(refreshToken);

            const response: ApiResponse = {
                success: true,
                data: result,
                message: 'Token refreshed successfully',
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Token refresh error:', error);
            throw error;
        }
    }

    static async logout(req: AuthRequest, res: Response): Promise<any> {
        try {
            const { refreshToken } = req.body;
            const userId = req.user!.id;

            await AuthService.logout(userId, refreshToken);

            const response: ApiResponse = {
                success: true,
                message: 'Logout successful',
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Logout error:', error);
            throw error;
        }
    }

    static async getCurrentUser(req: AuthRequest, res: Response): Promise<any> {
        try {
            const response: ApiResponse = {
                success: true,
                data: req.user,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Get current user error:', error);
            throw error;
        }
    }
}