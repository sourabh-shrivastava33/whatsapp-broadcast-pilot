# SaaS Execution Plan: WhatsApp CRM Transformation

## 1. Executive Summary

### Current State
The codebase is currently a functional, single-tenant WhatsApp Broadcast CRM. It provides robust features for managing WhatsApp Business Accounts (WABA), contact lists, broadcast campaigns, and template management. However, it lacks any concept of users, organizations, or data isolation. All data is globally accessible to anyone who can reach the API.

### Target State
The transformation will turn this into a production-grade, multi-tenant SaaS platform. Each customer will operate within their own isolated "Workspace" (Tenant). The system will support multiple users per workspace with Role-Based Access Control (RBAC), a guided onboarding flow, and a billing-ready architecture.

### Biggest Blockers
1.  **Lack of Identity**: No user/auth model exists in the database or API.
2.  **Global Data Models**: All existing tables (`Contact`, `Broadcast`, `Template`, etc.) lack a `tenantId` or ownership field.
3.  **Unprotected API**: All endpoints are public and lack middleware for authentication or authorization.
4.  **Static Configuration**: Many system settings are currently global or environment-variable driven rather than tenant-specific.

### Reusable Assets
*   **WhatsApp Engine**: The core logic for sending broadcasts and handling webhooks is robust and reusable.
*   **Feature UI**: The existing pages for Broadcasts, Templates, and Contacts are well-built and can be reused once wrapped in tenant/auth guards.
*   **Worker Architecture**: The Redis-backed queue system for processing messages is highly scalable.

### New Requirements (From Scratch)
*   **Identity & Access Management (IAM)**: Auth, Roles, Permissions.
*   **Tenant Architecture**: Workspace creation, tenant isolation middleware, and data partitioning.
*   **Onboarding Engine**: Multi-step wizard to guide new users from sign-up to their first broadcast.
*   **Admin/Super-Admin Panels**: Tools to manage the platform and support customers.

---

## 2. Product Target State

### SaaS End State
A "Slack-like" multi-tenant experience where users can sign up, create or join a workspace, and manage their WhatsApp marketing operations in complete isolation.

### Tenant Model
*   **Logical Isolation**: Single database with `tenantId` (Row-Level Security pattern) for all tenant-scoped entities.
*   **Workspace**: The primary unit of tenancy. Everything (Contacts, Broadcasts, Billing) belongs to a Workspace.

### User & Role Model
*   **User**: A global identity (unique email) that can be a member of multiple Workspaces.
*   **Roles**:
    *   **Owner**: Full access + Billing + Workspace deletion.
    *   **Admin**: Full access to CRM features + User management.
    *   **Member**: Full access to CRM features (Templates, Broadcasts, Contacts).
    *   **Viewer**: Read-only access to analytics and logs.
    *   **Super-Admin**: Global access for platform operators (Internal only).

### Onboarding Journey
1.  **Registration**: Email verification / Social login.
2.  **Workspace Setup**: Name, Industry, Brand details.
3.  **WABA Connection**: Integrated "Login with Facebook" flow to connect WhatsApp numbers.
4.  **Verification**: Automated check of WABA health.
5.  **Activation**: Guided path to upload first 10 contacts and send a test template.

---

## 3. Information Architecture / Page Plan

This plan outlines every page required for the SaaS platform. All pages must handle the following states: **Loading**, **Empty**, **Error**, **No-Access**, and **Success**.

### 3.1 Authentication & Entry
| Page | Purpose | Main User | Entry | Exit | Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Landing Page** | Marketing/Conversion| Guest | URL | Signup/Login | Guest |
| **Sign In** | User Access | User | Landing | Dashboard | Guest |
| **Sign Up** | Account Creation | Guest | Landing | Onboarding | Guest |
| **Auth Recovery** | Password Reset | User | Login | Login | Guest |

### 3.2 Workspace & Onboarding
| Page | Purpose | Main User | Entry | Exit | Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Workspace Switcher**| Select Org | User | Login | Dashboard | `auth` |
| **Onboarding Wizard** | Setup Guide | Owner | Signup | Dashboard | `org:setup` |
| **Invite Team** | Grow Workspace | Admin | Settings | Settings | `team:manage` |

### 3.3 Core CRM Operations
| Page | Purpose | Main User | Entry | Exit | Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | Overview | All | Sidebar | Any | `dash:view` |
| **Contacts** | Lead List | Member | Sidebar | Detail | `contact:view`|
| **Contact Detail** | 360 View | Member | List | List | `contact:view`|
| **Broadcasts** | Campaign List | Member | Sidebar | Detail | `bc:view` |
| **Broadcast Detail** | Analytics | Member | List | List | `bc:view` |
| **Media Library** | Asset Mgmt | Member | Sidebar | Preview | `media:view` |
| **Template Builder**| Content Creation | Admin | Templates| Templates| `temp:create`|
| **Inbox** | Shared Messaging | Member | Sidebar | Contact | `inbox:view` |

### 3.4 Management & Settings
| Page | Purpose | Main User | Entry | Exit | Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User Management** | Roles/Invites | Admin | Settings | Detail | `user:manage` |
| **Billing** | Subscriptions | Owner | Settings | Stripe | `bill:manage` |
| **Integrations** | Webhooks/Meta | Admin | Settings | Form | `set:manage` |
| **Audit Log** | Governance | Admin | Sidebar | Filter | `audit:view` |

### 3.5 System & Support
| Page | Purpose | Main User | Entry | Exit | Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Maintenance** | Downtime Display | All | Global | N/A | Guest |
| **Unauthorized** | 403 Forbidden | All | Guard | Home | `auth` |
| **Not Found** | 404 Missing | All | Invalid URL| Home | Guest |

---

## 4. Component Plan

Every component must implement standard states: **Loading (Skeleton)**, **Empty (Illustration/CTA)**, **Error (Boundary)**, and **Permission-Denied (Blurred/Locked)**.

### 4.1 Navigation Shell
*   **Navigation Shell**: The primary container for the app. Owns the sidebar and topbar state. Reads User/Workspace context.
*   **Sidebar**: Main navigation links. Reusable across all workspace-scoped pages.
*   **Tenant Switcher**: Dropdown in the topbar. Writes `activeWorkspaceId` to local storage/session.

### 4.2 Security Components
*   **Auth Guard**: Higher-Order Component (HOC) or Wrapper. Redirects to `/login` if `!authenticated`.
*   **Permission Guard**: Functional component. Wraps UI elements (e.g., "Delete" buttons) and checks `user.permissions` against `required`.
*   **Error Boundary**: Reusable wrapper to catch React lifecycle errors and display a fallback UI.

### 4.3 Data Components
*   **DataTable**: The workhorse for Contacts, Broadcasts, and Logs. Handles sorting, pagination, and bulk selection. Reads from API endpoints.
*   **Filters**: Sidebar or Drawer-based component. Owns filter state and updates parent query params.
*   **Modals/Drawers**: For creation flows. Reusable for "New Contact", "New Template", etc. Isolated state per instance.

### 4.4 SaaS Specifics
*   **Onboarding Stepper**: Controlled component. Reads `onboardingStatus` from Tenant context. Writes completion events to API.
*   **Billing Cards**: Display-only for Pricing pages. Reusable across Landing and Settings.
*   **Analytics Cards**: Visualizations for the Dashboard. Reads summarized metrics.
*   **Skeleton Loaders**: Custom SVGs mimicking the structure of Tables and Cards.

### 4.5 Utility Components
*   **Toast System**: Global state (Context/Redux). Reads alerts from any component and displays temporary notifications.
*   **Upload Component**: Reusable dropzone. Writes files to `workspace/` scoped cloud storage.
*   **Global Search**: (Deferred) Search across Contacts, Templates, and Broadcasts.

---

## 5. SaaS Architecture Plan

### 5.1 Tenant Context Establishment
*   **Identification**: The `workspace_slug` or `workspaceId` is extracted from the request (e.g., `workspace.crm.com` subdomain or `X-Workspace-Id` header).
*   **Validation**: Middleware verifies the authenticated user has a valid `Membership` record for that workspace.
*   **Establishment**: The verified `workspaceId` is attached to the request object (`req.workspaceId`) and made available to all downstream controllers.

### 5.2 Context Enforcement (Isolation)
*   **Request Level**: A global middleware intercepts every API call (except public ones) and injects the `workspaceId` into a Thread-Local Storage (using `AsyncLocalStorage` in Node.js) or explicitly passes it to services.
*   **Database Level**: Prisma middleware (Client Extensions) intercepts every query. It automatically appends `where: { workspaceId: currentContext.workspaceId }` to all `find`, `update`, `delete`, and `upsert` operations. This ensures developers cannot accidentally query data from another tenant.
*   **Creation Level**: Every `create` operation automatically has `workspaceId` injected from the context.

### 5.3 Async & Background Enforcement
*   **Queue Payloads**: Every job pushed to Redis (BullMQ/Bee-Queue) must include the `workspaceId` in its data payload.
*   **Worker Context**: When a worker picks up a job, its first action is to re-establish the tenant context from the payload before executing any logic.
*   **Webhook Routing**: For incoming Meta webhooks (which lack tenant IDs), the system performs a lookup on the `phoneNumberId` to find the corresponding `Account` record and its `workspaceId`. Once found, it proceeds with the established context.

### 5.4 Cross-Tenant Leakage Prevention
*   **Shared Infrastructure**: All tenants share the same DB and Redis clusters but are logically separated by `workspaceId`.
*   **Storage Pathing**: Files uploaded to Supabase/S3 are stored under keys like `/{workspaceId}/media/{fileId}`. Access tokens for media are scoped to the workspace.
*   **Strict FKs**: Database-level foreign keys ensure that a Contact belonging to Workspace A cannot be associated with a Broadcast from Workspace B.

### 5.5 Admin vs. Tenant User Separation
*   **Tenant User**: Access is scoped strictly to their `Membership`.
*   **Super-Admin**: A separate role with a `isSystemAdmin` flag. Bypasses the `workspaceId` filter in specific admin-only controllers to allow platform management.
*   **Surface Separation**: The UI uses a "Admin Mode" toggle for Super-Admins, switching the context from a single workspace to a global view.

---

## 6. Onboarding Plan

### 6.1 Strategies
*   **Minimal Friction Version**: For self-serve signups. Allows account creation and dashboard access immediately with "Connect WABA" as a persistent CTA.
*   **Guided Version**: A forced wizard for the first Workspace Owner. Ensures no "empty dashboard" syndrome.
*   **Skip/Later Behavior**: Users can skip WABA connection but will see "Read-Only/Demo" data in the dashboard until a real connection is made.

### 6.2 Validation & Data Entry
*   **Required Fields**: User Email, Password, Workspace Name, WABA ID, Access Token.
*   **Optional Fields**: Business Category, Team Invites, Brand Logo.
*   **Validation Rules**: 
    *   WABA ID must be numeric.
    *   Access Token must pass a "test-fetch" from Meta API during setup.
    *   Workspace Name must be unique within the platform (for slugs).

### 6.3 Recovery & Failure Flows
*   **Abandonment Recovery**: If a user drops off at Step 3 (WABA connection), trigger an email sequence after 2, 24, and 72 hours.
*   **Retry Flows**: If "Meta Token Verification" fails, provide clear error messages and a link to the "Meta Developer Portal" troubleshooting guide.
*   **Success Criteria**: A successful broadcast sent to the owner's own number.

---

## 7. RBAC Plan

| Role | Allowed Actions | Disallowed Actions | UI Restrictions |
| :--- | :--- | :--- | :--- |
| **Owner** | All | None | None |
| **Admin** | CRM, Team mgmt | Billing delete, Workspace delete | No "Delete Org" button |
| **Member** | Create/Send Broadcasts | Team settings, Webhook config | Settings menu hidden |
| **Viewer** | Read-Only Analytics | All Write actions | "Create" buttons disabled |

**Backend Enforcement**: Every API request is wrapped in a `can(user, 'action')` check that verifies both role and workspace ownership.

---

## 8. Data Model and Migration Plan

### 8.1 Entity Ownership
*   **Tenant-Scoped**: `Contact`, `Broadcast`, `Template`, `Media`, `Folder`, `Segment`, `MessageLog`, `WebhookSetting`.
*   **Shared/Global**: `SystemConfig` (Global maintenance), `BaseRoles` (Default platform roles).

### 8.2 Migration Execution
1.  **Backfill Strategy**:
    *   Create a "Seed Tenant" representing the current legacy data.
    *   Bulk update all existing records with the Seed Tenant ID.
2.  **Safety Checks**: 
    *   Pre-migration: Run `SELECT COUNT(*)` on all tables to ensure numbers match post-migration.
    *   Post-migration: Verify a random sample of 5% of records for correct `tenantId` assignment.
3.  **Rollback Strategy**: 
    *   Perform all changes within a SQL transaction. 
    *   Keep a backup of the DB prior to Phase 2.
4.  **Validation**:
    *   A "Migration Verification Script" will run queries like `SELECT * FROM Contacts WHERE tenantId IS NULL` (expected count: 0).

---

## 9. Test Strategy by Phase

### Phase Goals
*   **Unit**: Test auth middleware and permission logic in isolation.
*   **Integration**: Verify `tenantId` enforcement in Prisma queries.
*   **E2E**: Full signup-to-broadcast journey testing.
*   **Security**: Penetration testing for cross-tenant data access.

---

## 10. Phase-by-Phase Execution Plan

### Phase 1: Identity Foundation
*   Implement User and Auth models.
*   Build Sign-up and Login API/UI.
*   **Gate**: Successful user creation and authentication.

### Phase 2: Multi-Tenancy Core
*   Implement Tenant and Membership models.
*   Add `tenantId` to all entities.
*   **Gate**: Data isolation verified via unit tests.

### Phase 3: RBAC & Middleware
*   Implement Permission checking middleware.
*   Restrict existing routes based on roles.
*   **Gate**: Unauthorized users blocked from sensitive routes.

### Phase 4: Onboarding Engine
*   Build the multi-step onboarding wizard.
*   Connect WABA logic to tenant context.
*   **Gate**: New user can reach the dashboard autonomously.

### Phase 5: UI Refactor
*   Implement Tenant Switcher and App Shell.
*   Add empty/loading states to all pages.
*   **Gate**: Visual consistency check across all pages.

### Phase 6: Production Hardening
*   Audit logging implementation.
*   Billing integration (Stripe).
*   **Gate**: Production-ready release tagging.

---

## 11. Decision Log / Approval Gates

| Decision Point | Impact | Recommendation |
| :--- | :--- | :--- |
| **Auth Strategy** | Security & UX | JWT with HTTP-only Cookies |
| **Tenancy Type** | Maintenance vs Scaling | Single DB, Row-Level Isolation |
| **Onboarding Depth** | Conversion Rate | Guided Wizard with "Skip" option |

> [!IMPORTANT]
> **STOP: Approval Required.**
> Do you approve the Tenancy Model (Single DB / Row-Level) and the Phase-by-Phase approach?

---

## 12. GitHub Execution Plan
*   **Strategy**: GitFlow (Develop -> Staging -> Main).
*   **PR Size**: Max 500 lines per PR for thorough review.

## 13. Risk Register
*   **Leakage**: High Severity / Low Likelihood (Mitigated by Middleware).
*   **Latency**: Medium Severity (Mitigated by DB Indexing).

## 14. Final Delivery Definition
*   The application supports multiple organizations.
*   Data is strictly isolated per organization.
*   Role-based access is enforced on both Frontend and Backend.
*   Full onboarding flow is functional.
