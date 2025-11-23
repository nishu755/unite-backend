import { Router } from 'express';
import { ReportController } from '../controllers/reportController';
import { authenticate } from '../middlewares/auth';
import { isAdminOrManager } from '../middlewares/rbac';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// All routes require authentication (Admin/Manager only)
router.use(authenticate);
router.use(isAdminOrManager);

/**
 * @route   GET /api/reports/daily-summary
 * @desc    Get daily summary report
 * @access  Private (Admin/Manager)
 */
router.get(
  '/daily-summary',
  asyncHandler(ReportController.getDailySummary)
);

/**
 * @route   GET /api/reports/agent-performance/:agentId
 * @desc    Get agent performance report
 * @access  Private (Admin/Manager)
 */
router.get(
  '/agent-performance/:agentId',
  asyncHandler(ReportController.getAgentPerformance)
);

/**
 * @route   GET /api/reports/team-performance
 * @desc    Get team performance overview
 * @access  Private (Admin/Manager)
 */
router.get(
  '/team-performance',
  asyncHandler(ReportController.getTeamPerformance)
);

/**
 * @route   GET /api/reports/call-volume-trends
 * @desc    Get call volume trends (last 7 days)
 * @access  Private (Admin/Manager)
 */
router.get(
  '/call-volume-trends',
  asyncHandler(ReportController.getCallVolumeTrends)
);

export default router;