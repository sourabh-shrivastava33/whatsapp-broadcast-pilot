import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import fs from "fs";
import path from "path";
import multer from "multer";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {
  META_API_VERSION,
  META_API_BASE_URL,
  DEFAULT_TEMPLATE_LANGUAGE,
  TEMPLATE_STATUS,
  BROADCAST_STATUS,
  QUALITY_RATINGS,
} from "./constants.js";
import { runBroadcast, TIER_LIMITS } from "./broadcastEngine.js";

import { Server } from "socket.io";
import http from "http";
import crypto from "crypto";

dotenv.config();

const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();

// ─── Security Headers (Helmet) ────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Disabled: frontend is served separately; enabling breaks API responses
  crossOriginEmbedderPolicy: false,
}));

// ─── CORS ─────────────────────────────────────────────────────────
const corsOptions = {
  origin: IS_PRODUCTION ? ALLOWED_ORIGIN : "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};
app.use(cors(corsOptions));

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: IS_PRODUCTION ? ALLOWED_ORIGIN : "*",
    methods: ["GET", "POST"],
  },
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

/** Broadcast limiter: 10 per 15 minutes (prevent runaway broadcast triggers) */
const broadcastLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Broadcast rate limit exceeded. Max 10 broadcasts per 15 minutes." },
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

// ─── Fetch with Timeout Utility ───────────────────────────────────

/**
 * A drop-in replacement for fetch() with a configurable AbortController timeout.
 * Node 18 native fetch ignores { timeout } in RequestInit — this fixes that.
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
    console.warn("META_APP_SECRET not set, skipping signature verification (NOT SECURE)");
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

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads");
    }
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// ============================================
// Media API
// ============================================

app.post("/api/media/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    // Determine media type based on mimetype
    let type = "DOCUMENT";
    if (req.file.mimetype.startsWith("image/")) type = "IMAGE";
    else if (req.file.mimetype.startsWith("video/")) type = "VIDEO";
    else if (req.file.mimetype.startsWith("audio/")) type = "AUDIO";

    const media = await prisma.media.create({
      data: {
        url: fileUrl,
        filename: req.file.filename,
        type: type,
        size: req.file.size,
      },
    });

    res.json(media);
  } catch (error) {
    console.error("Media upload error:", error);
    res.status(500).json({ error: "Failed to save media record" });
  }
});

app.get("/api/media", async (req, res) => {
  try {
    const media = await prisma.media.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(media);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch media library" });
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

// ============================================
// Helpers
// ============================================

/**
 * Normalizes phone numbers to E.164-like format (digits only)
 */
const normalizePhone = (phone) => {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
};

/**
 * Removes sensitive fields from account objects before sending to frontend
 */
const sanitizeAccount = (account) => {
  if (!account) return null;
  if (Array.isArray(account)) {
    return account.map((acc) => {
      const { accessToken, ...rest } = acc;
      return rest;
    });
  }
  const { accessToken, ...rest } = account;
  return rest;
};

/**
 * Logs a system action for audit trail
 */
const logAction = async (action, entity, entityId = null, metadata = {}) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        metadata,
      },
    });
  } catch (error) {
    console.error("Failed to log action:", error);
  }
};

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

function parseMetaComponents(metaComponents) {
  let header = "";
  let body = "";
  let footer = "";
  let buttons = [];
  let variables = [];

  for (const comp of metaComponents) {
    if (comp.type === "HEADER") header = comp.text || "";
    else if (comp.type === "BODY") body = comp.text || "";
    else if (comp.type === "FOOTER") footer = comp.text || "";
    else if (comp.type === "BUTTONS") buttons = comp.buttons || [];
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

  return { header, body, footer, buttons, variables };
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
          const { header, body, footer, buttons, variables } =
            parseMetaComponents(metaTpl.components);
          let status = metaTpl.status.toLowerCase();
          if (status.includes("pending")) status = TEMPLATE_STATUS.PENDING;
          else if (status.includes("approved"))
            status = TEMPLATE_STATUS.APPROVED;
          else if (status.includes("rejected"))
            status = TEMPLATE_STATUS.REJECTED;

          await prisma.template.upsert({
            where: { metaTemplateId: metaTpl.id },
            update: {
              name: metaTpl.name,
              status,
              category: metaTpl.category,
              language: metaTpl.language,
              header,
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
    res.status(500).json({ error: "Sync failed" });
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
  try {
    const account = await prisma.account.findUnique({
      where: { id: req.params.id },
    });
    if (!account) return res.status(404).json({ error: "Account not found" });

    // Fetch Phone Number Health from Meta
    const phoneRes = await fetchWithTimeout(
      `${META_API_BASE_URL}/${META_API_VERSION}/${account.phoneNumberId}?fields=messaging_limit_tier,quality_rating,status,id,display_phone_number,verified_name`,
      {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      }
    );
    const phoneData = await phoneRes.json();

    if (!phoneRes.ok) throw new Error(phoneData.error?.message || "Meta API Error");

    // Fetch WABA Account health
    const wabaRes = await fetchWithTimeout(
      `${META_API_BASE_URL}/${META_API_VERSION}/${account.wabaId}?fields=id,name,status,account_mode`,
      {
        headers: { Authorization: `Bearer ${account.accessToken}` },
      }
    );
    const wabaData = await wabaRes.json();

    res.json({
      phone: phoneData,
      waba: wabaData,
      lastUpdated: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    if (!phone) return res.status(400).json({ error: "Valid phone number required" });

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
            optInStatus: c.optInStatus || undefined,
            optInMethod: c.optInMethod || undefined,
            optInTimestamp: c.optInTimestamp ? new Date(c.optInTimestamp) : undefined,
          },
          create: {
            name: c.name || "Unknown",
            phone: normalizedPhone,
            tags: c.tags || [],
            notes: c.notes || "",
            optInStatus: c.optInStatus || "unknown",
            optInMethod: c.optInMethod || null,
            optInTimestamp: c.optInTimestamp ? new Date(c.optInTimestamp) : null,
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
    await logAction("CONTACT_UNBLOCKED", "Contact", id, { phone: contact.phone });
    
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
    const filtered = contacts.filter(c => {
      if (!tags || tags.length === 0) return true;
      const contactTags = Array.isArray(c.tags) ? c.tags : JSON.parse(c.tags || "[]");
      return tags.every(t => contactTags.includes(t));
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
async function uploadMediaToMeta(filePath, accessToken, appId) {
  try {
    const stats = fs.statSync(filePath);
    const fileContent = fs.readFileSync(filePath);
    const mimeType = path.extname(filePath) === '.png' ? 'image/png' : 
                     path.extname(filePath) === '.jpg' || path.extname(filePath) === '.jpeg' ? 'image/jpeg' :
                     path.extname(filePath) === '.mp4' ? 'video/mp4' : 'application/pdf';

    // 1. Start Upload Session
    const startRes = await fetchWithTimeout(`${META_API_BASE_URL}/${META_API_VERSION}/${appId}/uploads?file_length=${stats.size}&file_type=${mimeType}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const startData = await startRes.json();
    if (!startRes.ok) throw new Error(startData.error?.message || "Failed to start upload");

    const sessionId = startData.id;

    // 2. Upload the file data
    const uploadRes = await fetchWithTimeout(`${META_API_BASE_URL}/${META_API_VERSION}/${sessionId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'file_offset': '0',
        'Content-Type': 'application/octet-stream'
      },
      body: fileContent
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error?.message || "Failed to upload media");

    return uploadData.h; // The handle
  } catch (error) {
    console.error("❌ Media Upload Failed:", error.message);
    throw error;
  }
}

/**
 * Uploads a file to Meta's Media API for use in direct messages.
 * Returns the media ID.
 */
async function uploadMessageMediaToMeta(file, accessToken, phoneNumberId) {
  try {
    const formData = new FormData();
    const blob = new Blob([fs.readFileSync(file.path)], { type: file.mimetype });
    formData.append("file", blob, file.originalname);
    formData.append("messaging_product", "whatsapp");

    const response = await fetchWithTimeout(
      `${META_API_BASE_URL}/${META_API_VERSION}/${phoneNumberId}/media`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Meta Media Upload Failed");

    return data.id;
  } catch (error) {
    console.error("❌ Message Media Upload Failed:", error.message);
    throw error;
  }
}

app.post("/api/templates/:id/submit", async (req, res) => {
  try {
    const appId = process.env.META_APP_ID;
    if (!appId) return res.status(400).json({ error: "META_APP_ID missing in .env" });

    const sourceTemplate = await prisma.template.findUnique({
      where: { id: req.params.id },
    });
    const activeAccounts = await prisma.account.findMany({
      where: { isActive: true, isArchived: false },
    });
    if (!sourceTemplate || activeAccounts.length === 0)
      return res.status(400).json({ error: "Invalid state: No active accounts found" });

    // Construct components...
    const getVarNums = (text) =>
      text
        ? [
            ...new Set([...text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])),
          ].sort((a, b) => Number(a) - Number(b))
        : [];
    const allVars = Array.isArray(sourceTemplate.variables) ? sourceTemplate.variables : [];
    const getSample = (num) => allVars.find((v) => String(v.num) === String(num))?.sample || "sample";

    const bodyVars = getVarNums(sourceTemplate.body);
    const bodyComp = { type: "BODY", text: sourceTemplate.body };
    if (bodyVars.length > 0)
      bodyComp.example = { body_text: [bodyVars.map(getSample)] };
    const components = [bodyComp];

    // Handle Media Header
    let mediaHandle = null;
    if (sourceTemplate.headerType !== "TEXT" && sourceTemplate.mediaUrl) {
      // Check if it's a local file
      if (sourceTemplate.mediaUrl.includes("localhost")) {
        const fileName = sourceTemplate.mediaUrl.split("/").pop();
        const filePath = path.join("uploads", fileName);
        if (fs.existsSync(filePath)) {
          console.log(`📤 Uploading local media to Meta: ${fileName}`);
          // Use the first active account's token for the upload
          mediaHandle = await uploadMediaToMeta(filePath, activeAccounts[0].accessToken, appId);
        }
      }

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
      const headerComp = { type: "HEADER", format: "TEXT", text: sourceTemplate.header };
      if (headerVars.length > 0)
        headerComp.example = { header_text: headerVars.map(getSample) };
      components.unshift(headerComp);
    }
    if (sourceTemplate.footer)
      components.push({ type: "FOOTER", text: sourceTemplate.footer });
    if (sourceTemplate.buttons) {
      const buttons = (
        Array.isArray(sourceTemplate.buttons) ? sourceTemplate.buttons : []
      )
        .map((b) => {
          if (b.type === "QUICK_REPLY")
            return { type: "QUICK_REPLY", text: b.text };
          if (b.type === "URL")
            return { type: "URL", text: b.text, url: "https://example.com" };
          if (b.type === "PHONE_NUMBER")
            return {
              type: "PHONE_NUMBER",
              text: b.text,
              phone_number: "+1234567890",
            };
          return null;
        })
        .filter(Boolean);
      if (buttons.length > 0) components.push({ type: "BUTTONS", buttons });
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
          console.error(`❌ Meta Template Submission Failed for WABA ${wabaId}:`, data.error?.message || "Unknown error");
          errors.push(`WABA ${wabaId}: ${data.error?.message || "Unknown error"}`);
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
        console.error(`❌ Submission fetch error for WABA ${wabaId}:`, err.message);
        errors.push(`WABA ${wabaId}: ${err.message}`);
      }
    }

    if (results.length === 0) {
      return res.status(400).json({ 
        error: "Submission failed for all accounts", 
        details: errors 
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
      total: broadcast.messages.length,
      queued: broadcast.messages.filter((m) => m.status === "queued").length,
      sent: broadcast.messages.filter((m) => !["queued", "failed"].includes(m.status)).length,
      delivered: broadcast.messages.filter((m) => ["delivered", "read"].includes(m.status)).length,
      read: broadcast.messages.filter((m) => m.status === "read").length,
      failed: broadcast.messages.filter((m) => m.status === "failed").length,
    };

    // Calculate professional metrics
    const metrics = {
      deliveryRate: stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0,
      readRate: stats.delivered > 0 ? Math.round((stats.read / stats.delivered) * 100) : 0,
      engagementRate: stats.sent > 0 ? Math.round((stats.read / stats.sent) * 100) : 0,
      failureRate: stats.total > 0 ? Math.round((stats.failed / stats.total) * 100) : 0,
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
  try {
    const { templateId, contactIds, variableValues = {}, campaignName } = req.body;

    // ── Input validation ───────────────────────────────────────────
    if (!templateId || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json({ error: "templateId and a non-empty contactIds array are required." });
    }

    // ── Load all active accounts ───────────────────────────────────
    const activeAccounts = await prisma.account.findMany({
      where: { isActive: true, isArchived: false },
    });
    if (activeAccounts.length === 0) {
      return res.status(400).json({ error: "No active accounts found. Enable at least one account before broadcasting." });
    }

    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template) return res.status(400).json({ error: "Template not found." });
    if (template.status !== "approved") {
      return res.status(400).json({ error: "Only approved templates can be broadcast." });
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
      0
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
      },
      include: { account: true, template: true },
    });

    await logAction("BROADCAST_START", "Broadcast", broadcast.id, {
      contactCount: contactIds.length,
      templateName: template.name,
      accountCount: activeAccounts.length,
      campaignName,
    });

    // Respond immediately — engine runs in background
    res.json({ ...broadcast, account: sanitizeAccount(broadcast.account) });

    // ── Run broadcast engine in background ────────────────────────
    runBroadcast({
      broadcastId: broadcast.id,
      accounts: accountsWithTier,
      contactIds,
      template,
      variableValues,

      // ── metaSender: the ONLY function that hits real Meta API ────
      // Swap this function with a mock in tests — zero other changes needed.
      metaSender: async (account, contact, tpl, vars) => {
        const components = [];

        if (tpl.headerType !== "TEXT" && tpl.mediaUrl) {
          components.push({
            type: "header",
            parameters: [{ type: tpl.headerType.toLowerCase(), [tpl.headerType.toLowerCase()]: { link: tpl.mediaUrl } }],
          });
        }

        const resolvedVariables = Array.isArray(tpl.variables) ? tpl.variables : [];
        if (resolvedVariables.length > 0) {
          components.push({
            type: "body",
            parameters: resolvedVariables
              .sort((a, b) => Number(a.num) - Number(b.num))
              .map((v) => ({ type: "text", text: vars[String(v.num)] || v.sample || "sample" })),
          });
        }

        const response = await fetchWithTimeout(
          `${META_API_BASE_URL}/${META_API_VERSION}/${account.phoneNumberId}/messages`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: contact.phone,
              type: "template",
              template: {
                name: tpl.name,
                language: { code: tpl.language || DEFAULT_TEMPLATE_LANGUAGE },
                components: components.length > 0 ? components : undefined,
              },
            }),
          }
        );

        const metaData = await response.json();
        if (!response.ok || metaData.error) {
          const err = new Error(metaData.error?.message || "Meta API Error");
          err.statusCode = response.status;
          err.retryable = response.status === 429 || response.status >= 500;
          throw err;
        }
        return metaData.messages?.[0]?.id;
      },

      getContact: (contactId) => prisma.contact.findUnique({ where: { id: contactId } }),

      onMessageQueued: async (contactId) => {
        const log = await prisma.messageLog.create({
          data: { broadcastId: broadcast.id, contactId, status: "queued" },
        });
        return log.id;
      },

      onMessageSuccess: async (messageLogId, metaMessageId, contactId, tpl, vars) => {
        await prisma.messageLog.update({
          where: { id: messageLogId },
          data: { status: "sent", metaMessageId, sentAt: new Date() },
        });
        // Resolve variable placeholders with user-supplied values
        const resolvedBody = (tpl.body || "").replace(/\{\{(\d+)\}\}/g, (match, num) => {
          return vars[num] ?? (Array.isArray(tpl.variables) ? (tpl.variables.find(v => String(v.num) === num)?.sample ?? match) : match);
        });
        await prisma.chatMessage.create({
          data: {
            contactId,
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
        io.emit("broadcast_progress", { broadcastId: broadcast.id });
      },

      onMessageFailure: async (messageLogId, err, contactId) => {
        console.error(`[Broadcast ${broadcast.id}] Failed for contact ${contactId}: ${err.message}`);
        await prisma.messageLog.update({
          where: { id: messageLogId },
          data: { status: "failed", error: err.message },
        });
      },

      onBroadcastComplete: async (broadcastId, totals) => {
        await prisma.broadcast.update({
          where: { id: broadcastId },
          data: {
            status: totals.failed === 0 ? BROADCAST_STATUS.SENT : "completed_with_errors",
            results: { ...totals, campaignName: campaignName || null },
          },
        });
        const finalBroadcast = await prisma.broadcast.findUnique({
          where: { id: broadcastId },
          include: { account: true, template: true },
        });
        io.emit("broadcast_update", { ...finalBroadcast, account: sanitizeAccount(finalBroadcast.account) });
      },

      onAuditLog: (action, metadata) => logAction(action, "Broadcast", broadcast.id, metadata),

      onProgress: ({ done, total, accountId }) => {
        io.emit("broadcast_progress", {
          broadcastId: broadcast.id,
          progress: Math.round((done / total) * 100),
          current: done,
          total,
          accountId,
        });
      },
    }).catch((err) => {
      console.error(`[Broadcast ${broadcast.id}] Engine failed:`, err.message);
      // Update broadcast status to failed if engine itself crashes
      prisma.broadcast
        .update({ where: { id: broadcast.id }, data: { status: "failed", results: { error: err.message } } })
        .catch(() => {});
    });

  } catch (error) {
    console.error("Broadcast initiation failed:", error);
    res.status(500).json({ error: "Broadcast initiation failed" });
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
    const processed = contacts.map(c => {
      const lastReply = c.lastReplyAt ? new Date(c.lastReplyAt) : null;
      const isWindowOpen = lastReply && (now - lastReply) < 24 * 60 * 60 * 1000;
      
      return {
        ...c,
        isWindowOpen,
        category: lastReply ? 'replied' : 'broadcast_only'
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
      where: { id: req.params.contactId }
    });
    
    if (!contact) return res.status(404).json({ error: "Contact not found" });

    const messages = await prisma.chatMessage.findMany({
      where: { contactId: req.params.contactId },
      orderBy: { timestamp: "asc" },
    });

    const now = new Date();
    const lastReply = contact.lastReplyAt ? new Date(contact.lastReplyAt) : null;
    const isWindowOpen = lastReply && (now - lastReply) < 24 * 60 * 60 * 1000;

    // Reset unread count
    await prisma.contact.update({
      where: { id: req.params.contactId },
      data: { unreadCount: 0 },
    });

    res.json({
      messages,
      isWindowOpen,
      lastReplyAt: contact.lastReplyAt
    });
  } catch (error) {
    res.status(500).json({ error: "Fetch messages failed" });
  }
});

app.post("/api/inbox/:contactId/send", upload.single("file"), async (req, res) => {
  try {
    const { contactId } = req.params;
    const { text, accountId, type = "text" } = req.body;
    const file = req.file;

    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    const account = await prisma.account.findUnique({ where: { id: accountId } });

    if (!contact || !account) return res.status(404).json({ error: "Not found" });

    // Meta Policy Check: 24h Window
    const now = new Date();
    const lastReply = contact.lastReplyAt ? new Date(contact.lastReplyAt) : null;
    const isWindowOpen = lastReply && (now - lastReply) < 24 * 60 * 60 * 1000;

    if (!isWindowOpen) {
      return res.status(403).json({ 
        error: "META_POLICY_VIOLATION", 
        message: "Customer Service Window closed. You can only send a template message to this user." 
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
        console.log(`📤 Uploading message media to Meta for ${contact.phone}...`);
        metaMediaId = await uploadMessageMediaToMeta(file, account.accessToken, account.phoneNumberId);
        
        metaPayload.type = messageType;
        metaPayload[messageType] = { id: metaMediaId };
      } catch (uploadErr) {
        console.warn("⚠️ Meta Upload failed, falling back to link (requires public URL):", uploadErr.message);
        metaPayload.type = messageType;
        metaPayload[messageType] = { link: fileUrl };
      }

      if (messageType === "document") metaPayload.document.filename = file.originalname;
      if (text && messageType !== "audio") metaPayload[messageType].caption = text;
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
      }
    );

    const metaData = await response.json();
    if (!response.ok) throw new Error(metaData.error?.message || "Meta API Error");

    // Store in DB
    const message = await prisma.chatMessage.create({
      data: {
        contactId,
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
      contact: contact // Minimal update
    });

    res.json(message);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: error.message });
  }
});

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
      return res.status(400).json({ error: "Configuration missing. Check .env and Webhook URL." });
    }

    io.emit("sync_status", { status: "processing", message: "Contacting Meta Cloud API..." });

    const appAccessToken = `${appId}|${appSecret}`;
    const systemToken = process.env.META_ACCESS_TOKEN || appAccessToken;

    io.emit("sync_status", { status: "processing", message: "Configuring App Webhook URL..." });

    // 1. Configure App Webhook (Requires App Token or System User Token)
    // Intelligent Fallback Logic
    const professionalFields = ["messages", "message_echoes", "message_deliveries", "message_reads", "template_status"];
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
        include_values: true
      }),
    });

    subscriptionData = await professionalRes.json();
    
    if (professionalRes.ok) {
      subscriptionSuccess = true;
      console.log("✅ Subscribed to Professional Tier fields");
    } else {
      console.warn("⚠️ Professional Tier failed, falling back to Minimal Tier...", subscriptionData.error?.message);
      io.emit("sync_status", { status: "processing", message: "Retrying with Compatibility Mode..." });
      
      const minimalRes = await fetchWithTimeout(professionalUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object: "whatsapp_business_account",
          callback_url: url,
          verify_token: verifyToken,
          fields: minimalFields,
          include_values: true
        }),
      });

      subscriptionData = await minimalRes.json();
      if (minimalRes.ok) {
        subscriptionSuccess = true;
        console.log("✅ Subscribed to Minimal Tier fields");
      }
    }
    
    if (!subscriptionSuccess) {
      console.error("❌ Meta App Subscription Failed. Full Response:", JSON.stringify(subscriptionData, null, 2));
      io.emit("sync_status", { status: "error", message: subscriptionData.error?.message || "App subscription failed" });
      throw new Error(`Meta App Subscription Failed: ${subscriptionData.error?.message || "Unknown Error"}`);
    }

    io.emit("sync_status", { status: "processing", message: "Subscribing active accounts..." });

    // 2. Subscribe active WABAs (Requires Account Tokens)
    const activeAccounts = await prisma.account.findMany({
      where: { isActive: true, isArchived: false }
    });

    for (const acc of activeAccounts) {
      if (acc.wabaId && acc.accessToken) {
        await fetch(`${META_API_BASE_URL}/${META_API_VERSION}/${acc.wabaId}/subscribed_apps`, {
          method: "POST",
          headers: { Authorization: `Bearer ${acc.accessToken}` },
        });
      }
    }

    await prisma.webhookSetting.update({
      where: { id: settings.id },
      data: { lastSyncAt: new Date(), metaStatus: "synchronized", metaError: null }
    });

    io.emit("sync_status", { status: "success", message: "All systems synchronized with Meta." });
    res.json({ success: true, message: "Synchronized with Meta Cloud API." });
  } catch (error) {
    io.emit("sync_status", { status: "error", message: error.message });
    console.error("Meta Sync Error:", error.message);
    const settings = await prisma.webhookSetting.findFirst();
    if (settings) {
      await prisma.webhookSetting.update({
        where: { id: settings.id },
        data: { metaStatus: "sync_failed", metaError: error.message }
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
        data: { healthStatus: "healthy" }
      });
      res.json({ success: true, message: "Webhook verified successfully!" });
    } else {
      await prisma.webhookSetting.updateMany({
        data: { healthStatus: "failing" }
      });
      res.status(400).json({ 
        success: false, 
        message: "Verification failed. URL did not return the expected challenge.",
        received: result
      });
    }
  } catch (error) {
    res.status(500).json({ error: "Connection error: " + error.message });
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

          // 1. Handle Account Quality Updates
          if (field === "phone_number_quality_update") {
            const displayPhone = value.display_phone_number;
            const event = value.event; // e.g. FLAGGED, UNFLAGGED, etc. (Or GREEN, YELLOW, RED if provided)
            
            // Meta typically sends the actual quality rating in event or quality property depending on the payload.
            // Some payloads: { event: "FLAGGED", current_limit: "TIER_10K" } or { quality: "RED" }
            const newQuality = value.current_limit ? value.event : (value.quality || "UNKNOWN");
            
            if (displayPhone) {
              const account = await prisma.account.findFirst({
                where: { displayPhoneNumber: displayPhone }
              });
              if (account) {
                const updatedAccount = await prisma.account.update({
                  where: { id: account.id },
                  data: { qualityRating: newQuality }
                });
                await logAction("ACCOUNT_QUALITY_UPDATE", "Account", account.id, { newQuality, rawValue: value });
                io.emit("account_health_updated", { accountId: account.id, qualityRating: newQuality, event });
              }
            }
          }

          // 2. Handle Status Updates (sent, delivered, read, failed)
          if (value.statuses) {
            for (const statusObj of value.statuses) {
              const { id: metaId, status, recipient_id } = statusObj;
              
              // Update MessageLog
              const messageLog = await prisma.messageLog.findUnique({
                where: { metaMessageId: metaId },
                include: { broadcast: true }
              });

              if (messageLog) {
                await prisma.messageLog.update({
                  where: { id: messageLog.id },
                  data: { status },
                });

                // Notify UI via Socket.io
                io.emit("message_status_update", {
                  messageId: messageLog.id,
                  broadcastId: messageLog.broadcastId,
                  status,
                  metaId,
                  recipient: recipient_id
                });
              }

              // Also update status in ChatMessage if found
              await prisma.chatMessage.updateMany({
                where: { metaMessageId: metaId },
                data: { 
                  body: status === 'failed' ? `[Failed] ${statusObj.errors?.[0]?.message}` : undefined 
                },
              });
            }
          }

          // 2. Handle Incoming Messages
          if (value.messages) {
            for (const msg of value.messages) {
              const { type, text, image, id: metaId } = msg;

              // Find contact by phone (normalize first)
              const phone = normalizePhone(msg.from);
              
              let contact = await prisma.contact.findUnique({
                where: { phone },
              });

              // Auto-create contact if not exists (Lead Generation)
              if (!contact) {
                contact = await prisma.contact.create({
                  data: {
                    name: value.contacts?.[0]?.profile?.name || "New Lead",
                    phone,
                    tags: ["auto-generated"],
                  },
                });
                await logAction("CONTACT_AUTO_CREATE", "Contact", contact.id, { phone });
              }

              // Store message
              let bodyText = "";
              if (type === "text") bodyText = text.body;
              else if (type === "image") bodyText = "[Image Message]";
              else if (type === "button") bodyText = msg.button.text;
              else if (type === "interactive") bodyText = msg.interactive.button_reply?.title || msg.interactive.list_reply?.title || "[Interactive]";

              const chatMsg = await prisma.chatMessage.create({
                data: {
                  contactId: contact.id,
                  fromMe: false,
                  type,
                  body: bodyText,
                  metaMessageId: metaId,
                  timestamp: new Date(),
                },
              });

              // Auto opt-out / opt-in detection
              const lowerBody = bodyText.toLowerCase().trim();
              const stopKeywords = ["stop", "unsubscribe", "quit", "cancel", "opt out", "stop receiving"];
              const startKeywords = ["start", "yes", "opt in", "subscribe"];
              
              let optInUpdates = {};
              if (stopKeywords.includes(lowerBody)) {
                optInUpdates = {
                  optInStatus: "opted_out",
                  optOutReason: "keyword_reply",
                  optOutTimestamp: new Date()
                };
                io.emit("contact_opted_out", { contactId: contact.id, phone });
                await logAction("OPT_OUT_AUTO", "Contact", contact.id, { reason: "keyword_reply" });
              } else if (startKeywords.includes(lowerBody)) {
                optInUpdates = {
                  optInStatus: "opted_in",
                  optInMethod: "keyword_reply",
                  optInTimestamp: new Date(),
                  optOutTimestamp: null,
                  optOutReason: null
                };
                io.emit("contact_opted_in", { contactId: contact.id, phone });
                await logAction("OPT_IN_AUTO", "Contact", contact.id, { method: "keyword_reply" });
              }

              // Update contact unread count, activity, and opt-in status
              const updatedContact = await prisma.contact.update({
                where: { id: contact.id },
                data: {
                  unreadCount: { increment: 1 },
                  lastMessageAt: new Date(),
                  lastReplyAt: new Date(),
                  ...optInUpdates
                },
              });

              // Notify UI via Socket.io
              io.emit("new_message", {
                message: chatMsg,
                contact: updatedContact
              });

              await logAction("INCOMING_MESSAGE", "Contact", contact.id, { type, metaId });
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

httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
 
