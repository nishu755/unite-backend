// app.ts
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import * as Sentry from '@sentry/node';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { requestLogger, performanceMonitor } from './middlewares/logger';
import { rateLimitMiddleware } from './middlewares/rateLimiter';
import logger from './utils/logger';

// Ensure NODE_ENV has a value in runtime (TS no-op)
const NODE_ENV = process.env.NODE_ENV ?? 'development';

const app: Application = express();

// Initialize Sentry (only in production and if DSN provided)
if (NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: NODE_ENV,
    tracesSampleRate: 0.1
  });

  // Sentry request handler MUST be the very first middleware for Sentry to capture request context
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Security: helmet with a minimal CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  })
);

// CORS config: parse comma-separated origins if present
const originEnv = process.env.CORS_ORIGIN ?? '';
const originList = originEnv ? originEnv.split(',').map(s => s.trim()) : ['http://localhost:3000'];

const corsOptions: cors.CorsOptions = {
  origin: originList,
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}
app.use(requestLogger);
app.use(performanceMonitor);

// Rate limiting (ensure rateLimitMiddleware is exported as RequestHandler)
app.use(rateLimitMiddleware);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV
  });
});

// Mount API routes: routes should export an Express.Router as default
app.use('/api', routes);

// Root
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Unite Backend API',
    version: '1.0.0',
    documentation: '/api-docs'
  });
});

// Sentry error handler (after routes, before local error handlers)
if (NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

// Not found + error handlers (must come last)
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
