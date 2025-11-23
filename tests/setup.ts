import dotenv from 'dotenv';
import path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

// Set environment to test
process.env.NODE_ENV = 'test';

// Mock AWS services
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-sns');
jest.mock('@aws-sdk/client-sqs');

// Mock Sentry
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  Handlers: {
    requestHandler: jest.fn(() => (req: any, res: any, next: any) => next()),
    tracingHandler: jest.fn(() => (req: any, res: any, next: any) => next()),
    errorHandler: jest.fn(() => (err: any, req: any, res: any, next: any) => next(err)),
  },
  captureException: jest.fn(),
}));

// Mock Twilio
jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'test-sid',
        status: 'sent',
        to: '+1234567890',
        from: '+0987654321',
      }),
    },
  }));
});

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn(() => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

// Global test utilities
global.testUtils = {
  generateToken: (userId: number, role: string) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { id: userId, email: `user${userId}@test.com`, role },
      'test-secret',
      { expiresIn: '15m' }
    );
  },
};

// Increase test timeout for integration tests
jest.setTimeout(30000);

afterAll(async () => {
  // Cleanup
  jest.clearAllMocks();
});