import { describe, expect, it } from 'vitest';
import { parseEditorContent } from './content';
describe('stored rich text validation', () => {
  it('accepts structured text and formatting', () => {
    expect(
      parseEditorContent({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: '<script>literal text</script>',
                marks: [{ type: 'bold' }],
              },
            ],
          },
        ],
      }).type,
    ).toBe('doc');
  });
  it.each([
    null,
    {},
    { type: 'script' },
    { type: 'doc', content: [{ type: 'unsupported' }] },
    { type: 'doc', content: [{ type: 'text', text: 'Invalid root text' }] },
  ])('rejects invalid or unsupported stored content', (value) => {
    expect(() => parseEditorContent(value)).toThrow('unsupported content');
  });
});
