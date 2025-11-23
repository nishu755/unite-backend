// ============ CSV TESTS ============
import { CsvService } from '../src/services/csvService';
import { CsvLog } from '../src/models/mongodb/CsvLog';
import { ValidationError } from '../src/utils/errors';

jest.mock('../src/models/mongodb/CsvLog');
jest.mock('../src/services/s3Service');

describe('CsvService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadCsvForProcessing', () => {
    it('should upload CSV and queue for processing', async () => {
      const mockFile = {
        mimetype: 'text/csv',
        size: 1024,
        originalname: 'leads.csv',
        buffer: Buffer.from('test'),
      } as Express.Multer.File;

      (CsvLog.create as jest.Mock).mockResolvedValueOnce({
        _id: 'csv-log-id',
      });

      const result = await CsvService.uploadCsvForProcessing(mockFile, 1);

      expect(result).toHaveProperty('csvLogId');
      expect(result).toHaveProperty('s3Key');
      expect(result.message).toContain('queued for processing');
    });

    it('should reject non-CSV files', async () => {
      const mockFile = {
        mimetype: 'application/json',
        size: 1024,
        originalname: 'data.json',
      } as Express.Multer.File;

      await expect(
        CsvService.uploadCsvForProcessing(mockFile, 1)
      ).rejects.toThrow(ValidationError);
    });

    it('should reject files larger than 10MB', async () => {
      const mockFile = {
        mimetype: 'text/csv',
        size: 11 * 1024 * 1024, // 11MB
        originalname: 'large.csv',
      } as Express.Multer.File;

      await expect(
        CsvService.uploadCsvForProcessing(mockFile, 1)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getCsvStatus', () => {
    it('should return CSV processing status', async () => {
      (CsvLog.findById as jest.Mock).mockResolvedValueOnce({
        _id: 'csv-log-id',
        file_name: 'leads.csv',
        status: 'completed',
        total_rows: 100,
        successful_imports: 95,
        failed_imports: 5,
      });

      const result = await CsvService.getCsvStatus('csv-log-id');

      expect(result.status).toBe('completed');
      expect(result.successful_imports).toBe(95);
    });

    it('should throw error if CSV log not found', async () => {
      (CsvLog.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(CsvService.getCsvStatus('non-existent')).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe('getUserCsvHistory', () => {
    it('should return user CSV history', async () => {
      (CsvLog.find as jest.Mock).mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValueOnce([
            {
              _id: 'csv-1',
              file_name: 'leads1.csv',
              status: 'completed',
            },
            {
              _id: 'csv-2',
              file_name: 'leads2.csv',
              status: 'processing',
            },
          ]),
        }),
      });

      const result = await CsvService.getUserCsvHistory(1, 10);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('file_name');
    });
  });
});

// ============ REPORTS TESTS ============
import { ReportService } from '../src/services/reportService';
import { CallTaskModel } from '../src/models/mysql/CallTask';
import { UserModel } from '../src/models/mysql/User';

jest.mock('../src/models/mysql/CallTask');
jest.mock('../src/models/mysql/User');

describe('ReportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDailySummary', () => {
    it('should return daily summary report', async () => {
      (CallTaskModel.getDailySummary as jest.Mock).mockResolvedValueOnce([
        {
          agent_id: 1,
          total_calls: 10,
          completed: 8,
          missed: 2,
        },
      ]);

      (UserModel.findById as jest.Mock).mockResolvedValueOnce({
        id: 1,
        email: 'agent@example.com',
      });

      const result = await ReportService.getDailySummary('2024-01-01');

      expect(result.date).toBe('2024-01-01');
      expect(result.total_calls).toBe(10);
      expect(result.completed).toBe(8);
      expect(result.completion_percentage).toBeGreaterThan(0);
    });

    it('should identify busiest agent', async () => {
      (CallTaskModel.getDailySummary as jest.Mock).mockResolvedValueOnce([
        {
          agent_id: 1,
          total_calls: 15,
          completed: 12,
          missed: 3,
        },
        {
          agent_id: 2,
          total_calls: 8,
          completed: 7,
          missed: 1,
        },
      ]);

      (UserModel.findById as jest.Mock)
        .mockResolvedValueOnce({ id: 1, email: 'agent1@example.com' })
        .mockResolvedValueOnce({ id: 2, email: 'agent2@example.com' });

      const result = await ReportService.getDailySummary('2024-01-01');

      expect(result.busiest_agent?.agent_id).toBe(1);
      expect(result.busiest_agent?.total_calls).toBe(15);
    });
  });

  describe('getAgentPerformanceReport', () => {
    it('should return agent performance metrics', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (CallTaskModel.getAgentStats as jest.Mock).mockResolvedValueOnce({
        total_calls: 50,
        completed: 45,
        missed: 5,
        pending: 0,
      });

      const result = await ReportService.getAgentPerformanceReport(
        1,
        startDate,
        endDate
      );

      expect(result.agent_id).toBe(1);
      expect(result.total_calls).toBe(50);
      expect(result.completed).toBe(45);
    });
  });

  describe('getTeamPerformanceOverview', () => {
    it('should return team performance overview', async () => {
      (UserModel.findAgents as jest.Mock).mockResolvedValueOnce([
        { id: 1, email: 'agent1@example.com' },
        { id: 2, email: 'agent2@example.com' },
      ]);

      (CallTaskModel.getAgentStats as jest.Mock)
        .mockResolvedValueOnce({
          total_calls: 50,
          completed: 45,
          missed: 5,
        })
        .mockResolvedValueOnce({
          total_calls: 40,
          completed: 35,
          missed: 5,
        });

      const result = await ReportService.getTeamPerformanceOverview(
        '2024-01-01',
        '2024-01-31'
      );

      expect(result.total_agents).toBe(2);
      expect(result.total_calls).toBe(90);
      expect(result.top_performers).toBeDefined();
    });
  });

  describe('getCallVolumeTrends', () => {
    it('should return 7-day call volume trends', async () => {
      (CallTaskModel.getDailySummary as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      (UserModel.findById as jest.Mock).mockResolvedValue(null);

      const result = await ReportService.getCallVolumeTrends();

      expect(result).toHaveLength(7);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('total_calls');
    });
  });
});