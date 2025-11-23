import { Router } from 'express';
import { CallTaskController } from '../controllers/callTaskController';
import { authenticate } from '../middlewares/auth';
import { isAdminOrManager } from '../middlewares/rbac';
import { validate, schemas } from '../middlewares/validation';
import { asyncHandler } from '../middlewares/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/call-tasks/my-tasks
 * @desc    Get agent's own tasks
 * @access  Private
 */
router.get(
  '/my-tasks',
  asyncHandler(CallTaskController.getMyTasks)
);

/**
 * @route   GET /api/call-tasks/pending
 * @desc    Get pending tasks
 * @access  Private
 */
router.get(
  '/pending',
  asyncHandler(CallTaskController.getPending)
);

/**
 * @route   GET /api/call-tasks/overdue
 * @desc    Get overdue tasks
 * @access  Private
 */
router.get(
  '/overdue',
  asyncHandler(CallTaskController.getOverdue)
);

/**
 * @route   GET /api/call-tasks/stats/:agentId
 * @desc    Get agent task statistics
 * @access  Private (Admin/Manager)
 */
router.get(
  '/stats/:agentId',
  isAdminOrManager,
  asyncHandler(CallTaskController.getAgentStats)
);

/**
 * @route   POST /api/call-tasks
 * @desc    Create new call task
 * @access  Private (Admin/Manager)
 */
router.post(
  '/',
  isAdminOrManager,
  validate(schemas.createCallTask),
  asyncHandler(CallTaskController.create)
);

/**
 * @route   GET /api/call-tasks/:id
 * @desc    Get task details
 * @access  Private
 */
router.get(
  '/:id',
  asyncHandler(CallTaskController.getById)
);

/**
 * @route   POST /api/call-tasks/:id/complete
 * @desc    Complete call task
 * @access  Private
 */
router.post(
  '/:id/complete',
  validate(schemas.completeCallTask),
  asyncHandler(CallTaskController.complete)
);

/**
 * @route   POST /api/call-tasks/:id/missed
 * @desc    Mark task as missed
 * @access  Private (Admin/Manager)
 */
router.post(
  '/:id/missed',
  isAdminOrManager,
  asyncHandler(CallTaskController.markAsMissed)
);

export default router;