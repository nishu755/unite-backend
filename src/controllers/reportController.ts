import { Response } from 'express';
import { AuthRequest } from '../types';
import { ReportService } from '../services/reportService';
import { ApiResponse } from '../types';
import logger from '../utils/logger';

export class ReportController {

    static async getDailySummary(req: AuthRequest, res: Response): Promise<any | Object> {
        try {
            const { date } = req.query;

            // Default to today if no date provided
            const reportDate = date
                ? (date as string)
                : new Date().toISOString().split('T')[0];

            const summary = await ReportService.getDailySummary(reportDate);

            const response: ApiResponse = {
                success: true,
                data: summary,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Get daily summary error:', error);
            throw error;
        }
    }


    static async getAgentPerformance(req: AuthRequest, res: Response): Promise<any | Object> {
        try {
            const agentId = parseInt(req.params.agentId);
            const { startDate, endDate } = req.query;

            // Default to last 30 days
            const end = endDate ? new Date(endDate as string) : new Date();
            const start = startDate
                ? new Date(startDate as string)
                : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

            const report = await ReportService.getAgentPerformanceReport(
                agentId,
                start,
                end
            );

            const response: ApiResponse = {
                success: true,
                data: report,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Get agent performance error:', error);
            throw error;
        }
    }


    static async getTeamPerformance(req: AuthRequest, res: Response): Promise<any | Object> {
        try {
            const { startDate, endDate } = req.query;

            // Default to last 7 days
            const end = endDate
                ? (endDate as string)
                : new Date().toISOString().split('T')[0];
            const start = startDate
                ? (startDate as string)
                : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const overview = await ReportService.getTeamPerformanceOverview(start, end);

            const response: ApiResponse = {
                success: true,
                data: overview,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Get team performance error:', error);
            throw error;
        }
    }

    static async getCallVolumeTrends(req: AuthRequest, res: Response): Promise<any | Object> {
        try {
            const trends = await ReportService.getCallVolumeTrends();

            const response: ApiResponse = {
                success: true,
                data: trends,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Get call volume trends error:', error);
            throw error;
        }
    }
}