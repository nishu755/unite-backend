import { CallTaskModel } from '../models/mysql/CallTask';
import { UserModel } from '../models/mysql/User';
import { CallLog } from '../models/mongodb/CallLog';
import { DailySummary, AgentStats } from '../types';
import { cacheService } from '../config/redis';
import logger from '../utils/logger';

type PerAgentSummary = {
  agent_id: number;
  email: string;
  total_calls: number;
  completed: number;
  missed: number;
  completion_percentage: number;
};

export class ReportService {
 
  static async getDailySummary(date: string): Promise<DailySummary> {
    const cacheKey = `report:daily:${date}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      try {
        return typeof cached === 'string' ? (JSON.parse(cached) as DailySummary) : (cached as DailySummary);
      } catch (err) {
        logger.warn(`Failed to parse cached daily summary for ${date}: ${(err as Error).message}`);
      }
    }


    const summaryRows: Array<Record<string, any>> = await CallTaskModel.getDailySummary(date);

    let totalCalls = 0;
    let totalCompleted = 0;
    let totalMissed = 0;
    const perAgentList: PerAgentSummary[] = [];

    for (const row of summaryRows) {
      const agentId = Number(row.agent_id);
      const agent = await UserModel.findById(agentId);
      if (!agent) continue;

      const agentTotalCalls = Number(row.total_calls ?? 0);
      const agentCompleted = Number(row.completed ?? 0);
      const agentMissed = Number(row.missed ?? 0);

      totalCalls += agentTotalCalls;
      totalCompleted += agentCompleted;
      totalMissed += agentMissed;

      perAgentList.push({
        agent_id: agentId,
        email: agent.email,
        total_calls: agentTotalCalls,
        completed: agentCompleted,
        missed: agentMissed,
        completion_percentage: agentTotalCalls > 0 ? (agentCompleted / agentTotalCalls) * 100 : 0
      });
    }

    
    const busiestAgent = perAgentList.length
      ? perAgentList.reduce((max, a) => (a.total_calls > max.total_calls ? a : max), perAgentList[0])
      : undefined;

    const summary: DailySummary = {
      date,
      total_calls: totalCalls,
      completed: totalCompleted,
      missed: totalMissed,
      completion_percentage: totalCalls > 0 ? (totalCompleted / totalCalls) * 100 : 0,
      per_agent: perAgentList,
      busiest_agent: busiestAgent
        ? {
            agent_id: busiestAgent.agent_id,
            email: busiestAgent.email,
            total_calls: busiestAgent.total_calls
          }
        : undefined
    };

    await cacheService.set(cacheKey, JSON.stringify(summary), 3600);
    logger.info(`Daily summary generated for ${date}`);
    return summary;
  }


  static async getAgentPerformanceReport(
    agentId: number,
    startDate: Date,
    endDate: Date
  ): Promise<
    AgentStats & {
      agent_id: number;
      calls_by_outcome: Array<{ outcome: string; count: number }>;
      average_call_duration: number;
      total_call_time_minutes: number;
    }
  > {
    const cacheKey = `report:agent:${agentId}:${startDate.toISOString()}:${endDate.toISOString()}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      try {
        return typeof cached === 'string' ? JSON.parse(cached) : (cached as any);
      } catch (err) {
        logger.warn(`Failed to parse cached agent report ${cacheKey}: ${(err as Error).message}`);
      }
    }

    const pipeline = [
      {
        $match: {
          agent_id: agentId,
          call_timestamp: {
            $gte: startDate,
            $lte: endDate
          }
        }
      },
      {
        $facet: {
          stats: [
            {
              $group: {
                _id: null,
                total_calls: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                missed: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
                average_duration: { $avg: '$duration_seconds' },
                total_duration: { $sum: '$duration_seconds' }
              }
            }
          ],
          by_outcome: [
            {
              $group: {
                _id: '$outcome',
                count: { $sum: 1 }
              }
            },
            {
              $project: {
                _id: 0,
                outcome: '$_id',
                count: 1
              }
            }
          ]
        }
      }
    ];

    const result = await CallLog.aggregate(pipeline).exec?.() ?? (await CallLog.aggregate(pipeline)); 
    const statsRow = (result?.[0]?.stats?.[0]) ?? {
      total_calls: 0,
      completed: 0,
      missed: 0,
      average_duration: 0,
      total_duration: 0
    };

    const byOutcome = result?.[0]?.by_outcome ?? [];

    const report = {
      agent_id: agentId,
      total_calls: Number(statsRow.total_calls ?? 0),
      completed: Number(statsRow.completed ?? 0),
      missed: Number(statsRow.missed ?? 0),
      average_call_duration: Math.round(Number(statsRow.average_duration ?? 0)),
      total_call_time_minutes: Math.round((Number(statsRow.total_duration ?? 0) || 0) / 60),
      calls_by_outcome: byOutcome
    };

    await cacheService.set(cacheKey, JSON.stringify(report), 1800);
    return report as any;
  }

  static async getTeamPerformanceOverview(startDate: string, endDate: string): Promise<{
    total_agents: number;
    total_calls: number;
    completed: number;
    missed: number;
    completion_percentage: number;
    top_performers: AgentStats[];
  }> {
    const cacheKey = `report:team:${startDate}:${endDate}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      try {
        return typeof cached === 'string' ? JSON.parse(cached) : (cached as any);
      } catch (err) {
        logger.warn(`Failed to parse cached team overview ${cacheKey}: ${(err as Error).message}`);
      }
    }

    const agents = await UserModel.findAgents();
    const agentStats: AgentStats[] = [];
    let totalCalls = 0;
    let totalCompleted = 0;
    let totalMissed = 0;

    for (const agent of agents) {
      const stats = await CallTaskModel.getAgentStats(agent.id, startDate, endDate);

      const agentStat: AgentStats = {
        agent_id: agent.id,
        email: agent.email,
        total_calls: Number(stats.total_calls ?? 0),
        completed: Number(stats.completed ?? 0),
        missed: Number(stats.missed ?? 0),
        completion_percentage: Number(stats.completion_percentage ?? 0)
      };

      agentStats.push(agentStat);
      totalCalls += agentStat.total_calls;
      totalCompleted += agentStat.completed;
      totalMissed += agentStat.missed;
    }

    const topPerformers = agentStats
      .slice()
      .sort((a, b) => b.completion_percentage - a.completion_percentage)
      .slice(0, 5);

    const overview = {
      total_agents: agents.length,
      total_calls: totalCalls,
      completed: totalCompleted,
      missed: totalMissed,
      completion_percentage: totalCalls > 0 ? (totalCompleted / totalCalls) * 100 : 0,
      top_performers: topPerformers
    };

    await cacheService.set(cacheKey, JSON.stringify(overview), 900);
    return overview;
  }

  static async getCallVolumeTrends(): Promise<Array<{ date: string; total_calls: number; completed: number; missed: number }>> {
    const cacheKey = 'report:trends:7days';
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      try {
        return typeof cached === 'string' ? JSON.parse(cached) : (cached as any);
      } catch (err) {
        logger.warn(`Failed to parse cached trends: ${(err as Error).message}`);
      }
    }

    const trends: Array<{ date: string; total_calls: number; completed: number; missed: number }> = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      const summary = await this.getDailySummary(dateString);
      trends.push({
        date: dateString,
        total_calls: summary.total_calls,
        completed: summary.completed,
        missed: summary.missed
      });
    }

    await cacheService.set(cacheKey, JSON.stringify(trends), 3600);
    return trends;
  }
}
