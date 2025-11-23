import { LeadService } from '../src/services/leadService';
import { LeadModel } from '../src/models/mysql/Lead';
import { ValidationError, NotFoundError, ConflictError } from '../src/utils/errors';
import { LeadStatus } from '../src/types';

jest.mock('../src/models/mysql/Lead');

describe('LeadService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createLead', () => {
    it('should create a new lead successfully', async () => {
      const mockLeadId = 1;
      (LeadModel.findByPhoneOrEmail as jest.Mock).mockResolvedValueOnce(null);
      (LeadModel.create as jest.Mock).mockResolvedValueOnce(mockLeadId);
      (LeadModel.findById as jest.Mock).mockResolvedValueOnce({
        id: mockLeadId,
        name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com',
        status: LeadStatus.NEW,
        source: 'manual',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await LeadService.createLead({
        name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe(mockLeadId);
      expect(result.name).toBe('John Doe');
    });

    it('should reject missing name or phone', async () => {
      await expect(
        LeadService.createLead({ name: '', phone: '' })
      ).rejects.toThrow(ValidationError);
    });

    it('should reject duplicate lead', async () => {
      (LeadModel.findByPhoneOrEmail as jest.Mock).mockResolvedValueOnce({
        id: 1,
        phone: '+1234567890',
      });

      await expect(
        LeadService.createLead({
          name: 'John Doe',
          phone: '+1234567890',
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('getLeadById', () => {
    it('should retrieve a lead by ID', async () => {
      const mockLead = {
        id: 1,
        name: 'John Doe',
        phone: '+1234567890',
        email: 'john@example.com',
        status: LeadStatus.NEW,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (LeadModel.findById as jest.Mock).mockResolvedValueOnce(mockLead);

      const result = await LeadService.getLeadById(1);

      expect(result).toEqual(mockLead);
    });

    it('should throw NotFoundError for non-existent lead', async () => {
      (LeadModel.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(LeadService.getLeadById(999)).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateLead', () => {
    it('should update lead successfully', async () => {
      const updatedLead = {
        id: 1,
        name: 'Jane Doe',
        phone: '+1234567890',
        status: LeadStatus.CONTACTED,
        created_at: new Date(),
        updated_at: new Date(),
      };

      (LeadModel.findById as jest.Mock)
        .mockResolvedValueOnce({
          id: 1,
          name: 'John Doe',
          phone: '+1234567890',
        })
        .mockResolvedValueOnce(updatedLead);
      (LeadModel.update as jest.Mock).mockResolvedValueOnce(true);

      const result = await LeadService.updateLead(1, {
        name: 'Jane Doe',
        status: LeadStatus.CONTACTED,
      });

      expect(result.name).toBe('Jane Doe');
    });

    it('should throw NotFoundError if lead does not exist', async () => {
      (LeadModel.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(LeadService.updateLead(999, {})).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('deleteLead', () => {
    it('should delete a lead successfully', async () => {
      (LeadModel.findById as jest.Mock).mockResolvedValueOnce({
        id: 1,
        name: 'John Doe',
      });
      (LeadModel.delete as jest.Mock).mockResolvedValueOnce(true);

      await expect(LeadService.deleteLead(1)).resolves.not.toThrow();
    });

    it('should throw NotFoundError if lead does not exist', async () => {
      (LeadModel.findById as jest.Mock).mockResolvedValueOnce(null);

      await expect(LeadService.deleteLead(999)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('getLeadStats', () => {
    it('should return lead statistics', async () => {
      (LeadModel.countByStatus as jest.Mock).mockResolvedValueOnce({
        [LeadStatus.NEW]: 10,
        [LeadStatus.CONTACTED]: 5,
        [LeadStatus.QUALIFIED]: 3,
        [LeadStatus.CONVERTED]: 2,
      });
      (LeadModel.countBySource as jest.Mock).mockResolvedValueOnce([
        { source: 'manual', count: 8 },
        { source: 'csv_import', count: 12 },
      ]);

      const result = await LeadService.getLeadStats();

      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('byStatus');
      expect(result).toHaveProperty('bySource');
      expect(result.total).toBe(20);
    });
  });
});