/**
 * broadcastEngine.js
 *
 * Meta-compliant, tier-aware broadcast sending engine.
 *
 * Design principles:
 *  - Queue-ready: accepts a `job` object so BullMQ can drop in later with zero logic changes.
 *  - No direct Meta API calls in this file's test path — the `metaSender` function is
 *    injected via the job object, making the engine 100% unit-testable without hitting Meta.
 *  - Tier-aware: partitions contacts proportionally across active accounts.
 *  - Throttled: enforces Meta's 80 msg/s per phone number limit via inter-message delay.
 *  - Exponential backoff: retries 429/5xx up to MAX_RETRIES times before logging failure.
 *  - Concurrency-limited: p-limit(5) per account partition.
 *
 * @module broadcastEngine
 */

import pLimit from 'p-limit';

// ─────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────

/** Maps Meta messaging_limit_tier values to their 24h unique conversation limits. */
export const TIER_LIMITS = {
  TIER_NOT_SET: 250,
  TIER_100: 100,
  TIER_1K: 1_000,
  TIER_10K: 10_000,
  TIER_100K: 100_000,
  TIER_UNLIMITED: Infinity,
};

/** Meta Cloud API documented rate: 80 messages/second per phone number. */
const META_MSGS_PER_SECOND = 80;
const INTER_MESSAGE_DELAY_MS = Math.ceil(1000 / META_MSGS_PER_SECOND); // 13ms

/** Exponential backoff: base delay and max retry count. */
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1_000;

/** Max concurrent in-flight Meta API calls per account partition. */
const CONCURRENCY_PER_PARTITION = 5;

/** Halt the account partition when this fraction of its tier limit is used (safety margin). */
const TIER_LIMIT_HALT_FRACTION = 0.95;

/** Warn (audit log) when this fraction of tier limit is reached. */
const TIER_LIMIT_WARN_FRACTION = 0.80;

// ─────────────────────────────────────────────────────────────────
// Utility: sleep
// ─────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────────
// Utility: exponential backoff retry
// ─────────────────────────────────────────────────────────────────

/**
 * Retries an async function with exponential backoff on retryable HTTP errors.
 * @param {Function} fn - Async function to retry.
 * @param {number} maxRetries - Maximum retry attempts.
 * @returns {Promise<any>}
 */
async function withExponentialBackoff(fn, maxRetries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isRetryable =
        err.retryable === true ||
        err.statusCode === 429 ||
        (err.statusCode >= 500 && err.statusCode < 600);

      if (!isRetryable || attempt === maxRetries) break;

      const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
      console.warn(
        `[BroadcastEngine] Retryable error (attempt ${attempt + 1}/${maxRetries}), backing off ${delay}ms: ${err.message}`
      );
      await sleep(delay);
    }
  }
  throw lastError;
}

// ─────────────────────────────────────────────────────────────────
// Core: partition contacts across accounts
// ─────────────────────────────────────────────────────────────────

/**
 * Partitions a contact list proportionally across accounts based on tier limits.
 *
 * @param {string[]} contactIds
 * @param {Array<{id: string, tierLimit: number, [key: string]: any}>} accounts
 * @returns {Array<{account: object, contactIds: string[]}>}
 */
export function partitionContacts(contactIds, accounts) {
  // Filter out accounts that have no remaining capacity (already at limit)
  const viable = accounts.filter((a) => a.tierLimit > 0);
  if (viable.length === 0) return [];

  const totalCapacity = viable.reduce((sum, a) => {
    return a.tierLimit === Infinity ? sum + contactIds.length : sum + a.tierLimit;
  }, 0);

  let remaining = [...contactIds];
  const partitions = [];

  for (let i = 0; i < viable.length; i++) {
    const account = viable[i];
    const isLast = i === viable.length - 1;

    let count;
    if (isLast) {
      // Last account takes whatever is left
      count = remaining.length;
    } else if (account.tierLimit === Infinity) {
      count = remaining.length;
    } else {
      // Proportional slice
      const fraction = account.tierLimit / totalCapacity;
      count = Math.min(Math.round(contactIds.length * fraction), account.tierLimit, remaining.length);
    }

    partitions.push({
      account,
      contactIds: remaining.splice(0, count),
    });

    if (remaining.length === 0) break;
  }

  return partitions;
}

// ─────────────────────────────────────────────────────────────────
// Core: process a single account partition
// ─────────────────────────────────────────────────────────────────

/**
 * Processes one account's slice of a broadcast.
 *
 * @param {object} params
 * @param {object} params.account - Account DB record (with tierLimit injected).
 * @param {string[]} params.contactIds - Contact IDs assigned to this account.
 * @param {object} params.template - Template DB record.
 * @param {object} params.variableValues - Map of variable num → user-supplied value.
 * @param {string} params.broadcastId - The parent Broadcast record ID.
 * @param {Function} params.metaSender - Async fn(account, contact, template, variableValues) → metaMessageId. Injected for testability.
 * @param {Function} params.getContact - Async fn(contactId) → contact record.
 * @param {Function} params.onMessageQueued - Async fn(contactId) → messageLogId.
 * @param {Function} params.onMessageSuccess - Async fn(messageLogId, metaMessageId, contactId, template, variableValues).
 * @param {Function} params.onMessageFailure - Async fn(messageLogId, error, contactId).
 * @param {Function} params.onAuditLog - Async fn(action, metadata).
 * @returns {Promise<{success: number, failed: number, skipped: number}>}
 */
async function processPartition({
  account,
  contactIds,
  template,
  variableValues,
  broadcastId,
  metaSender,
  getContact,
  onMessageQueued,
  onMessageSuccess,
  onMessageFailure,
  onAuditLog,
  onProgress,
}) {
  const limit = pLimit(CONCURRENCY_PER_PARTITION);
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let sentCount = 0; // rolling counter for tier limit enforcement

  const haltLimit = Math.floor(
    (account.tierLimit === Infinity ? Infinity : account.tierLimit) * TIER_LIMIT_HALT_FRACTION
  );
  const warnLimit = Math.floor(
    (account.tierLimit === Infinity ? Infinity : account.tierLimit) * TIER_LIMIT_WARN_FRACTION
  );
  let warnLogged = false;

  const tasks = contactIds.map((contactId, idx) =>
    limit(async () => {
      // ── Tier limit enforcement ───────────────────────────────
      if (sentCount >= haltLimit) {
        console.warn(
          `[BroadcastEngine] Account ${account.id} reached 95% tier limit. Halting partition.`
        );
        await onAuditLog('TIER_LIMIT_HALT', { accountId: account.id, sentCount });
        skipped++;
        return;
      }

      if (!warnLogged && sentCount >= warnLimit) {
        warnLogged = true;
        await onAuditLog('TIER_LIMIT_WARNING', { accountId: account.id, sentCount, limit: account.tierLimit });
      }

      const contact = await getContact(contactId);

      // ── Opt-out check ────────────────────────────────────────
      if (contact?.optInStatus === 'opted_out' || contact?.status === 'opted_out') {
        skipped++;
        return;
      }

      const messageLogId = await onMessageQueued(contactId);

      try {
        // ── Send via injected metaSender (throttled, retried) ──
        const metaMessageId = await withExponentialBackoff(() =>
          metaSender(account, contact, template, variableValues)
        );

        await onMessageSuccess(messageLogId, metaMessageId, contactId, template, variableValues);
        sentCount++;
        success++;
      } catch (err) {
        await onMessageFailure(messageLogId, err, contactId);
        failed++;
      }

      // ── Inter-message throttle (Meta: 80 msg/s) ────────────
      if (idx < contactIds.length - 1) {
        await sleep(INTER_MESSAGE_DELAY_MS);
      }

      onProgress?.({ done: idx + 1, total: contactIds.length, accountId: account.id });
    })
  );

  await Promise.all(tasks);
  return { success, failed, skipped };
}

// ─────────────────────────────────────────────────────────────────
// Public API: runBroadcast
// ─────────────────────────────────────────────────────────────────

/**
 * Entry point for the broadcast engine. Designed to be called directly
 * in-process now, and via a BullMQ worker later with zero changes.
 *
 * @param {object} job
 * @param {string}   job.broadcastId
 * @param {object[]} job.accounts   - Active accounts with `tierLimit` injected.
 * @param {string[]} job.contactIds - All contact IDs to send to.
 * @param {object}   job.template
 * @param {object}   job.variableValues - { "1": "John", "2": "Property XYZ" }
 * @param {Function} job.metaSender  - Injected sender function (real or mock).
 * @param {Function} job.getContact
 * @param {Function} job.onMessageQueued
 * @param {Function} job.onMessageSuccess
 * @param {Function} job.onMessageFailure
 * @param {Function} job.onBroadcastComplete
 * @param {Function} job.onAuditLog
 * @param {Function} [job.onProgress]
 * @returns {Promise<{success: number, failed: number, skipped: number, partitions: object[]}>}
 */
export async function runBroadcast(job) {
  const {
    broadcastId,
    accounts,
    contactIds,
    template,
    variableValues = {},
    metaSender,
    getContact,
    onMessageQueued,
    onMessageSuccess,
    onMessageFailure,
    onBroadcastComplete,
    onAuditLog,
    onProgress,
  } = job;

  // ── Validate combined capacity ───────────────────────────────
  const combinedLimit = accounts.reduce((sum, a) => {
    return a.tierLimit === Infinity ? Infinity : sum + a.tierLimit;
  }, 0);

  if (combinedLimit !== Infinity && contactIds.length > combinedLimit) {
    const err = new Error(
      `Broadcast rejected: ${contactIds.length} contacts exceed combined tier limit of ${combinedLimit}. ` +
      `Reduce contact count or upgrade account tiers.`
    );
    err.code = 'EXCEEDS_TIER_LIMIT';
    throw err;
  }

  // ── Partition contacts across accounts ───────────────────────
  const partitions = partitionContacts(contactIds, accounts);

  await onAuditLog('BROADCAST_ENGINE_START', {
    broadcastId,
    totalContacts: contactIds.length,
    partitions: partitions.map((p) => ({
      accountId: p.account.id,
      contactCount: p.contactIds.length,
      tierLimit: p.account.tierLimit,
    })),
  });

  // ── Process all partitions concurrently (accounts run in parallel) ──
  const partitionResults = await Promise.all(
    partitions.map((p) =>
      processPartition({
        account: p.account,
        contactIds: p.contactIds,
        template,
        variableValues,
        broadcastId,
        metaSender,
        getContact,
        onMessageQueued,
        onMessageSuccess,
        onMessageFailure,
        onAuditLog,
        onProgress,
      })
    )
  );

  // ── Aggregate results ────────────────────────────────────────
  const totals = partitionResults.reduce(
    (acc, r) => ({
      success: acc.success + r.success,
      failed: acc.failed + r.failed,
      skipped: acc.skipped + r.skipped,
    }),
    { success: 0, failed: 0, skipped: 0 }
  );

  await onBroadcastComplete(broadcastId, totals);
  await onAuditLog('BROADCAST_ENGINE_COMPLETE', { broadcastId, ...totals });

  return { ...totals, partitions: partitionResults };
}
