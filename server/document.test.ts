import { Editor } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { collaborativeEditorExtensions } from '../src/features/editor/config';
import {
  documentSnapshot,
  initializeDocument,
  validateUpdate,
} from './document';

const content = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Original paragraph' }],
    },
  ],
};
describe('collaborative document validation', () => {
  it('accepts whole-paragraph replacements and Tiptap position-migration metadata', () => {
    const server = initializeDocument('Title', content);
    const client = new Y.Doc();
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
    const editor = new Editor({
      extensions: [
        ...collaborativeEditorExtensions,
        Collaboration.configure({ document: client }),
      ],
    });
    try {
      editor.commands.setContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Replacement paragraph' }],
          },
        ],
      });
      const update = Y.encodeStateAsUpdate(client);
      expect(() => validateUpdate(server, update)).not.toThrow();
      Y.applyUpdate(server, update);
      expect(JSON.stringify(documentSnapshot(server).content)).toContain(
        'Replacement paragraph',
      );
    } finally {
      editor.destroy();
      client.destroy();
      server.destroy();
    }
  });
  it('rejects malformed content and unknown shared fields without modifying the live document', () => {
    const server = initializeDocument('Title', content);
    const client = new Y.Doc();
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
    try {
      client.getMap('unrecognized').set('value', 'bad');
      expect(() =>
        validateUpdate(server, Y.encodeStateAsUpdate(client)),
      ).toThrow('Unsupported document field');
      expect(server.share.has('unrecognized')).toBe(false);
      expect(() => initializeDocument('Title', { type: 'script' })).toThrow(
        'unsupported content',
      );
    } finally {
      client.destroy();
      server.destroy();
    }
  });
  it('rejects oversized titles before the live document is changed', () => {
    const server = initializeDocument('Title', content);
    const client = new Y.Doc();
    Y.applyUpdate(client, Y.encodeStateAsUpdate(server));
    try {
      client.getMap('metadata').set('title', 'x'.repeat(201));
      expect(() =>
        validateUpdate(server, Y.encodeStateAsUpdate(client)),
      ).toThrow('200 characters');
      expect(documentSnapshot(server).title).toBe('Title');
    } finally {
      client.destroy();
      server.destroy();
    }
  });
});
