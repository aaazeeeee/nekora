import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError } from '../../lib/errors';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase/client', () => ({ getClient: () => ({ rpc }) }));
import { documentService, EMPTY_CONTENT } from './document.service';
describe('document persistence', () => {
  beforeEach(() => rpc.mockReset());
  it('creates a document with a normalized title and structured JSON', async () => {
    rpc.mockResolvedValue({ data: 'document-id', error: null });
    await expect(documentService.create('  My draft  ')).resolves.toBe(
      'document-id',
    );
    expect(rpc).toHaveBeenCalledWith('create_document', {
      doc_title: 'My draft',
      doc_content: EMPTY_CONTENT,
    });
  });
  it('passes the expected revision to the atomic save function', async () => {
    rpc.mockResolvedValue({ data: 5, error: null });
    await expect(
      documentService.save('id', 4, 'Draft', EMPTY_CONTENT),
    ).resolves.toBe(5);
    expect(rpc).toHaveBeenCalledWith('save_document', {
      doc_id: 'id',
      expected_revision: 4,
      doc_title: 'Draft',
      doc_content: EMPTY_CONTENT,
    });
  });
  it('surfaces conflicts and does not pretend persistence succeeded', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: '40001', message: 'conflict' },
    });
    await expect(
      documentService.save('id', 4, 'Draft', EMPTY_CONTENT),
    ).rejects.toBeInstanceOf(ConflictError);
  });
  it('rejects empty titles before contacting the database', async () => {
    await expect(documentService.create('   ')).rejects.toThrow('1 and 200');
    expect(rpc).not.toHaveBeenCalled();
  });
});
