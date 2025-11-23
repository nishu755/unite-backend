import { LeadModel } from '../models/mysql/Lead';
import {
  ILead,
  LeadStatus,
  LeadFilters,
  PaginationParams
} from '../types';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';
import { cacheService } from '../config/redis';
import logger from '../utils/logger';

export class LeadService {
  private static CACHE_TTL = 300; // 5 minutes

  /**
   * Create a new lead with duplicate checking
   */
  static async createLead(data: {
    name: string;
    phone: string;
    email?: string;
    status?: LeadStatus;
    source?: string;
    assigned_to?: number;
    image_url?: string;
  }): Promise<ILead> {
    // Validate required fields
    if (!data.name || !data.phone) {
      throw new ValidationError('Name and phone are required');
    }

    // Check for duplicates
    const existing = await LeadModel.findByPhoneOrEmail(data.phone, data.email);
    if (existing) {
      throw new ConflictError('Lead with this phone or email already exists');
    }

    // Create lead
    const leadId = await LeadModel.create(data);
    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      throw new Error('Failed to create lead');
    }

    // Invalidate related caches
    await cacheService.flushPattern?.('leads:*');
    await cacheService.del?.(`lead:${leadId}`);

    logger.info(`Lead created: ${leadId}`);
    return lead;
  }

  /**
   * Get lead by ID
   */
  static async getLeadById(id: number): Promise<ILead> {
    // Try cache first
    const cacheKey = `lead:${id}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      try {
        // cacheService may return a stringified JSON
        return typeof cached === 'string' ? (JSON.parse(cached) as ILead) : (cached as ILead);
      } catch (err) {
        // if parse fails, fall through to DB
        logger.warn(`Failed to parse cached lead ${cacheKey}: ${(err as Error).message}`);
      }
    }

    // Get from database
    const lead = await LeadModel.findById(id);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    // Cache it (stringify for consistency)
    await cacheService.set(cacheKey, JSON.stringify(lead), this.CACHE_TTL);
    return lead;
  }

  /**
   * Update lead
   */
  static async updateLead(id: number, data: Partial<ILead>): Promise<ILead> {
    // Check if lead exists
    const existing = await LeadModel.findById(id);
    if (!existing) {
      throw new NotFoundError('Lead not found');
    }

    // Check for duplicate if phone/email is being updated
    if (data.phone || data.email) {
      const duplicate = await LeadModel.findByPhoneOrEmail(
        data.phone ?? existing.phone,
        data.email ?? existing.email
      );
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('Another lead with this phone or email exists');
      }
    }

    // Update lead
    const updated = await LeadModel.update(id, data);
    if (!updated) {
      throw new Error('Failed to update lead');
    }

    // Invalidate cache
    await cacheService.del?.(`lead:${id}`);
    await cacheService.flushPattern?.('leads:*');

    // Return updated lead
    const lead = await LeadModel.findById(id);
    if (!lead) {
      throw new Error('Failed to retrieve updated lead');
    }

    logger.info(`Lead updated: ${id}`);
    return lead;
  }

  /**
   * Delete lead
   */
  static async deleteLead(id: number): Promise<void> {
    const existing = await LeadModel.findById(id);
    if (!existing) {
      throw new NotFoundError('Lead not found');
    }

    await LeadModel.delete(id);

    // Invalidate cache
    await cacheService.del?.(`lead:${id}`);
    await cacheService.flushPattern?.('leads:*');

    logger.info(`Lead deleted: ${id}`);
  }

  /**
   * Get all leads with filters and pagination
   */
  static async getLeads(
    filters: LeadFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<{ leads: ILead[]; total: number; page: number; totalPages: number }> {
    // Build cache key from filters
    const cacheKey = `leads:${JSON.stringify(filters)}:${page}:${limit}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      try {
        return typeof cached === 'string'
          ? (JSON.parse(cached) as { leads: ILead[]; total: number; page: number; totalPages: number })
          : (cached as { leads: ILead[]; total: number; page: number; totalPages: number });
      } catch (err) {
        logger.warn(`Failed to parse cached leads ${cacheKey}: ${(err as Error).message}`);
      }
    }

    const offset = (page - 1) * limit;
    const pagination: PaginationParams = { page, limit, offset };

    const { leads, total } = await LeadModel.findAll(filters, pagination);
    const result = {
      leads,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };

    // Cache the result (stringify to keep cache consistent)
    await cacheService.set(cacheKey, JSON.stringify(result), this.CACHE_TTL);
    return result;
  }

  /**
   * Assign lead to agent
   */
  static async assignLead(leadId: number, agentId: number): Promise<ILead> {
    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    await LeadModel.assignToAgent(leadId, agentId);

    // Invalidate cache
    await cacheService.del?.(`lead:${leadId}`);
    await cacheService.flushPattern?.('leads:*');

    const updated = await LeadModel.findById(leadId);
    if (!updated) {
      throw new Error('Failed to retrieve updated lead');
    }

    logger.info(`Lead ${leadId} assigned to agent ${agentId}`);
    return updated;
  }

  /**
   * Search leads
   */
  static async searchLeads(searchTerm: string, limit: number = 20): Promise<ILead[]> {
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new ValidationError('Search term must be at least 2 characters');
    }

    return await LeadModel.search(searchTerm.trim(), limit);
  }

  /**
   * Get lead statistics
   */
  static async getLeadStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    bySource: Record<string, number> | Array<{ source: string; count: number }>;
  }> {
    const cacheKey = 'leads:stats';
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      try {
        return typeof cached === 'string' ? JSON.parse(cached) : cached;
      } catch (err) {
        logger.warn(`Failed to parse cached lead stats: ${(err as Error).message}`);
      }
    }

    const [byStatus, bySource] = await Promise.all([
      LeadModel.countByStatus(), // assume returns Record<string, number>
      LeadModel.countBySource() // can be Record<string, number> or Array<{source,count}>
    ]);

    const total = Object.values(byStatus).reduce((sum, count) => sum + (count ?? 0), 0);

    const stats = {
      total,
      byStatus,
      bySource
    };

    // Cache for 10 minutes
    await cacheService.set(cacheKey, JSON.stringify(stats), 600);

    return stats;
  }
}
