import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import fs from "fs";
import path from "path";
import multer from "multer";
import {
  META_API_VERSION,
  META_API_BASE_URL,
  DEFAULT_TEMPLATE_LANGUAGE,
  TEMPLATE_STATUS,
  BROADCAST_STATUS,
  QUALITY_RATINGS,
} from "./constants.js";

import { Server } from "socket.io";
import http from "http";
import crypto from "crypto";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors()); // Allow all origins for dev
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

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
    const ownedRes = await fetch(
      `${META_API_BASE_URL}/${META_API_VERSION}/${businessId}/owned_whatsapp_business_accounts`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    let wabaData = await ownedRes.json();

    if (wabaData.error) {
      // Strategy 2: Client WABAs
      const clientRes = await fetch(
        `${META_API_BASE_URL}/${META_API_VERSION}/${businessId}/client_whatsapp_business_accounts`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      wabaData = await clientRes.json();
    }

    if (!wabaData.error && wabaData.data) {
      for (const waba of wabaData.data) {
        const phoneRes = await fetch(
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
      const directRes = await fetch(
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
      const response = await fetch(
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
    const { name, phone, tags, notes } = req.body;
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
        if (!c.phone) {
          errors.push(`Missing phone for contact: ${c.name || "Unknown"}`);
          continue;
        }

        const existing = await prisma.contact.findUnique({
          where: { phone: c.phone },
        });

        await prisma.contact.upsert({
          where: { phone: c.phone },
          update: {
            name: c.name || undefined,
            tags: c.tags || undefined,
            notes: c.notes || undefined,
          },
          create: {
            name: c.name || "Unknown",
            phone: c.phone,
            tags: c.tags || [],
            notes: c.notes || "",
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
    
    const contacts = await prisma.contact.findMany({
      where: {
        AND: [
          tags && tags.length > 0 ? {
            tags: {
              path: [],
              array_contains: tags
            }
          } : {}
        ]
      }
    });

    res.json(contacts);
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

app.post("/api/templates/:id/submit", async (req, res) => {
  try {
    const sourceTemplate = await prisma.template.findUnique({
      where: { id: req.params.id },
    });
    const activeAccounts = await prisma.account.findMany({
      where: { isActive: true, isArchived: false },
    });
    if (!sourceTemplate || activeAccounts.length === 0)
      return res.status(400).json({ error: "Invalid state" });

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

    if (sourceTemplate.headerType !== "TEXT") {
      const headerComp = {
        type: "HEADER",
        format: sourceTemplate.headerType, // IMAGE, VIDEO, DOCUMENT
      };
      // For media templates, Meta requires an example.
      // Ideally we'd use a media handle from an upload,
      // but for now we can use the mediaUrl as a sample.
      if (sourceTemplate.mediaUrl) {
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
    for (const wabaId of uniqueWabas) {
      const account = activeAccounts.find((a) => a.wabaId === wabaId);
      const response = await fetch(
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
      if (!data.error) {
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
      }
    }
    if (results.length > 0 && !sourceTemplate.wabaId)
      await prisma.template.update({
        where: { id: sourceTemplate.id },
        data: { isArchived: true },
      });
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

    // Aggregated stats
    const stats = {
      total: broadcast.messages.length,
      sent: broadcast.messages.filter((m) => m.status === "sent").length,
      delivered: broadcast.messages.filter((m) => m.status === "delivered").length,
      read: broadcast.messages.filter((m) => m.status === "read").length,
      failed: broadcast.messages.filter((m) => m.status === "failed").length,
    };

    res.json({
      ...broadcast,
      account: sanitizeAccount(broadcast.account),
      stats,
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

app.post("/api/broadcasts", async (req, res) => {
  try {
    const { accountId, templateId, contactIds } = req.body;
    if (!accountId || !templateId || !Array.isArray(contactIds)) {
      return res.status(400).json({ error: "Invalid input payload" });
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    const template = await prisma.template.findUnique({
      where: { id: templateId },
    });
    
    if (!account || !template) {
      return res.status(400).json({ error: "Account or Template not found" });
    }

    // 1. Create Broadcast record
    const broadcast = await prisma.broadcast.create({
      data: {
        accountId,
        templateId,
        contactIds,
        status: BROADCAST_STATUS.SENDING,
      },
      include: { account: true, template: true },
    });

    // 2. Fetch contacts
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
    });

    // 3. Log the start of the broadcast
    await logAction("BROADCAST_START", "Broadcast", broadcast.id, {
      contactCount: contacts.length,
      templateName: template.name,
    });

    // 4. Process each contact (Asynchronously in background for demo)
    // In a real app, this would be a worker/queue job
    const processBroadcast = async () => {
      let successCount = 0;
      let failureCount = 0;

      for (const contact of contacts) {
        const messageLog = await prisma.messageLog.create({
          data: {
            broadcastId: broadcast.id,
            contactId: contact.id,
            status: "queued",
          },
        });

        try {
          const components = [];
          if (template.headerType !== "TEXT" && template.mediaUrl) {
            components.push({
              type: "header",
              parameters: [
                {
                  type: template.headerType.toLowerCase(),
                  [template.headerType.toLowerCase()]: { link: template.mediaUrl },
                },
              ],
            });
          }

          if (template.variables?.length > 0) {
            components.push({
              type: "body",
              parameters: template.variables
                .sort((a, b) => Number(a.num) - Number(b.num))
                .map((v) => ({ type: "text", text: v.sample || "sample" })),
            });
          }

          const response = await fetch(
            `${META_API_BASE_URL}/${META_API_VERSION}/${account.phoneNumberId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${account.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: contact.phone,
                type: "template",
                template: {
                  name: template.name,
                  language: {
                    code: template.language || DEFAULT_TEMPLATE_LANGUAGE,
                  },
                  components: components.length > 0 ? components : undefined,
                },
              }),
            }
          );

          const metaData = await response.json();

          if (!response.ok || metaData.error) {
            throw new Error(metaData.error?.message || "Meta API Error");
          }

          // Update MessageLog on success
          await prisma.messageLog.update({
            where: { id: messageLog.id },
            data: {
              status: "sent",
              metaMessageId: metaData.messages?.[0]?.id,
              sentAt: new Date(),
            },
          });

          // Also record in ChatMessage for unified history
          await prisma.chatMessage.create({
            data: {
              contactId: contact.id,
              fromMe: true,
              type: "template_broadcast",
              body: `Broadcast Template: ${template.name}`,
              metaMessageId: metaData.messages?.[0]?.id,
            },
          });

          // Update Contact Analytics
          await prisma.contact.update({
            where: { id: contact.id },
            data: { 
              lastBroadcastAt: new Date(),
              lastMessageAt: new Date(),
            },
          });

          successCount++;
        } catch (error) {
          console.error(`Broadcast error for ${contact.phone}:`, error.message);
          await prisma.messageLog.update({
            where: { id: messageLog.id },
            data: {
              status: "failed",
              error: error.message,
            },
          });
          failureCount++;
        }
      }

      // Finalize Broadcast record
      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: {
          status: failureCount === 0 ? BROADCAST_STATUS.SENT : "completed_with_errors",
          results: { success: successCount, failure: failureCount },
        },
      });

      await logAction("BROADCAST_COMPLETE", "Broadcast", broadcast.id, {
        success: successCount,
        failure: failureCount,
      });
    };

    // Run in background
    processBroadcast().catch(err => console.error("Background broadcast failed:", err));

    res.json(broadcast);
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

app.post("/api/inbox/:contactId/send", async (req, res) => {
  try {
    const { contactId } = req.params;
    const { text, accountId } = req.body;

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

    // Send via Meta API
    const response = await fetch(
      `${META_API_BASE_URL}/${META_API_VERSION}/${account.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: contact.phone,
          type: "text",
          text: { body: text },
        }),
      }
    );

    const metaData = await response.json();
    if (!response.ok) throw new Error(metaData.error?.message || "Meta API Error");

    // Store in DB
    const message = await prisma.chatMessage.create({
      data: {
        contactId,
        fromMe: true,
        type: "text",
        body: text,
        metaMessageId: metaData.messages?.[0]?.id,
      },
    });

    await prisma.contact.update({
      where: { id: contactId },
      data: { lastMessageAt: new Date() },
    });

    res.json(message);
  } catch (error) {
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

    // Automated Meta API Sync
    let metaStatus = "synchronized";
    let metaError = null;
    
    try {
      const appId = process.env.META_APP_ID;
      const appSecret = process.env.META_APP_SECRET;

      if (appId && appSecret && url) {
        console.log("🚀 Starting automated Meta webhook synchronization...");
        
        // 1. Set App Webhook URL
        const appAccessToken = `${appId}|${appSecret}`;
        const subRes = await fetch(`${META_API_BASE_URL}/${META_API_VERSION}/${appId}/subscriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${appAccessToken}`,
          },
          body: JSON.stringify({
            object: "whatsapp_business_account",
            callback_url: url,
            verify_token: verifyToken,
            fields: ["messages", "message_echoes", "message_deliveries", "message_reads", "template_status"],
            include_values: true
          }),
        });
        
        const subData = await subRes.json();
        if (subData.error) throw new Error(`App Sub Error: ${subData.error.message}`);
        console.log("✅ App Webhook URL configured at Meta");

        // 2. Subscribe active WABAs to this app
        const activeAccounts = await prisma.account.findMany({
          where: { isActive: true, isArchived: false }
        });

        for (const acc of activeAccounts) {
          if (acc.wabaId && acc.accessToken) {
            const wabaSubRes = await fetch(`${META_API_BASE_URL}/${META_API_VERSION}/${acc.wabaId}/subscribed_apps`, {
              method: "POST",
              headers: { Authorization: `Bearer ${acc.accessToken}` },
            });
            const wabaSubData = await wabaSubRes.json();
            if (wabaSubData.error) {
              console.warn(`⚠️ Failed to subscribe WABA ${acc.wabaId}:`, wabaSubData.error.message);
            } else {
              console.log(`✅ WABA ${acc.wabaId} subscribed to app`);
            }
          }
        }
      } else {
        metaStatus = "manual_setup_required";
        if (!appId || !appSecret) metaError = "Missing META_APP_ID or META_APP_SECRET in .env";
      }
    } catch (e) { 
      console.error("❌ Meta Sync Failed:", e.message);
      metaStatus = "sync_failed";
      metaError = e.message;
    }

    res.json({ ...settings, metaStatus, metaError });
  } catch (error) {
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
    
    const response = await fetch(testUrl, { timeout: 5000 });
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

    // Check signature if it's a production request
    if (process.env.NODE_ENV === "production" && req.isMetaVerified === false) {
      console.warn("Invalid webhook signature rejected");
      return res.status(401).send("Invalid signature");
    }

    if (body.object === "whatsapp_business_account") {
      for (const entry of body.entry) {
        for (const change of entry.changes) {
          const { value } = change;

          // 1. Handle Status Updates (sent, delivered, read, failed)
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
              const { from: phone, type, text, image, id: metaId } = msg;

              // Find contact by phone
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

              // Update contact unread count and activity
              const updatedContact = await prisma.contact.update({
                where: { id: contact.id },
                data: {
                  unreadCount: { increment: 1 },
                  lastMessageAt: new Date(),
                  lastReplyAt: new Date(),
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
 
