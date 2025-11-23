import { Response } from 'express';
import { AuthRequest } from '../types';
import { CsvService } from '../services/csvService';
import { ApiResponse } from '../types';
import logger from '../utils/logger';

export class CsvController {

    static async upload(req: AuthRequest, res: Response): Promise<any | Object> {
        try {
            if (!req.file) {
                res.status(400).json({
                    success: false,
                    error: 'No file uploaded',
                    correlationId: req.correlationId
                });
                return;
            }

            const userId = req.user!.id;
            const result = await CsvService.uploadCsvForProcessing(req.file, userId);

            const response: ApiResponse = {
                success: true,
                data: result,
                message: 'CSV uploaded successfully and queued for processing',
                correlationId: req.correlationId
            };

            res.status(202).json(response); // 202 Accepted
        } catch (error: any) {
            logger.error('CSV upload error:', error);
            throw error;
        }
    }

    static async getStatus(req: AuthRequest, res: Response): Promise<any | Object> {
        try {
            const csvLogId = req.params.id;
            const status = await CsvService.getCsvStatus(csvLogId);

            const response: ApiResponse = {
                success: true,
                data: status,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Get CSV status error:', error);
            throw error;
        }
    }

    static async getHistory(req: AuthRequest, res: Response): Promise<any | Object> {
        try {
            const userId = req.user!.id;
            const { limit = 10 } = req.query;

            const history = await CsvService.getUserCsvHistory(
                userId,
                parseInt(limit as string)
            );

            const response: ApiResponse = {
                success: true,
                data: history,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Get CSV history error:', error);
            throw error;
        }
    }
}