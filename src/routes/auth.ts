import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { validate, schemas } from '../middlewares/validation';
import { asyncHandler } from '../middlewares/errorHandler';
import { authenticate } from '../middlewares/auth';
import { strictRateLimitMiddleware } from '../middlewares/rateLimiter';

const router = Router();

/**
 * @route   POST /api/auth/register
 * @desc    Register new user
 * @access  Public
 */
router.post(
  '/register',
  strictRateLimitMiddleware,
  validate(schemas.register),
  asyncHandler(AuthController.register)
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  strictRateLimitMiddleware,
  validate(schemas.login),
  asyncHandler(AuthController.login)
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh',
  validate(schemas.refreshToken),
  asyncHandler(AuthController.refresh)
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(AuthController.logout)
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(AuthController.getCurrentUser)
);

export default router;