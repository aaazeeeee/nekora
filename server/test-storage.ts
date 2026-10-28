import type {
  CollaborationStorage,
  StoredCollaboration,
} from './collaboration.service';
import { CollaborationConflictError } from './collaboration.service';
import type { Json, Permission } from '../src/types/database';

/** In-memory backend for protocol/browser tests; production uses Supabase. */
export function createTestStorage() {
  const roles = new Map<string, Permission>([
    ['owner-token', 'owner'],
    ['editor-token', 'editor'],
    ['viewer-token', 'viewer'],
    ['test-token', 'owner'],
  ]);
  const records = new Map<string, StoredCollaboration>();
  const originals = new Map<
    string,
    { title: string; content: Json; revision: number }
  >();
  let failSaves = false;
  const storage: CollaborationStorage = {
    async authorize(token) {
      const role = roles.get(token);
      if (!role) throw new Error('Document access denied.');
      return role;
    },
    async load(id) {
      return records.get(id) ?? null;
    },
    async original(id) {
      return (
        originals.get(id) ?? {
          title: 'Product strategy',
          content: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'A clear direction.' }],
              },
            ],
          },
          revision: 0,
        }
      );
    },
    async initialize(id, _revision, state) {
      const stored = records.get(id) ?? { state, version: 1 };
      records.set(id, stored);
      return stored;
    },
    async store(id, version, state, title, content) {
      if (failSaves) throw new Error('Database is unavailable.');
      if (records.get(id)?.version !== version)
        throw new CollaborationConflictError();
      records.set(id, { state, version: version + 1 });
      originals.set(id, {
        title,
        content,
        revision: (originals.get(id)?.revision ?? 0) + 1,
      });
      return version + 1;
    },
  };
  return {
    storage,
    roles,
    records,
    originals,
    setFailSaves: (fail: boolean) => {
      failSaves = fail;
    },
  };
}
