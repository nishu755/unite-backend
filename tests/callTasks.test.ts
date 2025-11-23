import { CallTaskService } from '../src/services/callTaskService';
import { CallTaskModel } from '../src/models/mysql/CallTask';
import { LeadModel } from '../src/models/mysql/Lead';
import { UserModel } from '../src/models/mysql/User';
import { CallTaskStatus } from '../src/types';
import { ValidationError, NotFoundError, ForbiddenError } from '../src/utils/errors';

jest.mock('../src/models/mysql/CallTask');
jest.mock('../src/models/mysql/Lead');
jest.mock('../src/models/mysql/User');
jest.mock('../src/services/snsService');
jest.mock('../src/services/twilioService');

describe('CallTaskService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createCallTask', () => {
    it('should create a call task successfully', async () => {
      const mockTaskId = 1;

      (LeadModel.findById as jest.Mock).mockResolvedValueOnce({
        id: 1,
        name: 'John Doe',
      });
      (UserModel.findById as jest.Mock).mockResolvedValueOnce({
        id: 1,
        email: 'agent@example.com',
      });
      (CallTaskModel.create as jest.Mock).mockResolvedValueOnce(mockTaskId);
      (CallTaskModel.findById as jest.Mock).mockResolvedValueOnce({
        id: mockTaskId,
        lead_id: 1,
        agent_id: 1,
        status: CallTaskStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await CallTaskService.createCallTask({
        lead_id: 1,
        agent_id: 1,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(mockTaskId);
      expect(result.status).toBe(CallTaskStatus.PENDING);
    });

    it('should reject if lead does not exist', async () => {
      (LeadModel.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        CallTaskService.createCallTask({
          lead_id: 999,
          agent_id: 1,
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject if agent does not exist', async () => {
      (LeadModel.findById as jest.Mock).mockResolvedValueOnce({
        id: 1,
        name: 'John Doe',
      });
      (UserModel.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        CallTaskService.createCallTask({
          lead_id: 1,
          agent_id: 999,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('completeCallTask', () => {
    it('should complete a call task successfully', async () => {
      const agentId = 1;
      const taskId = 1;

      (CallTaskModel.findById as jest.Mock)
        .mockResolvedValueOnce({
          id: taskId,
          lead_id: 1,
          agent_id: agentId,
          status: CallTaskStatus.PENDING,
        })
        .mockResolvedValueOnce({
          id: taskId,
          lead_id: 1,
          agent_id: agentId,
          status: CallTaskStatus.COMPLETED,
          completed_at: new Date(),
        });
      (CallTaskModel.complete as jest.Mock).mockResolvedValueOnce(true);

      const result = await CallTaskService.completeCallTask(
        taskId,
        agentId,
        'Call completed successfully',
        'Positive'
      );

      expect(result.status).toBe(CallTaskStatus.COMPLETED);
    });

    it('should reject if agent does not own the task', async () => {
      (CallTaskModel.findById as jest.Mock).mockResolvedValueOnce({
        id: 1,
        agent_id: 2, // Different agent
        status: CallTaskStatus.PENDING,
      });

      await expect(
        CallTaskService.completeCallTask(1, 1, 'notes', 'outcome')
      ).rejects.toThrow(ForbiddenError);
    });

    it('should reject if task is not pending', async () => {
      (CallTaskModel.findById as jest.Mock).mockResolvedValueOnce({
        id: 1,
        agent_id: 1,
        status: CallTaskStatus.COMPLETED,
      });

      await expect(
        CallTaskService.completeCallTask(1, 1, 'notes', 'outcome')
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('markTaskAsMissed', () => {
    it('should mark task as missed successfully', async () => {
      const taskId = 1;

      (CallTaskModel.findById as jest.Mock)
        .mockResolvedValueOnce({
          id: taskId,
          status: CallTaskStatus.PENDING,
        })
        .mockResolvedValueOnce({
          id: taskId,
          status: CallTaskStatus.MISSED,
        });
      (CallTaskModel.markAsMissed as jest.Mock).mockResolvedValueOnce(true);

      const result = await CallTaskService.markTaskAsMissed(taskId);

      expect(result.status).toBe(CallTaskStatus.MISSED);
    });

    it('should reject if task is not pending', async () => {
      (CallTaskModel.findById as jest.Mock).mockResolvedValueOnce({
        id: 1,
        status: CallTaskStatus.COMPLETED,
      });

      await expect(CallTaskService.markTaskAsMissed(1)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('getAgentTasks', () => {
    it('should retrieve agent tasks', async () => {
      const mockTasks = [
        {
          id: 1,
          agent_id: 1,
          status: CallTaskStatus.PENDING,
        },
        {
          id: 2,
          agent_id: 1,
          status: CallTaskStatus.COMPLETED,
        },
      ];

      (CallTaskModel.findByAgent as jest.Mock).mockResolvedValueOnce(
        mockTasks
      );

      const result = await CallTaskService.getAgentTasks(1);

      expect(result).toHaveLength(2);
      expect(result[0].agent_id).toBe(1);
    });

    it('should filter by status if provided', async () => {
      const mockTasks = [
        {
          id: 1,
          agent_id: 1,
          status: CallTaskStatus.PENDING,
        },
      ];

      (CallTaskModel.findByAgent as jest.Mock).mockResolvedValueOnce(
        mockTasks
      );

      const result = await CallTaskService.getAgentTasks(
        1,
        CallTaskStatus.PENDING
      );

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(CallTaskStatus.PENDING);
    });
  });

  describe('getTaskWithDetails', () => {
    it('should retrieve task details', async () => {
      const mockTask = {
        id: 1,
        lead_id: 1,
        agent_id: 1,
        status: CallTaskStatus.PENDING,
      };

      (CallTaskModel.findById as jest.Mock).mockResolvedValueOnce(mockTask);

      const result = await CallTaskService.getTaskWithDetails(1);

      expect(result).toEqual(mockTask);
    });
  });

  describe('getAgentTaskStats', () => {
    it('should return agent task statistics', async () => {
      const mockStats = {
        total_calls: 10,
        completed: 8,
        missed: 2,
        pending: 0,
      };

      (CallTaskModel.getAgentStats as jest.Mock).mockResolvedValueOnce(
        mockStats
      );

      const result = await CallTaskService.getAgentTaskStats(
        1,
        '2024-01-01',
        '2024-01-31'
      );

      expect(result.total_calls).toBe(10);
      expect(result.completed).toBe(8);
    });
  });
});