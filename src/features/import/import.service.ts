import type { JSONContent } from '@tiptap/react';
import { marked } from 'marked';
import { generateJSON } from '@tiptap/core';
import { editorExtensions } from '../editor/config';
export const MAX_FILE_SIZE = 1024 * 1024;
export function validateFile(file: Pick<File, 'name' | 'size'>) {
  if (!/\.(txt|md)$/i.test(file.name))
    throw new Error('Choose a .txt or .md file.');
  if (file.size > MAX_FILE_SIZE)
    throw new Error('This file is too large. The maximum size is 1 MB.');
  if (file.size === 0)
    throw new Error('This file is empty. Choose a file with some text.');
}
export async function parseFile(
  file: File,
): Promise<{ title: string; content: JSONContent }> {
  validateFile(file);
  const text = await file.text();
  if (!text.trim())
    throw new Error('This file is empty. Choose a file with some text.');
  if (text.includes('\0'))
    throw new Error('This file does not appear to be a text file.');
  const title =
    file.name
      .replace(/\.(txt|md)$/i, '')
      .trim()
      .slice(0, 200) || 'Imported document';
  if (/\.md$/i.test(file.name)) {
    const html = await marked.parse(text, { async: false });
    // Whitelist supported formatting only. Raw HTML, links, images and scripts never enter the editor.
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed
      .querySelectorAll('script,style,iframe,object,svg,math,template')
      .forEach((node) => node.remove());
    const allowed = new Set([
      'P',
      'BR',
      'STRONG',
      'B',
      'EM',
      'I',
      'U',
      'H1',
      'H2',
      'UL',
      'OL',
      'LI',
      'BLOCKQUOTE',
      'PRE',
      'CODE',
      'HR',
    ]);
    function clean(node: Node): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return (node.textContent ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;');
      }
      if (!(node instanceof Element)) return '';
      const inside = Array.from(node.childNodes).map(clean).join('');
      return allowed.has(node.tagName)
        ? `<${node.tagName.toLowerCase()}>${inside}</${node.tagName.toLowerCase()}>`
        : inside;
    }
    return {
      title,
      content: generateJSON(
        Array.from(parsed.body.childNodes).map(clean).join(''),
        editorExtensions,
      ),
    };
  }
  return {
    title,
    content: {
      type: 'doc',
      content: text.split(/\r?\n/).map((line) => ({
        type: 'paragraph',
        ...(line ? { content: [{ type: 'text', text: line }] } : {}),
      })),
    },
  };
}
