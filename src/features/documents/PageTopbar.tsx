import type { ReactNode } from 'react';
import { PanelLeft } from 'lucide-react';
import { useWorkspace } from './workspace-context';

export function PageTopbar({ children }: { children: ReactNode }) {
  const { openSidebar } = useWorkspace();
  return (
    <header className="topbar">
      <button
        className="icon-button sidebar-toggle"
        aria-label="Open sidebar"
        onClick={openSidebar}
      >
        <PanelLeft size={18} />
      </button>
      {children}
    </header>
  );
}
