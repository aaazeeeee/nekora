# Nekora

A focused document workspace built for the Ajaia engineering assessment. React 19, strict TypeScript, Vite, Tailwind CSS 4, shadcn-style local UI primitives (Radix Dialog and CVA Button), React Router, Lucide, Tiptap 3, and Supabase Auth/PostgreSQL.

## Run locally

Requires Node 22.12+ and npm.

```sh
./setup.sh
# Fill in your Supabase project URL and publishable (or legacy anon) key in .env.
npm run collab # Terminal 1: authenticated WebSocket backend on port 1234
# In a second terminal:
npm run dev
```

The setup script checks Node/npm, installs locked dependencies with `npm ci`, and creates `.env` only when it does not already exist. It can be rerun safely and works from any working directory. It does not provision Supabase or apply migrations; follow the steps below. On Windows, run it through Git Bash or WSL.

Without configuration, the app shows setup instructions. There is no fake backend or local authentication bypass. Never place a service-role key in a `VITE_` variable: those values are public browser configuration. `.env` is ignored.

## Supabase setup

1. Create a Supabase project. Link with the Supabase CLI and run `supabase db push --linked` to apply all migrations, or execute the SQL files in `supabase/migrations/` in filename order in the SQL editor.
2. Copy the project URL and publishable/anon key into `.env`. Add `SUPABASE_SERVICE_ROLE_KEY` from the project API settings for the collaboration server. Keep it server-only, never prefix it with `VITE_`. Set `VITE_COLLABORATION_URL=ws://localhost:1234` locally.
3. Enable email/password authentication. Set **Site URL** to the deployment origin and add `http://localhost:5173` and the deployed origin to allowed redirect URLs. Configure a mail provider for production confirmation emails. Enable **Confirm email**. Under Authentication → Email Templates → Confirm signup, set the subject to "Your Nekora confirmation code" and copy the HTML from `supabase/templates/confirmation.html`. The template uses `{{ .Token }}` instead of a confirmation link. New users enter the emailed code in the app, which confirms their account and signs them in. Hosted email templates must be updated in the dashboard; changing the local config does not update the hosted project.
4. Restart Vite after changing environment variables.

For a local backend, install Docker and the Supabase CLI, then:

```sh
supabase start
supabase db reset
# Copy the local URL, anon key and server-only service-role key to .env.
npm run collab # First terminal
npm run dev # Second terminal
npm run test:db
```

The local config enables email confirmation and uses the code-only template. Retrieve local confirmation emails from the Supabase local mail inbox. Hosted settings are configured in the Supabase dashboard. The migration backfills profiles for existing email accounts and creates a profile trigger for new accounts.

## Features

- Email/password sign-in, signup with email confirmation when enabled, sign-out and account details.
- All, owned and shared document views; title/owner search, sort, grid/list layouts, loading, empty and error states.
- Create, open, rename and persist documents as Tiptap JSON.
- Bold, italic, underline, headings, paragraphs, bullet and numbered lists, undo/redo.
- Optional Gemini writing improvement: select text, generate a suggestion, review and replace.
- Real-time simultaneous editing with Yjs/Hocuspocus, shared titles, remote cursors/selections, collaborator presence and per-user undo.
- Debounced durable checkpoints, serialized server writes, automatic persistence retries, and unsaved navigation warnings. Download a JSON recovery draft after save errors.
- Owner-managed sharing by existing account email; editor and viewer permissions; revoke access.
- TXT and Markdown import up to 1 MB. Preserves basic formatting and strips unsupported HTML and executable content.

Sharing is invitation by known email, not public links or invitations to nonexistent accounts. Recipients see documents after refreshing their dashboard. Rich text is limited to the configured editor schema.

## Demo accounts (secure setup)

Create **two real users** using the signup screen or Supabase Dashboard → Authentication → Add user. Set display names such as Alex Morgan and Jamie Chen. Choose unique random passwords in your password manager, confirm both users, and send evaluator credentials through a private channel. Do not add passwords to this repository. No demo users or credentials have been provisioned automatically.

Walkthrough: sign in as Alex → create a document → write and wait for “All changes saved” → refresh → rename → share with Jamie as editor → sign in as Jamie in another browser → open Shared with me → edit → observe changes immediately as Alex → revoke Jamie → confirm Jamie disconnects and can no longer read/save. Repeat with viewer permission to verify read-only access. Use two sessions to edit different text at once and verify both edits merge, then refresh to verify persistence.

## Checks

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:db # Requires running local Supabase
npx playwright install chromium
npm run test:e2e # Production browser checks with mocked Supabase responses
```

Unit tests cover autosave ordering, debounce, failure/retry and conflicts; import validation/sanitization; persistence and sharing service contracts; dialog accessibility. The pgTAP database suite exercises four identities, private reads, editor/viewer permissions, ownership protection, sharing, revocation and stale revisions. The default test command also runs the actual migration against embedded PostgreSQL (PGlite), with a minimal Auth schema and four authenticated identities, to verify database permissions without Docker. This supplements, and does not replace, a real Supabase run. Browser tests use mocked Supabase responses and a separate `.e2e-dist` production build; they verify UI behavior, not hosted connectivity. Set `PLAYWRIGHT_CHANNEL=chrome` to use an existing Google Chrome installation instead of installing Chromium. GitHub Actions runs these checks on push/PR. Service mocks do not prove RLS. See `SUBMISSION.md` for checks actually executed.

## Deploy to Cloudflare Pages

1. Push this folder to your own GitHub repository (no remote has been created for you).
2. Create a Cloudflare Pages project connected to that repository.
3. Build command: `npm run build`. Output directory: `dist`. Node version: `22` (22.12+).
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Pages environment settings for each relevant environment. Build-time changes require a new deployment.
5. Apply the Supabase migration and configure Auth Site URL/redirect URLs for your Pages domain. Avoid wildcard preview redirects for sensitive production projects; use a separate Supabase project for previews.
6. Deploy. `public/_redirects` supplies the SPA fallback so document routes work after refresh.
7. Verify sign-in, refresh on `/documents/:id`, persistence, imports and sharing with two users at the deployed URL.

No deployment is claimed. Fill in URLs in `SUBMISSION.md` after provisioning and verification.

## Limitations

No comments, version-history UI, PDF/DOCX, teams, or public links. Use one collaboration server instance; independent instances are guarded by database version checks but do not synchronize their live rooms. Drafts remain in the current tab until durably saved; there is no IndexedDB recovery across reloads. Already-loaded content cannot be erased from a revoked user’s browser. The server uses verified access leases of at most five seconds, renews them in the background, and blocks expired leases. Permission changes close the connection when detected; renewal failures fail closed. Network/auth failures fail closed. Dashboard queries list accessible summaries without pagination (Supabase default row limit applies). No password-reset flow in this MVP. Production deployment and real Supabase end-to-end testing need project access.

## Gemini writing improvement

Highlight text in an editable document and a floating **Improve** button appears above it. Alternatively, press **⌘J / Ctrl+J**, or use **Improve writing** in the toolbar; with no selection, the paragraph at your cursor is used. An inline panel opens under the text, which stays highlighted. Describe how it should be improved (optional, up to 1,000 characters) or pick a quick prompt (Fix grammar, Make it clearer, Make it shorter, More professional). Then press Enter or the arrow button. You can stop a request while it's generating. Review the suggestion, then **Replace selection**, **Try again**, **Edit prompt** or **Discard**; Escape closes the panel. Each request rewrites the original text (up to 5,000 characters). Only that text and your instructions are sent to Google Gemini. Accepted changes synchronize through collaboration and can be undone. Replacement uses plain text, so inline formatting can be lost. If the document changes while the panel is open, replacing is refused rather than overwriting newer edits. Viewers don't see the feature, and the endpoint rejects their requests.

Enable the backend in your linked Supabase project:

1. Create a Gemini API key in Google AI Studio. In Supabase Dashboard → Edge Functions → Secrets, add `GEMINI_API_KEY`. Never put this key in a `VITE_` variable or commit it.
2. Optionally set the secret `GEMINI_MODEL` (default `gemini-3.5-flash-lite`) to an available Gemini generateContent model.
3. Run `npx supabase functions deploy improve-writing`. The checked-in config disables the legacy gateway JWT check; the handler explicitly validates the user's bearer token through Supabase Auth and calls `document_access` using that same user token. No service-role key is used.
4. Verify with owner/editor/viewer accounts. Without a secret or deployed function, generation shows a setup error and preserves the document.

For local use, create ignored `supabase/functions/.env` with `GEMINI_API_KEY=...`, then run `npx supabase functions serve improve-writing --env-file supabase/functions/.env` alongside local Supabase. The deployed function uses Supabase's built-in `SUPABASE_URL` and `SUPABASE_ANON_KEY` variables.

Requests have input/output limits and timeouts, and quota/provider errors are shown without exposing provider internals. There is no application-level per-user rate limiter yet; configure provider usage limits before broad rollout. Tests mock Google/Supabase HTTP responses; they do not establish live Gemini availability or billing configuration.

### Document access requests

Recipients of a copied document link must sign in. If they lack access, they can select **Request access**. The owner opens **Share → Access requests** and grants view/edit access or declines. Requests do not send email notifications; recipients reopen the link after approval. Apply `202610280002_access_requests.sql` to enable this flow.

## Collaboration server

Apply all migrations, configure `.env` using `.env.example`, then run `npm run collab` and `npm run dev` in separate terminals. `npm run collab:watch` restarts the backend during server development; a restart disconnects clients briefly. Existing JSON documents are converted once, on the server, so opening the same document in two tabs does not duplicate its content. TXT/Markdown imports use the same conversion path.

The server validates Supabase bearer tokens and document access, enforces viewer read-only mode, and persists binary Yjs state plus a JSON snapshot atomically. Browsers cannot read/write the CRDT table or call its storage RPCs. The old full-document save RPC refuses collaborative documents. “All changes saved” means a matching checkpoint completed in PostgreSQL, including deletions; WebSocket delivery alone is insufficient. On save failure, keep the tab open and retry or download the draft.

For deployment, run the Node 22 backend on a host supporting long-lived WebSockets (a container/VM or a suitable application host). Cloudflare Pages serves the frontend only. Set `COLLAB_HOST=0.0.0.0` for container hosting, `COLLAB_PORT` for the listening port, and `COLLAB_ALLOWED_ORIGINS` to a comma-separated list of exact frontend origins. Terminate TLS at the host/reverse proxy and set the frontend’s `VITE_COLLABORATION_URL=wss://your-collaboration-host`. Configure the service-role key only on the backend. Never add it to Pages frontend variables. Deploy one backend instance; horizontal scaling requires coordinated room routing or a shared synchronization layer, not additional independent instances.

Protocol integration tests use real local WebSockets with an in-memory persistence adapter. Browser tests bridge to the real Hocuspocus server with mocked Supabase responses. Embedded PostgreSQL tests execute the actual migrations with authenticated identities. These suites do not establish deployed connectivity.
