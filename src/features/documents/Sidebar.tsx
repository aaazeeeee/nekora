import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  LockKeyhole,
  Plus,
  Upload,
} from 'lucide-react';
import type { DocumentSummary } from '../../types/database';
import { documentTitle } from './workspace-context';

type SidebarProps = {
  name: string;
  documents: DocumentSummary[];
  loading: boolean;
  error: string;
  busy: boolean;
  open: boolean;
  onClose: () => void;
  onRetry: () => void;
  onCreate: () => void;
  onImport: () => void;
  onAccount: () => void;
};

export function Sidebar({
  name,
  documents,
  loading,
  error,
  busy,
  open,
  onClose,
  onRetry,
  onCreate,
  onImport,
  onAccount,
}: SidebarProps) {
  const owned = documents.filter((doc) => doc.permission === 'owner');
  const shared = documents.filter((doc) => doc.permission !== 'owner');
  return (
    <>
      {open && (
        <button
          className="sidebar-scrim"
          aria-label="Close sidebar"
          onClick={onClose}
        />
      )}
      <aside
        className={`sidebar ${open ? 'open' : ''}`}
        aria-label="Documents"
        onKeyDown={(event) => event.key === 'Escape' && onClose()}
      >
        <button className="workspace-switch" onClick={onAccount}>
          <span className="workspace-avatar">
            {name.charAt(0).toUpperCase()}
          </span>
          <span className="workspace-name">{name}’s Nekora</span>
          <ChevronsUpDown size={14} />
        </button>
        <div className="sidebar-actions">
          <button className="sidebar-row" onClick={onCreate} disabled={busy}>
            <Plus size={16} />
            New document
          </button>
          <button className="sidebar-row" onClick={onImport} disabled={busy}>
            <Upload size={16} />
            Import file
          </button>
        </div>
        <div className="sidebar-tree" aria-busy={loading}>
          {error ? (
            <div className="sidebar-error">
              <p>Couldn’t load documents.</p>
              <button onClick={onRetry}>Try again</button>
            </div>
          ) : (
            <>
              <TreeSection
                label="Private"
                documents={owned}
                loading={loading}
                empty="No documents yet"
                onNavigate={onClose}
              />
              <TreeSection
                label="Shared"
                documents={shared}
                loading={loading}
                empty="Nothing shared yet"
                onNavigate={onClose}
              />
            </>
          )}
        </div>
        <p className="sidebar-footnote">
          <LockKeyhole size={12} />
          Private until you share
        </p>
      </aside>
    </>
  );
}

function TreeSection({
  label,
  documents,
  loading,
  empty,
  onNavigate,
}: {
  label: string;
  documents: DocumentSummary[];
  loading: boolean;
  empty: string;
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <section className="tree-section">
      <button
        className="tree-heading"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {label}
        {!loading && <span className="tree-count">{documents.length}</span>}
      </button>
      {expanded &&
        (loading ? (
          <div className="tree-skeleton" aria-hidden="true">
            <span />
            <span />
          </div>
        ) : documents.length === 0 ? (
          <p className="tree-empty">{empty}</p>
        ) : (
          <ul>
            {documents.map((doc) => (
              <li key={doc.id}>
                <NavLink
                  to={`/documents/${doc.id}`}
                  className="tree-item"
                  onClick={onNavigate}
                >
                  <FileText size={15} />
                  <span>{documentTitle(doc.title)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
