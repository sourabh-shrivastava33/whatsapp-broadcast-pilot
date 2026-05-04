import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import { prisma } from "./db.js";
import fs from "fs";
import path from "path";
import multer from "multer";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import {
  BROADCAST_STATUS,
  TEMPLATE_STATUS,
  META_API_BASE_URL,
  META_API_VERSION,
  QUALITY_RATINGS,
} from "./constants.js";
import { TIER_LIMITS } from "./broadcastEngine.js";
import http from "http";
import crypto from "crypto";
import { logger } from "./logger.js";
import {
  sendSuccess,
  sendError,
  calculateHash,
  sanitizeAccount,
  fetchWithTimeout,
  normalizePhone,
  logAction,
} from "./utils.js";
import { initSocket, getIO } from "./socket.js";
import { getWhatsAppMediaUrl } from "./whatsapp.js";
import { getInboundOptInData } from "./leadOptIn.js";

dotenv.config();

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

// prisma imported from ./db.js

const app = express();
app.set("trust proxy", 1); // Fix for express-rate-limit when using ngrok/proxies

// ─── Security Headers (Helmet) ────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled: frontend is served separately; enabling breaks API responses
    crossOriginEmbedderPolicy: false,
  }),
);

// ─── CORS ─────────────────────────────────────────────────────────
const corsOptions = {
  origin: IS_PRODUCTION ? ALLOWED_ORIGIN : "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};
app.use(cors(corsOptions));

const httpServer = http.createServer(app);
const io = initSocket(httpServer, {
  cors: {
    origin: IS_PRODUCTION ? ALLOWED_ORIGIN : "*",
    methods: ["GET", "POST"],
  },
});

// ─── Middleware ───────────────────────────────────────────────────

// Correlation ID & Request Logger
app.use((req, res, next) => {
  req.correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
  res.setHeader("X-Correlation-Id", req.correlationId);

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} ${res.statusCode} (${duration}ms)`, {
      correlationId: req.correlationId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
  });
  next();
});

// ─── Rate Limiters ────────────────────────────────────────────────

/** General API limiter: 200 requests per 15 minutes per IP */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Import worker AFTER io is initialized to avoid circular dependency
import { broadcastQueue, incomingMessageQueue } from "./queue.js";
import "./worker.js";
import "./agentic/worker.js";

/** Broadcast limiter: 10 per 15 minutes (prevent runaway broadcast triggers) */
const broadcastLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Broadcast rate limit exceeded. Max 10 broadcasts per 15 minutes.",
  },
});

/** Webhook limiter: 1000 per 15 minutes (Meta sends bursts of status updates) */
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => false,
});

app.use("/api/webhooks", webhookLimiter);
app.use("/api", generalLimiter);

// fetchWithTimeout moved to utils.js

const PORT = process.env.PORT || 3001;

// ============================================
// Security: Webhook Signature Verification
// ============================================
const verifyMetaSignature = (req, res, buf, encoding) => {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) {
    req.isMetaVerified = false;
    return;
  }

  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    console.warn(
      "META_APP_SECRET not set, skipping signature verification (NOT SECURE)",
    );
    req.isMetaVerified = true;
    return;
  }

  const elements = signature.split("=");
  const signatureHash = elements[1];
  const expectedHash = crypto
    .createHmac("sha256", appSecret)
    .update(buf)
    .digest("hex");

  req.isMetaVerified = signatureHash === expectedHash;
};

app.use(express.json({ verify: verifyMetaSignature }));
app.use("/uploads", express.static("uploads"));

// ============================================
// Media Storage Configuration
// ============================================

// ============================================
// Media Storage Configuration (Supabase Cloud)
// ============================================

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY; // Use Secret Key for backend

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ CRITICAL: Supabase credentials missing in .env");
} else {
  console.log(`☁️ Supabase Cloud Storage Initialized: ${supabaseUrl}`);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const storage = multer.memoryStorage(); // Stream directly to memory

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// ============================================
// Media API
// ============================================

app.post("/api/media/upload", upload.single("file"), async (req, res) => {
  const { correlationId } = req;
  if (!req.file) {
    return sendError(res, null, "No file uploaded", 400, { correlationId });
  }

  try {
    const file = req.file;
    const { tags, campaign, language, purpose, folderId } = req.body;

    // 1. Calculate Hash for Duplicate Detection
    const hash = calculateHash(file.buffer);
    const existingMedia = await prisma.media.findFirst({
      where: { metadata: { path: ["hash"], equals: hash } },
    });

    if (existingMedia) {
      logger.info(`♻️ Duplicate media detected: ${existingMedia.id}`, {
        correlationId,
      });
      return sendSuccess(res, existingMedia);
    }

    const fileExt = path.extname(file.originalname);
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${fileExt}`;

    // 2. Upload to Supabase 'media' bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return sendError(res, uploadError, "Cloud storage upload failed", 500, {
        correlationId,
      });
    }

    // 3. Get Public URL
    const { data: urlData } = supabase.storage
      .from("media")
      .getPublicUrl(fileName);
    const fileUrl = urlData.publicUrl;

    // 4. Determine media type based on mimetype
    let type = "DOCUMENT";
    if (file.mimetype.startsWith("image/")) type = "IMAGE";
    else if (file.mimetype.startsWith("video/")) type = "VIDEO";
    else if (file.mimetype.startsWith("audio/")) type = "AUDIO";

    // 5. Save to Database
    const media = await prisma.media.create({
      data: {
        url: fileUrl,
        filename: fileName,
        type: type,
        size: file.size,
        tags: tags ? (typeof tags === "string" ? JSON.parse(tags) : tags) : [],
        campaign: campaign || null,
        language: language || null,
        purpose: purpose || null,
        folderId: folderId || null,
        metadata: {
          hash,
          mimetype: file.mimetype,
          originalName: file.originalname,
          // Future: add width, height if image
        },
      },
    });

    logger.info(`✅ Media uploaded successfully: ${media.id}`, {
      correlationId,
    });
    res.json(media);
  } catch (error) {
    return sendError(res, error, "Failed to process media", 500, {
      correlationId,
    });
  }
});

app.get("/api/media", async (req, res) => {
  try {
    const {
      type,
      campaign,
      archived,
      folderId,
      page = 1,
      limit = 20,
      sort = "desc",
      search,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      ...(type && type !== "ALL" && { type }),
      ...(campaign && { campaign }),
      ...(folderId && { folderId }),
      isArchived: archived === "true",
      ...(search && {
        OR: [
          { filename: { contains: search, mode: "insensitive" } },
          { campaign: { contains: search, mode: "insensitive" } },
          { tags: { array_contains: search } },
        ],
      }),
    };

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: sort },
        skip,
        take: parseInt(limit),
        include: { folder: true },
      }),
      prisma.media.count({ where }),
    ]);

    res.json({
      data: media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch media library" });
  }
});

app.post("/api/media/:id/duplicate", async (req, res) => {
  const { correlationId } = req;
  try {
    const original = await prisma.media.findUnique({
      where: { id: req.params.id },
    });
    if (!original)
      return sendError(res, null, "Media not found", 404, { correlationId });

    const copy = await prisma.media.create({
      data: {
        ...original,
        id: undefined,
        filename: `Copy of ${original.filename}`,
        createdAt: undefined,
        updatedAt: undefined,
        usageCount: 0,
      },
    });
    sendSuccess(res, copy);
  } catch (error) {
    sendError(res, error, "Duplication failed", 500, { correlationId });
  }
});

app.patch("/api/media/:id/move", async (req, res) => {
  const { correlationId } = req;
  try {
    const { folderId } = req.body;
    const media = await prisma.media.update({
      where: { id: req.params.id },
      data: { folderId: folderId || null },
    });
    sendSuccess(res, media);
  } catch (error) {
    sendError(res, error, "Move failed", 500, { correlationId });
  }
});

app.get("/api/folders", async (req, res) => {
  try {
    const folders = await prisma.folder.findMany({
      include: { _count: { select: { media: true } } },
      orderBy: { name: "asc" },
    });
    res.json(folders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch folders" });
  }
});

app.post("/api/folders", async (req, res) => {
  try {
    const { name, parentId } = req.body;
    const folder = await prisma.folder.create({
      data: { name, parentId },
    });
    res.json(folder);
  } catch (error) {
    res.status(500).json({ error: "Failed to create folder" });
  }
});

app.patch("/api/media/:id", async (req, res) => {
  const { correlationId } = req;
  try {
    const { tags, campaign, language, purpose, status, isArchived } = req.body;
    const media = await prisma.media.update({
      where: { id: req.params.id },
      data: {
        ...(tags && { tags }),
        ...(campaign !== undefined && { campaign }),
        ...(language !== undefined && { language }),
        ...(purpose !== undefined && { purpose }),
        ...(status && { status }),
        ...(isArchived !== undefined && { isArchived }),
      },
    });
    sendSuccess(res, media);
  } catch (error) {
    sendError(res, error, "Update failed", 500, { correlationId });
  }
});

app.post("/api/media/:id/archive", async (req, res) => {
  const { correlationId } = req;
  try {
    const media = await prisma.media.update({
      where: { id: req.params.id },
      data: {
        isArchived: true,
        status: "archived",
      },
    });
    sendSuccess(res, media);
  } catch (error) {
    sendError(res, error, "Archive failed", 500, { correlationId });
  }
});

app.get("/api/media/:id/usage", async (req, res) => {
  const { correlationId } = req;
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
    });
    if (!media)
      return sendError(res, null, "Media not found", 404, { correlationId });

    // Find templates using this URL
    const templates = await prisma.template.findMany({
      where: { mediaUrl: media.url },
      select: { id: true, name: true, status: true },
    });

    // Find chat messages using this URL
    const messages = await prisma.chatMessage.findMany({
      where: { mediaUrl: media.url },
      select: { id: true, contactId: true, timestamp: true },
      take: 10,
    });

    sendSuccess(res, { templates, recentMessages: messages });
  } catch (error) {
    sendError(res, error, "Usage fetch failed", 500, { correlationId });
  }
});

app.delete("/api/media/:id", async (req, res) => {
  const { correlationId } = req;
  try {
    const media = await prisma.media.findUnique({
      where: { id: req.params.id },
    });
    if (!media)
      return sendError(res, null, "Media not found", 404, { correlationId });

    // Safety check: is it used in any templates?
    const usageCount = await prisma.template.count({
      where: { mediaUrl: media.url },
    });

    if (usageCount > 0) {
      return sendError(
        res,
        null,
        "Cannot delete media currently in use by templates",
        400,
        { correlationId },
      );
    }

    // Delete from Supabase
    const { error: storageError } = await supabase.storage
      .from("media")
      .remove([media.filename]);

    if (storageError) {
      logger.error("Supabase delete error", {
        correlationId,
        error: storageError,
      });
      // Proceed with DB delete anyway if storage is gone or error is just "not found"
    }

    await prisma.media.delete({ where: { id: req.params.id } });
    sendSuccess(res, { success: true });
  } catch (error) {
    sendError(res, error, "Delete failed", 500, { correlationId });
  }
});

app.get("/api/media/:filename", (req, res) => {
  const filePath = path.join(process.cwd(), "uploads", req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

// Utility functions moved to utils.js

// ============================================
// Audit Log API
// ============================================

app.get("/api/audit-logs", async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

// ============================================
// Meta Media Resolution Helper
// ============================================

/**
 * Resolves a Meta media handle or ID to a local URL by downloading it.
 */
async function resolveMetaMedia(handle, accessToken) {
  if (!handle) return null;

  // If it's already a full URL (often the case with some Meta API responses), return it directly
  if (handle.startsWith("http")) return handle;

  try {
    // 1. Get metadata for the handle/ID
    const metadataRes = await fetchWithTimeout(
      `${META_API_BASE_URL}/${META_API_VERSION}/${handle}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const metadata = await metadataRes.json();
    if (!metadataRes.ok || !metadata.url) {
      console.warn(
        `[MediaResolve] Failed to get metadata for ${handle}:`,
        metadata.error?.message,
      );
      return null;
    }

    // 2. Download the file
    const fileRes = await fetchWithTimeout(metadata.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) return null;

    const buffer = await fileRes.arrayBuffer();
    const extension = metadata.mime_type?.split("/")[1]?.split(";")[0] || "png";
    const filename = `synced-${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    const filePath = path.join("uploads", filename);

    if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");
    fs.writeFileSync(filePath, Buffer.from(buffer));

    // Determine the host for the local URL
    const host = process.env.BACKEND_URL || "http://localhost:3001";
    return `${host}/uploads/${filename}`;
  } catch (err) {
    console.error(`[MediaResolve] Error resolving ${handle}:`, err.message);
    return null;
  }
}

function parseMetaComponents(metaComponents) {
  let header = "";
  let body = "";
  let footer = "";
  let buttons = [];
  let variables = [];
  let headerType = "TEXT";
  let mediaHandle = null;
  let limitedTimeOffer = null;

  for (const comp of metaComponents) {
    if (comp.type === "HEADER") {
      header = comp.text || "";
      headerType = comp.format || "TEXT";
      // Extract media handle if available
      if (headerType !== "TEXT" && comp.example?.header_handle?.[0]) {
        mediaHandle = comp.example.header_handle[0];
      }
    } else if (comp.type === "BODY") body = comp.text || "";
    else if (comp.type === "FOOTER") footer = comp.text || "";
    else if (comp.type === "LIMITED_TIME_OFFER") {
      limitedTimeOffer = comp.limited_time_offer || {
        text: "Flash Sale!",
        has_expiration: true,
      };
    } else if (comp.type === "BUTTONS") {
      buttons = (comp.buttons || []).map((btn) => {
        // Map Meta button types to our local types
        let type = btn.type;
        if (type === "PHONE_NUMBER") type = "PHONE_NUMBER";
        else if (type === "URL") type = "URL";
        else if (type === "QUICK_REPLY") type = "QUICK_REPLY";
        else if (type === "OTP")
          type = "OTP"; // New for Authentication
        else if (type === "CATALOG") type = "CATALOG"; // New for Utility

        return {
          type,
          text: btn.text,
          url: btn.url,
          phone_number: btn.phone_number,
          otp_type: btn.otp_type,
          autofill_text: btn.autofill_text,
          package_name: btn.package_name,
          signature_hash: btn.signature_hash,
        };
      });
    }
  }

  const getVarNums = (text) => {
    if (!text) return [];
    const matches = [...text.matchAll(/\{\{(\d+)\}\}/g)];
    return [...new Set(matches.map((m) => m[1]))].sort(
      (a, b) => Number(a) - Number(b),
    );
  };

  const bodyVars = getVarNums(body);
  const headerVars = getVarNums(header);
  const allVarNums = [...new Set([...bodyVars, ...headerVars])].sort(
    (a, b) => Number(a) - Number(b),
  );

  const bodyComp = metaComponents.find((c) => c.type === "BODY");
  const headerComp = metaComponents.find((c) => c.type === "HEADER");

  variables = allVarNums.map((num) => {
    let sample = "sample";
    if (bodyComp?.example?.body_text?.[0]) {
      const idx = bodyVars.indexOf(num);
      if (idx !== -1 && bodyComp.example.body_text[0][idx])
        sample = bodyComp.example.body_text[0][idx];
    }
    if (headerComp?.example?.header_text?.[0]) {
      const idx = headerVars.indexOf(num);
      if (idx !== -1 && headerComp.example.header_text[idx])
        sample = headerComp.example.header_text[idx];
    }
    return { num, sample };
  });

  return {
    header,
    body,
    footer,
    buttons,
    variables,
    headerType,
    mediaHandle,
    limitedTimeOffer,
  };
}

// ============================================
// Meta API Integration
// ============================================

app.post("/api/meta/discover", async (req, res) => {
  const { businessId, accessToken } = req.body;
  if (!businessId || !accessToken) {
    return res
      .status(400)
      .json({ error: "businessId and accessToken are required" });
  }

  try {
    let discoveredNumbers = [];
    let lastError = null;

    // Strategy 1: Owned WABAs
    const ownedRes = await fetchWithTimeout(
      `${META_API_BASE_URL}/${META_API_VERSION}/${businessId}/owned_whatsapp_business_accounts`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    let wabaData = await ownedRes.json();

    if (wabaData.error) {
      // Strategy 2: Client WABAs
      const clientRes = await fetchWithTimeout(
        `${META_API_BASE_URL}/${META_API_VERSION}/${businessId}/client_whatsapp_business_accounts`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      wabaData = await clientRes.json();
    }

    if (!wabaData.error && wabaData.data) {
      for (const waba of wabaData.data) {
        const phoneRes = await fetchWithTimeout(
          `${META_API_BASE_URL}/${META_API_VERSION}/${waba.id}/phone_numbers`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );
        const phoneData = await phoneRes.json();
        if (!phoneData.error && phoneData.data) {
          phoneData.data.forEach((phone) => {
            discoveredNumbers.push({
              phoneNumberId: phone.id,
              displayPhoneNumber: phone.display_phone_number,
              verifiedName: phone.verified_name,
              qualityRating: phone.quality_rating || QUALITY_RATINGS.UNKNOWN,
              wabaId: waba.id,
              wabaName: waba.name || "WhatsApp Business Account",
              accessToken,
            });
          });
        }
      }
    }

    // Strategy 3: Direct WABA ID
    if (discoveredNumbers.length === 0) {
      const directRes = await fetchWithTimeout(
        `${META_API_BASE_URL}/${META_API_VERSION}/${businessId}/phone_numbers`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      const directData = await directRes.json();
      if (!directData.error && directData.data) {
        directData.data.forEach((phone) => {
          discoveredNumbers.push({
            phoneNumberId: phone.id,
            displayPhoneNumber: phone.display_phone_number,
            verifiedName: phone.verified_name,
            qualityRating: phone.quality_rating || QUALITY_RATINGS.UNKNOWN,
            wabaId: businessId,
            wabaName: "WhatsApp Business Account",
            accessToken,
          });
        });
      } else {
        lastError = directData.error?.message || wabaData.error?.message;
      }
    }

    if (discoveredNumbers.length > 0) {
      res.json({ numbers: discoveredNumbers });
    } else {
      res.status(400).json({ error: lastError || "No numbers found." });
    }
  } catch (error) {
    res.status(500).json({ error: "Discovery failed" });
  }
});

app.post("/api/meta/sync-templates", async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { isActive: true, isArchived: false },
    });
    if (accounts.length === 0)
      return res.status(400).json({ error: "No active accounts" });

    let totalSynced = 0;
    let errors = [];

    for (const account of accounts) {
      const response = await fetchWithTimeout(
        `${META_API_BASE_URL}/${META_API_VERSION}/${account.wabaId}/message_templates?fields=name,status,rejected_reason,category,language,components&limit=1000`,
        {
          headers: { Authorization: `Bearer ${account.accessToken}` },
        },
      );
      const data = await response.json();
      if (data.error) {
        errors.push(`${account.displayName}: ${data.error.message}`);
        continue;
      }
      if (data.data) {
        for (const metaTpl of data.data) {
          const {
            header,
            body,
            footer,
            buttons,
            variables,
            headerType,
            mediaHandle,
            limitedTimeOffer,
          } = parseMetaComponents(metaTpl.components);

          let status = metaTpl.status.toLowerCase();
          if (status.includes("pending")) status = TEMPLATE_STATUS.PENDING;
          else if (status.includes("approved"))
            status = TEMPLATE_STATUS.APPROVED;
          else if (status.includes("rejected"))
            status = TEMPLATE_STATUS.REJECTED;

          // Attempt to resolve media if handle is present
          let mediaUrl = null;
          if (mediaHandle) {
            console.log(`[Sync] Resolving media for template: ${metaTpl.name}`);
            mediaUrl = await resolveMetaMedia(mediaHandle, account.accessToken);
          }

          await prisma.template.upsert({
            where: { metaTemplateId: metaTpl.id },
            update: {
              name: metaTpl.name,
              status,
              category: metaTpl.category,
              language: metaTpl.language,
              header,
              headerType,
              mediaUrl: mediaUrl || undefined, // Only update if we resolved a new one
              body,
              footer,
              buttons,
              variables,
              rejectionReason: metaTpl.rejected_reason || null,
              isArchived: false,
              wabaId: account.wabaId,
            },
            create: {
              metaTemplateId: metaTpl.id,
              name: metaTpl.name,
              status,
              category: metaTpl.category,
              language: metaTpl.language,
              header,
              headerType,
              mediaUrl,
              body,
              footer,
              buttons,
              variables,
              rejectionReason: metaTpl.rejected_reason || null,
              wabaId: account.wabaId,
            },
          });
          totalSynced++;
        }
      }
    }
    res.json({
      success: true,
      count: totalSynced,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("DEBUG: Sync templates error:", error);
    res.status(500).json({ error: "Sync failed", details: error.message });
  }
});

app.post("/api/meta/sync-account", async (req, res) => {
  const {
    phoneNumberId,
    verifiedName,
    displayPhoneNumber,
    qualityRating,
    wabaId,
    wabaName,
    accessToken,
  } = req.body;
  try {
    const account = await prisma.account.upsert({
      where: { phoneNumberId },
      update: {
        displayName: verifiedName || displayPhoneNumber,
        accessToken,
        businessLabel: wabaName || "",
        qualityRating: qualityRating || QUALITY_RATINGS.UNKNOWN,
        wabaId: wabaId || "",
        displayPhoneNumber: displayPhoneNumber || "",
        isActive: true,
        isArchived: false,
      },
      create: {
        displayName: verifiedName || displayPhoneNumber,
        phoneNumberId,
        accessToken,
        businessLabel: wabaName || "",
        qualityRating: qualityRating || QUALITY_RATINGS.UNKNOWN,
        wabaId: wabaId || "",
        displayPhoneNumber: displayPhoneNumber || "",
        isActive: true,
      },
    });
    res.status(201).json(sanitizeAccount(account));
  } catch (error) {
    res.status(500).json({ error: "Account sync failed" });
  }
});

// ============================================
// Accounts API
// ============================================

app.get("/api/accounts", async (req, res) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { isArchived: false },
    });
    res.json(sanitizeAccount(accounts));
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.get("/api/accounts/:id/health", async (req, res) => {
  const { correlationId } = req;
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.params.id },
    });
    if (!account)
      return sendError(res, null, "Account not found", 404, { correlationId });

    logger.info(`🏥 Deep Health Check: ${account.displayName}`, {
      correlationId,
    });

    // 1. Fetch Phone Metrics
    const phoneRes = await fetchWithTimeout(
      `${META_API_BASE_URL}/${META_API_VERSION}/${account.phoneNumberId}?fields=messaging_limit_tier,quality_rating,status,id,display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${account.accessToken}` } },
    );
    const phoneData = await phoneRes.json();

    if (!phoneRes.ok) {
      const isExpired =
        phoneData.error?.code === 190 ||
        phoneData.error?.error_subcode === 463 ||
        phoneData.error?.error_subcode === 467;
      const errorMsg = isExpired
        ? "Meta Session Expired. Please update your Access Token in Account Settings."
        : "Meta Phone API Error";
      logger.warn(`⚠️ Phone health check failed`, {
        correlationId,
        error: phoneData.error,
      });
      return sendError(
        res,
        phoneData.error,
        errorMsg,
        isExpired ? 401 : phoneRes.status,
        { correlationId },
      );
    }

    // 2. Fetch WABA Metrics
    const wabaRes = await fetchWithTimeout(
      `${META_API_BASE_URL}/${META_API_VERSION}/${account.wabaId}?fields=id,name,status,account_mode`,
      { headers: { Authorization: `Bearer ${account.accessToken}` } },
    );
    const wabaData = await wabaRes.json();

    if (!wabaRes.ok) {
      logger.warn(`⚠️ WABA health check failed`, {
        correlationId,
        error: wabaData.error,
      });
    }

    // 2.5 Fetch Templates for Quality Overview
    const templatesRes = await fetchWithTimeout(
      `${META_API_BASE_URL}/${META_API_VERSION}/${account.wabaId}/message_templates?limit=5`,
      { headers: { Authorization: `Bearer ${account.accessToken}` } },
    );
    const templatesData = await templatesRes.json();
    const templates = templatesData.data || [];

    // 3. Calculate Precise Health Score (Weighted Algorithm)
    let score = 100;

    // Quality Signal (Weight: 60%)
    if (phoneData.quality_rating === "YELLOW") score -= 30;
    else if (phoneData.quality_rating === "RED") score -= 60;
    else if (
      !phoneData.quality_rating ||
      phoneData.quality_rating === "UNKNOWN"
    )
      score -= 15;

    // Account Verification & Mode (Weight: 20%)
    if (wabaData.status !== "APPROVED") score -= 25;
    if (wabaData.account_mode === "SANDBOX") score -= 10;

    // Phone Connectivity (Weight: 20%)
    if (phoneData.status !== "CONNECTED") {
      if (phoneData.status === "FLAGGED" || phoneData.status === "BLOCKED")
        score -= 40;
      else score -= 20;
    }

    // Tier Penalty
    if (phoneData.messaging_limit_tier === "TIER_100") score -= 5;

    score = Math.max(0, score);

    // 4. Update Database Cache (Aligned with latest Meta Tiers: 250, 2K, 10K, 100K)
    const tierMap = {
      TIER_NOT_SET: 250,
      TIER_250: 250,
      TIER_1K: 1000,
      TIER_2K: 2000,
      TIER_10K: 10000,
      TIER_100K: 100000,
      TIER_UNLIMITED: 999999,
    };
    const limit = tierMap[phoneData.messaging_limit_tier] || 250;

    const updateData = {
      qualityRating: phoneData.quality_rating || "UNKNOWN",
      messagingLimit: limit,
      healthScore: score,
      accountMode: wabaData.account_mode || "SANDBOX",
    };

    logger.info(`📝 Updating account health in DB for ${account.id}`, {
      correlationId,
      updateData,
    });

    try {
      await prisma.account.update({
        where: { id: account.id },
        data: updateData,
      });
    } catch (dbError) {
      logger.error(
        `❌ Prisma update failed for account health: ${dbError.message}`,
        { correlationId, error: dbError },
      );
      // We don't want to fail the whole health check if DB update fails, but we should know why
    }

    // 5. Calculate Real Usage (Last 24h) from local activity
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [businessUsage, userUsage] = await Promise.all([
      prisma.messageLog.count({
        where: {
          broadcast: { accountId: account.id },
          sentAt: { gte: dayAgo },
          status: { in: ["sent", "delivered", "read"] },
        },
      }),
      prisma.chatMessage.count({
        where: {
          accountId: account.id,
          fromMe: false,
          timestamp: { gte: dayAgo },
        },
      }),
    ]);

    // Calculate dynamic reset time (Next UTC Midnight)
    const now = new Date();
    const nextMidnight = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
    );
    const diff = nextMidnight - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const resetStr = `${hours}h ${minutes}m`;

    return sendSuccess(res, {
      data: {
        score,
        status: phoneData.status || "UNKNOWN",
        quality: phoneData.quality_rating || "UNKNOWN",
        tier: phoneData.messaging_limit_tier || "TIER_NOT_SET",
        limit,
        mode: wabaData.account_mode || "SANDBOX",
        wabaStatus: wabaData.status || "UNKNOWN",
        verifiedName: phoneData.verified_name || account.displayName,
        displayPhoneNumber:
          phoneData.display_phone_number || account.displayPhoneNumber,
        id: account.id,
        lastUpdated: new Date(),
        alerts: deriveAlerts(phoneData, wabaData, score),
        recommendations: deriveRecommendations(phoneData, wabaData, score),
        templates: templates.map((t) => ({
          name: t.name,
          category: t.category,
          status: t.status,
          quality: t.quality_score?.score || "UNKNOWN",
          lastUpdated: new Date(),
        })),
        risk: {
          restrictions:
            wabaData.status === "APPROVED" ? "None" : wabaData.status,
          violations: 0,
          spamRate:
            phoneData.quality_rating === "GREEN"
              ? "Low"
              : phoneData.quality_rating === "YELLOW"
                ? "Medium"
                : "High",
          blocks:
            phoneData.quality_rating === "GREEN"
              ? "0.01%"
              : phoneData.quality_rating === "YELLOW"
                ? "0.45%"
                : "2.10%",
          reports: phoneData.quality_rating === "GREEN" ? "0.00%" : "0.05%",
        },
        usage: {
          businessInitiated: businessUsage,
          userInitiated: userUsage,
          resetTime: resetStr,
        },
      },
    });
  } catch (error) {
    return sendError(res, error, "Comprehensive health check failed", 500, {
      correlationId,
    });
  }
});

/** Helper to derive alerts based on health state */
function deriveAlerts(phone, waba, score) {
  const alerts = [];
  if (phone.quality_rating === "RED")
    alerts.push({
      type: "error",
      message: "Critical: Account quality is RED. High risk of suspension.",
      timestamp: new Date(),
    });
  if (phone.quality_rating === "YELLOW")
    alerts.push({
      type: "warning",
      message: "Warning: Quality dropped to YELLOW. Review recent templates.",
      timestamp: new Date(),
    });
  if (waba.status !== "APPROVED")
    alerts.push({
      type: "error",
      message: `Business account is ${waba.status}. Messaging may be restricted.`,
      timestamp: new Date(),
    });
  if (phone.status !== "CONNECTED")
    alerts.push({
      type: "warning",
      message: `Phone number status is ${phone.status}. Check Meta Dashboard.`,
      timestamp: new Date(),
    });
  if (waba.account_mode === "SANDBOX")
    alerts.push({
      type: "info",
      message: "Account is in Sandbox mode. Limits are heavily restricted.",
      timestamp: new Date(),
    });
  return alerts;
}

/** Helper to derive recommendations */
function deriveRecommendations(phone, waba, score) {
  const recs = [];
  if (score < 90)
    recs.push("Improve template quality to restore your health score.");
  if (waba.account_mode === "SANDBOX")
    recs.push("Complete business verification to move to production.");
  if (phone.messaging_limit_tier === "TIER_1K")
    recs.push(
      "Send 500+ high-quality messages daily to automatically upgrade to Tier 10K.",
    );
  if (phone.quality_rating === "GREEN" && score > 95)
    recs.push("Account is in peak health. Excellent work!");
  return recs;
}

app.put("/api/accounts/:id/enable", async (req, res) => {
  try {
    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: { isActive: true },
    });
    res.json(sanitizeAccount(account));
  } catch (error) {
    res.status(500).json({ error: "Enable failed" });
  }
});

app.put("/api/accounts/:id/disable", async (req, res) => {
  try {
    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json(sanitizeAccount(account));
  } catch (error) {
    res.status(500).json({ error: "Disable failed" });
  }
});

app.delete("/api/accounts/:id", async (req, res) => {
  try {
    await prisma.account.update({
      where: { id: req.params.id },
      data: { isArchived: true, isActive: false },
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// ============================================
// Contacts API
// ============================================

app.patch("/api/contacts/:id", async (req, res) => {
  try {
    const { leadStage, brokerageNotes, notes, tags } = req.body;
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: { leadStage, brokerageNotes, notes, tags },
    });
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
});

app.get("/api/contacts", async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      orderBy: { updatedAt: "desc" },
    });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.post("/api/contacts", async (req, res) => {
  try {
    let { name, phone, tags, notes } = req.body;
    phone = normalizePhone(phone);
    if (!phone)
      return res.status(400).json({ error: "Valid phone number required" });

    const contact = await prisma.contact.upsert({
      where: { phone },
      update: { name, tags, notes },
      create: { name, phone, tags, notes },
    });
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ error: "Create/Update failed" });
  }
});

app.post("/api/contacts/import", async (req, res) => {
  const { contacts } = req.body;
  if (!Array.isArray(contacts)) {
    return res.status(400).json({ error: "Contacts array is required" });
  }

  let created = 0;
  let updated = 0;
  const errors = [];

  try {
    for (const c of contacts) {
      try {
        const normalizedPhone = normalizePhone(c.phone);
        if (!normalizedPhone) {
          errors.push(`Invalid phone for contact: ${c.name || "Unknown"}`);
          continue;
        }

        const existing = await prisma.contact.findUnique({
          where: { phone: normalizedPhone },
        });

        await prisma.contact.upsert({
          where: { phone: normalizedPhone },
          update: {
            name: c.name || undefined,
            tags: c.tags || undefined,
            notes: c.notes || undefined,
            brokerageNotes: c.brokerageNotes || undefined,
            leadStage: c.leadStage || undefined,
            intentScore: c.intentScore ? Number(c.intentScore) : undefined,
            optInStatus: c.optInStatus || undefined,
            optInMethod: c.optInMethod || undefined,
            optInTimestamp: c.optInTimestamp
              ? new Date(c.optInTimestamp)
              : undefined,
          },
          create: {
            name: c.name || "Unknown",
            phone: normalizedPhone,
            tags: c.tags || [],
            notes: c.notes || "",
            brokerageNotes: c.brokerageNotes || "",
            leadStage: c.leadStage || "NEW",
            intentScore: c.intentScore ? Number(c.intentScore) : 0,
            optInStatus: c.optInStatus || "unknown",
            optInMethod: c.optInMethod || null,
            optInTimestamp: c.optInTimestamp
              ? new Date(c.optInTimestamp)
              : null,
          },
        });

        if (existing) updated++;
        else created++;
      } catch (err) {
        errors.push(`Failed to import ${c.phone}: ${err.message}`);
      }
    }

    await logAction("CONTACT_IMPORT", "Contact", null, {
      count: contacts.length,
      created,
      updated,
      errors: errors.length > 0 ? errors.length : 0,
    });

    res.json({
      success: true,
      processed: contacts.length,
      created,
      updated,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: "Bulk import failed" });
  }
});

// ============================================
// Blocklist API
// ============================================

app.get("/api/contacts/blocklist", async (req, res) => {
  try {
    const blockedContacts = await prisma.contact.findMany({
      where: { isBlocklisted: true },
      orderBy: { updatedAt: "desc" },
    });
    res.json(blockedContacts);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch blocklist" });
  }
});

app.post("/api/contacts/:id/block", async (req, res) => {
  try {
    const { id } = req.params;
    const contact = await prisma.contact.update({
      where: { id },
      data: {
        isBlocklisted: true,
        optInStatus: "opted_out",
        optOutReason: "meta_block",
        optOutTimestamp: new Date(),
      },
    });
    await logAction("CONTACT_BLOCKED", "Contact", id, { phone: contact.phone });

    // Emit socket event for real-time updates
    io.emit("contact_blocked", { contactId: id, phone: contact.phone });

    res.json({ success: true, contact });
  } catch (error) {
    console.error("Block error:", error);
    res.status(500).json({ error: "Failed to block contact" });
  }
});

app.post("/api/contacts/:id/unblock", async (req, res) => {
  try {
    const { id } = req.params;
    const contact = await prisma.contact.update({
      where: { id },
      data: {
        isBlocklisted: false,
        optInStatus: "unknown",
        optOutReason: null,
        optOutTimestamp: null,
      },
    });
    await logAction("CONTACT_UNBLOCKED", "Contact", id, {
      phone: contact.phone,
    });

    // Emit socket event for real-time updates
    io.emit("contact_unblocked", { contactId: id, phone: contact.phone });

    res.json({ success: true, contact });
  } catch (error) {
    console.error("Unblock error:", error);
    res.status(500).json({ error: "Failed to unblock contact" });
  }
});

// ============================================
// Segments API
// ============================================

app.get("/api/segments", async (req, res) => {
  try {
    const segments = await prisma.segment.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(segments);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.post("/api/segments", async (req, res) => {
  try {
    const { name, description, filters } = req.body;
    const segment = await prisma.segment.create({
      data: { name, description, filters },
    });
    await logAction("SEGMENT_CREATE", "Segment", segment.id, { name });
    res.status(201).json(segment);
  } catch (error) {
    res.status(500).json({ error: "Create failed" });
  }
});

app.get("/api/segments/:id/contacts", async (req, res) => {
  try {
    const segment = await prisma.segment.findUnique({
      where: { id: req.params.id },
    });
    if (!segment) return res.status(404).json({ error: "Segment not found" });

    const { tags } = segment.filters || {};

    // Build filter query
    let where = {};
    if (tags && Array.isArray(tags) && tags.length > 0) {
      where.tags = {
        array_contains: tags, // Note: Prisma has different ways to handle Json array filters depending on DB
      };
    }

    // For demo purposes, we'll implement a simple filter
    // If using PostgreSQL, array_contains works. If using SQLite, it's different.
    // The schema says postgresql, so we should use valid Prisma PG filters.

    const contacts = await prisma.contact.findMany();
    const filtered = contacts.filter((c) => {
      if (!tags || tags.length === 0) return true;
      const contactTags = Array.isArray(c.tags)
        ? c.tags
        : JSON.parse(c.tags || "[]");
      return tags.every((t) => contactTags.includes(t));
    });

    res.json(filtered);
  } catch (error) {
    console.error("Filter error:", error);
    res.status(500).json({ error: "Failed to fetch segment contacts" });
  }
});

app.delete("/api/contacts/:id", async (req, res) => {
  try {
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// ============================================
// Templates API
// ============================================

app.get("/api/templates", async (req, res) => {
  try {
    const activeWabas = (
      await prisma.account.findMany({
        where: { isArchived: false, isActive: true },
        select: { wabaId: true },
      })
    ).map((a) => a.wabaId);
    const templates = await prisma.template.findMany({
      where: {
        OR: [{ wabaId: { in: activeWabas.filter(Boolean) } }, { wabaId: null }],
        isArchived: false,
      },
    });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.post("/api/templates", async (req, res) => {
  try {
    const template = await prisma.template.create({
      data: { ...req.body, status: TEMPLATE_STATUS.DRAFT },
    });
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: "Create failed" });
  }
});

app.put("/api/templates/:id", async (req, res) => {
  try {
    const template = await prisma.template.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: "Update failed" });
  }
});

// ============================================
// Meta Media Upload Helper
// ============================================

/**
 * Uploads a file to Meta's Resumable Upload API for Templates.
 * Requires the App ID and a specific upload session.
 */
/**
 * Uploads a file (buffer or local path) to Meta's Resumable API for template samples.
 * Returns the session handle 'h'.
 */
async function uploadMediaToMeta(source, accessToken, appId) {
  try {
    let fileContent;
    let fileName = "sample_media";
    let mimeType = "application/octet-stream";

    if (Buffer.isBuffer(source)) {
      fileContent = source;
    } else if (
      typeof source === "string" &&
      (source.startsWith("http") || source.startsWith("https"))
    ) {
      const res = await fetch(source);
      if (!res.ok)
        throw new Error(`Failed to fetch remote media: ${res.statusText}`);
      fileContent = Buffer.from(await res.arrayBuffer());
      fileName = source.split("/").pop() || fileName;
      mimeType = res.headers.get("content-type") || mimeType;
    } else {
      fileContent = fs.readFileSync(source);
      fileName = path.basename(source);
      const ext = path.extname(source).toLowerCase();
      mimeType =
        ext === ".png"
          ? "image/png"
          : ext === ".jpg" || ext === ".jpeg"
            ? "image/jpeg"
            : ext === ".mp4"
              ? "video/mp4"
              : "application/pdf";
    }

    // 1. Create Upload Session
    const sessionRes = await fetchWithTimeout(
      `${META_API_BASE_URL}/${META_API_VERSION}/${appId}/uploads?file_length=${fileContent.length}&file_type=${mimeType}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const sessionData = await sessionRes.json();
    if (!sessionRes.ok)
      throw new Error(
        sessionData.error?.message || "Failed to create upload session",
      );

    const sessionId = sessionData.id;

    // 2. Upload Content
    const uploadRes = await fetchWithTimeout(
      `${META_API_BASE_URL}/${META_API_VERSION}/${sessionId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          file_offset: "0",
          "Content-Type": "application/octet-stream",
        },
        body: fileContent,
      },
    );
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok)
      throw new Error(
        uploadData.error?.message || "Failed to upload media content",
      );

    return uploadData.h; // The handle
  } catch (error) {
    console.error("❌ Meta Resumable Upload Failed:", error.message);
    throw error;
  }
}

/**
 * Uploads a file to Meta's Media API for use in direct messages.
 * Returns the media ID.
 */
/**
 * Uploads a file (from multer or a remote URL) to Meta's Media API for direct messages.
 * Returns the media ID.
 */
async function uploadMessageMediaToMeta(source, accessToken, phoneNumberId) {
  try {
    const formData = new FormData();
    let fileContent;
    let fileName = "broadcast_media";
    let mimeType = "application/octet-stream";

    if (source && typeof source === "object" && source.buffer) {
      // Multer memory file
      fileContent = source.buffer;
      fileName = source.originalname;
      mimeType = source.mimetype;
    } else if (
      typeof source === "string" &&
      (source.startsWith("http") || source.startsWith("https"))
    ) {
      // Remote URL
      const res = await fetch(source);
      if (!res.ok)
        throw new Error(`Failed to fetch remote media: ${res.statusText}`);
      fileContent = Buffer.from(await res.arrayBuffer());
      fileName = source.split("/").pop() || fileName;
      mimeType = res.headers.get("content-type") || mimeType;
    } else if (source && source.path) {
      // Multer disk file (fallback)
      fileContent = fs.readFileSync(source.path);
      fileName = source.originalname;
      mimeType = source.mimetype;
    } else {
      throw new Error("Invalid media source for Meta upload");
    }

    const blob = new Blob([fileContent], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("messaging_product", "whatsapp");

    const response = await fetchWithTimeout(
      `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formData,
      },
    );

    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error?.message || "Meta Media Upload Failed");

    return data.id;
  } catch (error) {
    console.error("❌ Message Media Upload Failed:", error.message);
    throw error;
  }
}

app.post("/api/templates/:id/submit", async (req, res) => {
  try {
    const appId = process.env.META_APP_ID;
    if (!appId)
      return res.status(400).json({ error: "META_APP_ID missing in .env" });

    const sourceTemplate = await prisma.template.findUnique({
      where: { id: req.params.id },
    });
    const activeAccounts = await prisma.account.findMany({
      where: { isActive: true, isArchived: false },
    });
    if (!sourceTemplate || activeAccounts.length === 0)
      return res
        .status(400)
        .json({ error: "Invalid state: No active accounts found" });

    // Construct components...
    const getVarNums = (text) =>
      text
        ? [
            ...new Set([...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])),
          ].sort((a, b) => Number(a) - Number(b))
        : [];
    const allVars = Array.isArray(sourceTemplate.variables)
      ? sourceTemplate.variables
      : [];
    const getSample = (num) =>
      allVars.find((v) => String(v.num) === String(num))?.sample || "sample";

    const bodyVars = getVarNums(sourceTemplate.body);
    const bodyComp = { type: "BODY", text: sourceTemplate.body };
    if (bodyVars.length > 0)
      bodyComp.example = { body_text: [bodyVars.map(getSample)] };
    const components = [bodyComp];

    // Handle Media Header
    let mediaHandle = null;
    if (sourceTemplate.headerType !== "TEXT" && sourceTemplate.mediaUrl) {
      console.log(
        `📤 Uploading media to Meta for template approval: ${sourceTemplate.mediaUrl}`,
      );
      mediaHandle = await uploadMediaToMeta(
        sourceTemplate.mediaUrl,
        activeAccounts[0].accessToken,
        appId,
      );

      const headerComp = {
        type: "HEADER",
        format: sourceTemplate.headerType,
      };

      if (mediaHandle) {
        headerComp.example = { header_handle: [mediaHandle] };
      } else if (sourceTemplate.mediaUrl) {
        // Fallback to URL if it's not local or upload failed but we want to try anyway
        headerComp.example = { header_handle: [sourceTemplate.mediaUrl] };
      }

      components.unshift(headerComp);
    } else if (sourceTemplate.header) {
      const headerVars = getVarNums(sourceTemplate.header);
      const headerComp = {
        type: "HEADER",
        format: "TEXT",
        text: sourceTemplate.header,
      };
      if (headerVars.length > 0)
        headerComp.example = { header_text: headerVars.map(getSample) };
      components.unshift(headerComp);
    }
    if (sourceTemplate.footer && sourceTemplate.category !== "AUTHENTICATION")
      components.push({ type: "FOOTER", text: sourceTemplate.footer });

    // Handle Limited Time Offer (Marketing only)
    if (
      sourceTemplate.category === "MARKETING" &&
      sourceTemplate.limitedTimeOffer
    ) {
      components.push({
        type: "LIMITED_TIME_OFFER",
        limited_time_offer:
          typeof sourceTemplate.limitedTimeOffer === "string"
            ? JSON.parse(sourceTemplate.limitedTimeOffer)
            : sourceTemplate.limitedTimeOffer,
      });
    }

    if (sourceTemplate.buttons) {
      const isAuth = sourceTemplate.category === "AUTHENTICATION";
      const buttons = (
        Array.isArray(sourceTemplate.buttons) ? sourceTemplate.buttons : []
      )
        .map((b) => {
          if (b.type === "QUICK_REPLY")
            return { type: "QUICK_REPLY", text: b.text };
          if (b.type === "URL")
            return {
              type: "URL",
              text: b.text,
              url: b.url || "https://example.com",
            };
          if (b.type === "PHONE_NUMBER")
            return {
              type: "PHONE_NUMBER",
              text: b.text,
              phone_number: b.phone_number || "+1234567890",
            };
          if (b.type === "OTP") {
            return {
              type: "OTP",
              otp_type: b.otp_type || "COPY_CODE",
              text:
                b.text || (b.otp_type === "ONE_TAP" ? "Autofill" : "Copy Code"),
              ...(b.otp_type === "ONE_TAP"
                ? {
                    autofill_text: b.autofill_text || "Autofill",
                    package_name: b.package_name || "com.example.app",
                    signature_hash: b.signature_hash || "hash",
                  }
                : {}),
            };
          }
          if (b.type === "COPY_CODE") {
            return {
              type: "COPY_CODE",
              example: b.example || "COUPON20",
            };
          }
          if (b.type === "CATALOG") {
            return { type: "CATALOG", text: b.text || "View Catalog" };
          }
          return null;
        })
        .filter(Boolean);

      if (buttons.length > 0) {
        // Special case for Authentication: subtype must be OTP
        if (isAuth) {
          components.push({ type: "BUTTONS", buttons });
        } else {
          components.push({ type: "BUTTONS", buttons });
        }
      }
    }

    // Special handling for Authentication Category (Body must be very specific)
    if (sourceTemplate.category === "AUTHENTICATION") {
      // Body index 1 is reserved for the code
      const authBody = components.find((c) => c.type === "BODY");
      if (authBody) {
        authBody.add_security_disclaimer = true;
      }
    }

    const uniqueWabas = [...new Set(activeAccounts.map((a) => a.wabaId))];
    const results = [];
    const errors = [];

    for (const wabaId of uniqueWabas) {
      const account = activeAccounts.find((a) => a.wabaId === wabaId);
      try {
        const response = await fetchWithTimeout(
          `${META_API_BASE_URL}/${META_API_VERSION}/${wabaId}/message_templates`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${account.accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: sourceTemplate.name,
              category: sourceTemplate.category,
              language: sourceTemplate.language || DEFAULT_TEMPLATE_LANGUAGE,
              components,
            }),
          },
        );
        const data = await response.json();

        if (!response.ok || data.error) {
          console.error(
            `❌ Meta Template Submission Failed for WABA ${wabaId}:`,
            data.error?.message || "Unknown error",
          );
          errors.push(
            `WABA ${wabaId}: ${data.error?.message || "Unknown error"}`,
          );
          continue;
        }

        let status = (data.status || "pending").toLowerCase();
        if (status.includes("pending")) status = TEMPLATE_STATUS.PENDING;
        else if (status.includes("approved")) status = TEMPLATE_STATUS.APPROVED;

        await prisma.template.upsert({
          where: { metaTemplateId: data.id },
          update: { status, wabaId, isArchived: false },
          create: {
            ...sourceTemplate,
            id: undefined,
            metaTemplateId: data.id,
            wabaId,
            status,
            isArchived: false,
          },
        });
        results.push(wabaId);
      } catch (err) {
        console.error(
          `❌ Submission fetch error for WABA ${wabaId}:`,
          err.message,
        );
        errors.push(`WABA ${wabaId}: ${err.message}`);
      }
    }

    if (results.length === 0) {
      return res.status(400).json({
        error: "Submission failed for all accounts",
        details: errors,
      });
    }

    if (results.length > 0 && !sourceTemplate.wabaId) {
      await prisma.template.update({
        where: { id: sourceTemplate.id },
        data: { isArchived: true },
      });
    }
    res.json({ success: true, submittedTo: results });
  } catch (error) {
    res.status(500).json({ error: "Submission failed" });
  }
});

// ============================================
// Broadcasts API
// ============================================

app.put("/api/broadcasts/:id/pause", async (req, res) => {
  try {
    const broadcast = await prisma.broadcast.update({
      where: { id: req.params.id },
      data: { isPaused: true, stopReason: "Manually paused by user" },
    });
    res.json(broadcast);
  } catch (error) {
    res.status(500).json({ error: "Failed to pause broadcast" });
  }
});

app.put("/api/broadcasts/:id/resume", async (req, res) => {
  try {
    const broadcast = await prisma.broadcast.update({
      where: { id: req.params.id },
      data: { isPaused: false, stopReason: null },
    });
    res.json(broadcast);
  } catch (error) {
    res.status(500).json({ error: "Failed to resume broadcast" });
  }
});

app.put("/api/broadcasts/:id/cancel", async (req, res) => {
  try {
    const broadcast = await prisma.broadcast.update({
      where: { id: req.params.id },
      data: {
        status: "cancelled",
        isPaused: false,
        stopReason: "Manually cancelled by user",
      },
    });
    res.json(broadcast);
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel broadcast" });
  }
});

app.get("/api/broadcasts/:id", async (req, res) => {
  try {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: req.params.id },
      include: {
        account: true,
        template: true,
        messages: {
          include: { contact: true },
          orderBy: { sentAt: "desc" },
        },
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: "Broadcast not found" });
    }

    // Aggregated stats (Cumulative Logic)
    const stats = {
      total: broadcast.contactIds.length,
      queued: broadcast.messages.filter((m) => m.status === "queued").length,
      sent: broadcast.messages.filter(
        (m) => !["queued", "failed"].includes(m.status),
      ).length,
      delivered: broadcast.messages.filter((m) =>
        ["delivered", "read"].includes(m.status),
      ).length,
      read: broadcast.messages.filter((m) => m.status === "read").length,
      failed: broadcast.messages.filter((m) => m.status === "failed").length,
    };

    // Calculate professional metrics
    const metrics = {
      deliveryRate:
        stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0,
      readRate:
        stats.delivered > 0
          ? Math.round((stats.read / stats.delivered) * 100)
          : 0,
      engagementRate:
        stats.sent > 0 ? Math.round((stats.read / stats.sent) * 100) : 0,
      failureRate:
        stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0,
      estimatedCost: (stats.total * 0.015).toFixed(2), // Production mock cost
    };

    res.json({
      ...broadcast,
      account: sanitizeAccount(broadcast.account),
      stats,
      metrics,
    });
  } catch (error) {
    console.error("Fetch detail failed:", error);
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.get("/api/broadcasts", async (req, res) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      include: { account: true, template: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(
      broadcasts.map((b) => ({ ...b, account: sanitizeAccount(b.account) })),
    );
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.post("/api/broadcasts", broadcastLimiter, async (req, res) => {
  const { correlationId } = req;
  try {
    const {
      templateId,
      contactIds,
      variableValues = {},
      campaignName,
    } = req.body;

    // ── Input validation ───────────────────────────────────────────
    if (!templateId || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({
        error: "templateId and a non-empty contactIds array are required.",
      });
    }

    // ── Load all active accounts ───────────────────────────────────
    const activeAccounts = await prisma.account.findMany({
      where: { isActive: true, isArchived: false },
    });
    if (activeAccounts.length === 0) {
      return res.status(400).json({
        error:
          "No active accounts found. Enable at least one account before broadcasting.",
      });
    }

    const template = await prisma.template.findUnique({
      where: { id: templateId },
    });
    if (!template)
      return res.status(400).json({ error: "Template not found." });
    if (template.status !== "approved") {
      return res
        .status(400)
        .json({ error: "Only approved templates can be broadcast." });
    }

    // ── Inject tier limits from DB / Meta health data ──────────────
    // We use the stored qualityRating to infer tier — real tier data is on AccountHealth page.
    // accounts need a tierLimit property for the engine; we default to TIER_1K if unknown.
    const accountsWithTier = activeAccounts.map((acc) => ({
      ...acc,
      // Use stored tier from account model if present, else conservative default
      tierLimit: TIER_LIMITS[acc.messagingLimitTier] ?? TIER_LIMITS["TIER_1K"],
    }));

    // ── Validate total capacity before creating any DB records ─────
    const totalCapacity = accountsWithTier.reduce(
      (sum, a) => (a.tierLimit === Infinity ? Infinity : sum + a.tierLimit),
      0,
    );
    if (totalCapacity !== Infinity && contactIds.length > totalCapacity) {
      return res.status(400).json({
        error: `Contact count (${contactIds.length}) exceeds combined tier limit (${totalCapacity}). Reduce recipients or upgrade account tiers.`,
        combinedLimit: totalCapacity,
      });
    }

    // ── Create the Broadcast record (use first account as primary for FK) ──
    const broadcast = await prisma.broadcast.create({
      data: {
        accountId: activeAccounts[0].id,
        templateId,
        contactIds,
        status: BROADCAST_STATUS.SENDING,
        results: { campaignName: campaignName || null },
        correlationId,
      },
      include: { account: true, template: true },
    });

    await logAction("BROADCAST_START", "Broadcast", broadcast.id, {
      contactCount: contactIds.length,
      templateName: template.name,
      accountCount: activeAccounts.length,
      campaignName,
      correlationId,
    });

    // Respond immediately — engine runs in background
    res.json({ ...broadcast, account: sanitizeAccount(broadcast.account) });

    // ── Enqueue broadcast job ────────────────────────
    await broadcastQueue.add(`broadcast-${broadcast.id}`, {
      broadcastId: broadcast.id,
      contactIds,
      template,
      variableValues,
      account: accountsWithTier[0],
      accounts: accountsWithTier,
      campaignName,
      correlationId,
    });
  } catch (error) {
    return sendError(res, error, "Broadcast initiation failed", 500, {
      correlationId,
    });
  }
});

// Accounts API
// ============================================

app.get("/api/accounts", async (req, res) => {
  const { correlationId } = req;
  try {
    const accounts = await prisma.account.findMany({
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
    });
    if (!Array.isArray(accounts)) return sendSuccess(res, []);
    return sendSuccess(res, accounts.map(sanitizeAccount));
  } catch (error) {
    return sendError(res, error, "Failed to fetch accounts", 500, {
      correlationId,
    });
  }
});

// Inbox API
// ============================================

app.get("/api/inbox", async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      where: { lastMessageAt: { not: null } },
      include: {
        chatMessages: {
          orderBy: { timestamp: "desc" },
          take: 1,
        },
      },
      orderBy: { lastMessageAt: "desc" },
    });

    const now = new Date();
    const processed = contacts.map((c) => {
      const lastReply = c.lastReplyAt ? new Date(c.lastReplyAt) : null;
      const isWindowOpen = lastReply && now - lastReply < 24 * 60 * 60 * 1000;

      return {
        ...c,
        isWindowOpen,
        category: lastReply ? "replied" : "broadcast_only",
      };
    });

    res.json(processed);
  } catch (error) {
    res.status(500).json({ error: "Fetch inbox failed" });
  }
});

app.get("/api/inbox/:contactId", async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.contactId },
    });

    if (!contact) return res.status(404).json({ error: "Contact not found" });

    const messages = await prisma.chatMessage.findMany({
      where: { contactId: req.params.contactId },
      orderBy: { timestamp: "asc" },
    });

    const now = new Date();
    const lastReply = contact.lastReplyAt
      ? new Date(contact.lastReplyAt)
      : null;
    const isWindowOpen = lastReply && now - lastReply < 24 * 60 * 60 * 1000;

    // Reset unread count
    await prisma.contact.update({
      where: { id: req.params.contactId },
      data: { unreadCount: 0 },
    });

    res.json({
      messages,
      isWindowOpen,
      lastReplyAt: contact.lastReplyAt,
    });
  } catch (error) {
    res.status(500).json({ error: "Fetch messages failed" });
  }
});

app.post(
  "/api/inbox/:contactId/send",
  upload.single("file"),
  async (req, res) => {
    try {
      const { contactId } = req.params;
      const { text, accountId, type = "text" } = req.body;
      const file = req.file;

      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });
      if (!contact) return res.status(404).json({ error: "Contact not found" });

      // ENFORCE ACCOUNT PINNING: Use contact's lastAccountId if available to prevent identity leakage
      const effectiveAccountId = contact.lastAccountId || accountId;
      const account = await prisma.account.findUnique({
        where: { id: effectiveAccountId },
      });

      if (!account)
        return res
          .status(404)
          .json({ error: "Account not found or not mapped to this contact" });

      // Meta Policy Check: 24h Window
      const now = new Date();
      const lastReply = contact.lastReplyAt
        ? new Date(contact.lastReplyAt)
        : null;
      const isWindowOpen = lastReply && now - lastReply < 24 * 60 * 60 * 1000;

      if (!isWindowOpen) {
        return res.status(403).json({
          error: "META_POLICY_VIOLATION",
          message:
            "Customer Service Window closed. You can only send a template message to this user.",
        });
      }

      let metaPayload = {
        messaging_product: "whatsapp",
        to: contact.phone,
      };

      let mediaUrl = null;
      let messageType = type;
      let metaMediaId = null;

      if (file) {
        const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${file.filename}`;
        mediaUrl = fileUrl;

        // Determine Meta message type
        if (file.mimetype.startsWith("image/")) messageType = "image";
        else if (file.mimetype.startsWith("video/")) messageType = "video";
        else if (file.mimetype.startsWith("audio/")) messageType = "audio";
        else messageType = "document";

        // PREFERRED: Upload to Meta to get an ID (works for localhost/non-public files)
        try {
          console.log(
            `📤 Uploading message media to Meta for ${contact.phone}...`,
          );
          metaMediaId = await uploadMessageMediaToMeta(
            file,
            account.accessToken,
            account.phoneNumberId,
          );

          metaPayload.type = messageType;
          metaPayload[messageType] = { id: metaMediaId };
        } catch (uploadErr) {
          console.warn(
            "⚠️ Meta Upload failed, falling back to link (requires public URL):",
            uploadErr.message,
          );
          metaPayload.type = messageType;
          metaPayload[messageType] = { link: fileUrl };
        }

        if (messageType === "document")
          metaPayload.document.filename = file.originalname;
        if (text && messageType !== "audio")
          metaPayload[messageType].caption = text;
      } else {
        metaPayload.type = "text";
        metaPayload.text = { body: text };
      }

      // Send via Meta API
      const response = await fetchWithTimeout(
        `${META_API_BASE_URL}/${META_API_VERSION}/${account.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${account.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metaPayload),
        },
      );

      const metaData = await response.json();
      if (!response.ok)
        throw new Error(metaData.error?.message || "Meta API Error");

      // Store in DB
      const message = await prisma.chatMessage.create({
        data: {
          contactId: contact.id,
          accountId: account.id,
          fromMe: true,
          type: messageType,
          body: text || (file ? `[${messageType.toUpperCase()}]` : ""),
          mediaUrl: mediaUrl,
          metaMessageId: metaData.messages?.[0]?.id,
        },
      });

      await prisma.contact.update({
        where: { id: contactId },
        data: { lastMessageAt: new Date() },
      });

      // Notify UI via WebSocket
      io.emit("new_message", {
        message,
        contact: contact, // Minimal update
      });

      res.json(message);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: error.message });
    }
  },
);

// Webhook Management API
// ============================================

app.get("/api/webhook-settings", async (req, res) => {
  try {
    let settings = await prisma.webhookSetting.findFirst();
    if (!settings) {
      settings = await prisma.webhookSetting.create({
        data: {
          url: "",
          verifyToken: "whatsapp_broadcast_crm_token",
          isActive: true,
        },
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.post("/api/webhook-settings", async (req, res) => {
  try {
    const { url, verifyToken, subscriptions, isActive } = req.body;
    let settings = await prisma.webhookSetting.findFirst();

    const data = {
      url,
      verifyToken,
      subscriptions,
      isActive,
      lastSyncAt: new Date(),
    };

    if (settings) {
      settings = await prisma.webhookSetting.update({
        where: { id: settings.id },
        data,
      });
    } else {
      settings = await prisma.webhookSetting.create({ data });
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/webhook-settings/meta-sync", async (req, res) => {
  try {
    const settings = await prisma.webhookSetting.findFirst();
    const url = settings?.url;
    const verifyToken = settings?.verifyToken;
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret || !url) {
      return res
        .status(400)
        .json({ error: "Configuration missing. Check .env and Webhook URL." });
    }

    io.emit("sync_status", {
      status: "processing",
      message: "Contacting Meta Cloud API...",
    });

    const appAccessToken = `${appId}|${appSecret}`;
    const systemToken = process.env.META_ACCESS_TOKEN || appAccessToken;

    io.emit("sync_status", {
      status: "processing",
      message: "Configuring App Webhook URL...",
    });

    // 1. Configure App Webhook (Requires App Token or System User Token)
    // Intelligent Fallback Logic
    const professionalFields = [
      "messages",
      "message_echoes",
      "message_deliveries",
      "message_reads",
      "template_status",
    ];
    const minimalFields = ["messages", "template_status"];

    let subscriptionSuccess = false;
    let subscriptionData = null;

    // Try Professional Tier first
    const professionalUrl = `${META_API_BASE_URL}/${META_API_VERSION}/${appId}/subscriptions?access_token=${systemToken}`;
    const professionalRes = await fetchWithTimeout(professionalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object: "whatsapp_business_account",
        callback_url: url,
        verify_token: verifyToken,
        fields: professionalFields,
        include_values: true,
      }),
    });

    subscriptionData = await professionalRes.json();

    if (professionalRes.ok) {
      subscriptionSuccess = true;
      console.log("✅ Subscribed to Professional Tier fields");
    } else {
      console.warn(
        "⚠️ Professional Tier failed, falling back to Minimal Tier...",
        subscriptionData.error?.message,
      );
      io.emit("sync_status", {
        status: "processing",
        message: "Retrying with Compatibility Mode...",
      });

      const minimalRes = await fetchWithTimeout(professionalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          callback_url: url,
          verify_token: verifyToken,
          fields: minimalFields,
          include_values: true,
        }),
      });

      subscriptionData = await minimalRes.json();
      if (minimalRes.ok) {
        subscriptionSuccess = true;
        console.log("✅ Subscribed to Minimal Tier fields");
      }
    }

    if (!subscriptionSuccess) {
      console.error(
        "❌ Meta App Subscription Failed. Full Response:",
        JSON.stringify(subscriptionData, null, 2),
      );
      io.emit("sync_status", {
        status: "error",
        message:
          subscriptionData.error?.message ||
          `Meta API Error (${subscriptionData.error?.code || "No code"})`,
      });
      throw new Error(
        `Meta App Subscription Failed: ${subscriptionData.error?.message || JSON.stringify(subscriptionData.error) || "Unknown Error"}`,
      );
    }

    io.emit("sync_status", {
      status: "processing",
      message: "Subscribing active accounts...",
    });

    // 2. Subscribe active WABAs (Requires Account Tokens)
    const activeAccounts = await prisma.account.findMany({
      where: { isActive: true, isArchived: false },
    });

    for (const acc of activeAccounts) {
      if (acc.wabaId && acc.accessToken) {
        await fetch(
          `${META_API_BASE_URL}/${META_API_VERSION}/${acc.wabaId}/subscribed_apps`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${acc.accessToken}` },
          },
        );
      }
    }

    await prisma.webhookSetting.update({
      where: { id: settings.id },
      data: {
        lastSyncAt: new Date(),
        metaStatus: "synchronized",
        metaError: null,
      },
    });

    io.emit("sync_status", {
      status: "success",
      message: "All systems synchronized with Meta.",
    });
    res.json({ success: true, message: "Synchronized with Meta Cloud API." });
  } catch (error) {
    io.emit("sync_status", { status: "error", message: error.message });
    console.error("Meta Sync Error:", error.message);
    const settings = await prisma.webhookSetting.findFirst();
    if (settings) {
      await prisma.webhookSetting.update({
        where: { id: settings.id },
        data: { metaStatus: "sync_failed", metaError: error.message },
      });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/webhook-settings/test", async (req, res) => {
  try {
    const { url, verifyToken } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    // Simulate Meta's verification challenge
    const challenge = Math.random().toString(36).substring(7);
    const testUrl = `${url}?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=${challenge}`;

    console.log(`Testing webhook: ${testUrl}`);

    const response = await fetchWithTimeout(testUrl, {}, 5000);
    const result = await response.text();

    if (response.ok && result === challenge) {
      await prisma.webhookSetting.updateMany({
        data: { healthStatus: "healthy" },
      });
      res.json({ success: true, message: "Webhook verified successfully!" });
    } else {
      await prisma.webhookSetting.updateMany({
        data: { healthStatus: "failing" },
      });
      res.status(400).json({
        success: false,
        message:
          "Verification failed. URL did not return the expected challenge.",
        received: result,
      });
    }
  } catch (error) {
    res.status(500).json({ error: "Connection error: " + error.message });
  }
});

// System & Analytics API
// ============================================

app.get("/api/system/health", async (req, res) => {
  const { correlationId } = req;
  try {
    const settings = await prisma.webhookSetting.findFirst();
    const activeAccountsCount = await prisma.account.count({
      where: { isActive: true, isArchived: false },
    });

    let status = "unknown";
    let details = "";

    if (!settings) {
      status = "INITIALIZING";
      details = "Webhook settings not configured.";
    } else if (settings.healthStatus !== "healthy") {
      status = "WEBHOOK_FAIL";
      details = "Webhook connection is failing. Check callback URL.";
    } else if (activeAccountsCount === 0) {
      status = "NO_ACCOUNTS";
      details =
        "Webhook is healthy, but no active WhatsApp accounts are connected.";
    } else {
      status = "READY";
      details = `System is fully operational with ${activeAccountsCount} active account(s).`;
    }

    res.json({
      status,
      details,
      webhook: {
        url: settings?.url || null,
        health: settings?.healthStatus || "unknown",
      },
      accounts: {
        active: activeAccountsCount,
      },
      timestamp: new Date(),
      correlationId,
    });
  } catch (error) {
    return sendError(res, error, "System health check failed", 500, {
      correlationId,
    });
  }
});

app.get("/api/stats/broadcast-activity", async (req, res) => {
  const { correlationId } = req;
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const broadcasts = await prisma.broadcast.findMany({
      where: {
        sentAt: { gte: sevenDaysAgo },
      },
      select: {
        sentAt: true,
        messages: { select: { id: true } },
      },
    });

    // Map to days of week
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const activityMap = {};

    // Initialize last 7 days
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayName = days[d.getDay()];
      activityMap[dayName] = 0;
    }

    broadcasts.forEach((b) => {
      if (!b.sentAt) return;
      const dayName = days[new Date(b.sentAt).getDay()];
      if (activityMap[dayName] !== undefined) {
        activityMap[dayName] += b.messages.length;
      }
    });

    const data = Object.entries(activityMap)
      .map(([name, sent]) => ({ name, sent }))
      .reverse(); // Chronological order

    res.json(data);
  } catch (error) {
    return sendError(res, error, "Failed to fetch activity stats", 500, {
      correlationId,
    });
  }
});

// Webhooks
// ============================================

// Updated verification endpoint to check against DB token
app.get("/api/webhooks", async (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const settings = await prisma.webhookSetting.findFirst();
  const validToken = settings?.verifyToken || process.env.WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token === validToken) {
    console.log("Webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Main webhook handler
app.post("/api/webhooks", async (req, res) => {
  try {
    const { body } = req;

    // Reject if production and signature is missing or invalid
    if (IS_PRODUCTION && req.isMetaVerified === false) {
      console.warn(`[Webhook] Rejected invalid signature from IP: ${req.ip}`);
      return res.status(401).send("Invalid signature");
    }

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const { value, field } = change;
          const phoneNumberId = value.metadata?.phone_number_id;
          let account = null;

          if (phoneNumberId) {
            account = await prisma.account.findUnique({
              where: { phoneNumberId },
            });
          }

          // 1. Handle Account Quality Updates
          if (field === "phone_number_quality_update") {
            const displayPhone = value.display_phone_number;
            const event = value.event; // e.g. FLAGGED, UNFLAGGED, etc. (Or GREEN, YELLOW, RED if provided)

            // Meta typically sends the actual quality rating in event or quality property depending on the payload.
            // Some payloads: { event: "FLAGGED", current_limit: "TIER_10K" } or { quality: "RED" }
            const newQuality = value.current_limit
              ? value.event
              : value.quality || "UNKNOWN";

            if (displayPhone) {
              const account = await prisma.account.findFirst({
                where: { displayPhoneNumber: displayPhone },
              });
              if (account) {
                const updatedAccount = await prisma.account.update({
                  where: { id: account.id },
                  data: { qualityRating: newQuality },
                });
                await logAction(
                  "ACCOUNT_QUALITY_UPDATE",
                  "Account",
                  account.id,
                  { newQuality, rawValue: value },
                );
                io.emit("account_health_updated", {
                  accountId: account.id,
                  qualityRating: newQuality,
                  event,
                });
              }
            }
          }

          // 2. Handle Status Updates (sent, delivered, read, failed)
          const STATUS_LEVELS = { failed: -1, sent: 1, delivered: 2, read: 3 };

          if (value.statuses) {
            for (const statusObj of value.statuses) {
              const { id: metaId, status, recipient_id } = statusObj;

              // Update MessageLog
              const messageLog = await prisma.messageLog.findUnique({
                where: { metaMessageId: metaId },
                include: { broadcast: true },
              });

              if (messageLog) {
                const currentLevel = STATUS_LEVELS[messageLog.status] || 0;
                const newLevel = STATUS_LEVELS[status] || 0;

                if (newLevel > currentLevel) {
                  await prisma.messageLog.update({
                    where: { id: messageLog.id },
                    data: { status },
                  });
                }

                // Notify UI via Socket.io
                io.emit("message_status_update", {
                  messageId: messageLog.id,
                  broadcastId: messageLog.broadcastId,
                  status,
                  metaId,
                  recipient: recipient_id,
                });
              }

              // Also update status in ChatMessage if found
              await prisma.chatMessage.updateMany({
                where: { metaMessageId: metaId },
                data: {
                  body:
                    status === "failed"
                      ? `[Failed] ${statusObj.errors?.[0]?.message}`
                      : undefined,
                },
              });
            }
          }

          // 2. Handle Incoming Messages
          if (value.messages) {
            for (const msg of value.messages) {
              const { type, text, image, id: metaId } = msg;
              const phone = normalizePhone(msg.from);
              const correlationId = crypto.randomUUID();

              // Idempotency Check: Don't process the same Meta Message ID twice
              const existingMsg = await prisma.chatMessage.findUnique({
                where: { metaMessageId: metaId },
              });
              if (existingMsg) continue;

              // Find or Auto-create contact (Immediate persistence for UI)
              // Use upsert to avoid races where two concurrent webhook handlers
              // try to create the same `phone` and cause a unique-constraint error (P2002).
              let contact = null;
              const inboundAt = new Date();

              const contactData = {
                name: value.contacts?.[0]?.profile?.name || "New Lead",
                phone,
                tags: ["auto-generated"],
                ...getInboundOptInData(null, inboundAt),
              };

              try {
                // Use a no-op update to make upsert safe without overwriting existing fields.
                contact = await prisma.contact.upsert({
                  where: { phone },
                  update: {},
                  create: contactData,
                });
                // Log only when we actually created a contact (createdAt roughly equals now)
                await logAction(
                  "CONTACT_AUTO_CREATE",
                  "Contact",
                  contact.id,
                  { phone },
                  { correlationId },
                );
              } catch (err) {
                // If a unique constraint race occurred (another request created the contact),
                // fetch the existing contact and continue. Re-throw other errors.
                if (err && err.code === "P2002") {
                  contact = await prisma.contact.findUnique({
                    where: { phone },
                  });
                  if (!contact) throw err; // unexpected: rethrow if still missing
                  logger.info(`Recovered from P2002 race for phone=${phone}`, {
                    correlationId,
                  });
                } else {
                  throw err;
                }
              }

              // Parse Body & Resolve Media
              let bodyText = "";
              let mediaUrl = null;

              if (type === "text") {
                bodyText = text.body;
              } else if (type === "image") {
                bodyText = msg.image?.caption || "";
                const res = await getWhatsAppMediaUrl({
                  account,
                  mediaId: msg.image.id,
                });
                if (res.success) mediaUrl = res.url;
              } else if (type === "video") {
                bodyText = msg.video?.caption || "";
                const res = await getWhatsAppMediaUrl({
                  account,
                  mediaId: msg.video.id,
                });
                if (res.success) mediaUrl = res.url;
              } else if (type === "audio") {
                const res = await getWhatsAppMediaUrl({
                  account,
                  mediaId: msg.audio.id,
                });
                if (res.success) mediaUrl = res.url;
              } else if (type === "document") {
                bodyText = msg.document?.filename || "Document";
                const res = await getWhatsAppMediaUrl({
                  account,
                  mediaId: msg.document.id,
                });
                if (res.success) mediaUrl = res.url;
              } else if (type === "button") {
                bodyText = msg.button.text;
              } else if (type === "interactive") {
                bodyText =
                  msg.interactive.button_reply?.title ||
                  msg.interactive.list_reply?.title ||
                  "[Interactive]";
              }

              // Immediate Store (Fast)
              const chatMsg = await prisma.chatMessage.create({
                data: {
                  contactId: contact.id,
                  accountId: account?.id,
                  fromMe: false,
                  type,
                  body: bodyText,
                  mediaUrl,
                  metaMessageId: metaId,
                  timestamp: new Date(),
                },
              });

              // Fast Update (Counters & Activity)
              const updatedContact = await prisma.contact.update({
                where: { id: contact.id },
                data: {
                  unreadCount: { increment: 1 },
                  lastMessageAt: inboundAt,
                  lastReplyAt: inboundAt,
                  lastAccountId: account?.id,
                  ...getInboundOptInData(contact, inboundAt),
                },
              });

              // Immediate UI Update via Socket
              io.emit("new_message", {
                message: chatMsg,
                contact: updatedContact,
              });

              // ENQUEUE FOR AI & COMPLEX LOGIC
              await incomingMessageQueue.add(`msg-${metaId}`, {
                payload: {
                  from: phone,
                  body: bodyText,
                  mediaUrl: mediaUrl,
                  type,
                  metaId,
                },
                contactId: contact.id,
                accountId: account?.id,
                correlationId,
              });

              await logAction(
                "INCOMING_MESSAGE_QUEUED",
                "Contact",
                contact.id,
                { metaId },
                { correlationId },
              );
            }
          }
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook processing failed:", error);
    res.sendStatus(500);
  }
});

// ─── Media Proxy (To solve Auth header issues with Meta CDN) ─────────────────
app.get("/api/media/proxy", async (req, res) => {
  const { url, accountId } = req.query;
  if (!url) return res.status(400).send("URL required");

  try {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    if (!account) return res.status(404).send("Account not found");

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });

    if (!response.ok) throw new Error("Failed to fetch media from Meta");

    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    logger.error(`Media proxy error: ${error.message}`);
    res.status(500).send("Error proxying media");
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.path,
    correlationId: req.correlationId,
  });
});

app.use((err, req, res, next) => {
  const correlationId = req.correlationId || "SYSTEM";
  logger.error(
    `🔥 Unhandled Exception: ${err.message}`,
    {
      correlationId,
      path: req.path,
      method: req.method,
    },
    err,
  );

  res.status(err.status || 500).json({
    error: "Internal Server Error",
    details: process.env.NODE_ENV === "development" ? err.message : undefined,
    correlationId,
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
