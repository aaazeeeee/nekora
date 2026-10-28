# Architecture

Nekora is a React SPA with Supabase Auth/PostgreSQL and a Node Hocuspocus WebSocket backend. The router protects workspace screens with the Supabase session. Auth state is shared; all other state stays within the relevant feature. Database calls live in document/sharing services; import parsing and autosave are independent of presentation. Radix handles dialog focus, keyboard interaction and accessible descriptions. The local Button/Dialog sources follow shadcn's owned-component approach rather than adding a UI framework runtime.

## Data and authorization

`profiles` references Auth users. Its trigger stores a bounded display name and email; ordinary users can read only their own full profile. Document listings expose owner display names, not owner emails. Owners can see emails for users with whom they have shared the specific document. Sharing resolves an existing exact email only after checking ownership; there is no searchable user directory.

`documents` stores JSONB content, an immutable owner, integer revision and timestamps. `document_shares` uniquely relates one document and recipient with editor/viewer permission. Foreign keys cascade deletion; owner/date, recipient/document and email lookups are indexed.

RLS protects reads on every application table. All direct writes are revoked, including for owners. Narrow security-definer functions with an empty search path enforce allowed operations and explicitly qualify objects. Their execute privilege is removed from PUBLIC/anon, then granted to authenticated users. `document_access` looks up access using the caller's `auth.uid()` and avoids recursive RLS policies. It discloses only the caller's permission. Ownership cannot be reassigned by a client.

Share/revoke operations serialize on the document row and enforce owner permission. The collaboration server validates bearer tokens using Supabase Auth and calls `document_access` as that user. Viewer writes are blocked server-side. Incoming messages require a valid server-verified access lease, capped at five seconds. Background renewal runs halfway through each lease and deduplicates in-flight checks; edits and cursor updates avoid remote requests while the lease is valid. Expired leases block updates and connections close if renewal fails or access changes. Auth credentials refresh without rebuilding the editor. Client presentation never grants authorization.

## Editor and persistence

The editor uses Tiptap Collaboration and CollaborationCaret backed by a shared Yjs document. `default` contains rich text, `metadata` contains the shared title, and Tiptap's reserved position-migration map supports replacements. StarterKit's ordinary undo is disabled in collaborative editors so undo affects the user's own operations. Schema configuration remains shared with import validation and server snapshot generation.

`useCollaboration` owns provider/Yjs lifecycle, presence, authenticated scope, debounced checkpoints and save state. Providers are created in effects and destroyed with timers/subscriptions on cleanup, including React StrictMode. Initial content comes from the server, never independently from each browser. The server converts existing JSON exactly once through an atomic initializer, preventing duplicated text or a stale client overwriting a converted document.

`server/collaboration.service.ts` centralizes database access. The server-only service-role key reads/writes `document_collaboration`; RLS and revoked client privileges prevent browser access. Its narrow storage RPC atomically saves binary state, normalized title, JSON snapshot and version. Writes compare the CRDT version to prevent independent server instances silently overwriting each other. The old JSON save RPC rejects documents once collaboration is initialized.

The server serializes persistence per room. Browser checkpoints carry incremental Yjs state (including delete sets) and a local generation number; the server merges the authenticated update, commits it, then acknowledges that generation. A matching acknowledgement marks the local draft saved. The client does not equate network delivery with durability. Newer local edits remain pending after an older acknowledgement. Background persistence failures retain rooms in memory and retry; client failures retain editable content with JSON download/retry and navigation warnings. Rich-text JSON is validated against the shared schema and capped at 2 MB; binary state is bounded separately.

## Imports

TXT/MD files are validated by extension and a 1 MB size cap. Empty/whitespace and NUL-containing files are rejected. TXT becomes literal paragraph text. Markdown is parsed with marked; a DOM-based allowlist strips dangerous nodes and all attributes, including URLs/events, before Tiptap converts it to schema-limited JSON. Imports create a real persisted document before navigating. No HTML is inserted directly into the UI. Imported images and links are deliberately omitted.

## Tradeoffs and follow-ups

The implementation targets one collaboration server. Additional independent instances cannot merge live rooms; version conflicts stop writes rather than overwrite data. Horizontal scaling needs room affinity/shared synchronization. Presence is transient and its display names are client-provided labels, never authorization identity. Draft recovery across reloads, comments, history UI, paginated listings, password recovery, and broader abuse controls remain follow-ups. The original Autosave controller remains tested for the legacy revision-save contract but is not used by the collaborative editor. Database types are maintained alongside migrations; regenerate from Supabase as the schema evolves.
