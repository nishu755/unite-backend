import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, AWS_CONFIG } from '../config/aws';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

type ImageUploadResult = {
  uploadUrl: string;
  key: string;
  imageUrl: string;
};

type CsvUploadResult = {
  uploadUrl: string;
  key: string;
};

/**
 * S3 helper service
 */
export class S3Service {
  /**
   * Generate pre-signed URL for image upload
   * @param fileName original file name (for logging/optional use)
   * @param fileType mime type (e.g. "image/png")
   */
  static async generateImageUploadUrl(
    fileName: string,
    fileType: string
  ): Promise<ImageUploadResult> {
    try {
      const allowedTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/jpg',
        'image/webp'
      ]);

      if (!allowedTypes.has(fileType)) {
        throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed');
      }

      // Map common mime types to safe extensions
      const mimeToExt: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp'
      };

      const fileExtension = mimeToExt[fileType] ?? 'bin';
      const key = `images/${uuidv4()}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: AWS_CONFIG.S3_BUCKET_IMAGES,
        Key: key,
        ContentType: fileType
      });

      // 5 minutes
      const uploadUrl = await getSignedUrl(s3Client as S3Client, command, { expiresIn: 300 });

      const imageUrl = `https://${AWS_CONFIG.S3_BUCKET_IMAGES}.s3.${AWS_CONFIG.REGION}.amazonaws.com/${key}`;

      logger.info(`Generated upload URL for image: ${fileName} -> key=${key}`);

      return { uploadUrl, key, imageUrl };
    } catch (err) {
      logger.error(`generateImageUploadUrl error: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Generate pre-signed URL for CSV upload
   * @param fileName original file name
   */
  static async generateCsvUploadUrl(fileName: string): Promise<CsvUploadResult> {
    try {
      const key = `csv/${Date.now()}-${fileName.replace(/\s+/g, '_')}`;

      const command = new PutObjectCommand({
        Bucket: AWS_CONFIG.S3_BUCKET_CSV,
        Key: key,
        ContentType: 'text/csv'
      });

      // 10 minutes
      const uploadUrl = await getSignedUrl(s3Client as S3Client, command, { expiresIn: 600 });

      logger.info(`Generated CSV upload URL for: ${fileName} -> key=${key}`);

      return { uploadUrl, key };
    } catch (err) {
      logger.error(`generateCsvUploadUrl error: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Generate pre-signed URL for downloading a file
   * @param bucket bucket name
   * @param key object key
   */
  static async generateDownloadUrl(bucket: string, key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key
      });

      // 1 hour
      const downloadUrl = await getSignedUrl(s3Client as S3Client, command, { expiresIn: 3600 });

      return downloadUrl;
    } catch (err) {
      logger.error(`generateDownloadUrl error for ${bucket}/${key}: ${(err as Error).message}`);
      throw err;
    }
  }

  /**
   * Upload buffer directly to S3 (server-side upload)
   * @param buffer file buffer
   * @param key destination key in bucket
   * @param contentType mime type
   * @param bucket optional bucket name (defaults to images bucket)
   */
  static async uploadBuffer(
    buffer: Buffer,
    key: string,
    contentType: string,
    bucket: string = AWS_CONFIG.S3_BUCKET_IMAGES
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType
      });

      await (s3Client as S3Client).send(command);

      const fileUrl = `https://${bucket}.s3.${AWS_CONFIG.REGION}.amazonaws.com/${key}`;
      logger.info(`Uploaded file to S3: ${bucket}/${key}`);

      return fileUrl;
    } catch (err) {
      logger.error(`uploadBuffer error for ${bucket}/${key}: ${(err as Error).message}`);
      throw err;
    }
  }
}
