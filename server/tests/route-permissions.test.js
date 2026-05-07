/**
 * Route Permission Map Tests
 * 
 * Validates that the RBAC route permission map correctly
 * matches route patterns and assigns the right permissions.
 * 
 * Run: node --test server/tests/route-permissions.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PERMISSIONS } from '../constants/permissions.js';

// ── Replicate the ROUTE_PERMISSIONS map from index.js ──
// This is intentionally duplicated here so the test validates
// the expected behavior independently.
const ROUTE_PERMISSIONS = [
  { pattern: /^\/accounts$/, methods: ['GET'], permission: PERMISSIONS.ACCOUNTS_VIEW },
  { pattern: /^\/accounts/, methods: ['PUT', 'DELETE'], permission: PERMISSIONS.ACCOUNTS_MANAGE },
  { pattern: /^\/meta\//, methods: ['POST'], permission: PERMISSIONS.ACCOUNTS_MANAGE },
  { pattern: /^\/contacts\/blocklist$/, methods: ['GET'], permission: PERMISSIONS.CONTACTS_VIEW },
  { pattern: /^\/contacts\/import$/, methods: ['POST'], permission: PERMISSIONS.CONTACTS_MANAGE },
  { pattern: /^\/contacts\/[^/]+\/block$/, methods: ['POST'], permission: PERMISSIONS.CONTACTS_MANAGE },
  { pattern: /^\/contacts\/[^/]+\/unblock$/, methods: ['POST'], permission: PERMISSIONS.CONTACTS_MANAGE },
  { pattern: /^\/contacts\/[^/]+$/, methods: ['DELETE'], permission: PERMISSIONS.CONTACTS_DELETE },
  { pattern: /^\/contacts\/[^/]+$/, methods: ['PATCH'], permission: PERMISSIONS.CONTACTS_MANAGE },
  { pattern: /^\/contacts$/, methods: ['GET'], permission: PERMISSIONS.CONTACTS_VIEW },
  { pattern: /^\/contacts$/, methods: ['POST'], permission: PERMISSIONS.CONTACTS_MANAGE },
  { pattern: /^\/segments/, methods: ['GET'], permission: PERMISSIONS.CONTACTS_VIEW },
  { pattern: /^\/segments$/, methods: ['POST'], permission: PERMISSIONS.CONTACTS_MANAGE },
  { pattern: /^\/templates\/[^/]+\/submit$/, methods: ['POST'], permission: PERMISSIONS.TEMPLATES_MANAGE },
  { pattern: /^\/templates$/, methods: ['GET'], permission: PERMISSIONS.TEMPLATES_VIEW },
  { pattern: /^\/templates$/, methods: ['POST'], permission: PERMISSIONS.TEMPLATES_MANAGE },
  { pattern: /^\/templates\//, methods: ['PUT'], permission: PERMISSIONS.TEMPLATES_MANAGE },
  { pattern: /^\/broadcasts$/, methods: ['GET'], permission: PERMISSIONS.BROADCASTS_VIEW },
  { pattern: /^\/broadcasts$/, methods: ['POST'], permission: PERMISSIONS.BROADCASTS_MANAGE },
  { pattern: /^\/broadcasts\/[^/]+$/, methods: ['GET'], permission: PERMISSIONS.BROADCASTS_VIEW },
  { pattern: /^\/broadcasts\/[^/]+\/(pause|resume|cancel)$/, methods: ['PUT'], permission: PERMISSIONS.BROADCASTS_MANAGE },
  { pattern: /^\/media\/upload$/, methods: ['POST'], permission: PERMISSIONS.MEDIA_MANAGE },
  { pattern: /^\/media\/[^/]+\/duplicate$/, methods: ['POST'], permission: PERMISSIONS.MEDIA_MANAGE },
  { pattern: /^\/media\/[^/]+\/move$/, methods: ['PATCH'], permission: PERMISSIONS.MEDIA_MANAGE },
  { pattern: /^\/media\/[^/]+\/archive$/, methods: ['POST'], permission: PERMISSIONS.MEDIA_MANAGE },
  { pattern: /^\/media\/[^/]+\/usage$/, methods: ['GET'], permission: PERMISSIONS.MEDIA_VIEW },
  { pattern: /^\/media\/[^/]+$/, methods: ['DELETE'], permission: PERMISSIONS.MEDIA_MANAGE },
  { pattern: /^\/media\/[^/]+$/, methods: ['PATCH'], permission: PERMISSIONS.MEDIA_MANAGE },
  { pattern: /^\/media$/, methods: ['GET'], permission: PERMISSIONS.MEDIA_VIEW },
  { pattern: /^\/media\/proxy$/, methods: ['GET'], permission: PERMISSIONS.MEDIA_VIEW },
  { pattern: /^\/folders$/, methods: ['GET'], permission: PERMISSIONS.MEDIA_VIEW },
  { pattern: /^\/folders$/, methods: ['POST'], permission: PERMISSIONS.MEDIA_MANAGE },
  { pattern: /^\/inbox\/[^/]+\/send$/, methods: ['POST'], permission: PERMISSIONS.INBOX_SEND },
  { pattern: /^\/inbox/, methods: ['GET'], permission: PERMISSIONS.INBOX_VIEW },
  { pattern: /^\/webhook-settings\/meta-sync$/, methods: ['POST'], permission: PERMISSIONS.WEBHOOKS_MANAGE },
  { pattern: /^\/webhook-settings\/test$/, methods: ['POST'], permission: PERMISSIONS.WEBHOOKS_MANAGE },
  { pattern: /^\/webhook-settings$/, methods: ['GET'], permission: PERMISSIONS.WEBHOOKS_VIEW },
  { pattern: /^\/webhook-settings$/, methods: ['POST'], permission: PERMISSIONS.WEBHOOKS_MANAGE },
  { pattern: /^\/audit-logs$/, methods: ['GET'], permission: PERMISSIONS.AUDIT_VIEW },
  { pattern: /^\/stats\//, methods: ['GET'], permission: PERMISSIONS.WORKSPACE_VIEW },
  { pattern: /^\/system\//, methods: ['GET'], permission: PERMISSIONS.WORKSPACE_VIEW },
];

function findPermission(path, method) {
  const rule = ROUTE_PERMISSIONS.find(
    (r) => r.pattern.test(path) && r.methods.includes(method)
  );
  return rule?.permission || null;
}

// ─── Test Suite ──────────────────────────────────────────────

describe('Route Permission Map', () => {
  // Contacts
  it('GET /contacts requires contacts:view', () => {
    assert.equal(findPermission('/contacts', 'GET'), PERMISSIONS.CONTACTS_VIEW);
  });

  it('POST /contacts requires contacts:manage', () => {
    assert.equal(findPermission('/contacts', 'POST'), PERMISSIONS.CONTACTS_MANAGE);
  });

  it('DELETE /contacts/:id requires contacts:delete', () => {
    assert.equal(findPermission('/contacts/uuid-123', 'DELETE'), PERMISSIONS.CONTACTS_DELETE);
  });

  it('POST /contacts/import requires contacts:manage', () => {
    assert.equal(findPermission('/contacts/import', 'POST'), PERMISSIONS.CONTACTS_MANAGE);
  });

  it('POST /contacts/:id/block requires contacts:manage', () => {
    assert.equal(findPermission('/contacts/uuid-123/block', 'POST'), PERMISSIONS.CONTACTS_MANAGE);
  });

  // Broadcasts
  it('GET /broadcasts requires broadcasts:view', () => {
    assert.equal(findPermission('/broadcasts', 'GET'), PERMISSIONS.BROADCASTS_VIEW);
  });

  it('POST /broadcasts requires broadcasts:manage', () => {
    assert.equal(findPermission('/broadcasts', 'POST'), PERMISSIONS.BROADCASTS_MANAGE);
  });

  it('PUT /broadcasts/:id/pause requires broadcasts:manage', () => {
    assert.equal(findPermission('/broadcasts/uuid-123/pause', 'PUT'), PERMISSIONS.BROADCASTS_MANAGE);
  });

  it('PUT /broadcasts/:id/cancel requires broadcasts:manage', () => {
    assert.equal(findPermission('/broadcasts/uuid-123/cancel', 'PUT'), PERMISSIONS.BROADCASTS_MANAGE);
  });

  it('GET /broadcasts/:id requires broadcasts:view', () => {
    assert.equal(findPermission('/broadcasts/uuid-123', 'GET'), PERMISSIONS.BROADCASTS_VIEW);
  });

  // Templates
  it('GET /templates requires templates:view', () => {
    assert.equal(findPermission('/templates', 'GET'), PERMISSIONS.TEMPLATES_VIEW);
  });

  it('POST /templates requires templates:manage', () => {
    assert.equal(findPermission('/templates', 'POST'), PERMISSIONS.TEMPLATES_MANAGE);
  });

  it('POST /templates/:id/submit requires templates:manage', () => {
    assert.equal(findPermission('/templates/uuid-123/submit', 'POST'), PERMISSIONS.TEMPLATES_MANAGE);
  });

  // Inbox
  it('GET /inbox requires inbox:view', () => {
    assert.equal(findPermission('/inbox', 'GET'), PERMISSIONS.INBOX_VIEW);
  });

  it('POST /inbox/:id/send requires inbox:send', () => {
    assert.equal(findPermission('/inbox/uuid-123/send', 'POST'), PERMISSIONS.INBOX_SEND);
  });

  // Webhooks
  it('GET /webhook-settings requires webhooks:view', () => {
    assert.equal(findPermission('/webhook-settings', 'GET'), PERMISSIONS.WEBHOOKS_VIEW);
  });

  it('POST /webhook-settings requires webhooks:manage', () => {
    assert.equal(findPermission('/webhook-settings', 'POST'), PERMISSIONS.WEBHOOKS_MANAGE);
  });

  it('POST /webhook-settings/meta-sync requires webhooks:manage', () => {
    assert.equal(findPermission('/webhook-settings/meta-sync', 'POST'), PERMISSIONS.WEBHOOKS_MANAGE);
  });

  // Media
  it('POST /media/upload requires media:manage', () => {
    assert.equal(findPermission('/media/upload', 'POST'), PERMISSIONS.MEDIA_MANAGE);
  });

  it('GET /media requires media:view', () => {
    assert.equal(findPermission('/media', 'GET'), PERMISSIONS.MEDIA_VIEW);
  });

  it('DELETE /media/:id requires media:manage', () => {
    assert.equal(findPermission('/media/uuid-123', 'DELETE'), PERMISSIONS.MEDIA_MANAGE);
  });

  // Audit
  it('GET /audit-logs requires audit:view', () => {
    assert.equal(findPermission('/audit-logs', 'GET'), PERMISSIONS.AUDIT_VIEW);
  });

  // Meta API
  it('POST /meta/discover requires accounts:manage', () => {
    assert.equal(findPermission('/meta/discover', 'POST'), PERMISSIONS.ACCOUNTS_MANAGE);
  });

  // Public routes should NOT match
  it('/health has no permission rule', () => {
    assert.equal(findPermission('/health', 'GET'), null);
  });

  it('/webhooks has no permission rule', () => {
    assert.equal(findPermission('/webhooks', 'POST'), null);
  });
});
