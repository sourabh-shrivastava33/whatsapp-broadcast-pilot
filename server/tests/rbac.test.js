/**
 * RBAC Unit Tests
 * 
 * Tests the permission constants, hasPermission utility,
 * and the RBAC middleware functions in isolation.
 * 
 * Run: node --test server/tests/rbac.test.js
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  hasPermission,
  isRoleAtLeast,
} from '../constants/permissions.js';
import { requirePermission, requireRole, requireRoleAtLeast } from '../middleware/rbac.js';

// ─── Helper: Mock Express req/res/next ─────────────────────────────────

function mockReq(membership = null) {
  return {
    membership,
    correlationId: 'test-correlation-id',
  };
}

function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
  };
  return res;
}

// ─── Test Suite: Permission Constants ─────────────────────────────────

describe('Permission Constants', () => {
  it('OWNER has all permissions', () => {
    const allPerms = Object.values(PERMISSIONS);
    for (const perm of allPerms) {
      assert.ok(
        hasPermission(ROLES.OWNER, perm),
        `OWNER should have permission: ${perm}`
      );
    }
  });

  it('VIEWER has only view permissions + inbox:view', () => {
    const viewerPerms = ROLE_PERMISSIONS[ROLES.VIEWER];
    for (const perm of viewerPerms) {
      assert.ok(
        perm.endsWith(':view'),
        `VIEWER should only have view permissions, but has: ${perm}`
      );
    }
  });

  it('VIEWER cannot manage broadcasts', () => {
    assert.equal(hasPermission(ROLES.VIEWER, PERMISSIONS.BROADCASTS_MANAGE), false);
  });

  it('VIEWER cannot manage contacts', () => {
    assert.equal(hasPermission(ROLES.VIEWER, PERMISSIONS.CONTACTS_MANAGE), false);
  });

  it('VIEWER cannot delete contacts', () => {
    assert.equal(hasPermission(ROLES.VIEWER, PERMISSIONS.CONTACTS_DELETE), false);
  });

  it('MEMBER can manage broadcasts', () => {
    assert.equal(hasPermission(ROLES.MEMBER, PERMISSIONS.BROADCASTS_MANAGE), true);
  });

  it('MEMBER can manage contacts', () => {
    assert.equal(hasPermission(ROLES.MEMBER, PERMISSIONS.CONTACTS_MANAGE), true);
  });

  it('MEMBER cannot delete contacts', () => {
    assert.equal(hasPermission(ROLES.MEMBER, PERMISSIONS.CONTACTS_DELETE), false);
  });

  it('MEMBER cannot manage webhooks', () => {
    assert.equal(hasPermission(ROLES.MEMBER, PERMISSIONS.WEBHOOKS_MANAGE), false);
  });

  it('MEMBER cannot manage members', () => {
    assert.equal(hasPermission(ROLES.MEMBER, PERMISSIONS.MEMBERS_MANAGE), false);
  });

  it('ADMIN can manage webhooks', () => {
    assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.WEBHOOKS_MANAGE), true);
  });

  it('ADMIN can manage members', () => {
    assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.MEMBERS_MANAGE), true);
  });

  it('ADMIN cannot delete workspace', () => {
    assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.WORKSPACE_DELETE), false);
  });

  it('ADMIN cannot manage system', () => {
    assert.equal(hasPermission(ROLES.ADMIN, PERMISSIONS.SYSTEM_MANAGE), false);
  });

  it('returns false for unknown role', () => {
    assert.equal(hasPermission('SUPERUSER', PERMISSIONS.WORKSPACE_VIEW), false);
  });

  it('returns false for unknown permission', () => {
    assert.equal(hasPermission(ROLES.OWNER, 'nonexistent:perm'), false);
  });
});

// ─── Test Suite: Role Hierarchy ─────────────────────────────────

describe('Role Hierarchy', () => {
  it('OWNER is highest', () => {
    assert.ok(isRoleAtLeast(ROLES.OWNER, ROLES.ADMIN));
    assert.ok(isRoleAtLeast(ROLES.OWNER, ROLES.MEMBER));
    assert.ok(isRoleAtLeast(ROLES.OWNER, ROLES.VIEWER));
  });

  it('VIEWER is lowest', () => {
    assert.equal(isRoleAtLeast(ROLES.VIEWER, ROLES.MEMBER), false);
    assert.equal(isRoleAtLeast(ROLES.VIEWER, ROLES.ADMIN), false);
    assert.equal(isRoleAtLeast(ROLES.VIEWER, ROLES.OWNER), false);
  });

  it('equal role passes', () => {
    assert.ok(isRoleAtLeast(ROLES.ADMIN, ROLES.ADMIN));
    assert.ok(isRoleAtLeast(ROLES.MEMBER, ROLES.MEMBER));
  });

  it('MEMBER < ADMIN', () => {
    assert.equal(isRoleAtLeast(ROLES.MEMBER, ROLES.ADMIN), false);
  });

  it('unknown role returns false', () => {
    assert.equal(isRoleAtLeast('GHOST', ROLES.VIEWER), false);
  });
});

// ─── Test Suite: requirePermission Middleware ─────────────────────────

describe('requirePermission middleware', () => {
  it('allows request when role has the permission', () => {
    const req = mockReq({ role: ROLES.MEMBER });
    const res = mockRes();
    let nextCalled = false;

    requirePermission(PERMISSIONS.BROADCASTS_MANAGE)(req, res, () => {
      nextCalled = true;
    });

    assert.ok(nextCalled, 'next() should have been called');
    assert.equal(res.statusCode, null);
  });

  it('blocks request when role lacks the permission', () => {
    const req = mockReq({ role: ROLES.VIEWER });
    const res = mockRes();
    let nextCalled = false;

    requirePermission(PERMISSIONS.BROADCASTS_MANAGE)(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, 'next() should NOT have been called');
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.error, 'Forbidden');
    assert.equal(res.body.required, PERMISSIONS.BROADCASTS_MANAGE);
    assert.equal(res.body.role, ROLES.VIEWER);
  });

  it('blocks request when no membership exists', () => {
    const req = mockReq(null);
    const res = mockRes();
    let nextCalled = false;

    requirePermission(PERMISSIONS.CONTACTS_VIEW)(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.ok(res.body.message.includes('No workspace context'));
  });

  it('OWNER passes any permission check', () => {
    const req = mockReq({ role: ROLES.OWNER });
    const res = mockRes();
    let nextCalled = false;

    requirePermission(PERMISSIONS.SYSTEM_MANAGE)(req, res, () => {
      nextCalled = true;
    });

    assert.ok(nextCalled);
  });
});

// ─── Test Suite: requireRole Middleware ─────────────────────────

describe('requireRole middleware', () => {
  it('allows request when role matches exactly', () => {
    const req = mockReq({ role: ROLES.ADMIN });
    const res = mockRes();
    let nextCalled = false;

    requireRole(ROLES.ADMIN, ROLES.OWNER)(req, res, () => {
      nextCalled = true;
    });

    assert.ok(nextCalled);
  });

  it('blocks request when role does not match', () => {
    const req = mockReq({ role: ROLES.MEMBER });
    const res = mockRes();
    let nextCalled = false;

    requireRole(ROLES.ADMIN, ROLES.OWNER)(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });
});

// ─── Test Suite: requireRoleAtLeast Middleware ─────────────────────────

describe('requireRoleAtLeast middleware', () => {
  it('allows ADMIN when minimum is ADMIN', () => {
    const req = mockReq({ role: ROLES.ADMIN });
    const res = mockRes();
    let nextCalled = false;

    requireRoleAtLeast(ROLES.ADMIN)(req, res, () => {
      nextCalled = true;
    });

    assert.ok(nextCalled);
  });

  it('allows OWNER when minimum is ADMIN', () => {
    const req = mockReq({ role: ROLES.OWNER });
    const res = mockRes();
    let nextCalled = false;

    requireRoleAtLeast(ROLES.ADMIN)(req, res, () => {
      nextCalled = true;
    });

    assert.ok(nextCalled);
  });

  it('blocks MEMBER when minimum is ADMIN', () => {
    const req = mockReq({ role: ROLES.MEMBER });
    const res = mockRes();
    let nextCalled = false;

    requireRoleAtLeast(ROLES.ADMIN)(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
    assert.ok(res.body.message.includes('at least ADMIN'));
  });

  it('blocks VIEWER when minimum is MEMBER', () => {
    const req = mockReq({ role: ROLES.VIEWER });
    const res = mockRes();
    let nextCalled = false;

    requireRoleAtLeast(ROLES.MEMBER)(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });
});
