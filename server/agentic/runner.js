import { Runner } from '@openai/agents';
import { prisma } from '../db.js';
import { logger } from '../logger.js';
import { triageAgent, salesAgent, objectionAgent } from './agents.js';

const AGENTS_BY_NAME = new Map([
  [triageAgent.name, triageAgent],
  [salesAgent.name, salesAgent],
  [objectionAgent.name, objectionAgent],
]);

const DEFAULT_MAX_TURNS = Number(process.env.AGENT_MAX_TURNS || 10);
const DEFAULT_TIMEOUT_MS = Number(process.env.AGENT_RUN_TIMEOUT_MS || 90_000);
const MAX_FALLBACK_MESSAGES = Number(process.env.AGENT_SESSION_FALLBACK_MESSAGES || 50);

function nowIso() {
  return new Date().toISOString();
}

function textFromMessageBody(body) {
  return typeof body === 'string' ? body.trim() : '';
}

function assistantItemFromMessage(message) {
  return {
    type: 'message',
    role: 'assistant',
    status: 'completed',
    content: [
      {
        type: 'output_text',
        text: textFromMessageBody(message.body),
      },
    ],
  };
}

function userItemFromMessage(message) {
  return {
    type: 'message',
    role: 'user',
    content: textFromMessageBody(message.body),
  };
}

function normalizeLegacyHistoryItem(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.type) return item;
  if (item.role === 'assistant') {
    return assistantItemFromMessage({ body: item.content });
  }
  if (item.role === 'user') {
    return userItemFromMessage({ body: item.content });
  }
  return null;
}

export function normalizeSessionItems(aiSessionState) {
  if (!aiSessionState || typeof aiSessionState !== 'object') return [];
  const rawItems = Array.isArray(aiSessionState.items)
    ? aiSessionState.items
    : Array.isArray(aiSessionState.history)
      ? aiSessionState.history
      : [];

  return rawItems
    .map(normalizeLegacyHistoryItem)
    .filter(Boolean);
}

function latestUserContent(items) {
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const item = items[i];
    if (item?.role === 'user') {
      if (typeof item.content === 'string') return item.content.trim();
      if (Array.isArray(item.content)) {
        const firstText = item.content.find((entry) => entry?.type === 'input_text');
        if (firstText?.text) return firstText.text.trim();
      }
    }
  }
  return '';
}

export function pruneDuplicateCurrentInput(items, currentInput) {
  const current = textFromMessageBody(currentInput);
  if (!current || latestUserContent(items) !== current) {
    return items;
  }
  return items.slice(0, -1);
}

function cloneItem(item) {
  return structuredClone(item);
}

async function loadFallbackItems(db, contactId, currentInput) {
  const messages = await db.chatMessage.findMany({
    where: { contactId },
    orderBy: { timestamp: 'asc' },
    take: MAX_FALLBACK_MESSAGES,
  });

  const items = messages
    .filter((message) => textFromMessageBody(message.body))
    .map((message) => (message.fromMe
      ? assistantItemFromMessage(message)
      : userItemFromMessage(message)));

  return pruneDuplicateCurrentInput(items, currentInput);
}

function resolveAgent(agentName) {
  return AGENTS_BY_NAME.get(agentName) || null;
}

export function resolveStartAgent(session) {
  const savedAgent = resolveAgent(session.currentAgentName);
  if (savedAgent) return savedAgent;
  return session.items.length === 0 ? triageAgent : salesAgent;
}

function agentNameFromResult(result, fallbackName) {
  return result?.activeAgent?.name || result?.lastAgent?.name || fallbackName || salesAgent.name;
}

function withTimeout(signal, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Agent run timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
}

/**
 * Prisma-backed implementation of the OpenAI Agents SDK Session contract.
 */
export class PrismaChatSession {
  constructor(contactId, currentInput = '', db = prisma) {
    this.contactId = contactId;
    this.sessionId = contactId;
    this.currentInput = currentInput;
    this.prisma = db;
    this.items = [];
    this.currentAgentName = null;
    this.lastResponseId = undefined;
  }

  async load() {
    const contact = await this.prisma.contact.findUnique({
      where: { id: this.contactId },
      select: { aiSessionState: true },
    });

    if (contact?.aiSessionState) {
      this.items = pruneDuplicateCurrentInput(
        normalizeSessionItems(contact.aiSessionState),
        this.currentInput,
      );
      this.currentAgentName = contact.aiSessionState.currentAgentName || null;
      this.lastResponseId = contact.aiSessionState.lastResponseId || undefined;
      logger.debug(`Restored AI session for ${this.contactId}. Items: ${this.items.length}`);
      return;
    }

    this.items = await loadFallbackItems(this.prisma, this.contactId, this.currentInput);
    logger.debug(`Loaded fallback AI session for ${this.contactId}. Items: ${this.items.length}`);
  }

  async getSessionId() {
    return this.sessionId;
  }

  async getItems(limit) {
    if (limit === undefined) {
      return this.items.map(cloneItem);
    }
    if (limit <= 0) return [];
    return this.items.slice(Math.max(this.items.length - limit, 0)).map(cloneItem);
  }

  async addItems(items) {
    if (!Array.isArray(items) || items.length === 0) return;
    this.items = [...this.items, ...items.map(cloneItem)];
  }

  async popItem() {
    if (this.items.length === 0) return undefined;
    const item = this.items[this.items.length - 1];
    this.items = this.items.slice(0, -1);
    return cloneItem(item);
  }

  async clearSession() {
    this.items = [];
    this.currentAgentName = null;
    this.lastResponseId = undefined;
    await this.prisma.contact.update({
      where: { id: this.contactId },
      data: { aiSessionState: null },
    });
  }

  async save(result) {
    const currentAgentName = agentNameFromResult(result, this.currentAgentName);
    this.currentAgentName = currentAgentName;
    this.lastResponseId = result?.lastResponseId || this.lastResponseId;

    await this.prisma.contact.update({
      where: { id: this.contactId },
      data: {
        aiSessionState: {
          items: this.items,
          currentAgentName,
          lastResponseId: this.lastResponseId || null,
          lastFinalOutput: result?.finalOutput || null,
          updatedAt: nowIso(),
        },
      },
    });

    logger.debug(`Saved AI session for ${this.contactId}. Items: ${this.items.length}`);
  }
}

// Global Runner
export const agentRunner = new Runner({
  workflowName: 'WhatsApp Lead Agent',
  traceIncludeSensitiveData: false,
  modelSettings: {
    parallelToolCalls: false,
  },
});

/**
 * Runs the agentic workflow.
 */
export async function runAgentFlow({
  contactId,
  accountId,
  messageBody,
  metaMessageId,
  signal,
}) {
  const session = new PrismaChatSession(contactId, messageBody);
  const timeout = withTimeout(signal, DEFAULT_TIMEOUT_MS);

  try {
    await session.load();

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { aiSessionState: true },
    });
    if (metaMessageId && contact?.aiSessionState?.lastProcessedMessageId === metaMessageId) {
      return {
        reply: contact.aiSessionState.lastFinalOutput || '',
        traceId: undefined,
        agentName: contact.aiSessionState.currentAgentName || session.currentAgentName,
        lastResponseId: contact.aiSessionState.lastResponseId,
        deduped: true,
      };
    }

    const startAgent = resolveStartAgent(session);
    const result = await agentRunner.run(startAgent, messageBody, {
      session,
      context: { contactId, accountId },
      maxTurns: DEFAULT_MAX_TURNS,
      signal: timeout.signal,
    });

    await session.save(result);

    if (metaMessageId) {
      const savedContact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { aiSessionState: true },
      });
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          aiSessionState: {
            ...(savedContact?.aiSessionState || {}),
            lastProcessedMessageId: metaMessageId,
            updatedAt: nowIso(),
          },
        },
      });
    }

    return {
      reply: result.finalOutput,
      traceId: undefined,
      agentName: agentNameFromResult(result, startAgent.name),
      lastResponseId: result.lastResponseId,
    };
  } catch (error) {
    logger.error(`Agent Runner Error: ${error.message}`, { contactId, accountId }, error);
    throw error;
  } finally {
    timeout.cancel();
  }
}
