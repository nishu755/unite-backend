import { Response } from 'express';
import { AuthRequest, LeadStatus } from '../types';
import { LeadService } from '../services/leadService';
import { ApiResponse } from '../types';
import logger from '../utils/logger';

export class LeadController {
   
    static async create(req: AuthRequest, res: Response): Promise<any | object> {
        try {
            const lead = await LeadService.createLead(req.body);

            const response: ApiResponse = {
                success: true,
                data: lead,
                message: 'Lead created successfully',
                correlationId: req.correlationId
            };

            res.status(201).json(response);
        } catch (error: any) {
            logger.error('Create lead error:', error);
            throw error;
        }
    }
    static async getById(req: AuthRequest, res: Response): Promise<any | object> {
        try {
            const leadId = parseInt(req.params.id);
            const lead = await LeadService.getLeadById(leadId);

            const response: ApiResponse = {
                success: true,
                data: lead,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Get lead error:', error);
            throw error;
        }
    }

    static async getAll(req: AuthRequest, res: Response): Promise<any | object> {
        try {
            const { status, source, assigned_to, page = 1, limit = 20 } = req.query;

            const filters = {
                status: status as LeadStatus | undefined,
                source: source as string | undefined,
                assigned_to: assigned_to ? parseInt(assigned_to as string) : undefined
            };

            const result = await LeadService.getLeads(
                filters,
                parseInt(page as string),
                parseInt(limit as string)
            );

            const response: ApiResponse = {
                success: true,
                data: result,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Get leads error:', error);
            throw error;
        }
    }
    static async update(req: AuthRequest, res: Response): Promise<any | object> {
        try {
            const leadId = parseInt(req.params.id);
            const lead = await LeadService.updateLead(leadId, req.body);

            const response: ApiResponse = {
                success: true,
                data: lead,
                message: 'Lead updated successfully',
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Update lead error:', error);
            throw error;
        }
    }


    static async delete(req: AuthRequest, res: Response): Promise<any | object> {
        try {
            const leadId = parseInt(req.params.id);
            await LeadService.deleteLead(leadId);

            const response: ApiResponse = {
                success: true,
                message: 'Lead deleted successfully',
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Delete lead error:', error);
            throw error;
        }
    }

  
    static async assign(req: AuthRequest, res: Response): Promise<any | object> {
        try {
            const leadId = parseInt(req.params.id);
            const { agent_id } = req.body;

            const lead = await LeadService.assignLead(leadId, agent_id);

            const response: ApiResponse = {
                success: true,
                data: lead,
                message: 'Lead assigned successfully',
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Assign lead error:', error);
            throw error;
        }
    }

    
    static async search(req: AuthRequest, res: Response): Promise<any | object> {
        try {
            const { q, limit = 20 } = req.query;

            const leads = await LeadService.searchLeads(
                q as string,
                parseInt(limit as string)
            );

            const response: ApiResponse = {
                success: true,
                data: leads,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Search leads error:', error);
            throw error;
        }
    }


    static async getStats(req: AuthRequest, res: Response): Promise<any | object> {
        try {
            const stats = await LeadService.getLeadStats();

            const response: ApiResponse = {
                success: true,
                data: stats,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Get lead stats error:', error);
            throw error;
        }
    }

    static async getImageUploadUrl(req: AuthRequest, res: Response): Promise<any | object> {
        try {
            const { fileName, fileType } = req.body;

            const { S3Service } = await import('../services/s3Service');
            const result = await S3Service.generateImageUploadUrl(fileName, fileType);

            const response: ApiResponse = {
                success: true,
                data: result,
                correlationId: req.correlationId
            };

            res.status(200).json(response);
        } catch (error: any) {
            logger.error('Get image upload URL error:', error);
            throw error;
        }
    }
}