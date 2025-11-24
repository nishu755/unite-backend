import { S3Service } from './s3Service';
import { LeadModel } from '../models/mysql/Lead';
import { CsvLog } from '../models/mongodb/CsvLog';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { sqsClient, AWS_CONFIG } from '../config/aws';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import Joi from 'joi';


const csvRowSchema = Joi.object({
  name: Joi.string().required().min(2).max(255),
  phone: Joi.string().required().pattern(/^\+?[1-9]\d{1,14}$/),
  email: Joi.string().email().optional().allow(''),
  source: Joi.string().optional().max(100)
});

export interface CsvRow {
  name: string;
  phone: string;
  email?: string;
  source?: string;
}

export class CsvService {
  /**
   * Upload CSV and trigger async processing
   */
  static async uploadCsvForProcessing(
    file: Express.Multer.File,
    userId: number
  ): Promise<{ csvLogId: string; s3Key: string; message: string }> {
    // Validate file type
    if (file.mimetype !== 'text/csv' && file.mimetype !== 'application/vnd.ms-excel') {
      throw new ValidationError('Only CSV files are allowed');
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      throw new ValidationError('File size must not exceed 10MB');
    }

    // Upload to S3
    const fileName = file.originalname;
    const { key } = await S3Service.generateCsvUploadUrl(fileName);

    // Upload buffer directly (server-side)
    await S3Service.uploadBuffer(file.buffer, key, 'text/csv', AWS_CONFIG.S3_BUCKET_CSV);

    // Create CSV log entry
    const csvLog = await CsvLog.create({
      file_name: fileName,
      s3_key: key,
      upload_user_id: userId,
      status: 'pending',
      total_rows: 0,
      successful_imports: 0,
      failed_imports: 0,
      validation_errors: [],
      created_at: new Date()
    });

    // Send message to SQS for async processing
    await this.sendToProcessingQueue({
      csvLogId: csvLog._id.toString(),
      s3Key: key,
      userId
    });

    logger.info(`CSV uploaded for processing: ${fileName} by user ${userId}`);

    return {
      csvLogId: csvLog._id.toString(),
      s3Key: key,
      message: 'CSV uploaded successfully and queued for processing'
    };
  }

  /**
   * Process CSV file (called by worker)
   */
  static async processCsvFile(csvLogId: string, s3Key: string): Promise<void> {
    const startTime = Date.now();

    try {
      // Update status to processing
      await CsvLog.updateOne({ _id: csvLogId }, { $set: { status: 'processing', started_at: new Date() } });

      // Download CSV from S3 via signed URL
      const downloadUrl = await S3Service.generateDownloadUrl(AWS_CONFIG.S3_BUCKET_CSV, s3Key);


      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error(`Failed to download CSV: ${res.status} ${res.statusText}`);
      const csvContent = await res.text();

      // Parse CSV
      const rows: CsvRow[] = [];
      const errors: Array<{ row: number; data: any; error: string }> = [];

      await new Promise<void>((resolve, reject) => {
        let rowNumber = 0;
        Readable.from([csvContent])
          .pipe(csvParser())
          .on('data', (data: Record<string, any>) => {
            rowNumber++;
            // Normalize empty strings to undefined for optional fields
            if (data.email === '') delete data.email;
            if (data.source === '') delete data.source;

            const { error, value } = csvRowSchema.validate(data, {
              abortEarly: false,
              stripUnknown: true,
              convert: true
            });

            if (error) {
              errors.push({
                row: rowNumber,
                data,
                error: error.details.map((d) => d.message).join(', ')
              });
            } else {
              // value is validated and typed as any; cast to CsvRow
              rows.push(value as CsvRow);
            }
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });

      logger.info(`Parsed CSV: ${rows.length} valid rows, ${errors.length} invalid rows`);

      // Bulk create leads (assume LeadModel.bulkCreate returns number of created rows)
      // If your bulkCreate signature differs (e.g. returns array), adjust accordingly.
      const successfulImports: number = await LeadModel.bulkCreate(rows);

      const processingTime = Date.now() - startTime;

      // Update CSV log
      await CsvLog.updateOne(
        { _id: csvLogId },
        {
          $set: {
            status: 'completed',
            total_rows: rows.length + errors.length,
            successful_imports: successfulImports,
            failed_imports: errors.length,
            validation_errors: errors,
            processing_time_ms: processingTime,
            completed_at: new Date()
          }
        }
      );

      logger.info(`CSV processing completed: ${successfulImports} imports, ${errors.length} errors`);
    } catch (err: any) {
      logger.error('CSV processing failed:', err?.message ?? err);
      await CsvLog.updateOne(
        { _id: csvLogId },
        {
          $set: {
            status: 'failed',
            error_report: err?.message ?? String(err),
            completed_at: new Date()
          }
        }
      );
    }
  }

  /**
   * Send CSV processing job to SQS
   */
  private static async sendToProcessingQueue(data: { csvLogId: string; s3Key: string; userId: number }): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: AWS_CONFIG.SQS_QUEUE_URL,
      MessageBody: JSON.stringify(data),
      MessageAttributes: {
        jobType: {
          DataType: 'String',
          StringValue: 'csv_processing'
        }
      }
    });

    await (sqsClient as SQSClient).send(command);
    logger.info(`CSV processing job queued: ${data.csvLogId}`);
  }

  /**
   * Get CSV processing status
   */
  static async getCsvStatus(csvLogId: string): Promise<{
    id: string;
    file_name: string;
    status: string;
    total_rows: number;
    successful_imports: number;
    failed_imports: number;
    validation_errors?: Array<any>;
    processing_time_ms?: number;
    created_at?: Date;
    completed_at?: Date;
  }> {
    const csvLog = await CsvLog.findById(csvLogId);
    if (!csvLog) {
      throw new ValidationError('CSV log not found');
    }

    return {
      id: csvLog._id.toString(),
      file_name: csvLog.file_name,
      status: csvLog.status,
      total_rows: csvLog.total_rows ?? 0,
      successful_imports: csvLog.successful_imports ?? 0,
      failed_imports: csvLog.failed_imports ?? 0,
      validation_errors: Array.isArray(csvLog.validation_errors) ? csvLog.validation_errors : undefined,
      // convert null -> undefined to satisfy strict type expectations
      processing_time_ms: csvLog.processing_time_ms ?? undefined,
      created_at: csvLog.created_at ?? undefined,
      completed_at: csvLog.completed_at ?? undefined
    };
  }

  /**
   * Get user's CSV upload history
   */
  static async getUserCsvHistory(userId: number, limit: number = 10): Promise<Array<any>> {
    const logs = await CsvLog.find({ upload_user_id: userId })
      .sort({ created_at: -1 })
      .limit(limit)
      .lean()
      .exec?.();

    // If .exec is not available, logs is already the result
    const results = (logs as any[]) ?? (await CsvLog.find({ upload_user_id: userId }).sort({ created_at: -1 }).limit(limit));

    return results.map((log: any) => ({
      id: log._id.toString(),
      file_name: log.file_name,
      status: log.status,
      total_rows: log.total_rows,
      successful_imports: log.successful_imports,
      failed_imports: log.failed_imports,
      created_at: log.created_at,
      completed_at: log.completed_at
    }));
  }
}