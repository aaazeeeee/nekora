import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
  AtSign,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  Eye,
  Link,
  LoaderCircle,
  LockKeyhole,
  PencilLine,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { Dialog } from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { sharingService } from './sharing.service';
import type { Permission, Share } from '../../types/database';
import { errorMessage } from '../../lib/errors';
type GrantablePermission = Exclude<Permission, 'owner'>;
const PERMISSION_OPTIONS = [
  {
    value: 'editor',
    label: 'Can edit',
    description: 'Write, format and rename',
    icon: PencilLine,
  },
  {
    value: 'viewer',
    label: 'Can view',
    description: 'Read only, no changes',
    icon: Eye,
  },
] as const;
export function SharingDialog({
  id,
  open,
  onOpenChange,
}: {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [requests, setRequests] = useState<
    Pick<Share, 'user_id' | 'display_name' | 'email'>[]
  >([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copyState, setCopyState] = useState<
    'idle' | 'copying' | 'copied' | 'error'
  >('idle');
  const documentUrl = new URL(
    `/documents/${encodeURIComponent(id)}`,
    window.location.origin,
  ).href;
  const [permission, setPermission] = useState<GrantablePermission>('editor');
  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    setError('');
    setNotice('');
    setCopyState('idle');
    void Promise.all([sharingService.list(id), sharingService.listRequests(id)])
      .then(([items, pending]) => {
        if (active) {
          setShares(items);
          setRequests(pending);
        }
      })
      .catch((error) => {
        if (active) setError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, open]);
  async function copyLink() {
    setCopyState('copying');
    try {
      await navigator.clipboard.writeText(documentUrl);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await sharingService.grant(id, String(values.get('email')), permission);
      setShares(await sharingService.list(id));
      form.reset();
      setPermission('editor');
      setNotice(
        'Access granted. They can find this document in Shared with me.',
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function resolveRequest(
    userId: string,
    access: GrantablePermission | null,
  ) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await sharingService.resolveRequest(id, userId, access);
      setRequests((items) => items.filter((item) => item.user_id !== userId));
      setNotice(access ? 'Access granted.' : 'Request declined.');
      setShares(await sharingService.list(id));
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  async function revoke(userId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await sharingService.revoke(id, userId);
      setShares((items) => items.filter((item) => item.user_id !== userId));
      setNotice('Access revoked.');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const accessLabel = (access: string) =>
    access === 'editor'
      ? 'Can edit'
      : access === 'viewer'
        ? 'Can view'
        : access;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Share document"
      description="Invite people or copy the link. Only people with access can open it."
    >
      {error && (
        <p role="alert" className="sheet-banner danger">
          <CircleAlert size={16} />
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="sheet-banner success">
          <CircleCheck size={16} />
          {notice}
        </p>
      )}
      <section className="sheet-section" aria-labelledby="invite-title">
        <h3 id="invite-title" className="sheet-section-title">
          Invite
        </h3>
        <form onSubmit={invite}>
          <div className="sheet-group">
            <div className="sheet-row">
              <span className="sheet-icon" aria-hidden="true">
                <AtSign size={16} />
              </span>
              <label className="sr-only" htmlFor="share-email">
                Email address
              </label>
              <input
                id="share-email"
                className="sheet-input"
                type="email"
                name="email"
                required
                autoComplete="off"
                placeholder="Email address"
              />
            </div>
            <div className="sheet-row">
              <span className="sheet-icon" aria-hidden="true">
                <ShieldCheck size={16} />
              </span>
              <label className="sheet-row-label" htmlFor="share-permission">
                Permission
              </label>
              <Select
                id="share-permission"
                variant="ghost"
                value={permission}
                onValueChange={setPermission}
                options={PERMISSION_OPTIONS}
              />
            </div>
          </div>
          <Button
            className="sheet-submit"
            disabled={busy || loading}
            type="submit"
          >
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <UserPlus size={16} />
            )}
            {busy ? 'Updating…' : 'Give access'}
          </Button>
        </form>
      </section>
      <section className="sheet-section" aria-labelledby="share-link-title">
        <h3 id="share-link-title" className="sheet-section-title">
          Link
        </h3>
        <div className="sheet-group">
          <div className="sheet-row">
            <span className="sheet-icon tinted" aria-hidden="true">
              <Link size={16} />
            </span>
            <div className="sheet-row-text">
              <strong>Restricted</strong>
              <input
                aria-label="Document link"
                className="sheet-link-field"
                value={documentUrl}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>
            <Button
              type="button"
              variant={copyState === 'copied' ? 'success' : 'tinted'}
              className="sheet-pill"
              disabled={copyState === 'copying'}
              onClick={() => void copyLink()}
            >
              {copyState === 'copied' ? (
                <Check size={15} />
              ) : (
                <Copy size={14} />
              )}
              {copyState === 'copied' ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
        {copyState === 'copied' && (
          <p role="status" className="sr-only">
            Link copied.
          </p>
        )}
        {copyState === 'error' && (
          <p role="alert" className="sheet-footnote danger">
            Couldn’t copy automatically. Select the link above to copy it
            manually.
          </p>
        )}
      </section>
      {requests.length > 0 && (
        <section className="sheet-section" aria-labelledby="requests-title">
          <h3 id="requests-title" className="sheet-section-title">
            Requests
            <span className="sheet-badge">{requests.length}</span>
          </h3>
          <ul className="sheet-group">
            {requests.map((request) => (
              <li className="sheet-row request-row" key={request.user_id}>
                <span className="avatar" aria-hidden="true">
                  {request.display_name[0]?.toUpperCase()}
                </span>
                <div className="sheet-row-text">
                  <strong>{request.display_name}</strong>
                  <small>{request.email}</small>
                  <div className="request-actions">
                    <Button
                      variant="tinted"
                      className="sheet-pill"
                      disabled={busy}
                      onClick={() =>
                        void resolveRequest(request.user_id, 'viewer')
                      }
                      aria-label={`Allow ${request.email} to view`}
                    >
                      <Eye size={14} />
                      Can view
                    </Button>
                    <Button
                      variant="tinted"
                      className="sheet-pill"
                      disabled={busy}
                      onClick={() =>
                        void resolveRequest(request.user_id, 'editor')
                      }
                      aria-label={`Allow ${request.email} to edit`}
                    >
                      <PencilLine size={14} />
                      Can edit
                    </Button>
                    <button
                      type="button"
                      className="sheet-destructive"
                      disabled={busy}
                      onClick={() => void resolveRequest(request.user_id, null)}
                      aria-label={`Decline ${request.email}`}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="sheet-section" aria-labelledby="people-title">
        <h3 id="people-title" className="sheet-section-title">
          People with access
        </h3>
        <ul className="sheet-group" aria-busy={loading}>
          <li className="sheet-row">
            <span className="avatar" aria-hidden="true">
              Y
            </span>
            <div className="sheet-row-text">
              <strong>You</strong>
              <small>Document owner</small>
            </div>
            <span className="sheet-row-value">Owner</span>
          </li>
          {loading ? (
            <li className="sheet-row" role="status">
              <LoaderCircle size={16} className="spin" />
              <span className="sheet-row-value">Loading access…</span>
            </li>
          ) : (
            shares.map((share) => (
              <li className="sheet-row" key={share.user_id}>
                <span className="avatar" aria-hidden="true">
                  {share.display_name[0]?.toUpperCase()}
                </span>
                <div className="sheet-row-text">
                  <strong>{share.display_name}</strong>
                  <small>{share.email}</small>
                </div>
                <span className="sheet-row-value">
                  {accessLabel(share.permission)}
                </span>
                <button
                  type="button"
                  className="sheet-destructive"
                  disabled={busy}
                  onClick={() => void revoke(share.user_id)}
                  aria-label={`Revoke access for ${share.email}`}
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
        <p className="sheet-footnote">
          <LockKeyhole size={12} />
          Private. Only the people listed here can open this document.
        </p>
      </section>
    </Dialog>
  );
}
