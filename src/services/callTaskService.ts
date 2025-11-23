import { CallTaskModel } from '../models/mysql/CallTask';
import { LeadModel } from '../models/mysql/Lead';
import { UserModel } from '../models/mysql/User';
import { ICallTask, CallTaskStatus } from '../types';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { CallLog } from '../models/mongodb/CallLog';
import { SNSService } from './snsService';
import { TwilioService } from './twilioService';
import { cacheService } from '../config/redis';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class CallTaskService {
  /**
   * Create a new call task and send notifications
   */
  static async createCallTask(data: {
    lead_id: number;
    agent_id: number;
    scheduled_at?: Date;
    idempotency_key?: string;
  }): Promise<ICallTask> {  // ✅ Fixed
    // Validate lead exists
    const lead = await LeadModel.findById(data.lead_id);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    // Validate agent exists
    const agent = await UserModel.findById(data.agent_id);
    if (!agent) {
      throw new NotFoundError('Agent not found');
    }

    // Create task with idempotency
    const idempotencyKey = data.idempotency_key || uuidv4();
    const taskId = await CallTaskModel.create({
      ...data,
      idempotency_key: idempotencyKey
    });

    const task = await CallTaskModel.findById(taskId);
    if (!task) {
      throw new Error('Failed to create call task');
    }

    // Send notifications asynchronously (don't wait)
    this.sendTaskAssignmentNotifications(task, lead, agent).catch(error => {
      logger.error('Failed to send task assignment notifications:', error);
    });

    // Invalidate cache
    await cacheService.flushPattern('call_tasks:*');

    logger.info(`Call task created: ${taskId} for lead ${lead.name}`);

    return task;
  }

  /**
   * Complete a call task
   */
  static async completeCallTask(
    taskId: number,
    agentId: number,
    notes: string,
    outcome: string
  ): Promise<ICallTask> {  // ✅ Fixed
    // Validate task exists
    const task = await CallTaskModel.findById(taskId);
    if (!task) {
      throw new NotFoundError('Call task not found');
    }

    // Verify agent owns this task
    if (task.agent_id !== agentId) {
      throw new ForbiddenError('You can only complete your own tasks');
    }

    // Verify task is pending
    if (task.status !== CallTaskStatus.PENDING) {
      throw new ValidationError('Task is already completed or missed');
    }

    // Complete the task
    const success = await CallTaskModel.complete(taskId, agentId, notes, outcome);
    if (!success) {
      throw new Error('Failed to complete call task');
    }

    // Get updated task
    const updatedTask = await CallTaskModel.findById(taskId);
    if (!updatedTask) {
      throw new Error('Failed to retrieve updated task');
    }

    // Create immutable call log
    await this.createCallLog(updatedTask, notes, outcome);

    // Send completion notifications
    const lead = await LeadModel.findById(task.lead_id);
    const agent = await UserModel.findById(agentId);

    if (lead && agent) {
      this.sendTaskCompletionNotifications(updatedTask, lead, agent, outcome).catch(error => {
        logger.error('Failed to send task completion notifications:', error);
      });
    }

    // Invalidate cache
    await cacheService.flushPattern('call_tasks:*');
    await cacheService.flushPattern('reports:*');

    logger.info(`Call task completed: ${taskId} by agent ${agentId}`);

    return updatedTask;
  }

  /**
   * Mark task as missed
   */
  static async markTaskAsMissed(taskId: number): Promise<ICallTask> {  // ✅ Fixed
    const task = await CallTaskModel.findById(taskId);
    if (!task) {
      throw new NotFoundError('Call task not found');
    }

    if (task.status !== CallTaskStatus.PENDING) {
      throw new ValidationError('Task is not pending');
    }

    const success = await CallTaskModel.markAsMissed(taskId);  // ✅ Fixed - only taskId
    if (!success) {
      throw new Error('Failed to mark task as missed');
    }

    // Create call log for missed call
    await this.createCallLog(task, 'Task marked as missed', 'missed');

    // Invalidate cache
    await cacheService.flushPattern('call_tasks:*');
    await cacheService.flushPattern('reports:*');

    logger.info(`Call task marked as missed: ${taskId}`);

    const updatedTask = await CallTaskModel.findById(taskId);
    if (!updatedTask) {
      throw new Error('Failed to retrieve updated task');
    }

    return updatedTask;
  }

  /**
   * Get tasks for an agent
   */
  static async getAgentTasks(
    agentId: number,
    status?: CallTaskStatus
  ): Promise<ICallTask[]> {  // ✅ Fixed
    const cacheKey = `call_tasks:agent:${agentId}:${status || 'all'}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tasks = await CallTaskModel.findByAgent(agentId, status);

    // Cache for 2 minutes
    await cacheService.set(cacheKey, tasks, 120);

    return tasks;
  }

  /**
   * Get pending tasks for an agent
   */
  static async getPendingTasks(agentId: number): Promise<ICallTask[]> {  // ✅ Fixed
    return await CallTaskModel.getTodaysTasks(agentId);
  }

  /**
   * Get overdue tasks
   */
  static async getOverdueTasks(agentId?: number): Promise<ICallTask[]> {  // ✅ Fixed
    return await CallTaskModel.getOverdueTasks();
  }

  /**
   * Get task by ID with details
   */
  static async getTaskWithDetails(taskId: number): Promise<ICallTask | null> {  // ✅ Fixed
    return await CallTaskModel.findById(taskId);
  }

  /**
   * Send task assignment notifications (SNS + SMS)
   */
  private static async sendTaskAssignmentNotifications(
    task: ICallTask,
    lead: any,
    agent: any
  ): Promise<void> {  // ✅ Fixed
    // Send SNS notification
    await SNSService.notifyTaskAssignment({
      taskId: task.id,
      leadName: lead.name,
      agentEmail: agent.email,
      agentPhone: agent.phone
    });

    // Send SMS to agent if phone is available
    if (agent.phone) {
      await TwilioService.sendTaskAssignmentSMS({
        agentPhone: agent.phone,
        agentName: agent.email.split('@')[0], // Use email prefix as name
        leadName: lead.name,
        taskId: task.id,
        leadId: lead.id,
        agentId: agent.id
      });
    }
  }

  /**
   * Send task completion notifications
   */
  private static async sendTaskCompletionNotifications(
    task: ICallTask,
    lead: any,
    agent: any,
    outcome: string
  ): Promise<void> {  // ✅ Fixed
    // Send SNS notification
    await SNSService.notifyTaskCompletion({
      taskId: task.id,
      leadName: lead.name,
      outcome,
      agentEmail: agent.email
    });
  }

  /**
   * Create immutable call log in MongoDB
   */
  private static async createCallLog(
    task: ICallTask,
    notes: string,
    outcome: string
  ): Promise<void> {  // ✅ Fixed
    await CallLog.create({
      call_task_id: task.id,
      lead_id: task.lead_id,
      agent_id: task.agent_id,
      status: task.status === CallTaskStatus.COMPLETED ? 'completed' : 'missed',
      notes,
      outcome,
      call_timestamp: new Date(),
      metadata: {
        scheduled_at: task.scheduled_at,
        completed_at: task.completed_at
      }
    });

    logger.info(`Call log created for task ${task.id}`);
  }

  /**
   * Get task statistics for an agent
   */
  static async getAgentTaskStats(
    agentId: number,
    startDate: string,
    endDate: string
  ): Promise<any> {  // ✅ Fixed (or use AgentTaskStats type)
    const cacheKey = `call_tasks:stats:${agentId}:${startDate}:${endDate}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const stats = await CallTaskModel.getAgentStats(agentId, startDate, endDate);

    // Cache for 10 minutes
    await cacheService.set(cacheKey, stats, 600);

    return stats;
  }
}