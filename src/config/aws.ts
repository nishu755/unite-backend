import { S3Client } from '@aws-sdk/client-s3';
import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';
import logger from '../utils/logger';
import 'dotenv/config';

const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  } : undefined,
};

// S3 Client
export const s3Client = new S3Client(awsConfig);
logger.info('AWS S3 Client initialized');

// SNS Client
export const snsClient = new SNSClient(awsConfig);
logger.info('AWS SNS Client initialized');

// SQS Client
export const sqsClient = new SQSClient(awsConfig);
logger.info('AWS SQS Client initialized');

export const AWS_CONFIG = {
  S3_BUCKET_IMAGES: process.env.S3_BUCKET_IMAGES || 'unite-images-bucket',
  S3_BUCKET_CSV: process.env.S3_BUCKET_CSV || 'unite-csv-bucket',
  SNS_TOPIC_ARN: process.env.SNS_TOPIC_ARN || '',
  SQS_QUEUE_URL: process.env.SQS_QUEUE_URL || '',
  REGION: process.env.AWS_REGION || 'us-east-1',
};