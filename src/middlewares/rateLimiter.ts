import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../config/redis';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

// Create rate limiter
const rateLimiter = new RateLimiterRedis({
    storeClient: redis,
    keyPrefix: 'rate_limit',
    points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000, // Convert to seconds
});


export const rateLimitMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> => {
    try {
        // Use IP address as key
        const key = req.ip || 'unknown';

        await rateLimiter.consume(key);
        next();
    } catch (error: any) {
        if (error.remainingPoints !== undefined) {
            // Rate limit exceeded
            logger.warn(`Rate limit exceeded for IP: ${req.ip}`);

            res.status(429).json({
                success: false,
                error: 'Too many requests. Please try again later.',
                retryAfter: Math.round(error.msBeforeNext / 1000)
            });
            return;
        }

        // Other errors
        logger.error('Rate limiter error:', error);
        next();
    }
};


export const strictRateLimitMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<any> => {
    const strictLimiter = new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: 'strict_rate_limit',
        points: 5, // 5 requests
        duration: 60, // per minute
    });

    try {
        const key = req.ip || 'unknown';
        await strictLimiter.consume(key);
        next();
    } catch (error: any) {
        if (error.remainingPoints !== undefined) {
            logger.warn(`Strict rate limit exceeded for IP: ${req.ip}`);

            res.status(429).json({
                success: false,
                error: 'Too many attempts. Please try again later.',
                retryAfter: Math.round(error.msBeforeNext / 1000)
            });
            return;
        }

        logger.error('Strict rate limiter error:', error);
        next();
    }
};