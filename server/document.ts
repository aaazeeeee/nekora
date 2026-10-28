import { getSchema } from '@tiptap/core';
import { prosemirrorJSONToYDoc, yDocToProsemirrorJSON } from '@tiptap/y-tiptap';
import * as Y from 'yjs';
import { editorExtensions } from '../src/features/editor/config';
import type { Json } from '../src/types/database';
import { parseEditorContent } from '../src/features/editor/content';

const schema = getSchema(editorExtensions);
export const MAX_STATE_BYTES = 6 * 1024 * 1024;
export function initializeDocument(title: string, content: unknown) {
  const document = prosemirrorJSONToYDoc(
    schema,
    parseEditorContent(content),
    'default',
  );
  document.getMap('metadata').set('title', title);
  return document;
}
export function documentSnapshot(document: Y.Doc) {
  const title: unknown = document.getMap('metadata').get('title');
  if (typeof title !== 'string' || title.length > 200)
    throw new Error('Use a title of at most 200 characters.');
  const content = parseEditorContent(
    yDocToProsemirrorJSON(document, 'default'),
  );
  if (Buffer.byteLength(JSON.stringify(content)) > 2 * 1024 * 1024)
    throw new Error('Document is too large.');
  return {
    title: title.trim() || 'Untitled document',
    content: JSON.parse(JSON.stringify(content)) as Json,
  };
}
/** Validate a candidate without applying untrusted state to the live room. */
export function validateUpdate(document: Y.Doc, update: Uint8Array) {
  if (update.byteLength > MAX_STATE_BYTES)
    throw new Error('Document update is too large.');
  const candidate = new Y.Doc();
  try {
    Y.applyUpdate(candidate, Y.encodeStateAsUpdate(document));
    Y.applyUpdate(candidate, update);
    if (
      [...candidate.share.keys()].some(
        (key) =>
          key !== 'default' &&
          key !== 'metadata' &&
          key !== '__tiptap_position_migrations:root:default',
      )
    )
      throw new Error('Unsupported document field.');
    documentSnapshot(candidate);
    if (Y.encodeStateAsUpdate(candidate).byteLength > MAX_STATE_BYTES)
      throw new Error('Document is too large.');
  } finally {
    candidate.destroy();
  }
}
