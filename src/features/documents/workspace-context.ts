import { useOutletContext } from 'react-router-dom';
import type { DocumentSummary } from '../../types/database';

export type WorkspaceContext = {
  documents: DocumentSummary[];
  loading: boolean;
  error: string;
  busy: boolean;
  reload: () => Promise<void>;
  renameLocally: (id: string, title: string) => void;
  createDocument: () => void;
  openImport: () => void;
  openSidebar: () => void;
};

export function useWorkspace() {
  return useOutletContext<WorkspaceContext>();
}

export function documentTitle(title: string) {
  return title.trim() || 'Untitled';
}
