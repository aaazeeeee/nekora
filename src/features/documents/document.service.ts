import type { JSONContent } from '@tiptap/react';
import { getClient } from '../../lib/supabase/client';
import { AccessDeniedError, databaseError } from '../../lib/errors';
import type { Json } from '../../types/database';
export const EMPTY_CONTENT: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};
export function validateTitle(title: string) {
  const trimmed = title.trim();
  if (!trimmed || trimmed.length > 200)
    throw new Error('Use a title between 1 and 200 characters.');
  return trimmed;
}
export function contentJson(content: JSONContent): Json {
  return JSON.parse(JSON.stringify(content)) as Json;
}
export const documentService = {
  async list() {
    const { data, error } = await getClient().rpc('list_documents');
    if (error) throw databaseError(error);
    return data;
  },
  async get(id: string) {
    const client = getClient();
    const [document, access] = await Promise.all([
      client.from('documents').select('*').eq('id', id).single(),
      client.rpc('document_access', { doc_id: id }),
    ]);
    if (document.error) throw databaseError(document.error);
    if (access.error) throw databaseError(access.error);
    if (!access.data)
      throw new AccessDeniedError(
        'You no longer have access to this document.',
      );
    const { parseEditorContent } = await import('../editor/content');
    return {
      ...document.data,
      content: parseEditorContent(document.data.content),
      permission: access.data,
    };
  },
  async create(title = 'Untitled document', content = EMPTY_CONTENT) {
    const { data, error } = await getClient().rpc('create_document', {
      doc_title: validateTitle(title),
      doc_content: contentJson(content),
    });
    if (error) throw databaseError(error);
    return data;
  },
  async save(
    id: string,
    revision: number,
    title: string,
    content: JSONContent,
  ) {
    const { data, error } = await getClient().rpc('save_document', {
      doc_id: id,
      expected_revision: revision,
      doc_title: validateTitle(title),
      doc_content: contentJson(content),
    });
    if (error) throw databaseError(error);
    return data;
  },
};
