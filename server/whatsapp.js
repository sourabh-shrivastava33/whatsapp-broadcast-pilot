import { fetchWithTimeout } from './utils.js';
import { META_API_BASE_URL, META_API_VERSION } from './constants.js';
import { logger } from './logger.js';

/**
 * Sends a free-form text message via WhatsApp Cloud API.
 */
export async function sendWhatsAppMessage({ account, to, body }) {
  try {
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${account.phoneNumberId}/messages`;
    
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Meta API Error");
    }

    return { success: true, metaMessageId: data.messages?.[0]?.id };
  } catch (error) {
    logger.error(`Failed to send WhatsApp message: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Resolves a Meta Media ID to a temporary download URL.
 */
export async function getWhatsAppMediaUrl({ account, mediaId }) {
  try {
    const url = `${META_API_BASE_URL}/${META_API_VERSION}/${mediaId}`;
    
    const response = await fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Meta Media API Error");
    }

    return { success: true, url: data.url };
  } catch (error) {
    logger.error(`Failed to fetch Meta media URL: ${error.message}`);
    return { success: false, error: error.message };
  }
}
