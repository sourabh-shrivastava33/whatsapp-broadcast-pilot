/**
 * PermissionGate Component
 * 
 * Conditionally renders children based on the current user's permissions.
 * Used to hide/disable UI elements that the user doesn't have access to.
 * 
 * Usage:
 *   <PermissionGate permission="broadcasts:manage">
 *     <CreateBroadcastButton />
 *   </PermissionGate>
 * 
 *   <PermissionGate permission="contacts:delete" fallback={<Tooltip text="No access">}>
 *     <DeleteButton />
 *   </PermissionGate>
 * 
 *   <PermissionGate role="ADMIN">
 *     <AdminPanel />
 *   </PermissionGate>
 */

import React from 'react';
import { usePermissions } from '../../hooks/usePermissions';

/**
 * @param {Object} props
 * @param {string} [props.permission] - Required permission key
 * @param {string} [props.role] - Required exact role
 * @param {string} [props.minRole] - Minimum required role (hierarchy check)
 * @param {React.ReactNode} [props.fallback] - What to render if access denied (default: null)
 * @param {React.ReactNode} props.children - Content to render if access granted
 */
export const PermissionGate = ({ permission, role, minRole, fallback = null, children }) => {
  const { can, hasRole, isAtLeast } = usePermissions();

  let hasAccess = true;

  if (permission) {
    hasAccess = can(permission);
  } else if (role) {
    hasAccess = hasRole(role);
  } else if (minRole) {
    hasAccess = isAtLeast(minRole);
  }

  if (!hasAccess) {
    return fallback;
  }

  return <>{children}</>;
};

export default PermissionGate;
