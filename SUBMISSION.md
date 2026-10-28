# Submission

## Deliverables

- [x] React/TypeScript/Vite workspace and Tiptap editor
- [x] Supabase auth integration and schema migration (applied to linked hosted project)
- [x] Database-enforced permissions, real-time editing/cursors/presence, and durable CRDT persistence
- [x] Dashboard, sharing UI and TXT/Markdown imports
- [x] Unit/UI tests and local Supabase pgTAP suite
- [x] Cloudflare Pages build/routing preparation and documentation
- [x] Hosted Supabase project linked, migration applied, local public configuration saved
- [ ] Two demo accounts
- [ ] Live Cloudflare deployment and deployed end-to-end verification
- [ ] GitHub remote repository
- [ ] Walkthrough recording

## Links and accounts

- Live deployment: **[PENDING — provision Cloudflare Pages]**
- Source: local repository folder; GitHub URL **[PENDING]**
- Walkthrough video: **[PENDING]**
- Demo accounts: provision two users per README and deliver credentials privately. No passwords are committed.

## Verification

Executed locally:

- `npm run lint` — passed.
- `npm run typecheck` — passed (strict TypeScript, including browser tests).
- `npm run test` — 77 tests passed across 16 files, including real local WebSocket synchronization/restart/permission/failure/conflict tests, Tiptap replacement validation, and embedded PostgreSQL migration/authorization tests.
- `npm run build` — passed; SPA routing fallback included. The server credential was checked and is absent from frontend artifacts.
- Browser suite — nine checks passed using installed Chrome, mocked Supabase responses, and real Hocuspocus rooms: editing/reopen, sharing/revoke, Markdown import, viewer mode, mobile navigation, auth forms, save recovery, AI replacement, and two-page collaborative editing/title sync/per-user undo.
- Collaboration migrations `202610280003_collaboration.sql` and `202610280004_collaboration_conflicts.sql` applied to the linked hosted project.
- Live protocol smoke check against hosted Supabase — passed with temporary owner/editor/viewer/stranger accounts: authenticated text/title synchronization, durable CRDT/JSON persistence, viewer rejection, unauthorized-room denial, revocation, and legacy-overwrite protection. All temporary accounts/documents were deleted afterward. This was a protocol check, not a hosted browser walkthrough.

Hosted setup completed after the initial implementation: authenticated through the Supabase CLI using `npm exec`, linked project `ozizrfqerqsfxgzzqvsn`, applied migration `202610280001_draftly.sql`, and saved public client configuration to ignored `.env`. Hosted Auth settings responded successfully and an anonymous document request was rejected with HTTP 401. All 17 pgTAP authorization assertions passed on the hosted database using a transactional wrapper; fixture accounts/documents were rolled back.

Not executed: real-user browser authentication/sharing against hosted Supabase, GitHub Actions and deployed end-to-end checks. The nine browser checks use mocked Supabase responses with real local WebSocket rooms. Hosted Auth Site URL and allowed redirects now use `http://localhost:5173`; a follow-up config diff confirmed no pending URL updates, and email confirmation remained enabled. The app already running on port 5173 was verified to use the linked project, and the production build passed with the new configuration. No persistent demo accounts or Cloudflare deployment have been created.

## Another 2–4 hours

Provision evaluator accounts, complete the two-account browser walkthrough against hosted Supabase, deploy to Pages and record the walkthrough. Then prioritize password recovery, paginated dashboard queries and a draft conflict comparison/recovery flow.
