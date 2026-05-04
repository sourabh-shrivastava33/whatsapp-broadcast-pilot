import { tool } from '@openai/agents';
import { prisma } from '../db.js';
import { logger } from '../logger.js';
import { getIO } from '../socket.js';
import { AsyncLocalStorage } from 'async_hooks';

export const agentContext = new AsyncLocalStorage();

function resolveToolContext(runContext) {
  return runContext?.context || agentContext.getStore() || {};
}

export function assertStrictObjectSchema(schema, path = 'schema') {
  if (!schema || typeof schema !== 'object') {
    throw new Error(`CRITICAL: ${path} must be a JSON object schema.`);
  }
  if (schema.type !== 'object') {
    throw new Error(`CRITICAL: ${path} must have type: "object".`);
  }
  if (!schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties)) {
    throw new Error(`CRITICAL: ${path} must define object "properties".`);
  }
  if (!Array.isArray(schema.required)) {
    throw new Error(`CRITICAL: ${path} must define a "required" array.`);
  }
  if (schema.additionalProperties !== false) {
    throw new Error(`CRITICAL: ${path} must have "additionalProperties: false".`);
  }

  Object.entries(schema.properties).forEach(([key, value]) => {
    if (!value || typeof value !== 'object') return;

    if (value.type === 'object') {
      assertStrictObjectSchema(value, `${path}.properties.${key}`);
    }
    if (value.type === 'array' && value.items?.type === 'object') {
      assertStrictObjectSchema(value.items, `${path}.properties.${key}.items`);
    }
    if (Array.isArray(value.anyOf)) {
      value.anyOf.forEach((entry, index) => {
        if (entry?.type === 'object') {
          assertStrictObjectSchema(entry, `${path}.properties.${key}.anyOf[${index}]`);
        }
      });
    }
  });
}

/**
 * Updates the lead intelligence data in the database.
 */
export async function updateLeadIntelligence(
  { budget, location, propertyType, timeline, purpose, loanReadiness, aiSummary, nextAction, intentScore, leadStage },
  runContext,
) {
  const context = resolveToolContext(runContext);
  const contactId = context?.contactId;

  try {
    if (!contactId) throw new Error('Missing contactId in agent run context');

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) throw new Error(`Contact ${contactId} not found`);

    const currentData = contact.qualificationData || {};
    const newData = {
      budget: budget || currentData.budget,
      location: location || currentData.location,
      propertyType: propertyType || currentData.propertyType,
      timeline: timeline || currentData.timeline,
      purpose: purpose || currentData.purpose,
      loanReadiness: loanReadiness || currentData.loanReadiness,
    };

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        qualificationData: newData,
        aiSummary: aiSummary || contact.aiSummary,
        nextAction: nextAction || contact.nextAction,
        intentScore: intentScore !== undefined ? intentScore : contact.intentScore,
        leadStage: leadStage || contact.leadStage,
        updatedAt: new Date(),
      },
    });

    getIO()?.emit('contact_updated', updated);

    return { success: true, message: 'Lead intelligence updated' };
  } catch (error) {
    logger.error(`Error updating lead intelligence: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Explicitly triggers a human handoff.
 */
export async function escalateToHuman({ reason }, runContext) {
  const context = resolveToolContext(runContext);
  const contactId = context?.contactId;

  try {
    if (!contactId) throw new Error('Missing contactId in agent run context');

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        leadStage: 'HUMAN_NEEDED',
        notes: `[AI ESCALATION] ${reason}`,
      },
    });

    getIO()?.emit('contact_updated', updated);
    getIO()?.emit('ai_escalation', { contactId, reason });

    return { success: true, message: 'Escalated to human' };
  } catch (error) {
    logger.error(`Error escalating to human: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Defensive validation to ensure tools match the expected OpenAI Agents SDK shape.
 * Fails fast if any tool is invalid.
 */
export function validateTools(toolList) {
  toolList.forEach((candidate) => {
    if (candidate.type !== 'function') {
      throw new Error(`CRITICAL: Unsupported tool type "${candidate.type}" for tool "${candidate.name}". OpenAI Agents SDK requires "function" type for local tools.`);
    }
    if (typeof candidate.invoke !== 'function') {
      throw new Error(`CRITICAL: Tool "${candidate.name}" is missing an executable "invoke" function. Use the tool() helper.`);
    }
    if (typeof candidate.needsApproval !== 'function') {
      throw new Error(`CRITICAL: Tool "${candidate.name}" is missing "needsApproval" method.`);
    }
    if (candidate.strict !== true) {
      throw new Error(`CRITICAL: Tool "${candidate.name}" must have "strict: true" for production safety.`);
    }
    assertStrictObjectSchema(candidate.parameters, `Tool "${candidate.name}" schema`);
  });

  logger.info(`Hardened & validated ${toolList.length} agent tools.`);
  return toolList;
}

export const tools = validateTools([
  tool({
    name: 'update_lead_intelligence',
    description: 'Update structured lead data such as budget, location, property type, and intent score. Use this whenever you learn something new about the buyer.',
    parameters: {
      type: 'object',
      properties: {
        budget: { type: 'string', description: 'Budget range (e.g. 50L - 75L)' },
        location: { type: 'string', description: 'Preferred location/area' },
        propertyType: { type: 'string', description: 'e.g. 2BHK, 3BHK, Villa, Plot' },
        timeline: { type: 'string', description: 'e.g. Immediate, 3-6 months, Exploring' },
        purpose: { type: 'string', description: 'Self-use or Investment' },
        loanReadiness: { type: 'string', description: 'Loan, Cash, or Undecided' },
        aiSummary: { type: 'string', description: "Brief summary of the lead's current state" },
        nextAction: { type: 'string', description: 'Next recommended step for the sales team' },
        intentScore: { type: 'number', description: '0-100 score of buying intent' },
        leadStage: { type: 'string', enum: ['NEW', 'HOT', 'WARM', 'COLD', 'VISIT_BOOKED', 'CLOSED'], description: 'Current lifecycle stage' },
      },
      required: ['budget', 'location', 'propertyType', 'timeline', 'purpose', 'loanReadiness', 'aiSummary', 'nextAction', 'intentScore', 'leadStage'],
      additionalProperties: false,
    },
    strict: true,
    execute: updateLeadIntelligence,
  }),
  tool({
    name: 'escalate_to_human',
    description: 'Trigger a human handoff if the lead is frustrated, asks for a person, or is ready for a high-value discussion.',
    parameters: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'The reason for escalation' },
      },
      required: ['reason'],
      additionalProperties: false,
    },
    strict: true,
    execute: escalateToHuman,
  }),
]);
