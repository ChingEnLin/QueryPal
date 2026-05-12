import React from 'react';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
import { useTheme } from '../contexts/ThemeContext';

interface AppTopBarProps {
  accountName?: string;
  databaseName?: string;
  collectionName?: string;
  onNewQuery?: () => void;
}

const AppTopBar: React.FC<AppTopBarProps> = ({
  accountName,
  databaseName,
  collectionName,
  onNewQuery,
}) => {
  const { user } = useUnifiedAuth();
  const { theme, toggleTheme } = useTheme();

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="qp-topbar">
      {/* Breadcrumb */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--muted)', minWidth: 0 }}>
        {accountName && (
          <>
            <span style={{ color: 'var(--fg)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{accountName}</span>
          </>
        )}
        {databaseName && (
          <>
            <span style={{ opacity: 0.4 }}>›</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{databaseName}</span>
          </>
        )}
        {collectionName && (
          <>
            <span style={{ opacity: 0.4 }}>›</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{collectionName}</span>
          </>
        )}
      </div>

      {/* ⌘K hint */}
      <button
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 7,
          background: 'var(--soft)', color: 'var(--muted)', fontSize: 12,
          cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}
        title="Command palette (coming soon)"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="4.5"/>
          <path d="M10.5 10.5l3 3"/>
        </svg>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>⌘K</span>
      </button>

      {onNewQuery && (
        <button className="qa-btn primary" onClick={onNewQuery} style={{ fontSize: 12.5 }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          New query
        </button>
      )}

      {/* Theme toggle — shows icon for what you'll switch TO */}
      <button
        onClick={toggleTheme}
        title="Toggle theme"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', display: 'flex', padding: 5, borderRadius: 6,
        }}
      >
        {theme === 'light' ? (
          /* Moon: click to go dark */
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        ) : (
          /* Sun: click to go light */
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        )}
      </button>

      {/* Notifications */}
      <button
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', display: 'flex', padding: 5, borderRadius: 6,
        }}
        title="Notifications"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 1.5A3.5 3.5 0 0111.5 5v3.5l1 1.5H3.5l1-1.5V5A3.5 3.5 0 018 1.5z"/>
          <path d="M6.5 13a1.5 1.5 0 003 0"/>
        </svg>
      </button>

      {/* User avatar */}
      <div
        title={user?.name || user?.email}
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'var(--accent-soft)', color: 'var(--accent)',
          display: 'grid', placeItems: 'center',
          fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)',
          cursor: 'default',
        }}
      >
        {initials}
      </div>
    </header>
  );
};

export default AppTopBar;
