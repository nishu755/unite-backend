// middlewares/auth.ts
import { RequestHandler } from 'express';
import { AuthRequest } from '../types';
import { AuthService } from '../services/authService';
import { UnauthorizedError } from '../utils/errors';
import logger from '../utils/logger';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authReq = req as AuthRequest;

  try {
    const authHeader = String(req.headers.authorization ?? '');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('No token provided'));
    }

    const token = authHeader.slice(7);
    const payload = await Promise.resolve(AuthService.verifyAccessToken(token));

    if (!payload || typeof payload !== 'object') {
      return next(new UnauthorizedError('Invalid token payload'));
    }

    authReq.user = {
      id: (payload as any).id ?? (payload as any).userId ?? null,
      email: (payload as any).email ?? null,
      role: (payload as any).role ?? null
    };

    return next();
  } catch (err: any) {
    logger.error('Authentication error:', err?.message ?? err);
    return next(new UnauthorizedError('Invalid or expired token'));
  }
};

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  const authReq = req as AuthRequest;

  try {
    const authHeader = String(req.headers.authorization ?? '');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.slice(7);
    const payload = await Promise.resolve(AuthService.verifyAccessToken(token));

    if (payload && typeof payload === 'object') {
      authReq.user = {
        id: (payload as any).id ?? (payload as any).userId ?? null,
        email: (payload as any).email ?? null,
        role: (payload as any).role ?? null
      };
    }
  } catch (err: any) {
    logger.debug('Optional auth failed, continuing without user:', err?.message ?? err);
  }

  return next();
};
