import { useEffect, useState } from 'react';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { getClient } from '../../lib/supabase/client';
import type { SaveState } from './autosave';

export type Collaborator = { id: string; name: string; color: string };
export type CollaborationSession = {
  provider: HocuspocusProvider;
  document: Y.Doc;
  retry: () => void;
};
export function collaboratorIdentity(id: string, name: string): Collaborator {
  const colors = ['#7c3aed', '#2563eb', '#047857', '#be123c', '#b45309'];
  const hash = Array.from(id).reduce(
    (value, letter) => value + letter.charCodeAt(0),
    0,
  );
  return { id, name: name.slice(0, 100), color: colors[hash % colors.length] };
}
function toBase64(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

export function useCollaboration(id: string, user: Collaborator) {
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [synced, setSynced] = useState(false);
  const [online, setOnline] = useState(false);
  const [readOnly, setReadOnly] = useState(true);
  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState<Collaborator[]>([]);
  const [saveState, setSaveState] = useState<SaveState>({
    status: 'pending',
    message: '',
  });
  const { id: userId, name, color } = user;
  useEffect(() => {
    let active = true;
    let connected = false;
    let canWrite = false;
    let loaded = false;
    let generation = 0;
    let persistedGeneration = 0;
    let acknowledgedVector: Uint8Array | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const document = new Y.Doc();
    const metadata = document.getMap('metadata');
    function requestCheckpoint() {
      clearTimeout(timer);
      if (!active) return;
      if (!connected || !provider.isAuthenticated) {
        provider.disconnect();
        void provider.connect();
        return;
      }
      if (!loaded) return;
      if (!canWrite && generation !== persistedGeneration) {
        setSaveState({
          status: 'error',
          message:
            'Your access is now read-only. Download your unsaved draft before reopening.',
          canRetry: false,
        });
        return;
      }
      setSaveState({ status: 'saving', message: '' });
      provider.sendStateless(
        JSON.stringify({
          type: 'checkpoint',
          id: generation,
          ...(canWrite
            ? {
                update: toBase64(
                  Y.encodeStateAsUpdate(document, acknowledgedVector),
                ),
              }
            : {}),
        }),
      );
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (active)
          setSaveState({
            status: 'error',
            message: 'Saving is taking too long. Retry or download your draft.',
          });
      }, 15000);
    }
    function changed(
      _update: Uint8Array,
      _origin: unknown,
      _document: Y.Doc,
      transaction: Y.Transaction,
    ) {
      if (!active || !transaction.local || !canWrite) return;
      generation += 1;
      setSaveState({ status: 'pending', message: '' });
      clearTimeout(timer);
      timer = setTimeout(requestCheckpoint, 800);
    }
    function titleChanged() {
      const value: unknown = metadata.get('title');
      if (active && typeof value === 'string') setTitle(value);
    }
    document.on('update', changed);
    metadata.observe(titleChanged);
    const url = import.meta.env.VITE_COLLABORATION_URL || 'ws://localhost:1234';
    const provider = new HocuspocusProvider({
      url,
      name: id,
      document,
      token: async () => {
        const { data, error } = await getClient().auth.getSession();
        if (error || !data.session)
          throw new Error('Sign in again to collaborate.');
        return data.session.access_token;
      },
      onStatus({ status }) {
        if (!active) return;
        connected = status === 'connected';
        setOnline(connected);
        if (!connected)
          setSaveState({
            status: 'pending',
            message: 'Reconnecting… Keep this tab open to sync your changes.',
          });
      },
      onAuthenticated({ scope }) {
        if (!active) return;
        canWrite = scope === 'read-write';
        setReadOnly(!canWrite);
      },
      onAuthenticationFailed() {
        if (!active) return;
        canWrite = false;
        setReadOnly(true);
        setSaveState({
          status: 'error',
          message:
            'Access denied or your session expired. Download your draft before reopening.',
          canRetry: false,
        });
      },
      onClose() {
        if (!active) return;
        connected = false;
        setOnline(false);
        canWrite = false;
        setReadOnly(true);
        setSaveState({
          status: 'error',
          message:
            'The collaboration connection closed. Your draft is still in this tab. Reconnect or download it.',
        });
      },
      onSynced({ state }) {
        if (!active || !state) return;
        loaded = true;
        setSynced(true);
        titleChanged();
        requestCheckpoint();
      },
      onStateless({ payload }) {
        if (!active) return;
        let message: unknown;
        try {
          message = JSON.parse(payload);
        } catch {
          return;
        }
        if (!message || typeof message !== 'object' || !('type' in message))
          return;
        if (message.type === 'fatal') {
          canWrite = false;
          setReadOnly(true);
          setSaveState({
            status: 'error',
            message:
              'This document moved to another server. Download your draft and reopen.',
            canRetry: false,
          });
          return;
        }
        if (!('id' in message) || message.id !== generation) return;
        clearTimeout(timeout);
        if (
          message.type === 'saved' &&
          'vector' in message &&
          typeof message.vector === 'string'
        ) {
          try {
            acknowledgedVector = fromBase64(message.vector);
          } catch {
            return;
          }
          persistedGeneration = generation;
          setSaveState({ status: 'saved', message: '' });
        } else if (message.type === 'save-error') {
          setSaveState({
            status: 'error',
            message:
              'Could not save. Keep this tab open and retry, or download your draft.',
          });
        }
      },
      onAwarenessUpdate() {
        if (!active) return;
        const people = new Map<string, Collaborator>();
        for (const presence of provider.awareness?.getStates().values() ?? []) {
          const person: unknown = presence.user;
          if (
            person &&
            typeof person === 'object' &&
            'id' in person &&
            typeof person.id === 'string' &&
            'name' in person &&
            typeof person.name === 'string'
          ) {
            people.set(person.id, collaboratorIdentity(person.id, person.name));
          }
        }
        setParticipants([...people.values()]);
      },
    });
    provider.setAwarenessField('user', { id: userId, name, color });
    setSession({ provider, document, retry: requestCheckpoint });
    const connectionTimeout = setTimeout(() => {
      if (active && !loaded)
        setSaveState({
          status: 'error',
          message:
            'Could not connect to collaboration. Check the server and reopen this document.',
        });
    }, 15000);
    // Send refreshed credentials without destroying the editor or its unsaved state.
    const {
      data: { subscription },
    } = getClient().auth.onAuthStateChange((event) => {
      if (event === 'TOKEN_REFRESHED') {
        // Avoid calling Supabase auth methods inside the synchronous auth callback.
        queueMicrotask(() => {
          if (active) void provider.sendToken().catch(() => setReadOnly(true));
        });
      }
      if (event === 'SIGNED_OUT') {
        provider.disconnect();
        setReadOnly(true);
      }
    });
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(timeout);
      clearTimeout(connectionTimeout);
      subscription.unsubscribe();
      metadata.unobserve(titleChanged);
      document.off('update', changed);
      provider.destroy();
      document.destroy();
    };
  }, [id, userId, name, color]);
  return { session, synced, online, readOnly, title, participants, saveState };
}
