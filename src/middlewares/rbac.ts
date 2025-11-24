// middlewares/rbac.ts
import { RequestHandler } from 'express';
import { AuthRequest, UserRole } from '../types';
import { ForbiddenError } from '../utils/errors';

/**
 * Role-based access control middleware factory
 * Usage: router.get('/x', authorize(UserRole.ADMIN, UserRole.MANAGER), handler)
 */
export const authorize =
  (...allowedRoles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    const authReq = req as AuthRequest;

    try {
      if (!authReq.user) {
        return next(new ForbiddenError('User not authenticated'));
      }

      // Make sure role is present and is allowed
      const role = authReq.user.role;
      if (!role || !allowedRoles.includes(role)) {
        return next(new ForbiddenError('You do not have permission to access this resource'));
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };

/** Check if user is admin */
export const isAdmin: RequestHandler = authorize(UserRole.ADMIN);

/** Check if user is admin or manager */
export const isAdminOrManager: RequestHandler = authorize(UserRole.ADMIN, UserRole.MANAGER);

/**
 * Allow all authenticated users
 * (exported as RequestHandler and casts internally)
 */
export const isAuthenticated: RequestHandler = (req, _res, next) => {
  const authReq = req as AuthRequest;

  if (!authReq.user) {
    return next(new ForbiddenError('Authentication required'));
  }

  return next();
};
