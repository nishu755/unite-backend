import mysql from 'mysql2/promise';
import mongoose from 'mongoose';
import logger from '../utils/logger';


// MySQL Connection Pool
export const createMySQLPool = () => {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Nishant@123',
    database: process.env.DB_NAME,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
    waitForConnections: true,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });

  logger.info('MySQL connection pool created');
  return pool;
};


export const testMySQLConnection = async () => {
  try {
    const connection = await mysqlPool.getConnection();
    logger.info('MySQL connection established successfully');
    connection.release();
    return true;
  } catch (error) {
    logger.error('MySQL connection failed:', error);
    throw error;
  }
};
export const mysqlPool = createMySQLPool();


export const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/unite';

    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DB_NAME || 'unite_logs',
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    return mongoose.connection;
  } catch (error) {
    logger.error('MongoDB connection failed:', error);
    throw error;
  }
}

export const closeDatabaseConnections = async () => {
  try {
    await mysqlPool.end();
    await mongoose.connection.close();
    logger.info('Database connections closed');
  } catch (error) {
    logger.error('Error closing database connections:', error);
  }
};