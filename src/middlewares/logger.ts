// middlewares/logger.ts
import { RequestHandler } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../types';
import logger from '../utils/logger';
import { ApiLog } from '../models/mongodb/ApiLog';

/**
 * Request logger middleware (Express RequestHandler)
 * Casts req to AuthRequest internally to access req.user and correlationId.
 */
export const requestLogger: RequestHandler = (req, res, next) => {
  const authReq = req as AuthRequest;

  // Generate correlation ID if not present
  authReq.correlationId = authReq.correlationId ?? uuidv4();
  const correlationId = authReq.correlationId;

  const startTime = Date.now();

  // Log incoming request
  logger.info('Incoming request', {
    correlationId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Capture response body by wrapping res.json
  let responseBody: unknown;
  const originalJson = res.json.bind(res);
  res.json = function (body: unknown) {
    responseBody = body;
    return originalJson(body);
  };

  // Use finish event to log response (preferred over overriding res.end directly)
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logger.info('Outgoing response', {
      correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });

    // Async store in MongoDB in production (don't await)
    if (process.env.NODE_ENV === 'production') {
      (async () => {
        try {
          await ApiLog.create({
            correlation_id: correlationId,
            method: req.method,
            path: req.path,
            user_id: authReq.user?.id ?? null,
            status_code: res.statusCode,
            duration_ms: duration,
            request_body: req.body,
            response_body: responseBody,
            ip_address: req.ip,
            user_agent: req.get('user-agent'),
            timestamp: new Date()
          });
        } catch (err) {
          logger.error('Failed to save API log:', err);
        }
      })();
    }
  });

  return next();
};

/**
 * Performance monitoring middleware — logs slow requests.
 */
export const performanceMonitor: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;

    if (durationMs > 1000) {
      logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration: `${durationMs.toFixed(2)}ms`
      });
    }
  });

  return next();
};
