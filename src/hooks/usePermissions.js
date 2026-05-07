/**
 * usePermissions Hook
 * 
 * Provides role-based permission checking functions
 * for the current authenticated user in the active workspace.
 * 
 * Usage:
 *   const { can, hasRole, isAtLeast, userRole } = usePermissions();
 *   
 *   if (can(PERMISSIONS.BROADCASTS_MANAGE)) { ... }
 *   if (isAtLeast(ROLES.ADMIN)) { ... }
 */

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission, isRoleAtLeast } from '../constants/permissions';

export const usePermissions = () => {
  const { userRole } = useAuth();

  return useMemo(() => ({
    /** The current user's role in the active workspace */
    userRole,

    /** 
     * Check if the user has a specific permission.
     * @param {string} permission - Permission key from PERMISSIONS
     * @returns {boolean}
     */
    can: (permission) => {
      if (!userRole) return false;
      return hasPermission(userRole, permission);
    },

    /**
     * Check if the user has a specific role.
     * @param {string} role - Role from ROLES
     * @returns {boolean}
     */
    hasRole: (role) => userRole === role,

    /**
     * Check if the user's role is at or above a minimum role.
     * @param {string} minimumRole - Minimum role from ROLES
     * @returns {boolean}
     */
    isAtLeast: (minimumRole) => {
      if (!userRole) return false;
      return isRoleAtLeast(userRole, minimumRole);
    },
  }), [userRole]);
};
