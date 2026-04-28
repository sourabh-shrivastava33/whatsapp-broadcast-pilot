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

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
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
    const contacts = await prisma.contact.findMany();
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: "Fetch failed" });
  }
});

app.post("/api/contacts", async (req, res) => {
  try {
    const contact = await prisma.contact.create({ data: req.body });
    res.status(201).json(contact);
  } catch (error) {
    res.status(500).json({ error: "Create failed" });
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

app.get("/api/broadcasts", async (req, res) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      include: { account: true, template: true },
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
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });
    const template = await prisma.template.findUnique({
      where: { id: templateId },
    });
    if (!account || !template)
      return res.status(400).json({ error: "Invalid input" });

    const broadcast = await prisma.broadcast.create({
      data: {
        accountId,
        templateId,
        contactIds,
        status: BROADCAST_STATUS.SENDING,
      },
      include: { account: true, template: true },
    });
    const contacts = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
    });

    for (const contact of contacts) {
      const components = [];

      // 1. Header component (Media or Text with variables)
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
      } else if (
        template.headerType === "TEXT" &&
        template.header.includes("{{")
      ) {
        // If text header has variables, handle them here (simplified for demo)
        // components.push({ type: "header", parameters: [...] });
      }

      // 2. Body component
      if (template.variables?.length > 0) {
        components.push({
          type: "body",
          parameters: template.variables
            .sort((a, b) => Number(a.num) - Number(b.num))
            .map((v) => ({ type: "text", text: v.sample || "sample" })),
        });
      }
      await fetch(
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
        },
      );
    }
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: BROADCAST_STATUS.SENT },
    });
    res.json(broadcast);
  } catch (error) {
    res.status(500).json({ error: "Broadcast failed" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
