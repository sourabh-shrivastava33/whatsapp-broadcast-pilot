import test from 'node:test';
import assert from 'node:assert/strict';
import { tool } from '@openai/agents';
import { validateTools } from '../agentic/tools.js';

test('validateTools rejects unsupported hosted tools', () => {
  assert.throws(
    () => validateTools([
      {
        type: 'hosted_tool',
        name: 'bad_tool',
        invoke: async () => 'nope',
        needsApproval: async () => false,
      },
    ]),
    /Unsupported tool type/,
  );
});

test('validateTools rejects non-strict and loose schemas', () => {
  assert.throws(
    () => validateTools([
      {
        type: 'function',
        name: 'loose_tool',
        invoke: async () => 'nope',
        needsApproval: async () => false,
        strict: false,
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: false,
        },
      },
    ]),
    /strict: true/,
  );

  assert.throws(
    () => validateTools([
      {
        type: 'function',
        name: 'extra_props_tool',
        invoke: async () => 'nope',
        needsApproval: async () => false,
        strict: true,
        parameters: {
          type: 'object',
          properties: {},
          required: [],
          additionalProperties: true,
        },
      },
    ]),
    /additionalProperties: false/,
  );
});

test('validateTools rejects nested non-strict object schemas', () => {
  const candidate = tool({
    name: 'nested_tool',
    description: 'Should fail nested strict validation',
    parameters: {
      type: 'object',
      properties: {
        profile: {
          type: 'object',
          properties: { name: { type: 'string' } },
          required: ['name'],
          additionalProperties: true,
        },
      },
      required: ['profile'],
      additionalProperties: false,
    },
    strict: true,
    execute: async () => 'ok',
  });

  assert.throws(() => validateTools([candidate]), /additionalProperties: false/);
});

test('validateTools accepts a hardened function tool', () => {
  const candidate = tool({
    name: 'hardened_tool',
    description: 'Should pass',
    parameters: {
      type: 'object',
      properties: {
        value: { type: 'string' },
      },
      required: ['value'],
      additionalProperties: false,
    },
    strict: true,
    execute: async () => 'ok',
  });

  assert.equal(validateTools([candidate])[0], candidate);
});
