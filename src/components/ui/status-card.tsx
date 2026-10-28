import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function StatusCard({
  icon: Icon,
  tone = 'neutral',
  title,
  children,
  actions,
  footer,
}: {
  icon: LucideIcon;
  tone?: 'neutral' | 'accent' | 'success' | 'danger';
  title: string;
  children: ReactNode;
  actions: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="status-screen">
      <section className="status-card" aria-labelledby="status-card-title">
        <span className={`status-tile ${tone}`} aria-hidden="true">
          <Icon size={26} strokeWidth={1.8} />
        </span>
        <h1 id="status-card-title">{title}</h1>
        <div className="status-body">{children}</div>
        <div className="status-actions">{actions}</div>
        {footer && <p className="status-footer">{footer}</p>}
      </section>
    </div>
  );
}
