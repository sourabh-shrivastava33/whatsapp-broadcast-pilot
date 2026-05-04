import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WHATSAPP_INBOUND_OPT_IN_METHOD,
  getInboundOptInData,
  shouldApplyInboundOptIn,
} from '../leadOptIn.js';

test('new inbound WhatsApp lead is marked opted in', () => {
  const at = new Date('2026-05-04T00:00:00.000Z');
  assert.equal(shouldApplyInboundOptIn(null), true);
  assert.deepEqual(getInboundOptInData(null, at), {
    optInStatus: 'opted_in',
    optInMethod: WHATSAPP_INBOUND_OPT_IN_METHOD,
    optInTimestamp: at,
  });
});

test('existing unknown inbound lead is opted in once', () => {
  const at = new Date('2026-05-04T00:00:00.000Z');
  const contact = { optInStatus: 'unknown', isBlocklisted: false };
  assert.equal(shouldApplyInboundOptIn(contact), true);
  assert.equal(getInboundOptInData(contact, at).optInStatus, 'opted_in');
});

test('existing opted in, opted out, and blocklisted leads are not overwritten', () => {
  const at = new Date('2026-05-04T00:00:00.000Z');
  const cases = [
    { optInStatus: 'opted_in', isBlocklisted: false },
    { optInStatus: 'opted_out', isBlocklisted: false },
    { optInStatus: 'unknown', isBlocklisted: true },
  ];

  cases.forEach((contact) => {
    assert.equal(shouldApplyInboundOptIn(contact), false);
    assert.deepEqual(getInboundOptInData(contact, at), {});
  });
});
