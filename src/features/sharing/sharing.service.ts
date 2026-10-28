import { getClient } from '../../lib/supabase/client';
import { databaseError } from '../../lib/errors';
export const sharingService = {
  async requestAccess(id: string) {
    const { error } = await getClient().rpc('request_document_access', {
      doc_id: id,
    });
    if (error) throw databaseError(error);
  },
  async listRequests(id: string) {
    const { data, error } = await getClient().rpc(
      'list_document_access_requests',
      { doc_id: id },
    );
    if (error) throw databaseError(error);
    return data ?? [];
  },
  async resolveRequest(
    id: string,
    userId: string,
    permission: 'editor' | 'viewer' | null,
  ) {
    const { error } = await getClient().rpc('resolve_document_access_request', {
      doc_id: id,
      recipient_id: userId,
      access_level: permission,
    });
    if (error) throw databaseError(error);
  },
  async list(id: string) {
    const { data, error } = await getClient().rpc('list_document_shares', {
      doc_id: id,
    });
    if (error) throw databaseError(error);
    return data ?? [];
  },
  async grant(id: string, email: string, permission: 'editor' | 'viewer') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      throw new Error('Enter a valid email address.');
    const { error } = await getClient().rpc('share_document', {
      doc_id: id,
      recipient_email: email.trim(),
      access_level: permission,
    });
    if (error) throw databaseError(error);
  },
  async revoke(id: string, userId: string) {
    const { error } = await getClient().rpc('revoke_document_access', {
      doc_id: id,
      recipient_id: userId,
    });
    if (error) throw databaseError(error);
  },
};
