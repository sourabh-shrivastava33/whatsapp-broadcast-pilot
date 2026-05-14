# Current State Product Specification: WhatsApp Broadcast CRM

## Executive Summary
The product is a production-ready, multi-tenant WhatsApp Broadcast CRM built to manage WhatsApp business messaging at scale. It is primarily optimized for **Residential Real Estate sales in India**, evidenced by specialized AI agents ("Triage", "Sales/Broker", "Objection") configured to extract real estate qualification data (Budget, Location, Property Type, etc.) and handle common Indian buyer objections (Price, Legal, Delays) in English and Hinglish. 

The application facilitates mass broadcasting of Meta-approved templates, multi-agent AI inbound response handling, contact management, and team collaboration. It utilizes a modern tech stack (React/Vite frontend, Node.js/Express backend, Prisma/PostgreSQL database, and BullMQ/Redis for background jobs) and is architected to handle Meta Cloud API rate limits and Webhooks.

## Current Product Spec

### Architecture Overview
- **Frontend**: React SPA (Single Page Application) built with Vite. It features lazy-loaded routes for performance, modern styling (Vanilla CSS with a premium aesthetic), and real-time updates via Socket.io.
- **Backend**: Node.js (v22+) Express server providing REST APIs. Includes security headers (Helmet), rate limiting, and CORS configuration.
- **Database**: PostgreSQL managed via Prisma ORM.
- **Queuing & Background Jobs**: BullMQ backed by Redis (configured for Upstash compatibility) for handling intensive tasks like broadcasting (`broadcastEngine.js`) and processing inbound AI messages (`agentic/worker.js`).
- **Media Storage**: Supabase Cloud Storage is integrated for uploading and serving media assets (images, videos, documents) used in broadcasts and chat.

### 1. Module Breakdown
**Implemented:**
- **Authentication & Tenancy**: JWT-based authentication. Users belong to Workspaces (Tenants) via Memberships. All major data models are scoped by `workspaceId` using Prisma client extensions and `AsyncLocalStorage` for context.
- **RBAC (Role-Based Access Control)**: Hierarchical roles (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`) enforced via Express middleware (`middleware/rbac.js`). Specific permissions (e.g., `BROADCASTS_MANAGE`, `CONTACTS_VIEW`) are mapped to routes.
- **WhatsApp Account Management**: Syncing and managing multiple WhatsApp Business Accounts (WABAs) and Phone Numbers. Includes real-time health checks, quality rating monitoring, and messaging tier limits.
- **Contact Management**: Auto-creation of contacts on inbound messages, bulk import via CSV/JSON, blocklisting, and tracking lead stages and AI-driven qualification data.
- **Template Builder & Sync**: Fetching templates from Meta, submitting new templates (including media headers and OTP/URL buttons) to Meta for approval, and local syncing.
- **Broadcast Engine**: A robust, tier-aware broadcast engine that partitions audiences across multiple active WhatsApp numbers to maximize throughput while respecting Meta's 80 msg/s limit. Includes exponential backoff for Meta API errors.
- **Agentic AI Inbox**: An advanced, multi-modal AI workflow using `@openai/agents` and Gemini 1.5 Pro. It routes inbound messages through specialized agents (Triage -> Sales -> Objection) to qualify leads autonomously.
- **Media Library**: Management of uploaded media assets (Supabase), including deduplication (via hash), folders, and usage tracking.
- **Webhooks**: Handles Meta's webhook verification and processes real-time events (message delivery statuses, inbound messages, account quality updates).

**Partially Implemented:**
- **Segments/Filtering**: The `Segment` model exists, and creation is possible, but actual contact filtering logic in `GET /api/segments/:id/contacts` is basic and notes DB-specific Prisma array filtering limitations.
- **Analytics/Stats**: A basic endpoint (`/api/stats/broadcast-activity`) exists for a 7-day activity chart, but comprehensive analytics (e.g., campaign ROI, detailed agent performance) are minimal.

**Missing:**
- Automated billing/subscriptions for the SaaS model (Stripe/Razorpay integration is absent).
- Deep CRM integrations (e.g., Salesforce, HubSpot). The `crmId` field exists, but no sync engine is present.

### 2. Data Model Summary (Prisma)
- **Global Entities**: `User`, `Workspace`, `Membership`, `SystemConfig`, `AuditLog`.
- **Tenant-Scoped Entities (Belong to a Workspace)**:
  - `Account`: A connected WhatsApp Phone Number & WABA.
  - `Contact`: A lead/customer. Includes real estate `qualificationData`, `intentScore`, and `aiSessionState`.
  - `Segment`: Saved contact filters.
  - `Template`: Meta-approved message templates.
  - `Media` & `Folder`: Stored assets.
  - `Broadcast`: A messaging campaign linking an Account, Template, and array of Contact IDs.
  - `MessageLog`: Tracks individual delivery status (queued, sent, delivered, read, failed) for broadcasts.
  - `ChatMessage`: Individual inbound/outbound messages for the Inbox.
  - `WebhookSetting`: Workspace-specific Meta webhook configuration.

### 3. Workflow Summary
**Outbound Broadcast Flow:**
1. User selects a Template, Audience (Contacts), and maps variables in the UI.
2. `POST /api/broadcasts` validates capacity against Account messaging tiers, creates a `Broadcast` DB record (status: sending), and pushes a job to `broadcast-queue`.
3. `broadcastEngine.js` (via `worker.js`) partitions the contacts across available active accounts, respecting `lastAccountId` (Identity Pinning) so contacts hear from the same number.
4. Messages are dispatched to Meta's API with throttling (max 80/sec) and exponential backoff for 429 errors.
5. Delivery status updates arrive via Webhook, updating `MessageLog` and emitting Socket.io events.

**Inbound Agentic AI Flow:**
1. Meta sends an inbound message to the `/api/webhooks` endpoint.
2. The webhook auto-creates/updates the `Contact`, saves the `ChatMessage`, emits a Socket event, and pushes to `incoming-message-queue`.
3. `agentic/worker.js` picks up the job. If the message contains media, it uses Gemini (`multimodal.js`) to transcribe/describe it.
4. `agentic/runner.js` loads the chat history and invokes the AI Agent workflow.
5. The `TriageAgent` categorizes intent, potentially passing to the `ObjectionAgent` (handles fears) or `Real_Estate_Broker` (qualifies the lead using the `update_lead_intelligence` tool).
6. The final AI response is sent back via WhatsApp API, saved to the DB, and pushed to the UI.

### 4. Gaps, Risks, and Inconsistencies

**Risks & Bugs:**
- **Webhook Concurrency Race Conditions**: The webhook attempts to handle unique constraint (`P2002`) errors when auto-creating contacts during simultaneous inbound messages, but high volume could still cause missed updates if not queued properly before DB writes.
- **Media Fallback in Broadcasts**: If Supabase upload fails during a broadcast or template submission, it falls back to a public URL link, which might fail Meta's strict media URL validation if not accessible.
- **Account Disconnection Handling**: If an Account's Meta token expires, the system logs it during health checks, but ongoing broadcasts might fail catastrophically for that partition until manually intervened.

**Inconsistencies:**
- **CORS vs Allowed Origins**: The code references `ALLOWED_ORIGIN` in production for CORS, but also uses `*` in local dev, which was previously flagged by the user as a bug they tried to fix in past conversations.
- **Agent Context vs Real Time**: The AI agent relies on `aiSessionState` stored on the `Contact`. If a user sends messages in rapid succession, the agent runner might suffer from race conditions writing the updated session state back to the DB.

### 5. Product Assumptions Embedded in Codebase
- **Industry Niche**: The AI agents are hardcoded with prompts for Indian Residential Real Estate (BHK, Villas, Plots, EMI, RERA, Hinglish). Adapting this to another vertical (e.g., E-commerce) requires rewriting `agentic/agents.js` and `agentic/tools.js`.
- **Identity Pinning**: The system assumes it's highly desirable for a contact to always be messaged by the same WhatsApp account (`lastAccountId`).
- **Media Types**: Assumes audio messages are `.ogg` (WhatsApp default) and defaults documents to PDF when estimating MIME types.
- **Tier Limits**: Hardcodes Meta's standard tiers (250, 1K, 10K, 100K) and enforces limits locally to prevent Meta bans.

### 6. Product Direction Implied
The codebase is transitioning from a single-tenant CRM to a multi-tenant SaaS. The presence of `Workspace`, `Membership`, `tenancy.js`, and `rbac.js` indicates the infrastructure for a commercial SaaS is in place, but it lacks the onboarding, billing, and super-admin layers necessary for public signups. The deep integration of `@openai/agents` shows a pivot towards "AI-First Customer Support & Sales Qualification" rather than just a dumb broadcast tool.

### Open Questions for Next Requirement Phase
1. **Multi-Tenancy Scaling**: Are we opening this up for self-serve SaaS registration, or is this still invite/manual-provisioning only? If self-serve, where do billing and subscription tiers fit in?
2. **AI Flexibility**: Do we need a UI to let tenants customize their AI Agent prompts (e.g., for non-Real Estate clients), or is the product exclusively a Real Estate tool?
3. **Template Syncing**: Currently, `sync-templates` grabs templates from Meta to the local DB. If a user has 10,000 templates, this could timeout. Do we need pagination/background syncing for templates?
4. **CRM Integrations**: The DB has `crmId` and `crmStatus`. What CRMs (Salesforce, Zoho) are targeted for integration next?
