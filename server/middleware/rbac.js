/**
 * RBAC Authorization Middleware
 * 
 * Provides Express middleware functions for permission-based access control.
 * Relies on `req.membership` being set by the tenancy middleware upstream.
 * 
 * Usage:
 *   app.post('/api/broadcasts', requirePermission(PERMISSIONS.BROADCASTS_MANAGE), handler);
 *   app.delete('/api/workspace', requireRole(ROLES.OWNER), handler);
 * 
 * @module middleware/rbac
 */

import { hasPermission, isRoleAtLeast, ROLE_HIERARCHY } from '../constants/permissions.js';

/**
 * Middleware that blocks the request unless the user's role
 * includes the specified permission.
 * 
 * @param {string} permission - Permission key from PERMISSIONS constant
 * @returns {Function} Express middleware
 */
export const requirePermission = (permission) => {
  return (req, res, next) => {
    // If no membership attached, the user hasn't been resolved to a workspace
    if (!req.membership) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No workspace context. Ensure you are accessing a valid workspace.',
        correlationId: req.correlationId,
      });
    }

    const { role } = req.membership;

    if (!hasPermission(role, permission)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Your role (${role}) does not have the required permission: ${permission}`,
        required: permission,
        role,
        correlationId: req.correlationId,
      });
    }

    next();
  };
};

/**
 * Middleware that blocks the request unless the user's role
 * is one of the specified roles.
 * 
 * @param {...string} allowedRoles - Role names from ROLES constant
 * @returns {Function} Express middleware
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.membership) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No workspace context.',
        correlationId: req.correlationId,
      });
    }

    const { role } = req.membership;

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
        required: allowedRoles,
        role,
        correlationId: req.correlationId,
      });
    }

    next();
  };
};

/**
 * Middleware that blocks the request unless the user's role
 * is at or above the specified minimum role in the hierarchy.
 * 
 * @param {string} minimumRole - Minimum role from ROLES constant
 * @returns {Function} Express middleware
 */
export const requireRoleAtLeast = (minimumRole) => {
  return (req, res, next) => {
    if (!req.membership) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No workspace context.',
        correlationId: req.correlationId,
      });
    }

    const { role } = req.membership;

    if (!isRoleAtLeast(role, minimumRole)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `This action requires at least ${minimumRole} role.`,
        required: minimumRole,
        role,
        correlationId: req.correlationId,
      });
    }

    next();
  };
};
