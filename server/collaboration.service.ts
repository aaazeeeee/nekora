import { createClient } from '@supabase/supabase-js';
import type { Database, Permission } from '../src/types/database';

export type StoredCollaboration = { state: string; version: number };
export interface CollaborationStorage {
  authorize(token: string, documentId: string): Promise<Permission>;
  load(documentId: string): Promise<StoredCollaboration | null>;
  original(
    documentId: string,
  ): Promise<{ title: string; content: unknown; revision: number }>;
  initialize(
    documentId: string,
    revision: number,
    state: string,
  ): Promise<StoredCollaboration>;
  store(
    documentId: string,
    version: number,
    state: string,
    title: string,
    content: Database['public']['Tables']['documents']['Row']['content'],
  ): Promise<number>;
}

/** All privileged database access stays in this server-only module. */
export function createCollaborationStorage(
  url: string,
  publicKey: string,
  serviceKey: string,
): CollaborationStorage {
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient<Database>(url, serviceKey, options);
  return {
    async authorize(token, documentId) {
      if (
        !token ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          documentId,
        )
      ) {
        throw new Error('Document access denied.');
      }
      const client = createClient<Database>(url, publicKey, {
        ...options,
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const [identity, access] = await Promise.all([
        client.auth.getUser(token),
        client.rpc('document_access', { doc_id: documentId }),
      ]);
      if (identity.error || !identity.data.user)
        throw new Error('Sign in again to continue.');
      const { data, error } = access;
      if (error || !data) throw new Error('Document access denied.');
      return data;
    },
    async load(documentId) {
      const { data, error } = await admin
        .from('document_collaboration')
        .select('state,version')
        .eq('document_id', documentId)
        .maybeSingle();
      if (error)
        throw new Error(
          'Could not load collaboration state. Check the database migration.',
        );
      return data;
    },
    async original(documentId) {
      const { data, error } = await admin
        .from('documents')
        .select('title,content,revision')
        .eq('id', documentId)
        .single();
      if (error) throw new Error('Document unavailable.');
      return data;
    },
    async initialize(documentId, revision, state) {
      const { data, error } = await admin.rpc('initialize_collaboration', {
        doc_id: documentId,
        expected_revision: revision,
        initial_state: state,
      });
      if (error || !data?.[0])
        throw new Error(
          'Could not initialize collaboration. Reopen the document to retry.',
        );
      return data[0];
    },
    async store(documentId, version, state, title, content) {
      const { data, error } = await admin.rpc('store_collaboration', {
        doc_id: documentId,
        expected_version: version,
        next_state: state,
        doc_title: title,
        doc_content: content,
      });
      if (error) {
        // A second server must never silently overwrite the first server's state.
        if (error.code === '55000') throw new CollaborationConflictError();
        throw new Error('The document could not be saved. Retry saving.');
      }
      return data;
    },
  };
}
export class CollaborationConflictError extends Error {
  constructor() {
    super(
      'Document is active on another collaboration server. Download your draft and reopen.',
    );
  }
}
