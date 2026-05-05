# SaaS Phase Plan: WhatsApp CRM Transformation

This document outlines the canonical phase-by-phase roadmap for transforming the single-tenant WhatsApp CRM into a production-grade multi-tenant SaaS platform.

## Phase 0: Repo and Release Foundation
**Goal**: Establish the execution scaffold and documentation standards.
- [x] Define phase order and gates.
- [x] Establish branch naming and PR conventions.
- [x] Initialize tracking artifacts.

### Conventions
- **Branch Naming**: `phase/XX-name` (e.g., `phase/01-auth`).
- **PR Conventions**: 
    - Max 500 lines per PR.
    - Mandatory description of architectural impact.
    - No merging until manual or automated verification passes.
- **Test Gates**:
    - Backend: `npm test` in `/server`.
    - Frontend: Build check `npm run build`.
    - E2E: (Optional) Manual verification of the specific phase feature.
- **Deployment Gates**:
    - All phases must be merge-ready to `main`.
    - Deployment to production only after Phase 10 validation.
- **Rollback Expectations**:
    - DB migrations must be reversible.
    - Code changes must be atomic per phase.

---

## Phase 1: Identity Foundation
**Goal**: Introduce the identity layer (Users/Auth).
- [ ] Design Auth model (JWT, session, provider).
- [ ] Implement Sign-in/Sign-up/Recovery.
- [ ] Define protected vs public routes.

## Phase 2: Tenancy Foundation
**Goal**: Make the application workspace-aware.
- [ ] Define Workspace and Membership models.
- [ ] Implement Backend context propagation (AsyncLocalStorage).
- [ ] Enforce row-level isolation in Prisma.

## Phase 3: RBAC Foundation
**Goal**: Implement enforceable roles and permissions.
- [ ] Define Role catalog (Owner, Admin, Member, Viewer).
- [ ] Implement Permission checking middleware.
- [ ] Enforce visibility rules in UI and API.

## Phase 4: Onboarding Foundation
**Goal**: Guided conversion-focused entry flow.
- [ ] Design the Workspace setup wizard.
- [ ] Implement WABA connection flow within Workspace context.
- [ ] Define "First-Value" moment logic.

## Phase 5: UI Shell Foundation
**Goal**: Premium app shell and navigation.
- [ ] Implement App Shell with Sidebar and Topbar.
- [ ] Add Workspace Switcher.
- [ ] Implement Loading Skeletons and Empty States.

## Phase 6: Page System
**Goal**: Full page architecture implementation.
- [ ] Port/Build all pages (Contacts, Broadcasts, AI Agents, etc.) with Tenant guards.
- [ ] Ensure consistent Error/Forbidden/Loading states.

## Phase 7: Data Migration Foundation
**Goal**: Prepare existing data for SaaS.
- [ ] Plan schema backfill (assigning existing data to a "Legacy" tenant).
- [ ] Implement validation scripts for data integrity.

## Phase 8: Jobs, AI, and Webhooks
**Goal**: Tenant-safe async flows.
- [ ] Scope BullMQ jobs to `tenantId`.
- [ ] Map incoming Webhooks to the correct Workspace.
- [ ] Isolate AI Agent context per tenant.

## Phase 9: Hardening and Quality
**Goal**: Production safety and performance.
- [ ] Implement Audit Trails and Security Headers.
- [ ] Performance tuning and test expansion.

## Phase 10: Release and Deployment
**Goal**: Safe production rollout.
- [ ] Staging validation.
- [ ] Feature flag and Rollback plans.
- [ ] Production deployment.

---

## Approval Gates
- **Phase 0**: Plan Approval.
- **Phase 1**: Auth Provider/Model Approval.
- **Phase 2**: Isolation Strategy Approval.
- **Phase 3**: Permission Matrix Approval.
- **Phase 7**: Migration Script Approval.
- **Phase 10**: Deployment Readiness Approval.
