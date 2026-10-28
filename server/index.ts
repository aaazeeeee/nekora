import {
  createCollaborationServer,
  listenCollaborationServer,
} from './collaboration';
import { createCollaborationStorage } from './collaboration.service';

const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const publicKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !publicKey || !serviceKey) {
  console.error(
    'Set SUPABASE_SERVICE_ROLE_KEY in .env (server only), plus the Supabase URL and publishable key. See README.md.',
  );
  process.exit(1);
}
const port = Number(process.env.COLLAB_PORT ?? 1234);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('COLLAB_PORT must be a valid port.');
const origins = (
  process.env.COLLAB_ALLOWED_ORIGINS ??
  'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const server = createCollaborationServer(
  createCollaborationStorage(url, publicKey, serviceKey),
  {
    port,
    address: process.env.COLLAB_HOST ?? '127.0.0.1',
    origins,
  },
);
await listenCollaborationServer(server);
console.log(`Collaboration server listening on port ${port}.`);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.destroy();
}
process.on('SIGINT', () => {
  void stop();
});
process.on('SIGTERM', () => {
  void stop();
});
