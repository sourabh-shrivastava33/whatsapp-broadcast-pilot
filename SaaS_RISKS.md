# SaaS Transformation Risk Register

This document tracks identified risks and mitigation strategies throughout the project.

| Risk ID | Risk Description | Severity | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **R01** | **Index.js Fragility** | High | High | Strict "No-Refactor" rule until phase-appropriate modules are built. |
| **R02** | **Cross-Tenant Leakage** | Critical | Low | Database-level row filters (Prisma middleware) + API context enforcement. |
| **R03** | **Data Loss (Migration)** | Critical | Low | Transaction-based migrations + pre/post-migration validation scripts. |
| **R04** | **Performance Degradation** | Medium | Medium | DB Indexing on `tenantId` + optimized Prisma queries. |
| **R05** | **Auth Bypass** | High | Low | Global middleware for auth/permission checks; explicit allow-lists for public routes. |

---

## Active Watchlist
- **Index.js Growth**: Ensure new features are being built in subfolders to prevent `index.js` from getting larger.
- **WABA Multi-Tenancy**: Verifying how Meta's API handles multiple WABAs across different workspaces.
