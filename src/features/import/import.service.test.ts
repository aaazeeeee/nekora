import { describe, expect, it } from 'vitest';
import { parseFile, validateFile, MAX_FILE_SIZE } from './import.service';
function file(name: string, text: string): File {
  return {
    name,
    size: new TextEncoder().encode(text).length,
    text: async () => text,
  } as File;
}
describe('file imports', () => {
  it('rejects unsupported extensions, oversized files, and empty files', () => {
    expect(() => validateFile({ name: 'report.pdf', size: 10 })).toThrow(
      '.txt or .md',
    );
    expect(() =>
      validateFile({ name: 'report.md', size: MAX_FILE_SIZE + 1 }),
    ).toThrow('1 MB');
    expect(() => validateFile({ name: 'empty.txt', size: 0 })).toThrow('empty');
  });
  it('preserves text, line breaks and literal markup', async () => {
    const result = await parseFile(
      file('Notes.TXT', 'Hello\n\n<script>alert(1)</script>'),
    );
    expect(result.title).toBe('Notes');
    expect(result.content.content).toHaveLength(3);
    expect(JSON.stringify(result.content)).toContain('<script>');
  });
  it('converts basic Markdown into structured editor content', async () => {
    const { content } = await parseFile(
      file('Draft.md', '# Heading\n\n**Bold** and *italic*\n\n- One\n- Two'),
    );
    expect(content.content?.[0]).toMatchObject({
      type: 'heading',
      attrs: { level: 1 },
    });
    expect(JSON.stringify(content)).toContain('"type":"bold"');
    expect(JSON.stringify(content)).toContain('"type":"bulletList"');
  });
  it('drops scripts and event attributes from Markdown', async () => {
    const { content } = await parseFile(
      file(
        'Unsafe.md',
        '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n<p onclick="alert(1)">Safe</p>',
      ),
    );
    const json = JSON.stringify(content);
    expect(json).toContain('Safe');
    expect(json).not.toContain('alert');
    expect(json).not.toContain('onerror');
    expect(json).not.toContain('onclick');
  });
  it('rejects whitespace and binary content', async () => {
    await expect(parseFile(file('Empty.md', ' \n '))).rejects.toThrow('empty');
    await expect(parseFile(file('Binary.txt', 'a\0b'))).rejects.toThrow(
      'text file',
    );
  });
});
