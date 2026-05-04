import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PrismaChatSession,
  normalizeSessionItems,
  pruneDuplicateCurrentInput,
  resolveStartAgent,
} from '../agentic/runner.js';

function makeDb({ state = null, messages = [] } = {}) {
  const calls = { updated: null };
  return {
    calls,
    contact: {
      findUnique: async () => ({ aiSessionState: state }),
      update: async (args) => {
        calls.updated = args;
        state = args.data.aiSessionState;
        return { id: args.where.id, aiSessionState: state };
      },
    },
    chatMessage: {
      findMany: async () => messages,
    },
  };
}

test('normalizes legacy manual history to Responses-compatible items', () => {
  const items = normalizeSessionItems({
    currentAgentName: 'Real_Estate_Broker',
    history: [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ],
  });

  assert.equal(items[0].role, 'user');
  assert.equal(items[0].content, 'Hello');
  assert.equal(items[1].role, 'assistant');
  assert.equal(items[1].content[0].type, 'output_text');
});

test('prunes only the duplicate current user input from restored history', () => {
  const items = [
    { type: 'message', role: 'user', content: 'First' },
    { type: 'message', role: 'user', content: 'Current' },
  ];

  assert.equal(pruneDuplicateCurrentInput(items, 'Current').length, 1);
  assert.equal(pruneDuplicateCurrentInput(items, 'Different').length, 2);
});

test('loads SDK session state and saves active agent state', async () => {
  const db = makeDb({
    state: {
      items: [{ type: 'message', role: 'user', content: 'Hello' }],
      currentAgentName: 'Real_Estate_Broker',
      lastResponseId: 'resp_previous',
    },
  });
  const session = new PrismaChatSession('contact_1', '', db);

  await session.load();
  assert.equal((await session.getItems()).length, 1);
  assert.equal(resolveStartAgent(session).name, 'Real_Estate_Broker');

  await session.addItems([{ type: 'message', role: 'user', content: 'Need 3BHK' }]);
  await session.save({
    activeAgent: { name: 'Real_Estate_Broker' },
    lastResponseId: 'resp_next',
    finalOutput: 'Sure, which location?',
  });

  assert.equal(db.calls.updated.data.aiSessionState.currentAgentName, 'Real_Estate_Broker');
  assert.equal(db.calls.updated.data.aiSessionState.lastResponseId, 'resp_next');
  assert.equal(db.calls.updated.data.aiSessionState.items.length, 2);
});

test('falls back to chat messages and avoids duplicating current inbound text', async () => {
  const db = makeDb({
    messages: [
      { fromMe: false, body: 'Hello' },
      { fromMe: true, body: 'Hi, how can I help?' },
      { fromMe: false, body: 'Need 3BHK' },
    ],
  });
  const session = new PrismaChatSession('contact_1', 'Need 3BHK', db);

  await session.load();
  const items = await session.getItems();
  assert.equal(items.length, 2);
  assert.equal(items[0].role, 'user');
  assert.equal(items[1].role, 'assistant');
});
