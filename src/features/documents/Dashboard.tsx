import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  Clock3,
  FileText,
  FolderOpen,
  LoaderCircle,
  Plus,
  Search,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import type { DocumentSummary, Permission } from '../../types/database';
import { PageTopbar } from './PageTopbar';
import { documentTitle, useWorkspace } from './workspace-context';

type Filter = 'all' | 'mine' | 'shared';
type Sort = 'modified' | 'title';

const SORT_OPTIONS = [
  { value: 'modified', label: 'Last edited', icon: Clock3 },
  { value: 'title', label: 'Title A–Z', icon: ArrowDownAZ },
] as const;

const VIEWS = {
  all: {
    label: 'All documents',
    description: 'Everything you’ve written or been invited to.',
    icon: FolderOpen,
  },
  mine: {
    label: 'My documents',
    description: 'Documents you own. Private until you share them.',
    icon: FileText,
  },
  shared: {
    label: 'Shared with me',
    description: 'Documents other people have shared with you.',
    icon: Users,
  },
} as const;

const ACCESS_LABELS: Record<Permission, string> = {
  owner: 'Only you',
  editor: 'Can edit',
  viewer: 'Can view',
};

function modified(timestamp: string) {
  const date = new Date(timestamp);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days < 1)
    return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (days === 1) return 'Yesterday';
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function byModified(a: DocumentSummary, b: DocumentSummary) {
  return Date.parse(b.updated_at) - Date.parse(a.updated_at);
}

export function Dashboard() {
  const {
    documents,
    loading,
    error,
    busy,
    reload,
    createDocument,
    openImport,
  } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const view = params.get('view');
  const filter: Filter = view === 'mine' || view === 'shared' ? view : 'all';
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('modified');
  const counts = {
    all: documents.length,
    mine: documents.filter((doc) => doc.permission === 'owner').length,
    shared: documents.filter((doc) => doc.permission !== 'owner').length,
  };
  const search = query.trim().toLowerCase();
  const visible = documents
    .filter(
      (doc) =>
        (filter === 'all' ||
          (filter === 'mine'
            ? doc.permission === 'owner'
            : doc.permission !== 'owner')) &&
        (doc.title.toLowerCase().includes(search) ||
          doc.owner_name.toLowerCase().includes(search)),
    )
    .sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title) : byModified(a, b),
    );
  const recent =
    filter === 'all' && !search
      ? [...documents].sort(byModified).slice(0, 4)
      : [];
  const { label, description, icon: PageIcon } = VIEWS[filter];
  return (
    <>
      <PageTopbar>
        <div className="breadcrumb">
          <span>Nekora</span>
          <span aria-hidden="true">/</span>
          <strong>{label}</strong>
        </div>
      </PageTopbar>
      <main className="page">
        <header className="page-header">
          <span className="page-icon" aria-hidden="true">
            <PageIcon size={30} strokeWidth={1.6} />
          </span>
          <h1>{label}</h1>
          <p>{description}</p>
        </header>
        {!loading && !error && recent.length > 0 && (
          <section className="recent" aria-labelledby="recent-heading">
            <h2 id="recent-heading" className="section-label">
              <Clock3 size={14} />
              Jump back in
            </h2>
            <div className="recent-grid">
              {recent.map((doc, index) => (
                <Link
                  key={doc.id}
                  to={`/documents/${doc.id}`}
                  className="recent-card"
                >
                  <span
                    className={`recent-cover tone-${index % 4}`}
                    aria-hidden="true"
                  >
                    <FileText size={22} />
                  </span>
                  <span className="recent-title">
                    {documentTitle(doc.title)}
                  </span>
                  <span className="recent-meta">
                    {modified(doc.updated_at)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
        <section aria-label="Documents">
          <div className="database-toolbar">
            <div
              className="view-tabs"
              role="group"
              aria-label="Filter documents"
            >
              {(Object.keys(VIEWS) as Filter[]).map((key) => (
                <button
                  key={key}
                  className="view-tab"
                  aria-pressed={filter === key}
                  onClick={() => setParams(key === 'all' ? {} : { view: key })}
                >
                  {VIEWS[key].label}
                  <span className="view-count">{counts[key]}</span>
                </button>
              ))}
            </div>
            <div className="database-actions">
              <label className="search-input">
                <Search size={15} />
                <span className="sr-only">Search documents</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search…"
                />
                {query && (
                  <button
                    aria-label="Clear search"
                    onClick={() => setQuery('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </label>
              <Select
                variant="ghost"
                icon={ArrowDownWideNarrow}
                aria-label="Sort documents"
                value={sort}
                onValueChange={setSort}
                options={SORT_OPTIONS}
              />
              <Button variant="outline" onClick={openImport} disabled={busy}>
                <Upload size={15} />
                Import
              </Button>
              <Button
                onClick={createDocument}
                disabled={busy}
                aria-label="New document"
              >
                {busy ? (
                  <LoaderCircle size={15} className="spin" />
                ) : (
                  <Plus size={16} />
                )}
                New
              </Button>
            </div>
          </div>
          {loading ? (
            <div className="table-skeleton" role="status">
              {[1, 2, 3].map((item) => (
                <span key={item} />
              ))}
              <span className="sr-only">Loading documents…</span>
            </div>
          ) : error ? (
            <div className="empty-state">
              <FolderOpen size={28} />
              <h3>Let’s try that again.</h3>
              <p role="alert">{error}</p>
              <Button variant="outline" onClick={() => void reload()}>
                Retry loading
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="empty-state">
              <FileText size={28} />
              <h3>
                {search
                  ? 'No matching documents'
                  : filter === 'shared'
                    ? 'Nothing shared with you yet'
                    : 'An empty page, full of possibility'}
              </h3>
              <p>
                {search
                  ? 'Try a different title or owner name.'
                  : filter === 'shared'
                    ? 'Documents shared with your account will appear here.'
                    : 'Create your first document or import a TXT or Markdown file.'}
              </p>
              {!search && filter !== 'shared' && (
                <Button onClick={createDocument} disabled={busy}>
                  <Plus size={16} />
                  Create a document
                </Button>
              )}
            </div>
          ) : (
            <table className="document-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col" className="col-owner">
                    Owner
                  </th>
                  <th scope="col" className="col-access">
                    Access
                  </th>
                  <th scope="col" className="col-modified">
                    Last edited
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <Link to={`/documents/${doc.id}`} className="row-link">
                        <FileText size={16} />
                        <span>{documentTitle(doc.title)}</span>
                      </Link>
                    </td>
                    <td className="col-owner">
                      <span className="owner">
                        <span className="mini-avatar" aria-hidden="true">
                          {doc.owner_name[0]?.toUpperCase()}
                        </span>
                        {doc.permission === 'owner' ? 'You' : doc.owner_name}
                      </span>
                    </td>
                    <td className="col-access">
                      <span className={`access-tag ${doc.permission}`}>
                        {ACCESS_LABELS[doc.permission]}
                      </span>
                    </td>
                    <td className="col-modified">{modified(doc.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
