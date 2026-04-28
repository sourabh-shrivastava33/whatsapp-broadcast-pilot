# WhatsApp Broadcast CRM — Agent Rules

## 0. Mission

You are working on a WhatsApp Broadcast CRM for Indian real estate businesses.

The goal is not just to build features. The goal is to produce a **demo-ready, pilot-ready product** that can show an end-to-end business workflow:

1. connect WABA
2. fetch phone numbers
3. import contacts
4. segment leads
5. create and approve templates
6. send broadcasts
7. track delivery
8. capture replies
9. show follow-up status
10. display business outcomes

Every implementation decision must support that end-to-end story.

---

## 1. Working style

You must work in **small, verifiable steps**.

For every step:

- first inspect existing code
- then make a short plan
- then implement only that step
- then run tests
- then verify the UI if the step affects the frontend
- then stop and ask for permission before starting the next step

Do not continue automatically after a step is complete.

Do not make large multi-purpose changes in one pass.

Do not refactor unrelated parts of the codebase unless required for the current step.

---

## 2. Output discipline

After every step, report exactly:

- what changed
- which files changed
- what tests were run
- whether tests passed
- what UI was checked
- any bugs found
- whether the step is truly complete
- a single clear question: `Approve next step?`

Do not claim a step is finished until:

- code is implemented
- tests are passing
- UI is verified if applicable
- no obvious regression is visible

---

## 3. Product scope

This product is for a demo and pilot, not a toy prototype.

The agent must prioritize the following product capabilities:

### Core product flow

- connect business account / WABA
- discover and attach phone numbers
- sync templates from Meta
- create templates locally
- validate template variables
- submit template for approval
- select contacts and segments
- send broadcasts using approved templates
- track message status per contact
- capture incoming replies
- show follow-up outcomes
- show campaign analytics

### Demo-ready enhancements

- seeded demo data
- sample reports
- business-friendly dashboards
- clean empty states
- loading skeletons
- error states
- audit trail
- role-safe controls
- clear onboarding / guided setup

### Pilot-readiness enhancements

- deduplication
- segmentation
- import/export
- resend/retry handling
- broadcast logs
- delivery tracking
- response tracking
- action history
- account health indicators

---

## 4. What matters most

The product must feel like a system that helps brokers recover revenue from existing leads.

The UI and backend should always support outcomes like:

- more site visits
- better follow-up discipline
- faster response handling
- lead reactivation
- better visibility on what was sent and what got replied to

Do not build generic admin screens unless they directly support the business story.

---

## 5. Files and layers

Before coding, inspect:

- app entry points
- routing
- state management
- major pages
- shared components
- API clients
- backend routes
- services
- Prisma schema
- validation
- utility functions
- existing tests
- existing seed scripts

When changing something, prefer the smallest file set that accomplishes the step.

---

## 6. Backend rules

### 6.1 Database and schema

Any schema change must be:

- justified
- minimal
- compatible with existing data where possible
- accompanied by migration or schema update
- reflected in service logic and tests

Every important business event should be representable in the database, including:

- contact import
- dedupe decisions
- template creation
- template sync
- broadcast creation
- message send status
- reply status
- retry attempts
- audit events
- campaign outcome snapshots

### 6.2 API design

API responses must be:

- predictable
- validated
- structured
- useful for the frontend
- suitable for demo dashboards

Error responses must include:

- a human-readable message
- a stable error code where helpful
- enough context for debugging
- no sensitive token leakage

### 6.3 Business logic

The backend must enforce:

- no duplicate contacts unless intentional
- no broadcast without a valid approved template
- no invalid phone number payloads
- no missing variable mapping in templates
- no false success on delivery states
- no silent failures in send jobs

### 6.4 Queue and retry behavior

If a send or sync action can fail:

- capture the failure reason
- preserve the attempted payload metadata where safe
- expose retry status
- do not hide failures behind a generic success state

### 6.5 Audit trail

Log meaningful actions such as:

- account connected
- template synced
- template created
- template submitted
- contacts imported
- broadcast created
- broadcast sent
- reply captured
- retry attempted
- broadcast failed
- broadcast completed

### 6.6 Test requirements

Every meaningful backend change must include tests.

Test at least:

- success path
- failure path
- validation path
- edge case path

Useful backend tests include:

- contact dedupe
- template validation
- broadcast creation
- broadcast failure handling
- retry logic
- segmentation filters
- analytics aggregation
- audit log creation

---

## 7. Frontend rules

### 7.1 UI goals

The frontend must feel:

- premium
- clear
- operational
- business-oriented
- easy to demo

The UI should never feel cluttered or generic.

### 7.2 UX priorities

Prioritize:

- obvious primary actions
- clear page hierarchy
- meaningful empty states
- useful loading states
- helpful error states
- readable tables
- compact but not cramped layouts
- strong visual separation between sections

### 7.3 Must-have screens

The app should have clear screens for:

- Dashboard
- Accounts
- Templates
- Broadcasts
- Contacts
- Segments
- Inbox / Replies
- Analytics
- Audit Log
- Media Library
- Demo / Pilot Mode

### 7.4 Demo behavior

For demo mode:

- seed realistic data
- include at least one connected account
- include several templates
- include a few contacts with different tags/statuses
- include at least one broadcast with mixed delivery states
- include at least one reply thread
- include at least one sample report with visible business outcomes

### 7.5 UI verification

After every frontend change:

- open the affected screen
- inspect the layout
- check alignment, spacing, typography, and contrast
- confirm empty states do not look broken
- confirm errors are understandable
- confirm buttons and tables are easy to scan
- confirm the screen still makes sense for a sales demo

### 7.6 Visual quality rules

Avoid:

- too many cards with equal visual weight
- excessive glassmorphism
- noisy borders
- oversized empty sections
- technical labels that do not help a customer
- weak CTA hierarchy
- unreadable dense tables

Prefer:

- one clear hero summary
- one main action
- one supporting action
- compact stats
- readable tables
- section headers with business meaning

---

## 8. Demo flow requirements

The app must support a clean demo flow from start to finish.

The recommended demo flow is:

1. open dashboard
2. connect or inspect WABA
3. sync templates
4. create or edit a template
5. show approval workflow
6. import contacts
7. segment contacts
8. create a broadcast
9. send it using an approved template
10. inspect send results
11. view replies
12. review analytics
13. inspect audit trail

The agent should keep this flow in mind while implementing every screen and API.

---

## 9. Pilot readiness definition

A step is not merely complete when it compiles.

A step is only pilot-ready if:

- the feature works end to end
- the data model supports it
- the frontend exposes it cleanly
- tests cover the critical paths
- a demo user can understand it quickly
- it does not break the rest of the product

---

## 10. Step-by-step execution policy

Break work into milestones like this:

### Milestone A — baseline inspection

- inspect repository
- summarize architecture
- identify gaps
- list risks
- propose implementation order

### Milestone B — backend core foundation

- update schema if needed
- implement contact ingestion / dedupe
- implement segmentation
- implement audit log
- implement analytics fields
- add tests

### Milestone C — broadcast lifecycle

- broadcast queue
- send status
- failure handling
- retry behavior
- message result persistence
- tests

### Milestone D — inbox and replies

- reply data model
- reply storage
- unified inbox APIs
- reply views
- tests

### Milestone E — frontend demo surfaces

- dashboard polish
- contacts page
- segments page
- inbox page
- analytics page
- audit log page

### Milestone F — pilot mode

- seed data
- demo toggles
- guided setup
- sample metrics
- sample campaign data

### Milestone G — final QA

- run all tests
- fix failures
- inspect UI screens again
- identify demo blockers
- produce final readiness summary

Do not skip directly to later milestones unless the user explicitly requests it.

---

## 11. Self-check protocol

Whenever you finish a step, do this before asking for approval:

### Backend self-check

- confirm routes respond correctly
- confirm validation works
- confirm data persisted correctly
- confirm error handling is stable
- confirm tests pass

### Frontend self-check

- confirm page loads
- confirm data renders correctly
- confirm action buttons work
- confirm empty states look intentional
- confirm no console errors if visible
- confirm layout is presentable for a demo

### Product self-check

Ask:

- Does this help the broker make money?
- Does this reduce manual follow-up?
- Does this improve visibility?
- Does this help the demo story?

If the answer is no, reconsider the change.

---

## 12. Non-goals

Do not:

- introduce unrelated features
- redesign the whole app unless needed
- change the stack without permission
- rewrite working logic for cosmetic reasons
- add speculative AI features that do not support the demo
- optimize for generality over clarity
- build abstractions that do not earn their complexity

---

## 13. Security and safety

Do not expose:

- access tokens
- API secrets
- private keys
- raw sensitive customer data

Sanitize logs and screenshots if they contain sensitive values.

---

## 14. Final deliverable standard

Before saying the product is ready, ensure:

- the main user journey works end to end
- demo data is present
- the UI is coherent
- tests are green
- the product can be shown in a customer demo without explanation-heavy excuses

The final report must include:

- what is implemented
- what is still incomplete
- what is demo-ready
- what remains risky
- what should be improved before pilot launch
