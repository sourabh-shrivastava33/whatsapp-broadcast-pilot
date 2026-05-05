# SaaS Architecture Decisions (ADR)

This document records the key architectural decisions and tradeoffs made during the SaaS transformation.

## ADR 0: Phase-Based Execution Strategy
- **Status**: Proposed (Phase 0)
- **Context**: The existing codebase is single-tenant and centralized in `index.js`.
- **Decision**: Adopt a strict phase-gated execution model as defined in `phasewise.md`. Confine changes to phase-specific branches.
- **Consequence**: Slower execution but significantly higher reliability and lower risk of breaking existing functionality.

## ADR 1: Documentation-First Approach
- **Status**: Proposed (Phase 0)
- **Context**: Large transformation projects often suffer from knowledge loss.
- **Decision**: Maintain a mandatory implementation log with file-level traceability.
- **Consequence**: Increased overhead for the engineer (AI), but creates a self-documenting system for future maintainers.

## ADR 2: Authentication Strategy
- **Status**: Proposed (Phase 1)
- **Context**: Need a secure, scalable identity layer that supports multi-tenancy.
- **Decision**: Use custom JWT-based authentication with `bcryptjs` for password hashing and HTTP-only cookies for token storage.
- **Rationale**: 
    - Full control over the user lifecycle.
    - No vendor lock-in.
    - Direct integration with the primary Neon database allows for efficient relational queries between Users and Tenancy entities (to be built in Phase 2).
    - Enhanced security via HTTP-only cookies prevents client-side script access to tokens.
- **Consequence**: Requires manual implementation of login/register/logout logic and session management.

---

## Pending Decisions
| Decision Point | Impact | Recommendation |
| :--- | :--- | :--- |
| **Tenancy Isolation** | Phase 2 | Shared DB with `tenantId` (Logical Isolation). |
| **Async Context** | Phase 8 | Use Node.js `AsyncLocalStorage` for `tenantId` propagation. |
