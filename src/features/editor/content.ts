import { getSchema } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { editorExtensions } from './config';
const schema = getSchema(editorExtensions);
/** Validate database/import JSON against the exact schema rendered by the editor. */
export function parseEditorContent(value: unknown): JSONContent {
  try {
    const node = schema.nodeFromJSON(value);
    if (node.type.name !== 'doc') throw new Error('Invalid document root');
    node.check();
    return node.toJSON() as JSONContent;
  } catch {
    throw new Error(
      'This document contains unsupported content and could not be opened.',
    );
  }
}
