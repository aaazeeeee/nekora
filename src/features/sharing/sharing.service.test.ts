import { describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('../../lib/supabase/client', () => ({ getClient: () => ({ rpc }) }));
import { sharingService } from './sharing.service';
describe('sharing service', () => {
  it('validates recipient email before a request', async () => {
    await expect(
      sharingService.grant('id', 'invalid', 'editor'),
    ).rejects.toThrow('valid email');
  });
  it('surfaces permission denials', async () => {
    rpc.mockResolvedValue({ error: { code: '42501', message: 'private' } });
    await expect(
      sharingService.grant('id', 'writer@example.com', 'editor'),
    ).rejects.toThrow('permission');
  });
  it('revokes access through the owner-only RPC', async () => {
    rpc.mockResolvedValue({ error: null });
    await sharingService.revoke('document', 'recipient');
    expect(rpc).toHaveBeenLastCalledWith('revoke_document_access', {
      doc_id: 'document',
      recipient_id: 'recipient',
    });
  });
});
