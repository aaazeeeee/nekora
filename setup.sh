#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

for command in node npm; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Missing %s. Install Node.js 22.12+ (with npm), then rerun ./setup.sh.\n' "$command" >&2
    exit 1
  fi
done

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)'; then
  printf 'Node.js 22.12+ is required. Current version: %s\n' "$(node --version)" >&2
  exit 1
fi

printf 'Installing dependencies from package-lock.json…\n'
npm ci

if [[ -e .env || -L .env ]]; then
  printf 'Keeping your existing .env unchanged.\n'
else
  (set -o noclobber; cat .env.example > .env)
  printf 'Created .env from .env.example.\n'
fi

cat <<'NEXT_STEPS'

Setup complete. Next steps:
  1. Set your Supabase URL and publishable/anon key in .env.
  2. Follow README.md → Supabase setup for database and Auth configuration.
  3. Run npm run dev to start Nekora.

Never put a service-role key in .env's VITE_ variables.
NEXT_STEPS
