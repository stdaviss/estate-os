/** Temporary stand-ins for @repo/ui. Delete when packages/ui is in the repo. */

import type { CSSProperties, ReactNode } from 'react';

export function Data({ children }: { children: ReactNode }) {
  return <span className="c-data">{children}</span>;
}

export function Button({
  children,
  variant = 'ghost',
  href,
  onClick,
  type = 'button',
}: {
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'danger';
  href?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
}) {
  const cls = `c-btn ${variant === 'primary' ? 'c-btn-primary' : variant === 'danger' ? 'c-btn-danger' : 'c-btn-ghost'}`;
  if (href) {
    return (
      <a className={cls} href={href}>
        {children}
      </a>
    );
  }
  return (
    <button className={cls} type={type} onClick={onClick}>
      {children}
    </button>
  );
}

export function Pill({ children, live = false }: { children: ReactNode; live?: boolean }) {
  return <span className={live ? 'c-pill c-pill-live' : 'c-pill'}>{children}</span>;
}

export function StatusDot() {
  return <span className="c-dot" aria-hidden="true" />;
}

export function Rule() {
  return <hr className="c-rule" />;
}

export function SectionHead({ children }: { children: ReactNode }) {
  return <h2 className="c-display-m">{children}</h2>;
}

export function EmptyState({
  label,
  children,
  action,
}: {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="c-empty">
      <div className="c-label">{label}</div>
      <p className="c-body-l">{children}</p>
      {action}
    </div>
  );
}

export function Artwork({
  src,
  alt,
  size = 48,
}: {
  src: string | null;
  alt: string;
  size?: number;
}) {
  const style: CSSProperties = { width: size, height: size };
  return (
    <span className="c-art" style={style}>
      {src ? (
        <img src={src} alt={alt} />
      ) : (
        <svg viewBox="0 0 96 96" role="img" aria-label={alt}>
          <rect width="96" height="96" fill="var(--hull)" />
          <rect x="8" y="8" width="80" height="80" fill="none" stroke="var(--rule)" />
        </svg>
      )}
    </span>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="c-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="c-field">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function LoadState({
  status,
  onRetry,
  children,
}: {
  status: 'loading' | 'error' | 'ready';
  onRetry: () => void;
  children: ReactNode;
}) {
  if (status === 'loading') {
    return (
      <div className="c-status">
        <span className="c-label">Loading</span>
        <p>Fetching the list.</p>
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="c-status">
        <span className="c-label">Error</span>
        <p>The list did not load. Check the connection and try again.</p>
        <div className="c-retry">
          <Button variant="primary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
