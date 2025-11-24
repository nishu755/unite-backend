import dotenv from 'dotenv';
import app from './app';
import { testMySQLConnection, connectMongoDB, closeDatabaseConnections } from './config/database';
import { MigrationService } from './services/migrationService';
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
    logger.info('🚀 Starting Unite Backend Server...');

    // Step 1: Test MySQL connection
    logger.info('📡 Testing MySQL connection...');
    await testMySQLConnection();
    logger.info('✅ MySQL connected successfully');

    // Step 2: Run database migrations
    logger.info('🔄 Running database migrations...');
    try {
      await MigrationService.runMigrations();
      logger.info('✅ Database migrations completed');
    } catch (error: any) {
      logger.error('⚠️ Migration issue:', error.message);
      logger.info('⏭️ Continuing startup (migrations may have already run)');
    }

    // Step 3: Connect to MongoDB
    logger.info('📡 Connecting to MongoDB...');
    try {
      await connectMongoDB();
      logger.info('✅ MongoDB connected');
    } catch (error: any) {
      logger.warn('⚠️ MongoDB connection warning:', error.message);
      logger.info('⏭️ Continuing without MongoDB (non-critical)');
    }

    // Step 4: Test Redis connection
    logger.info('📡 Testing Redis connection...');
    try {
      await redis.ping();
      logger.info('✅ Redis connected');
    } catch (error: any) {
      logger.warn('⚠️ Redis warning:', error.message);
    }

    // Step 5: Start HTTP server
    logger.info('🚀 Starting HTTP server...');
    server = app.listen(PORT, () => {
      logger.info(`🎉 Server running on port ${PORT}`);
      logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
      logger.info(`✅ All systems initialized and ready`);
    });

    // Step 6: Setup periodic cleanup (every hour)
    setInterval(async () => {
      try {
        const deleted = await AuthService.cleanupExpiredTokens();
        if (deleted > 0) {
          logger.info(`🧹 Cleaned up ${deleted} expired tokens`);
        }
      } catch (error) {
        logger.warn('Token cleanup warning:', error);
      }
    }, 60 * 60 * 1000);

  } catch (error: any) {
    logger.error('❌ Critical startup error:', error);
    logger.error('Stack:', error.stack);
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string) {
  logger.info(`📴 ${signal} received - initiating graceful shutdown`);

  if (server) {
    server.close(async () => {
      logger.info('🛑 HTTP server closed');

      try {
        logger.info('Closing database connections...');
        await closeDatabaseConnections();
        
        logger.info('Closing Redis connection...');
        await redis.quit();
        
        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error: any) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('⏱️ Shutdown timeout - forcing exit');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
}

// Register signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error: Error) => {
  logger.error('💥 Uncaught exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('⚠️ Unhandled rejection:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();