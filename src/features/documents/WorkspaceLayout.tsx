import { Suspense, useEffect, useRef, useState } from 'react';
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  FileText,
  Home,
  Layers3,
  LoaderCircle,
  LogOut,
  Users,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { useAuth } from '../auth/AuthProvider';
import { authService } from '../auth/auth.service';
import { errorMessage } from '../../lib/errors';
import { documentService } from './document.service';
import { useDocuments } from './useDocuments';
import { Sidebar } from './Sidebar';
import type { WorkspaceContext } from './workspace-context';

const RIBBON_LINKS = [
  { view: null, label: 'All documents', icon: Home },
  { view: 'mine', label: 'My documents', icon: FileText },
  { view: 'shared', label: 'Shared with me', icon: Users },
] as const;

export function WorkspaceLayout() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const { documents, loading, error, reload, renameLocally } = useDocuments();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [account, setAccount] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Refresh on navigation so titles and edit times reflect the latest saves.
  useEffect(() => {
    void reload();
  }, [reload, pathname]);
  const name = String(
    session?.user.user_metadata.display_name ||
      session?.user.email?.split('@')[0] ||
      'Writer',
  );
  async function run(action: () => Promise<string>) {
    setBusy(true);
    setActionError('');
    try {
      const id = await action();
      setSidebarOpen(false);
      void navigate(`/documents/${id}`);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  function createDocument() {
    void run(() => documentService.create());
  }
  function importFile(file: File) {
    void run(async () => {
      const { parseFile } = await import('../import/import.service');
      const imported = await parseFile(file);
      return documentService.create(imported.title, imported.content);
    });
  }
  async function signOut() {
    setBusy(true);
    setActionError('');
    try {
      await authService.signOut();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }
  const context: WorkspaceContext = {
    documents,
    loading,
    error,
    busy,
    reload,
    renameLocally,
    createDocument,
    openImport: () => fileRef.current?.click(),
    openSidebar: () => setSidebarOpen(true),
  };
  const currentView = pathname === '/' ? params.get('view') : undefined;
  return (
    <div className="workspace">
      <nav className="ribbon" aria-label="Views">
        <Link to="/" className="ribbon-brand" aria-label="Nekora home">
          <Layers3 size={18} />
        </Link>
        {RIBBON_LINKS.map(({ view, label, icon: Icon }) => (
          <Link
            key={label}
            to={view ? `/?view=${view}` : '/'}
            className="ribbon-item"
            aria-label={label}
            title={label}
            aria-current={currentView === view ? 'page' : undefined}
          >
            <Icon size={18} />
          </Link>
        ))}
      </nav>
      <Sidebar
        name={name}
        documents={documents}
        loading={loading}
        error={error}
        busy={busy}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onRetry={() => void reload()}
        onCreate={createDocument}
        onImport={context.openImport}
        onAccount={() => setAccount(true)}
      />
      <input
        ref={fileRef}
        className="sr-only"
        aria-label="Import a TXT or Markdown file"
        type="file"
        accept=".txt,.md"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) importFile(file);
        }}
      />
      <div className="workspace-main">
        <Suspense
          fallback={
            <div className="page-state" role="status">
              <LoaderCircle className="spin" />
              Loading…
            </div>
          }
        >
          <Outlet context={context} />
        </Suspense>
      </div>
      {actionError && (
        <div className="toast" role="alert">
          <span>{actionError}</span>
          <button
            className="icon-button"
            aria-label="Dismiss error"
            onClick={() => setActionError('')}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <Dialog
        open={account}
        onOpenChange={setAccount}
        title="Your account"
        description="Your personal Nekora workspace."
      >
        <div className="account-info">
          <span className="avatar">{name.charAt(0).toUpperCase()}</span>
          <div>
            <strong>{name}</strong>
            <p>{session?.user.email}</p>
          </div>
        </div>
        <p className="muted">
          All documents are private until you grant access to another account.
        </p>
        <div className="dialog-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void signOut()}
          >
            <LogOut size={16} />
            Sign out
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
