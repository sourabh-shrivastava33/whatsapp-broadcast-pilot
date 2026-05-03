import crypto from 'crypto';
import { prisma } from './db.js';
import { logger } from './logger.js';

/**
 * A drop-in replacement for fetch() with a configurable AbortController timeout.
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [timeoutMs=10000]
 * @returns {Promise<Response>}
 */
export function fetchWithTimeout(url, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

/**
 * Normalizes phone numbers for consistency.
 */
export function normalizePhone(phone) {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, "");
  if (clean.length === 10) clean = "91" + clean; // Default for pilot
  return clean;
}

/**
 * Sanitizes an account object for the frontend.
 */
export function sanitizeAccount(account) {
  if (!account) return null;
  if (Array.isArray(account)) {
    return account.map((a) => sanitizeAccount(a));
  }
  const { accessToken, ...rest } = account;
  return rest;
}

/**
 * Standardized API success response
 */
export function sendSuccess(res, data, status = 200) {
  return res.status(status).json(data);
}

/**
 * Standardized API error response with automatic logging
 */
export function sendError(res, error, message = "Internal Server Error", status = 500, context = {}) {
  const correlationId = context.correlationId || res.req?.correlationId || 'N/A';
  
  logger.error(message, { 
    ...context, 
    correlationId, 
    path: res.req?.path,
    method: res.req?.method
  }, error);

  return res.status(status).json({
    error: message,
    details: process.env.NODE_ENV === 'development' ? error?.message : undefined,
    correlationId
  });
}

// Re-export logAction for backward compatibility but use logger.audit internally
export const logAction = (action, entity, entityId, metadata) => 
  logger.audit(action, entity, entityId, metadata);
