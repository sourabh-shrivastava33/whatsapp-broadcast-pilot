# SaaS Transformation: Manual Verification Plan (Phases 1 & 2)

This document provides a step-by-step guide to manually verify the features implemented during **Phase 1 (Identity)** and **Phase 2 (Tenancy Foundation)**.

---

## 🔐 Phase 1: Identity & Authentication
**Goal**: Ensure users can securely create accounts, log in, and maintain a session.

### 1.1 Registration Flow
1.  Navigate to `/auth/register`.
2.  Fill in a Name, Email, and Password.
3.  Click **Create Account**.
4.  **Expectation**: You should be redirected to the Dashboard (`/`). A default workspace should be automatically created for you.

### 1.2 Login Flow
1.  Logout (if logged in).
2.  Navigate to `/auth/login`.
3.  Enter the credentials created in step 1.1.
4.  **Expectation**: You should be redirected to the Dashboard. Your name should be visible (if displayed in the UI).

### 1.3 Session Persistence
1.  While logged in, refresh the browser page.
2.  **Expectation**: You should remain on the current page and NOT be redirected back to the login screen.

### 1.4 Route Protection
1.  Logout.
2.  Attempt to manually navigate to `https://[your-domain]/contacts` via the address bar.
3.  **Expectation**: You should be immediately redirected to `/auth/login`.

---

## 🏢 Phase 2: Tenancy Foundation
**Goal**: Ensure data is isolated between workspaces and the switcher functions correctly.

### 2.1 Workspace Initialization
1.  Log in.
2.  Look at the Sidebar.
3.  **Expectation**: You should see a "Workspace Switcher" section showing a default workspace (e.g., "[Your Name]'s Workspace").

### 2.2 Data Isolation (The "Acid Test")
1.  Select **Workspace A** (Default).
2.  Go to **Contacts** and create a test contact (e.g., "John Doe").
3.  Now, switch to **Workspace B** (you may need to create a second one in the DB or via the UI if implemented).
    *   *Note: If "Create Workspace" UI is not yet fully functional, verify that John Doe appears ONLY when the header `X-Workspace-Id` matches Workspace A.*
4.  **Expectation**: When in Workspace B, the Contacts list should be **EMPTY**. John Doe should not be visible.

### 2.3 API Header Verification (Technical)
1.  Open Chrome DevTools (`F12`) -> **Network** tab.
2.  Navigate to any page that fetches data (e.g., Contacts or Templates).
3.  Click on one of the API requests (e.g., `/api/contacts`).
4.  Look at **Request Headers**.
5.  **Expectation**: You should see a header `X-Workspace-Id` with a UUID value.

### 2.4 Workspace Persistence
1.  Select a specific workspace from the sidebar.
2.  Refresh the page.
3.  **Expectation**: The sidebar should still show the same workspace as "Active". It should not revert to the first one in the list.

---

## 🧪 Quick Smoke Test (API Consistency)
1.  Open the browser to `https://whatsapp-broadcast-pilot.vercel.app/auth/login`.
2.  Attempt to log in.
3.  **Expectation**: The request should succeed and hit `https://whatsapp-broadcast-pilot.onrender.com/api/auth/login` (check DevTools Network tab to confirm it's NOT hitting the vercel.app domain).

---

## 📝 Status Reporting
| Test Case | Status | Notes |
| :--- | :--- | :--- |
| Registration | [ ] | |
| Login | [ ] | |
| Route Guards | [ ] | |
| Workspace Switcher | [ ] | |
| Data Isolation | [ ] | |
| API Headers (X-Workspace-Id) | [ ] | |
| Backend URL Consistency | [ ] | |
