import { Worker } from 'bullmq';
import { connection } from '../queue.js';
import { prisma } from '../db.js';
import { logger } from '../logger.js';
import { getIO } from '../socket.js';
import { runAgentFlow } from './runner.js';
import { sendWhatsAppMessage } from '../whatsapp.js';
import { enrichMultimodalContext } from './multimodal.js';

export const agentWorker = new Worker(
  'incoming-message-queue',
  async (job) => {
    const start = Date.now();
    const { payload, accountId, contactId, correlationId } = job.data;

    logger.info(`🤖 Agent Worker processing message: ${job.id}`, { correlationId });

    try {
      // 1. Resolve Contact & Account
      const [contact, account] = await Promise.all([
        prisma.contact.findUnique({ where: { id: contactId } }),
        prisma.account.findUnique({ where: { id: accountId } })
      ]);

      if (!contact || !account) {
        logger.error(`Contact or Account missing. Skipping job ${job.id}`);
        return;
      }

      // 2. Handle Multimodal Enrichment (Gemini 1.5 Pro)
      let effectiveBody = payload.body || "";
      if (payload.type !== 'text' && payload.mediaUrl) {
        logger.info(`🔮 Media detected (${payload.type}). Calling Gemini for enrichment...`);
        const enrichment = await enrichMultimodalContext({
          mediaUrl: payload.mediaUrl,
          type: payload.type,
          account
        });

        if (enrichment) {
          effectiveBody = `[USER SENT ${payload.type.toUpperCase()}: ${enrichment}] ${effectiveBody}`;
        } else {
          effectiveBody = `[SYSTEM NOTE: The user sent a ${payload.type}. Please acknowledge it professionally and ask if they have any specific questions about it.] ${effectiveBody}`;
        }
      }

      if (!effectiveBody.trim() && payload.type === 'text') {
        logger.warn(`Skipping empty text message for contact ${contactId}`);
        return;
      }

      // 3. Run AI Agent Flow (The reasoning part)
      const agentStart = Date.now();
      const { reply, traceId } = await runAgentFlow({ 
        contactId, 
        accountId, 
        messageBody: effectiveBody,
        metaMessageId: payload.metaId,
      });
      const agentDuration = Date.now() - agentStart;

      if (!reply) {
        logger.warn(`Agent generated an empty reply for contact ${contactId}`);
        return;
      }

      // 4. Send Message via WhatsApp
      const sendResult = await sendWhatsAppMessage({
        account,
        to: contact.phone,
        body: reply
      });

      if (!sendResult.success) {
        throw new Error(`Failed to send AI reply: ${sendResult.error}`);
      }

      // 5. Persist AI Message
      const chatMsg = await prisma.chatMessage.create({
        data: {
          contactId: contact.id,
          accountId: account.id,
          fromMe: true,
          type: 'text',
          body: reply,
          metaMessageId: sendResult.metaMessageId,
          timestamp: new Date(),
        },
      });

      // 6. Update Contact
      const updatedContact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lastReplyAt: new Date(),
          lastMessageAt: new Date(),
        },
      });

      // 7. Notify UI
      getIO()?.emit('new_message', {
        message: chatMsg,
        contact: updatedContact,
      });

      const totalDuration = Date.now() - start;
      logger.info(`✅ Agent replied to ${contact.phone} in ${totalDuration}ms (AI Reasoning: ${agentDuration}ms)`, { correlationId, traceId });
      
    } catch (error) {
      logger.error(`Error in Agent Worker: ${error.message}`, { correlationId, stack: error.stack });
      throw error;
    }
  },
  { 
    connection,
    concurrency: 5
  }
);

agentWorker.on('failed', (job, err) => {
  logger.error(`❌ Agent Job ${job.id} failed: ${err.message}`);
});

logger.info('🚀 Agent Worker with Multimodal Intelligence Active');
