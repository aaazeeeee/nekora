import { useCallback, useRef, useState } from 'react';
import { documentService } from './document.service';
import { errorMessage } from '../../lib/errors';
import type { DocumentSummary } from '../../types/database';

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const latestRequest = useRef(0);
  const reload = useCallback(async () => {
    // Ignore responses from earlier requests so a slow list never overwrites a newer one.
    const request = ++latestRequest.current;
    setError('');
    try {
      const items = await documentService.list();
      if (request === latestRequest.current) setDocuments(items);
    } catch (error) {
      if (request === latestRequest.current) setError(errorMessage(error));
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, []);
  // Keeps the sidebar in step with the title being typed in the editor.
  const renameLocally = useCallback((id: string, title: string) => {
    setDocuments((items) =>
      items.map((item) => (item.id === id ? { ...item, title } : item)),
    );
  }, []);
  return { documents, loading, error, reload, renameLocally };
}
