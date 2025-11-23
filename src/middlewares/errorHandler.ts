import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ApiResponse } from '../types';
import logger from '../utils/logger';
import * as Sentry from '@sentry/node';


export const errorHandler = (
    error: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {

    logger.error('Error:', {
        message: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
    });


    if (process.env.NODE_ENV === 'production') {
        Sentry.captureException(error);
    }

    // Handle operational errors
    if (error instanceof AppError && error.isOperational) {
        const response: ApiResponse = {
            success: false,
            error: error.message,
            correlationId: (req as any).correlationId
        };

        res.status(error.statusCode).json(response);
        return;
    }

    // Handle validation errors from Joi
    if (error.name === 'ValidationError') {
        const response: ApiResponse = {
            success: false,
            error: error.message,
            correlationId: (req as any).correlationId
        };

        res.status(400).json(response);
        return;
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        const response: ApiResponse = {
            success: false,
            error: 'Invalid or expired token',
            correlationId: (req as any).correlationId
        };

        res.status(401).json(response);
        return;
    }

    // Handle MySQL errors
    if ((error as any).code === 'ER_DUP_ENTRY') {
        const response: ApiResponse = {
            success: false,
            error: 'Duplicate entry. Record already exists.',
            correlationId: (req as any).correlationId
        };

        res.status(409).json(response);
        return;
    }

    // Handle unknown errors
    const response: ApiResponse = {
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : error.message,
        correlationId: (req as any).correlationId
    };

    res.status(500).json(response);
};

export const notFoundHandler = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const response: ApiResponse = {
        success: false,
        error: `Route ${req.method} ${req.path} not found`,
        correlationId: (req as any).correlationId
    };

    res.status(404).json(response);
};


export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction): Promise<any> => {
        return Promise.resolve(fn(req, res, next)).catch(next);
    };
};