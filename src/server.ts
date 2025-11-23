import dotenv from 'dotenv';
import app from './app';
import { testMySQLConnection, connectMongoDB, closeDatabaseConnections } from './config/database';
import { redis } from './config/redis';
import logger from './utils/logger';
import { AuthService } from './services/authService';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
let server: any;

/**
 * Start the server
 */
async function startServer() {
  try {
    logger.info('Starting Unite Backend Server...');

    // Test database connections
    logger.info('Connecting to databases...');
    await testMySQLConnection();
    await connectMongoDB();
    logger.info('Database connections established');

    // Test Redis connection
    await redis.ping();
    logger.info('Redis connection established');

    // Start server
    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });

    // Cleanup expired tokens periodically (every hour)
    setInterval(async () => {
      try {
        const deleted = await AuthService.cleanupExpiredTokens();
        if (deleted > 0) {
          logger.info(`Cleaned up ${deleted} expired refresh tokens`);
        }
      } catch (error) {
        logger.error('Failed to cleanup expired tokens:', error);
      }
    }, 60 * 60 * 1000);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        // Close database connections
        await closeDatabaseConnections();
        
        // Close Redis connection
        await redis.quit();
        logger.info('Redis connection closed');

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();