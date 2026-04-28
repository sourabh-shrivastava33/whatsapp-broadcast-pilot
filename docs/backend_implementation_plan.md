# Backend Implementation Plan: WhatsApp Business API Integration

This document outlines the phase-by-phase implementation of a production-ready Node.js backend to replace the current frontend-only mockup. It will connect directly to the Meta Graph API to enable real WhatsApp message broadcasting.

## Goal
Transform the existing UI into a full-stack application by building a Node.js backend that handles real WhatsApp Business API integration (using your Developer Token), local data persistence, and message queuing.

## Architecture & Tech Stack
- **Backend Framework**: Node.js with Express.js
- **Database**: PostgreSQL (via Prisma ORM) for robust, local, free data persistence.
- **External API**: Meta Graph API (v20.0+) for WhatsApp Cloud API.
- **Frontend Integration**: We will modify the existing `src/store/*Context.jsx` files to make HTTP calls (`fetch` or `axios`) instead of purely local updates.

---

## Phase-wise Implementation Plan

### **Phase 1: Backend Scaffolding & Local Persistence**
**Goal**: Set up the Node.js server and replace `localStorage` with a real PostgreSQL database.
- Initialize `server/` directory in the monorepo.
- Setup Express server, CORS, and basic error handling.
- Setup PostgreSQL database schema using Prisma for `Accounts`, `Contacts`, `Templates`, and `Broadcasts`.
- Build basic REST API endpoints (`GET/POST /api/accounts`, `/api/contacts`, etc.).
- Update frontend context providers to sync with these APIs instead of `localStorage`.

### **Phase 2: Meta Manager Sync & Account Import** ✅ IN PROGRESS
**Goal**: Allow seamless import of phone numbers from Meta Business Manager without manual data entry.

#### Backend
- `POST /api/meta/discover` — Accepts `businessId` + `accessToken`. Calls Graph API to:
  - Fetch all owned & client WABAs (`/owned_whatsapp_business_accounts`, `/client_whatsapp_business_accounts`).
  - For each WABA, fetch all phone numbers (`/{waba_id}/phone_numbers`).
  - Return a combined list with display name, number, quality rating, and status.
- `POST /api/meta/sync-account` — Save a discovered/selected phone number into PostgreSQL.
- `PUT /api/accounts/:id/enable` / `PUT /api/accounts/:id/disable` — Toggle account active state.

#### Frontend (Accounts Page Overhaul)
- Replace manual "Connect Account" form with **"Import from Meta Manager"** button.
- New `MetaDiscoveryModal.jsx` — Two-step modal:
  - **Step 1**: Enter Business Manager ID + Access Token → click "Discover".
  - **Step 2**: See a table of all discovered numbers (showing WABA name, number, quality rating, status) with checkboxes to select which to import.
- Updated `Accounts.jsx` — Full accounts manager page with:
  - List of all imported numbers with live status badges (quality rating, enabled/disabled).
  - Per-card Enable / Disable / Set Active / Remove actions.
  - "Sync" button to re-fetch latest data from Meta.

#### Test Criteria (Pass before moving to Phase 3)
- [ ] Can discover phone numbers from a real Meta Business Manager account.
- [ ] Discovered numbers can be selected and imported into PostgreSQL.
- [ ] Imported accounts appear on the Accounts page with correct status.
- [ ] Enable/Disable toggles work and persist.
- [ ] Page refreshes show imported accounts from the DB.

---

### **Phase 3: Template Syncing & Submission**
**Goal**: Read and submit templates directly to your Meta WhatsApp Business Account.
- Fetch templates: `GET https://graph.facebook.com/v20.0/{waba_id}/message_templates` to populate the approved templates list.
- Submit templates: `POST https://graph.facebook.com/v20.0/{waba_id}/message_templates` to actually create templates in Meta when the user builds them in our UI.
- Status updates: Sync template statuses (APPROVED, REJECTED, PENDING) directly from Meta instead of simulating it.
- **Test Criteria**: Templates list syncs from Meta and manual template submission creates a real template in Meta.

---

### **Phase 4: The Broadcast Engine (Sending Real Messages)**
**Goal**: Send actual WhatsApp messages to the selected contacts.
- Implement `/api/broadcasts/send` which iterates over selected contacts.
- Map the local template variables to Meta's expected `components` structure.
- Call `POST https://graph.facebook.com/v20.0/{phone_number_id}/messages` for each contact.
- Handle rate-limits and Meta API error responses.
- **Test Criteria**: A real WhatsApp message is received on the test number.

---

### **Phase 5: Webhooks & Live Status Updates**
**Goal**: Receive real-time delivery receipts (Sent, Delivered, Read).
- Create a webhook endpoint `/api/webhooks/whatsapp` that Meta can call.
- Handle webhook verification challenge from Meta.
- Process incoming `statuses` payload to update broadcast recipient status in PostgreSQL.
- Provide a polling endpoint or WebSocket for the frontend to show live status updates on the Broadcast page.
- **Test Criteria**: Sending a broadcast shows real-time Sent → Delivered → Read status transitions in the UI.
