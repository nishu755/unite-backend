import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient, AWS_CONFIG } from '../config/aws';
import { CsvService } from '../services/csvService';
import { connectMongoDB } from '../config/database';
import logger from '../utils/logger';

// Worker to process CSV files from SQS queue
export class CsvProcessor {
  private static isRunning = false;

  static async start(): Promise<any> {
    if (this.isRunning) {
      logger.warn('CSV processor already running');
      return;
    }

    this.isRunning = true;
    logger.info('CSV processor started');

    // Connect to MongoDB
    await connectMongoDB();

    // Poll SQS queue
    while (this.isRunning) {
      try {
        await this.pollQueue();
      } catch (error) {
        logger.error('Error in CSV processor:', error);
        // Wait before retrying
        await this.sleep(5000);
      }
    }
  }

  static stop(): void {
    this.isRunning = false;
    logger.info('CSV processor stopped');
  }

  private static async pollQueue(): Promise<any> {
    const command = new ReceiveMessageCommand({
      QueueUrl: AWS_CONFIG.SQS_QUEUE_URL,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20, // Long polling
      MessageAttributeNames: ['All']
    });

    const response = await sqsClient.send(command);

    if (!response.Messages || response.Messages.length === 0) {
      return;
    }

    for (const message of response.Messages) {
      try {
        const body = JSON.parse(message.Body || '{}');
        logger.info(`Processing CSV job: ${body.csvLogId}`);

        // Process the CSV
        await CsvService.processCsvFile(body.csvLogId, body.s3Key);

        // Delete message from queue
        await this.deleteMessage(message.ReceiptHandle!);

        logger.info(`CSV job completed: ${body.csvLogId}`);
      } catch (error) {
        logger.error('Failed to process CSV message:', error);
        // Message will become visible again for retry
      }
    }
  }

  private static async deleteMessage(receiptHandle: string): Promise<any> {
    const command = new DeleteMessageCommand({
      QueueUrl: AWS_CONFIG.SQS_QUEUE_URL,
      ReceiptHandle: receiptHandle
    });

    await sqsClient.send(command);
  }

  private static sleep(ms: number): Promise<any> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run worker if this file is executed directly
if (require.main === module) {
  CsvProcessor.start().catch((error: any) => {
    logger.error('Failed to start CSV processor:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Received SIGINT, shutting down...');
    CsvProcessor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down...');
    CsvProcessor.stop();
    process.exit(0);
  });
}