import { Worker } from "bullmq";
import { connection } from "./queue.js";
import { prisma } from "./db.js";
import { getIO } from "./socket.js";
import { runBroadcast } from "./broadcastEngine.js";
import { fetchWithTimeout, logAction, sanitizeAccount } from "./utils.js";
import {
  META_API_VERSION,
  META_API_BASE_URL,
  DEFAULT_TEMPLATE_LANGUAGE,
  BROADCAST_STATUS,
} from "./constants.js";

console.log("👷 Worker starting...");

const worker = new Worker(
  "broadcast-queue",
  async (job) => {
    const {
      broadcastId,
      contactIds,
      template,
      variableValues,
      account,
      accounts,
      campaignName,
      correlationId,
    } = job.data;

    console.log(
      `[Job ${job.id}][Corr: ${correlationId}] Processing broadcast ${broadcastId} for ${contactIds.length} contacts`,
    );

    try {
      await runBroadcast({
        account,
        accounts,
        contactIds,
        template,
        variableValues,
        broadcastId,
        correlationId, // Pass it down

        metaSender: async (acc, contact, tpl, vars) => {
          const components = [];

          // 1. Handle Header (Media or Text with Variables)
          if (tpl.headerType && tpl.headerType !== "NONE") {
            if (tpl.headerType === "TEXT") {
              const headerVars = (tpl.header || "").match(/\{\{(\d+)\}\}/g);
              if (headerVars) {
                components.push({
                  type: "header",
                  parameters: headerVars.map((v) => {
                    const num = v.match(/\d+/)[0];
                    return {
                      type: "text",
                      text: vars[String(num)] || "sample",
                    };
                  }),
                });
              }
            } else {
              // Media Header (IMAGE, VIDEO, DOCUMENT)
              // If mediaUrl is missing, we still must send the component if the template requires it,
              // though Meta will likely error if the URL is invalid.
              components.push({
                type: "header",
                parameters: [
                  {
                    type: tpl.headerType.toLowerCase(),
                    [tpl.headerType.toLowerCase()]: {
                      link: tpl.mediaUrl || "", 
                    },
                  },
                ],
              });
            }
          }

          // 2. Handle Body Variables
          const resolvedVariables = Array.isArray(tpl.variables)
            ? tpl.variables
            : [];
          if (resolvedVariables.length > 0) {
            components.push({
              type: "body",
              parameters: resolvedVariables
                .sort((a, b) => Number(a.num) - Number(b.num))
                .map((v) => ({
                  type: "text",
                  text: vars[String(v.num)] || v.sample || "sample",
                })),
            });
          }

          const requestBody = {
            messaging_product: "whatsapp",
            to: contact.phone,
            type: "template",
            template: {
              name: tpl.name,
              language: { code: tpl.language || DEFAULT_TEMPLATE_LANGUAGE },
              components: components.length > 0 ? components : undefined,
            },
          };

          console.log(
            `[MetaRequest][Broadcast ${broadcastId}] Sending to ${contact.phone}:`,
            JSON.stringify(requestBody, null, 2),
          );

          const response = await fetchWithTimeout(
            `${META_API_BASE_URL}/${META_API_VERSION}/${acc.phoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${acc.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(requestBody),
            },
          );

          const metaData = await response.json();
          if (!response.ok || metaData.error) {
            console.error(
              `[MetaError][Broadcast ${broadcastId}] Failed to send to ${contact.phone}:`,
              JSON.stringify(metaData, null, 2),
            );
            
            const errorMsg = metaData.error?.error_user_msg || metaData.error?.message || "Meta API Error";
            const err = new Error(errorMsg);
            err.statusCode = response.status;
            err.fbCode = metaData.error?.code;
            err.fbSubcode = metaData.error?.error_subcode;
            err.retryable = response.status === 429 || response.status >= 500;
            throw err;
          }
          return metaData.messages?.[0]?.id;
        },

        getContact: (id) => prisma.contact.findUnique({ where: { id } }),

        onMessageQueued: async (contactId) => {
          const idempotencyKey = `${broadcastId}:${contactId}`;
          const existing = await prisma.messageLog.findUnique({
            where: { idempotencyKey },
          });
          if (existing) return existing.id;

          const log = await prisma.messageLog.create({
            data: {
              broadcastId,
              contactId,
              status: "queued",
              idempotencyKey,
              correlationId,
            },
          });
          return log.id;
        },

        onMessageSuccess: async (
          messageLogId,
          metaMessageId,
          contactId,
          tpl,
          vars,
        ) => {
          const log = await prisma.messageLog.findUnique({
            where: { id: messageLogId },
          });
          if (log?.metaMessageId) return; // Already successful

          await prisma.messageLog.update({
            where: { id: messageLogId },
            data: { status: "sent", metaMessageId, sentAt: new Date() },
          });

          const resolvedBody = (tpl.body || "").replace(
            /\{\{(\d+)\}\}/g,
            (match, num) => {
              return (
                vars[num] ??
                (Array.isArray(tpl.variables)
                  ? (tpl.variables.find((v) => String(v.num) === num)?.sample ??
                    match)
                  : match)
              );
            },
          );

          await prisma.chatMessage.create({
            data: {
              contactId,
              accountId: account.id, // Fixed: Added accountId from worker data
              fromMe: true,
              type: "template_broadcast",
              body: resolvedBody,
              mediaUrl: tpl.mediaUrl,
              metaMessageId,
            },
          });

          await prisma.contact.update({
            where: { id: contactId },
            data: { lastBroadcastAt: new Date(), lastMessageAt: new Date() },
          });

          getIO()?.emit("broadcast_progress", { broadcastId });
        },

        onMessageFailure: async (messageLogId, err, contactId) => {
          console.error(
            `[Broadcast ${broadcastId}] Failed for contact ${contactId}: ${err.message}`,
          );
          await prisma.messageLog.update({
            where: { id: messageLogId },
            data: { status: "failed", error: err.message },
          });
        },

        onBroadcastComplete: async (bId, totals) => {
          await prisma.broadcast.update({
            where: { id: bId },
            data: {
              status:
                totals.failed === 0
                  ? BROADCAST_STATUS.SENT
                  : "completed_with_errors",
              results: { ...totals, campaignName: campaignName || null },
            },
          });
          const finalBroadcast = await prisma.broadcast.findUnique({
            where: { id: bId },
            include: { account: true, template: true },
          });
          getIO()?.emit("broadcast_update", {
            ...finalBroadcast,
            account: sanitizeAccount(finalBroadcast.account),
          });
        },

        onAuditLog: (action, metadata) =>
          logAction(action, "Broadcast", broadcastId, metadata),

        onProgress: ({ done, total, accountId }) => {
          getIO()?.emit("broadcast_progress", {
            broadcastId,
            progress: Math.round((done / total) * 100),
            current: done,
            total,
            accountId,
          });
        },

        checkPaused: async () => {
          // 1. Check Global Pause
          const globalConfig = await prisma.systemConfig.findUnique({
            where: { id: "global" },
          });
          if (globalConfig?.isPaused) return true;

          // 2. Check Individual Broadcast Pause/Cancel
          const broadcast = await prisma.broadcast.findUnique({
            where: { id: broadcastId },
          });
          if (broadcast?.isPaused || broadcast?.status === "cancelled")
            return true;

          // 3. Dynamic Safety: Failure Threshold
          // Stop if > 50% failure rate after 10 messages
          const logs = await prisma.messageLog.findMany({
            where: { broadcastId },
            select: { status: true },
          });
          const failed = logs.filter((l) => l.status === "failed").length;
          const total = logs.length;
          if (total >= 10 && failed / total > 0.5) {
            console.error(
              `[Safety] High failure rate detected (${failed}/${total}). Auto-pausing broadcast ${broadcastId}`,
            );
            await prisma.broadcast.update({
              where: { id: broadcastId },
              data: {
                isPaused: true,
                stopReason: "High failure rate threshold exceeded (>50%)",
              },
            });
            return true;
          }

          return false;
        },
      });
    } catch (err) {
      console.error(`[Job ${job.id}] Engine failure:`, err.message);
      await prisma.broadcast.update({
        where: { id: broadcastId },
        data: { status: "failed", results: { error: err.message } },
      });
      throw err; // Allow BullMQ to handle retry
    }
  },
  { connection, concurrency: 1 },
); // Sequential processing per worker for safety

worker.on("completed", (job) => {
  console.log(`[Job ${job.id}] Completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`[Job ${job.id}] Failed: ${err.message}`);
});

export default worker;
