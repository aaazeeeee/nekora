# AI-assisted workflow

## First-time setup script

Added executable `setup.sh` to check Node 22.12+ and npm, install locked dependencies, and copy `.env.example` only when `.env` is absent. Existing configuration is preserved; the script never reads credentials into shell code or provisions a hosted database. README quick-start instructions now use the script.

Verification: Bash syntax check and isolated smoke checks with mocked Node/npm passed for first-time creation, rerun preservation, invocation from another directory, unsupported Node and dependency-install failure. ESLint, TypeScript, all 32 tests and the production build passed. The smoke checks did not reinstall real dependencies or alter the existing `.env`.

Codex read the supplied product request and repository AGENTS.md, inspected the empty repository, and implemented the React/Vite application, SQL migration, tests and documentation. No pre-existing app code was available to reuse. The Sites skill was read for development guidance; the explicit Cloudflare Pages target took precedence over its hosting workflow.

AI accelerated scaffolding, UI composition, service boilerplate, test cases and database functions. Significant engineering choices were a static SPA with no separate API server, database-only write functions rather than direct client updates, one revision-checked save path for both title and content, and serial autosave requests. Markdown imports use a formatting allowlist rather than trusting parser HTML. No images or external assets were needed.

Generated code is reviewed and checked during development. Revisions and verification results are recorded below before handoff. No human implementation decisions or reviews are attributed to people who did not perform them. No hosted credentials, accounts, remote repository or deployment URLs are fabricated.

## Corrections and verification

- Reviewed the database constraint semantics and corrected SQL NULL handling so a missing document type cannot pass the root check. Added a regression assertion.
- Added runtime schema validation for loaded Tiptap JSON, rather than relying only on TypeScript casts.
- Removed a retry control for permanent revision conflicts; added browser coverage for recovery downloads and navigation warnings.
- Upgraded Vitest after npm audit reported test-tooling advisories. npm 10's optional peer resolver crashed during that upgrade; the project records legacy peer resolution in `.npmrc` and explicitly declares imported/test peers. The updated dependency audit returned zero vulnerabilities.
- Inspected rendered dashboard/editor screenshots, improved secondary text contrast and split the initial large production bundle.
- Executed strict TypeScript, ESLint, 31 unit/integration tests (including seven PostgreSQL authorization scenarios), production builds, and seven browser tests against mocked Supabase responses. No hosted Supabase or Cloudflare deployment was performed. The Supabase CLI is unavailable, so the pgTAP suite has not been executed here.
- The user chose to configure Supabase later. Setup, demo-account provisioning and deployment instructions remain explicit handoff steps.

## Hosted setup follow-up

The user subsequently authorized Supabase login/link and database setup. The CLI was run through `npm exec`; existing initialization was preserved. The migration was applied to project `ozizrfqerqsfxgzzqvsn`. Public client configuration was written to ignored `.env` without printing API keys. Hosted Auth returned HTTP 200 and anonymous document reads returned HTTP 401. The CLI initially displayed only the final pgTAP result, so a temporary transactional wrapper explicitly collected and checked all 17 assertions; all passed and test fixtures were rolled back. No real-user browser or deployed-host verification is claimed.

Hosted auth URL changes were made from an isolated minimal config declaring only Site URL and allowed redirects. The post-update diff showed zero declared updates; email confirmation remained enabled. The existing local server was verified to serve Draftly with the linked project, and a duplicate server was stopped. The production build passed with the new environment configuration.

## Notion/Obsidian-inspired redesign

At the user's request the UI was redesigned using Notion and Obsidian as references. The dashboard and editor now share a `WorkspaceLayout` route: a ribbon of icons (Obsidian), a sidebar with a document tree split into Private and Shared sections (Notion), and pages with a large icon and title. The document list moved into a `useDocuments` hook owned by the layout and passed to pages through typed outlet context, so the sidebar and dashboard read from one source. The hook ignores stale responses, and the sidebar title updates while you type. The editor now has an inline title, the save state in the top bar, and a word/character status bar. Autosave, revision checks and recovery logic are unchanged. Colours are CSS tokens, with a dark theme that follows `prefers-color-scheme`. On narrow screens the sidebar becomes a drawer.

Verification: lint, typecheck, 31 unit tests, the production build and all 7 Playwright tests passed. The tests ran on system Chrome via `PLAYWRIGHT_CHANNEL=chrome` because the bundled Chromium is not installed. E2E selectors were updated because the trailing heading dots were removed, and document links now appear in the sidebar, the recent cards and the table. Light, dark, mobile and sign-in screenshots were reviewed. One fix came from that review: the toolbar wrapped at 1440px, so it was made more compact.

The colour palette was then replaced with one taken from a reference image the user supplied. It uses ink and paper neutrals with near-black pill buttons, a blue accent for interactive states, and Figma's orange, purple, green and blue for decorative covers and access tags. Only CSS tokens and three class names changed. The unit tests, build and e2e tests were re-run and passed.

The app was renamed from Draftly to Nekora at the user's request. User-facing copy, page metadata, the draft-recovery filename, docs and package name all changed. The applied migration filename, Supabase `project_id`, test fixture emails and mocked test URLs intentionally keep `draftly`. Renaming the applied migration would desynchronise Supabase's migration history.

The native selects were replaced with a shared `Select` component (`src/components/ui/select.tsx`) built on `@radix-ui/react-select`. Native option lists can't be styled, and Radix provides keyboard navigation, typeahead and ARIA semantics. The project already depends on Radix Dialog. The sharing permission is now controlled state rather than read from `FormData`. The jsdom `scrollIntoView` stub in test setup first broke the Node-environment database suite, so it was guarded with `typeof Element`. A unit test now covers keyboard selection, and the sharing e2e test picks "Can view" and checks that it reaches the backend. 32 unit tests, the build and 7 e2e tests passed.

## Gemini writing improvement

Added a selection-based Tiptap action with an explicit disclosure before sending text to Gemini, a preview, cancellation, and user-approved replacement through the existing autosave path. Generated output is inserted as JSON text nodes rather than HTML. A document snapshot prevents suggestions from replacing text after intervening edits; replacement supports editor undo. Requests are canceled when the dialog closes or unmounts.

The Supabase function validates input size, authenticates the bearer token through Auth, and checks `document_access` using the caller's token before calling Google. Viewer, revoked and anonymous users cannot generate suggestions. It uses no service-role key. Gemini credentials remain server secrets; model configuration is optional. Input/output limits, timeouts and safe provider errors are implemented. Application-level per-user throttling remains a documented limitation.

Verification: ESLint, strict TypeScript, all 43 tests and the production build passed. New tests cover authenticated owner/editor access, viewer/anonymous/expired-session denial, invalid input, missing configuration, provider failures/truncation, preview before replacement, undo and intervening edits. An initial UI test needed explicit cleanup between cases; this was corrected before the successful run. Live Gemini generation requires a server-side key and is not claimed by mocked tests.

Deployment follow-up: deployed `improve-writing` to the existing linked project `ozizrfqerqsfxgzzqvsn`; the Supabase CLI confirmed deployment. All seven existing Playwright regression tests passed using system Chrome after allowing the local test server to bind its port. No Gemini key was supplied or printed, and a successful live generation has not been verified.

## Writing action discoverability fix

The original action was disabled with no text selection, which made paragraph improvement hard to discover. The action now opens for editable documents and captures the current text block when the cursor has no selection. Empty paragraphs show guidance and disable generation. Explicit selections still take precedence. Added tests for current-paragraph replacement without touching adjacent text and empty-paragraph guidance. ESLint, TypeScript, all 45 tests and the production build passed.

## Gemini provider availability correction

Investigated the live provider error without logging credentials or document content. The original `gemini-2.5-flash` returned HTTP 404 with a message that it is no longer available to new users. The suggested `gemini-3.8-flash` timed out on two short generateContent probes. A small live `gemini-3.5-flash-lite` request returned HTTP 200, finishReason STOP and the expected grammar correction. Updated the default/example model and hosted GEMINI_MODEL to Flash Lite. Removed the older sampling configuration and selected LOW thinking effort for paragraph editing. No automatic retries or model fallback were added, to avoid multiplying paid requests.

Provider failures now distinguish model availability and credential/API configuration from quotas and transient outages. Server diagnostics contain only the HTTP status and model name, never raw provider responses, credentials or user text. Added four regression cases for model/key/access errors. Lint, TypeScript, all 49 tests and the build passed. The live test verifies Google generation directly; a signed-in browser request through Supabase still needs user verification.

## Custom writing instructions

Added an optional, labeled instruction field (1,000-character limit) and regeneration in the preview dialog. Regeneration applies the current instructions to the original captured text; it does not modify the document until replacement is approved. Replacement and instructions are disabled during generation. Failed regeneration preserves the previous suggestion. The server validates instruction types/length before contacting providers and sends source text and editing preferences in distinct JSON fields. Existing authorization, cancellation, snapshot checks and plain-text insertion remain in place.

Added coverage for custom regeneration without premature document changes, provider request structure, and invalid instruction inputs. Lint, strict TypeScript, all 54 tests and the production build passed. Dialog actions wrap to fit narrow screens. No additional live Gemini request was needed for the request-shape change; mocked tests verify its payload.

The improve-writing flow was redesigned at the user's request, using an inline AI prompt reference image. Before, a toolbar button opened a modal dialog. Now highlighting text shows a floating "Improve" pill (Tiptap `BubbleMenu`). It opens an inline panel under the text with an optional prompt, quick-prompt chips, a gradient "Generating…" state, a stop button, and Replace / Try again / Edit prompt / Discard. The target text stays highlighted through a ProseMirror decoration. ⌘J and the toolbar button remain as keyboard paths. Logic moved into `useImproveWriting`, which models the flow as a discriminated union (closed, prompting, generating, suggested). The Gemini edge function, input limits, inert JSON-node insertion and the document-changed guard are unchanged. `@tiptap/extension-bubble-menu` and `@tiptap/pm` were previously only transitive and are now declared, because the code imports them directly.

Correction: the first browser run crashed with React error #185 (maximum update depth). Inline `shouldShow` and `options` props made BubbleMenu re-register its plugin on every render, and each registration dispatched a transaction that re-rendered the page. Both are now module-level constants, and the new e2e test asserts there are no page errors. Verification: 55 unit tests, the build and 8 e2e tests passed. One e2e run during a concurrent install and build timed out on two unrelated tests; three later full runs passed 8/8. Live Gemini output was not exercised. Tests mock the function response.

## Email confirmation codes

Replaced the signup link notice with an email-code form, signup OTP verification and resend support. Kept password authentication and existing session subscriptions. Added a code-only Supabase confirmation template and enabled local confirmations. Hosted template settings require applying the documented dashboard change; no hosted configuration or real email delivery is claimed. Added service and UI coverage for verification, invalid/expired tokens and resend failures.

Verification: ESLint, strict TypeScript, all 60 Vitest tests and the production build passed. Email delivery and hosted template settings were not exercised.

## Missing confirmation email investigation

Added actionable signup/resend errors for Supabase email-sending limits, request throttling and unauthorized recipient addresses, without exposing raw provider details. ESLint, typecheck, all 61 Vitest tests and the production build passed. The linked project is reachable via the authenticated CLI; real email delivery is not yet verified.

A read-only CLI config comparison confirmed hosted confirmations are enabled and custom SMTP is disabled (both matched the explicitly declared diagnostic values). The hosted confirmation subject remains the default. No hosted settings were changed. Supabase's default-sender restrictions mean custom SMTP is needed for reliable non-team signup emails; SMTP credentials are not present in the project configuration.

## Porkbun / Resend setup

Using the user's signed-in browser, added `aazee.dev` to Resend and saved its generated DKIM TXT (`resend._domainkey`) and sending CNAME (`rsend`) in Porkbun. Read back both saved records; the public DKIM lookup also returned the expected value. Existing website records were preserved. Resend started DNS verification. The automatic Supabase integration reached an organization-wide Auth/Projects read-write consent screen; automatic approval review rejected granting this persistent third-party access without specific consent. Requested a choice between manual SMTP and explicitly approving that scope. No integration grant or SMTP activation is claimed at this point.

The user explicitly approved Resend's organization-wide Auth/Projects access. Completed authorization, selected Ajaia Project, linked aazee.dev, generated the integration-managed key, and configured Nekora <noreply@aazee.dev>. Resend reported “Ready to send”; a separate Supabase CLI comparison confirmed SMTP enabled at smtp.resend.com:465 with sender Nekora. Applied the code-only confirmation template and subject through an isolated minimal config; CLI reported exactly those two properties updated and 16 undeclared settings preserved. Added Resend's additional send CNAME after its domain page requested it. Resend subsequently showed domain, DKIM, rsend and send records all Verified. Existing website DNS records were preserved.

A confirmation resend to the user's existing signup address returned HTTP 200, but Resend showed no sent emails at the check, so inbox delivery is not verified (the account may already be confirmed). Python's local CA setup failed before sending; Node's normal TLS client completed the request. No credentials were written to project files. No application code changed during this setup.

## Copy collaboration link

Added a document URL field and Copy link action to the sharing dialog while retaining email invitations, permission selection, and revocation. Links preserve existing database authorization: recipients must sign in and already have access. The dialog explains this restriction. Clipboard success is reported only after writing succeeds; failure leaves the selectable URL available for manual copying. No schema changes or new dependencies were needed.

Added UI coverage for copying the canonical document URL, retaining email invitations, and clipboard rejection with manual fallback. Corrected test isolation by explicitly cleaning up rendered dialogs between cases. ESLint, strict TypeScript, all 63 Vitest tests, and the production build passed. No live browser clipboard or multi-user hosted verification was performed.

## Request access from a copied link

Added an authenticated Request access action on the unavailable-document page, with pending, success and retry states. Owners review requests in the Share dialog and approve viewer/editor access or decline. Requests are unique per document/user; repeated submissions do not duplicate them. Database RPCs derive requester identity from auth.uid(), enforce owner-only review and resolution, serialize changes on the document row, and grant access atomically with approval. The request table has RLS and no direct client privileges. Missing document IDs return the same request response without exposing document metadata. No emails or automatic grants are introduced.

Added PostgreSQL authorization coverage for duplicate requests, private request lists, blocked self-approval, decline, viewer approval, denied writes and anonymous requests. Added UI coverage for owner approval and requester success/failure states. ESLint, strict TypeScript, all 67 tests, and production build passed. Supabase CLI dry run identified only 202610280002_access_requests.sql as pending; applied that migration successfully to the linked project. A live multi-user browser flow was not exercised.

The share dialog and the blocked-document screen were redesigned in an iOS style at the user's request. Changes:

- All dialogs are sheets with grouped, inset sections and a grey circular close button; on phones they become bottom sheets with a grabber. The close button is now last in focus order, so sheets open on their first field instead of showing a focus ring on ×.
- Inside the share sheet: an iOS-style Invite group (email row and Permission row) with a full-width Give access button, a Restricted link row with a Copy pill, Requests rows with a count badge, View/Edit pills and red Decline, and People rows with a red Remove.
- A new `StatusCard` drives the request-access and couldn't-open screens. A new `AccessDeniedError` lets the editor offer "Request access" only for authorization failures (42501, PGRST116, no access). Other failures show a retry instead.

Correction: the access-request feature, added in parallel, crashed the share dialog whenever `list_document_access_requests` returned null (`requests.length` on null). The sharing service now normalizes null RPC lists to `[]`, and the e2e mock answers that endpoint. Unit test wording for copy-link was updated to match the new UI.

Verification: 67 unit tests passed and lint and typecheck are clean for `src`. All 8 e2e tests passed against a Vite-only build of the redesign; a temporary config skipped `tsc -b` because the in-progress `server/collaboration.ts` didn't typecheck. After a final CSS and button-variant tweak, e2e couldn't be re-run. Parallel collaboration work had begun importing `@tiptap/y-tiptap`, which isn't installed, so the app build fails until that work is completed. Running `prettier --write src` also reformatted that session's `EditorPage.tsx` (whitespace only).

## Real-time collaboration (2026-10-28)

Replaced the editor's whole-document autosave with Tiptap Collaboration/CollaborationCaret, Yjs and a Hocuspocus 3 WebSocket backend. Shared metadata synchronizes titles; provider awareness shows people/cursors/selections. StarterKit undo history is disabled for collaborative editors in favor of per-user collaborative undo. Existing imports and AI replacements use the same editor transactions.

Server/database decisions: convert JSON once in an atomic initializer; persist bounded binary CRDT state plus validated JSON/title snapshots atomically; version-check server writes; reject legacy whole-JSON saves after conversion. The server owns the service-role credential; the CRDT table has RLS and no browser privileges, and its RPCs are service-role-only. Bearer tokens are verified through Auth and access is checked with the user's token. Viewer updates are blocked server-side; idle access checks close revoked sessions in about five seconds. Independent backend instances fail on stale storage versions instead of silently overwriting each other; deployment targets one instance.

Durability decisions: checkpoints contain a generation and incremental Yjs update, including delete sets; only a successful database commit acknowledges that generation. Network delivery is not reported as a saved document. Older acknowledgements cannot mark newer edits saved. Persistence errors preserve the browser draft and retain dirty server rooms for automatic retries; users can retry/download before navigation. Provider resources, refresh subscriptions, permission timers and retry timers are cleaned up.

Corrections found during review/testing: installed Tiptap 3's actual `@tiptap/y-tiptap` binding and protocol peer dependencies; reused that binding for server conversion rather than a second ProseMirror/Yjs binding. Allowed the exact Tiptap position-migration map used by paragraph/AI replacement. Handled Hocuspocus's background store rejection to avoid unhandled errors and premature unloading. Bound the HTTP listener explicitly because Hocuspocus 3 passes `address` rather than Node's `host`. Disabled client stateless broadcasts so clients cannot spoof durable-save acknowledgements. Accounted for protocol close events using code 1000 even for server revocation. Preserved unsaved drafts if a reconnect changes the user to viewer. A hosted smoke test exposed delayed conflict responses; the follow-up migration uses SQLSTATE 55000 for collaboration lifecycle/version conflicts rather than retryable serialization errors.

Validation executed: lint and strict typecheck passed; 77 tests across 16 files passed; production build passed; all nine Chrome browser checks passed against mocked Supabase and real Hocuspocus rooms. Protocol tests cover concurrent edits, deletions, restart recovery, authorization/viewer isolation, revocation, failed-save retry, conversion and independent-server version conflicts. Embedded PostgreSQL executes all four migrations and checks privileged CRDT access, atomic snapshots, rollback and legacy-write protection. A live hosted Supabase smoke check passed text/title sync, durable storage, viewer denial, stranger rejection, revocation and legacy-write blocking using temporary users/documents, all removed afterward. Hosted browser deployment and multi-instance synchronization were not tested or claimed.

Applied the two collaboration migrations to the already-linked Supabase project. Retrieved the existing server key through the linked CLI into ignored `.env` without displaying it and verified it is absent from the frontend build. The local backend runs on port 1234; production still needs a separately hosted WebSocket backend and a configured `wss://` frontend URL.

## Collaboration latency correction (2026-10-28)

The initial server performed two sequential Supabase calls for every incoming edit, cursor update and checkpoint, serializing network latency into a growing per-socket queue. Replaced that path with server-verified access leases lasting at most five seconds. Background renewal begins halfway through the lease, shares one in-flight authorization request, and verifies Auth/access concurrently. Expired leases still block updates; role changes, revoked access and renewal failures close the connection. Refreshed credentials receive a new verified lease. This deliberately bounds permission staleness while removing remote I/O from normal keystroke/presence delivery. Durable checkpoints remain separate from live edit delivery.

Added a real WebSocket regression that blocks background authorization and sends 30 edits plus 30 presence updates; the last edit must arrive within 500 ms without per-message authorization requests. All 78 tests, lint and strict typecheck passed for the initial correction.

Final latency verification: 79 tests passed, including lease expiry during stalled renewal; lint, strict typecheck and production build passed. All nine Chrome checks passed for the optimized lease path. The backend was restarted on port 1234, and the frontend on port 5173 returned HTTP 200.
