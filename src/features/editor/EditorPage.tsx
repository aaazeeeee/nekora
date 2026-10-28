import { useEffect, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import {
  ArrowLeft,
  Check,
  Cloud,
  CloudOff,
  FileText,
  LoaderCircle,
  LockKeyhole,
  Share2,
} from 'lucide-react';
import { documentService } from '../documents/document.service';
import { AccessDeniedError, errorMessage } from '../../lib/errors';
import { StatusCard } from '../../components/ui/status-card';
import { useAuth } from '../auth/AuthProvider';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { collaborativeEditorExtensions } from './config';
import { collaboratorIdentity, useCollaboration } from './useCollaboration';
import type { CollaborationSession, Collaborator } from './useCollaboration';
import { Toolbar } from './Toolbar';
import { ImproveWritingLayer } from '../ai/ImproveWriting';
import { isImproveShortcut, useImproveWriting } from '../ai/useImproveWriting';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { RequestAccess } from '../sharing/RequestAccess';
import { SharingDialog } from '../sharing/SharingDialog';
import { PageTopbar } from '../documents/PageTopbar';
import { documentTitle, useWorkspace } from '../documents/workspace-context';
type LoadedDocument = Awaited<ReturnType<typeof documentService.get>>;
export function EditorPage() {
  const { id } = useParams();
  const { session } = useAuth();
  const [document, setDocument] = useState<LoadedDocument | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setDocument(null);
    setError(null);
    if (id)
      void documentService
        .get(id)
        .then((doc) => {
          if (active) setDocument(doc);
        })
        .catch((error: unknown) => {
          if (active) setError(error);
        });
    return () => {
      active = false;
    };
  }, [id, attempt]);
  if (error instanceof AccessDeniedError && id)
    return <RequestAccess key={id} id={id} email={session?.user.email} />;
  if (error)
    return (
      <StatusCard
        icon={CloudOff}
        tone="danger"
        title="Couldn’t open this document"
        actions={
          <>
            <Button onClick={() => setAttempt((count) => count + 1)}>
              Try again
            </Button>
            <Link to="/" className="button button-outline">
              Back to workspace
            </Link>
          </>
        }
      >
        <p role="alert">{errorMessage(error)}</p>
      </StatusCard>
    );
  if (!document)
    return (
      <div className="page-state" role="status">
        <LoaderCircle className="spin" />
        Opening your document…
      </div>
    );
  return <DocumentEditor key={document.id} document={document} />;
}
function DocumentEditor({ document }: { document: LoadedDocument }) {
  const { session } = useAuth();
  const user = collaboratorIdentity(
    session?.user.id ?? '',
    typeof session?.user.user_metadata.display_name === 'string'
      ? session.user.user_metadata.display_name
      : (session?.user.email?.split('@')[0] ?? 'Writer'),
  );
  const collaboration = useCollaboration(document.id, user);
  if (!collaboration.session || !collaboration.synced) {
    return (
      <div className="page-state" role="status">
        {collaboration.saveState.status === 'error' ? (
          <div role="alert">
            <p>{collaboration.saveState.message}</p>
            <p>
              Check that the collaboration server is running, then reopen this
              document.
            </p>
            <Link to="/" className="button button-outline">
              Back to workspace
            </Link>
          </div>
        ) : (
          <>
            <LoaderCircle className="spin" />
            Connecting to the shared document…
          </>
        )}
      </div>
    );
  }
  return (
    <CollaborativeEditor
      document={document}
      user={user}
      collaboration={collaboration}
      room={collaboration.session}
    />
  );
}
function CollaborativeEditor({
  document,
  user,
  collaboration,
  room,
}: {
  document: LoadedDocument;
  user: Collaborator;
  collaboration: ReturnType<typeof useCollaboration>;
  room: CollaborationSession;
}) {
  const editable = !collaboration.readOnly;
  const { renameLocally } = useWorkspace();
  const title = collaboration.title;
  const state = collaboration.saveState;
  const [sharing, setSharing] = useState(false);
  const editor = useEditor({
    extensions: [
      ...collaborativeEditorExtensions,
      Collaboration.configure({ document: room.document }),
      CollaborationCaret.configure({ provider: room.provider, user }),
    ],
    editable,
    editorProps: {
      attributes: {
        'aria-label': 'Document content',
        role: 'textbox',
        'aria-multiline': 'true',
        spellcheck: 'true',
      },
    },
  });
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);
  useEffect(() => {
    renameLocally(document.id, title);
  }, [document.id, title, renameLocally]);
  useEditorState({ editor, selector: (context) => context.transactionNumber });
  const improve = useImproveWriting(editor, document.id);
  const dirty = state.status !== 'saved';
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const text = editor?.getText() ?? '';
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const characters = text.length;
  function rename(value: string) {
    if (editable) room.document.getMap('metadata').set('title', value);
  }

  const saveLabel = !collaboration.online
    ? 'Reconnecting…'
    : state.status === 'saved'
      ? 'All changes saved'
      : state.status === 'saving'
        ? 'Saving…'
        : state.status === 'pending'
          ? 'Unsaved changes'
          : 'Could not save';
  return (
    <div className="editor-layout">
      <PageTopbar>
        <Link className="icon-button" to="/" aria-label="Back to documents">
          <ArrowLeft size={18} />
        </Link>
        <div className="breadcrumb">
          <span>
            {document.permission === 'owner' ? 'Private' : 'Shared with you'}
          </span>
          <span aria-hidden="true">/</span>
          <strong>{documentTitle(title)}</strong>
        </div>
        <span
          className={`save-status ${state.status === 'error' ? 'is-error' : ''}`}
          role="status"
        >
          {state.status === 'saved' ? (
            <Check size={14} />
          ) : state.status === 'saving' ? (
            <LoaderCircle size={14} className="spin" />
          ) : (
            <Cloud size={14} />
          )}
          <span>{saveLabel}</span>
        </span>
        {document.permission === 'owner' ? (
          <Button onClick={() => setSharing(true)}>
            <Share2 size={15} />
            Share
          </Button>
        ) : (
          <span className={`access-tag ${document.permission}`}>
            <LockKeyhole size={12} />
            {editable ? 'Can edit' : 'View only'}
          </span>
        )}
      </PageTopbar>
      {state.status === 'error' && (
        <div className="save-error" role="alert">
          <span>{state.message}</span>
          {state.canRetry !== false && (
            <Button variant="outline" onClick={() => room.retry()}>
              Retry save
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              if (!editor) return;
              const blob = new Blob(
                [JSON.stringify({ title, content: editor.getJSON() }, null, 2)],
                { type: 'application/json' },
              );
              const url = URL.createObjectURL(blob);
              const link = window.document.createElement('a');
              link.href = url;
              link.download = 'nekora-unsaved-draft.json';
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Download draft
          </Button>
        </div>
      )}
      <div
        className="collaboration-presence"
        aria-label="Document collaborators"
      >
        <span
          className={
            collaboration.online ? 'connection-online' : 'connection-offline'
          }
        >
          {collaboration.online ? 'Live' : 'Reconnecting…'}
        </span>
        {collaboration.participants.map((person) => (
          <span
            key={person.id}
            className="collaborator"
            style={{ borderColor: person.color }}
            title={person.name}
          >
            <span
              aria-hidden="true"
              style={{ backgroundColor: person.color }}
            />
            {person.name}
            {person.id === user.id ? ' (you)' : ''}
          </span>
        ))}
      </div>
      <Toolbar editor={editor} disabled={!editable} improve={improve} />
      <main className="editor-canvas">
        <div
          className="editor-page"
          onKeyDown={(event) => {
            if (
              editable &&
              isImproveShortcut(event) &&
              event.target instanceof Node &&
              editor?.view.dom.contains(event.target)
            ) {
              event.preventDefault();
              improve.open();
            }
          }}
        >
          <span className="page-icon" aria-hidden="true">
            <FileText size={30} strokeWidth={1.6} />
          </span>
          <label className="sr-only" htmlFor="document-title">
            Document title
          </label>
          <input
            id="document-title"
            className="title-input"
            value={title}
            maxLength={200}
            placeholder="Untitled"
            readOnly={!editable}
            onChange={(event) => rename(event.target.value)}
          />
          <p className="editor-meta">
            {document.permission === 'owner'
              ? 'Your document · Private until you share it'
              : `Shared with you · ${editable ? 'You can edit' : 'View only'}`}
          </p>
          <EditorContent editor={editor} />
          {editor && editable && (
            <ImproveWritingLayer editor={editor} improve={improve} />
          )}
        </div>
      </main>
      <footer className="status-bar">
        <span>
          {words} {words === 1 ? 'word' : 'words'}
        </span>
        <span>
          {characters} {characters === 1 ? 'character' : 'characters'}
        </span>
      </footer>
      <SharingDialog
        id={document.id}
        open={sharing}
        onOpenChange={setSharing}
      />
      <Dialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open && blocker.state === 'blocked') blocker.reset();
        }}
        title="You have unsaved changes"
        description="Stay here to finish saving, or leave and discard the unsaved draft."
      >
        <div className="dialog-actions">
          <Button
            variant="outline"
            onClick={() => blocker.state === 'blocked' && blocker.reset()}
          >
            Keep editing
          </Button>
          <Button
            variant="danger"
            onClick={() => blocker.state === 'blocked' && blocker.proceed()}
          >
            Leave document
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
