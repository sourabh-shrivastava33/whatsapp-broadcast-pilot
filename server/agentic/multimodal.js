import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../logger.js";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

/**
 * Enriches a message with Gemini's visual or auditory understanding.
 * Returns a text description that can be fed into the primary Agent.
 */
export async function enrichMultimodalContext({ mediaUrl, type, mimeType, account }) {
  if (!process.env.GEMINI_API_KEY) {
    logger.warn("GEMINI_API_KEY missing. Skipping multimodal enrichment.");
    return null;
  }

  try {
    logger.info(`🔮 Gemini processing ${type}...`);

    // 1. Download the media
    const response = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${account.accessToken}` }
    });

    if (!response.ok) throw new Error("Failed to download media for Gemini");

    const buffer = await response.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString("base64");

    // 2. Prepare the prompt based on type
    let prompt = "";
    if (type === 'image') {
      prompt = "You are a Real Estate Assistant. Describe this image in detail. If it's a floorplan, list BHK and dimensions. If it's a receipt, list amount and date. If it's a property photo, describe the condition and amenities.";
    } else if (type === 'audio') {
      prompt = "You are a Real Estate Assistant. Transcribe this audio message accurately. If it's in Hindi or Hinglish, provide the transcript in that language.";
    } else if (type === 'document') {
      prompt = "Summarize this document and extract key real estate information like project name, price, or legal terms.";
    }

    // 3. Call Gemini
    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType || getMimeType(type)
        }
      }
    ]);

    const description = result.response.text();
    logger.info(`✅ Gemini Enrichment Complete: ${description.substring(0, 50)}...`);
    
    return description;
  } catch (error) {
    logger.error(`Gemini Multimodal Error: ${error.message}`);
    return null;
  }
}

function getMimeType(type) {
  switch (type) {
    case 'image': return 'image/jpeg';
    case 'audio': return 'audio/ogg'; // WhatsApp default
    case 'video': return 'video/mp4';
    case 'document': return 'application/pdf';
    default: return 'application/octet-stream';
  }
}
