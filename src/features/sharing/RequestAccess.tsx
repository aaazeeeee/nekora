import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, LoaderCircle, LockKeyhole, Send } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { StatusCard } from '../../components/ui/status-card';
import { errorMessage } from '../../lib/errors';
import { sharingService } from './sharing.service';

export function RequestAccess({ id, email }: { id: string; email?: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  async function request() {
    setState('sending');
    setError('');
    try {
      await sharingService.requestAccess(id);
      setState('sent');
    } catch (error) {
      setError(errorMessage(error));
      setState('idle');
    }
  }
  const sent = state === 'sent';
  return (
    <StatusCard
      icon={sent ? Check : LockKeyhole}
      tone={sent ? 'success' : 'accent'}
      title={sent ? 'Request sent' : 'You need access'}
      actions={
        <>
          <Button
            variant={sent ? 'success' : 'default'}
            disabled={state !== 'idle'}
            onClick={() => void request()}
          >
            {sent ? (
              <Check size={16} />
            ) : state === 'sending' ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Send size={15} />
            )}
            {sent
              ? 'Request sent'
              : state === 'sending'
                ? 'Sending…'
                : 'Request access'}
          </Button>
          <Link to="/" className="button button-outline">
            Back to workspace
          </Link>
        </>
      }
      footer={email && <>Signed in as {email}</>}
    >
      {sent ? (
        <p role="status">
          If this document exists, the owner can review your request from the
          Share menu. Reopen this link once it’s approved.
        </p>
      ) : (
        <p>
          This document is private. Ask the owner for access, or switch to an
          account that already has it.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </StatusCard>
  );
}
