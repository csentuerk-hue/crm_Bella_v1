# Bella CRM – Current Task Board

## 1. Current Safe Baseline

- GitHub repo URL: https://github.com/csentuerk-hue/crm_Bella_v1
- Current branch: main
- Working folder: C:\Users\CSent\Desktop\bella-crm-git-check
- Current Preview URL: https://bella-8fy9goail-csentuerk-7515s-projects.vercel.app
- Production deployment has not been intentionally triggered in this workflow.
- Preview deployments are allowed for visual testing when explicitly requested.
- Production deployments are forbidden unless explicitly approved.
- Never use `vercel deploy --prod` unless explicitly approved.
- Project docs exist:
  - AGENTS.md
  - PROJECT_PROFILE.md
  - TESTING.md
  - DEPLOYMENT.md
  - docs/invoice-rules.md
  - docs/privacy-media-consent.md

## 2. Active Stashes / Pending Work

- stash@{0}: vercel link metadata ignore update
- stash@{1}: pending invoice schema default and customerId test verification
- Rule: do not apply/pop stashes unless explicitly requested.
- Pending schema/default work should not be mixed with MVP visual testing.
- Stashed changes are not visible in the Preview until applied, verified, committed, pushed and deployed.

## 3. Deployment Rule

- Preview deployment is allowed and required when a work package needs visual testing.
- Production deployment is forbidden unless explicitly approved.
- A Vercel Preview URL must be reported after every preview deployment.
- If code changes are made and the user needs to see them, the flow is:
  implement → test/build → commit → push → preview deploy → report URL
- If a task is documentation/API/test-only and not visually testable, say so clearly.

## 4. Current Product Priority

The immediate priority is MVP usability, not production hardening.

Primary MVP flow:
1. Customer exists
2. Appointment can be created
3. Appointment can be opened/viewed
4. Appointment can be used for an invoice if supported
5. Manual/free invoice can be created for a customer
6. Invoice preview opens
7. PDF download/export is available
8. User stores PDF manually in a protected local folder
9. Invoice archive shows whether PDF is missing/downloaded/saved
10. Payment status can be viewed/changed if supported
11. Invoice/archive can be searched or opened

## 5. Current Test Data Policy

- Reduce visible test data.
- Keep at most two dedicated test customers where possible:
  - Max Mustermann
  - Maxime Musterfrau
- Do not create excessive test data.
- Do not delete records that may be real.
- Do not delete finalized invoices directly unless a task explicitly creates a safe preview/test cleanup path.
- In Preview/Test mode, clearly marked test invoices and test data may be removed only through a safe scoped cleanup path.
- In Production, finalized real invoices must not be deleted.
- If a record is uncertain or may be real, keep it and report it.
- If deletion is blocked by invoice protection, report it instead of bypassing.
- Avoid broad cleanup markers such as:
  - example.com
  - generic "Test"
  - AGNC
  - broad timestamp-only cleanup
- Cleanup must stay scoped and safe and must not use broad destructive deletion.

## 6. PDF-Download-First V1 Rule

Bella CRM V1 is not a full accounting system.
It should create simple Kleinunternehmer invoices and PDF downloads.
The user stores downloaded PDFs manually in a protected local folder.
The CRM should help track whether a PDF is missing, downloaded or saved.

Rules:
- No cloud PDF storage in V1.
- No automatic local folder detection in V1.
- No PDF storage grid on the normal `/invoices` editing page.
- PDF storage/status belongs in `/invoices/archive`.
- The invoice archive should later show:
  - PDF fehlt
  - PDF heruntergeladen
  - PDF gespeichert
- The invoice archive should later show the expected PDF filename.
- The invoice archive should later allow:
  - PDF herunterladen
  - Als gespeichert markieren
  - Status zurücksetzen
- A separate archive/status raster is preferred so the invoice editing page stays clean.

## 7. Next Work Packages

Create these work packages in order:

### WP-00 — Reality/status check

Goal:
Find out exactly where the project stands before more implementation.

Scope:
- No code changes
- No schema changes
- No stash apply
- No deploy

Acceptance:
- Report committed state
- Report stashes
- Report current Preview URL
- Report whether TASKS.md is committed/pushed
- Report what is visible vs only local/stashed
- Report what should be done next

### WP-01 — Preview data cleanup and MVP audit

Goal:
Clean visible test/demo data safely and keep only Max Mustermann and Maxime Musterfrau as test customers where possible.
Then audit the visible Preview for real functional issues.

Scope:
- Preview/runtime first
- No new production hardening
- No auth/storno/media-scope work
- No schema migration unless separately approved
- Preview deployment allowed if needed
- Production deployment forbidden

Acceptance:
- CRM has minimal visible test data or remaining blockers are reported
- Max Mustermann exists
- Maxime Musterfrau exists
- Dashboard metrics are understandable or remaining pollution is reported
- Invoice/customer/appointment issues are listed
- User can understand what is actually testable in the Preview

### WP-02 — PDF archive status planning/audit

Goal:
Audit current PDF generation and invoice archive structure before implementation.

Scope:
- Read code
- No implementation yet unless explicitly approved

Acceptance:
- Report whether Invoice already has PDF status fields
- Report current PDF route
- Report current filename behavior
- Report exact minimal implementation plan for:
  - pdfDownloadedAt
  - pdfMarkedSavedAt
  - pdfFileName
  - archive status raster

### WP-03 — PDF archive status implementation

Goal:
Build PDF-Unterlagenstatus in `/invoices/archive`.

Scope:
- Invoice archive only
- PDF download status only
- No cloud storage
- No local folder access
- No normal invoice page clutter

Prisma implementation note:
- If Prisma schema fields are required for persistent PDF status, they must be optional fields only:
  - `pdfDownloadedAt DateTime?`
  - `pdfMarkedSavedAt DateTime?`
  - `pdfFileName String?`
- These fields track local PDF handling status only.
- They are not cloud storage.
- They do not mean the app can verify the local Windows folder.
- The user still stores the PDF manually in a protected local folder.

Acceptance:
- Archive shows PDF status
- Archive shows expected filename
- Buttons exist:
  - PDF herunterladen
  - Als gespeichert markieren
  - Status zurücksetzen
- Filter exists:
  - Alle
  - PDF fehlt
  - PDF gespeichert
- Preview deployment created after commit/push so user can visually test

### WP-04 — Invoice view bugfix package

Goal:
Fix only confirmed invoice-page bugs from WP-01/WP-03.

Scope:
- `/invoices`
- `/invoices/archive`
- preview/PDF only if confirmed broken
- No redesign
- No schema migration unless separately approved

Acceptance:
- Invoice list loads
- selected invoice loads
- preview opens
- PDF/export route works if supported
- no 500 errors
- focused tests pass
- Preview deployment available if visible changes were made

### WP-05 — Customer detail usability package

Goal:
Make customer list/detail usable for MVP.

Scope:
- `/customers` only
- selecting Max Mustermann/Maxime Musterfrau should show useful details
- no full redesign

Acceptance:
- search works
- selecting customer opens profile/details
- media consent display is at least visible
- notes/basic info areas do not look broken
- Preview deployment available if visible changes were made

### WP-06 — Appointment MVP flow package

Goal:
Make appointment workflow usable enough for a studio test.

Scope:
- `/appointments`
- create/open/status/detail flow
- no major calendar redesign

Acceptance:
- appointment can be seen
- status/workflow is understandable
- link to invoice flow is clear if supported
- Preview deployment available if visible changes were made

### WP-07 — First user test readiness checklist

Goal:
Prepare a short checklist for the user’s wife to test the CRM.

Scope:
- no code
- checklist only

Acceptance:
- 10-minute test script exists
- known issues separated from blockers
- only MVP functions included

## 8. Do Not Build Yet

- Auth/Login
- Storno/cancellation invoice
- media consent scopes
- inventory
- marketing
- reports
- customerId NOT NULL migration
- onDelete migration
- transaction-safe invoice counter
- full redesign
- production deployment

Clarify:
These are not rejected forever. They are postponed until the visible MVP flow works.

## 9. Codex Reporting Format

Every future Codex task should return:

- Work package name
- Visible to user: yes/no
- Preview deployment needed: yes/no
- Preview URL if deployed
- Files changed
- What was tested
- What failed
- What remains
- Git status
- Stash status if relevant
- Commit recommended: yes/no
- Push recommended: yes/no

Avoid long reports unless requested.
