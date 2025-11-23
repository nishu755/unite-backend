import { Response } from 'express';
import { AuthRequest, CallTaskStatus, UserRole } from '../types';
import { CallTaskService } from '../services/callTaskService';
import { ApiResponse } from '../types';
import { ForbiddenError } from '../utils/errors';
import logger from '../utils/logger';

export class CallTaskController {
  /**
   * Create new call task
   * POST /api/call-tasks
   */
  static async create(req: AuthRequest, res: Response): Promise<any | Object> {
    try {
      const task = await CallTaskService.createCallTask(req.body);

      const response: ApiResponse = {
        success: true,
        data: task,
        message: 'Call task created successfully',
        correlationId: req.correlationId
      };

      res.status(201).json(response);
    } catch (error: any) {
      logger.error('Create call task error:', error);
      throw error;
    }
  }

  /**
   * Complete call task
   * POST /api/call-tasks/:id/complete
   */
  static async complete(req: AuthRequest, res: Response): Promise<any | Object> {
    try {
      const taskId = parseInt(req.params.id);
      const agentId = req.user!.id;
      const { notes, outcome } = req.body;

      const task = await CallTaskService.completeCallTask(
        taskId,
        agentId,
        notes,
        outcome
      );

      const response: ApiResponse = {
        success: true,
        data: task,
        message: 'Call task completed successfully',
        correlationId: req.correlationId
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Complete call task error:', error);
      throw error;
    }
  }

  /**
   * Mark task as missed
   * POST /api/call-tasks/:id/missed
   */
  static async markAsMissed(req: AuthRequest, res: Response): Promise<any | Object> {
    try {
      const taskId = parseInt(req.params.id);

      const task = await CallTaskService.markTaskAsMissed(taskId);

      const response: ApiResponse = {
        success: true,
        data: task,
        message: 'Task marked as missed',
        correlationId: req.correlationId
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Mark task as missed error:', error);
      throw error;
    }
  }

  /**
   * Get agent's tasks
   * GET /api/call-tasks/my-tasks
   */
  static async getMyTasks(req: AuthRequest, res: Response): Promise<any | Object> {
    try {
      const agentId = req.user!.id;
      const { status } = req.query;

      const tasks = await CallTaskService.getAgentTasks(
        agentId,
        status as CallTaskStatus | undefined
      );

      const response: ApiResponse = {
        success: true,
        data: tasks,
        correlationId: req.correlationId
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Get my tasks error:', error);
      throw error;
    }
  }

  /**
   * Get pending tasks
   * GET /api/call-tasks/pending
   */
  static async getPending(req: AuthRequest, res: Response): Promise<any | Object> {
    try {
      const agentId = req.user!.id;

      const tasks = await CallTaskService.getPendingTasks(agentId);

      const response: ApiResponse = {
        success: true,
        data: tasks,
        correlationId: req.correlationId
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Get pending tasks error:', error);
      throw error;
    }
  }

  /**
   * Get overdue tasks (admin/manager only)
   * GET /api/call-tasks/overdue
   */
  static async getOverdue(req: AuthRequest, res: Response): Promise<any | Object> {
    try {
      // Only admin and manager can see all overdue tasks
      if (req.user!.role === UserRole.AGENT) {
        const tasks = await CallTaskService.getOverdueTasks(req.user!.id);
        const response: ApiResponse = {
          success: true,
          data: tasks,
          correlationId: req.correlationId
        };
        res.status(200).json(response);
        return;
      }

      const tasks = await CallTaskService.getOverdueTasks();

      const response: ApiResponse = {
        success: true,
        data: tasks,
        correlationId: req.correlationId
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Get overdue tasks error:', error);
      throw error;
    }
  }

  /**
   * Get task details
   * GET /api/call-tasks/:id
   */
  static async getById(req: AuthRequest, res: Response): Promise<any | Object> {
    try {
      const taskId = parseInt(req.params.id);

      const task = await CallTaskService.getTaskWithDetails(taskId);

      const response: ApiResponse = {
        success: true,
        data: task,
        correlationId: req.correlationId
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Get task error:', error);
      throw error;
    }
  }

  /**
   * Get agent task statistics
   * GET /api/call-tasks/stats/:agentId
   */
  static async getAgentStats(req: AuthRequest, res: Response): Promise<any | Object> {
    try {
      const agentId = parseInt(req.params.agentId);
      const { startDate, endDate } = req.query;

      const stats = await CallTaskService.getAgentTaskStats(
        agentId,
        startDate as string,
        endDate as string
      );

      const response: ApiResponse = {
        success: true,
        data: stats,
        correlationId: req.correlationId
      };

      res.status(200).json(response);
    } catch (error: any) {
      logger.error('Get agent stats error:', error);
      throw error;
    }
  }
}