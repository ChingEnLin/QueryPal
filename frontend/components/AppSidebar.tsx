import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
import { CollectionSummary } from '../types';

interface AppSidebarProps {
  accountName?: string;
  databaseName?: string;
  collections?: CollectionSummary[];
  activeCollection?: string;
  onCollectionSelect?: (name: string) => void;
  latencyMs?: number;
}

type NavItem =
  | { label: string; href: string; matchPrefix?: boolean; panel?: never; icon: React.ReactNode }
  | { label: string; panel: string; href?: never; matchPrefix?: never; icon: React.ReactNode };

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Workspace',
    href: '/query-generator',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="2" y="2" width="5" height="5" rx="1.5"/>
        <rect x="9" y="2" width="5" height="5" rx="1.5"/>
        <rect x="2" y="9" width="5" height="5" rx="1.5"/>
        <rect x="9" y="9" width="5" height="5" rx="1.5"/>
      </svg>
    ),
  },
  {
    label: 'Explorer',
    href: '/data-explorer',
    matchPrefix: true,
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M2 3h12v3H2zM2 7h12v3H2zM2 11h12v3H2z"/>
      </svg>
    ),
  },
  {
    label: 'Saved queries',
    panel: 'saved',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4 2h6l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
        <path d="M6 7h5M6 10h3"/>
      </svg>
    ),
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M2 13h12M4 11V6M7 11V3M10 11V8M13 11V5"/>
      </svg>
    ),
  },
  {
    label: 'Audit Log',
    href: '/audit',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M3 2h7l3 3v9H3zM6 7h5M6 9h5M6 11h3"/>
      </svg>
    ),
  },
];

const itemBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
  borderRadius: 6, fontSize: 12.5, cursor: 'pointer', textDecoration: 'none',
  width: '100%', border: 'none', background: 'none', fontFamily: 'var(--font-body)',
  transition: 'background 0.1s, color 0.1s', textAlign: 'left',
};

const AppSidebar: React.FC<AppSidebarProps> = ({
  accountName,
  databaseName,
  collections,
  activeCollection,
  onCollectionSelect,
  latencyMs,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useUnifiedAuth();

  const isActive = (href: string, matchPrefix?: boolean) => {
    if (matchPrefix) return location.pathname.startsWith(href);
    return location.pathname === href;
  };

  return (
    <aside className="qp-sidebar" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Brand */}
      <div style={{ padding: '14px 10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link to="/hub" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 7, background: 'var(--fg)', color: 'var(--bg)',
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14, letterSpacing: '-0.04em',
            flexShrink: 0,
          }}>Q</span>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 14,
            color: 'var(--fg)', letterSpacing: '-0.01em',
          }}>QueryPal</span>
        </Link>

        {/* Connection chip */}
        {accountName && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 9px', background: 'var(--soft)', borderRadius: 7,
          }}>
            <span style={{
              width: 14, height: 14, borderRadius: 4, background: '#1d6cf2', flexShrink: 0,
            }} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 11.5, fontWeight: 500, color: 'var(--fg)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{accountName}</div>
              {databaseName && (
                <div style={{
                  fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{databaseName}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ padding: '8px 8px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{
          fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'var(--muted)', padding: '0 8px 6px', fontWeight: 500,
        }}>Workspace</div>

        {NAV_ITEMS.map((item) => {
          const active = item.href ? isActive(item.href, item.matchPrefix) : false;
          const style: React.CSSProperties = {
            ...itemBase,
            color: active ? 'var(--fg)' : 'var(--muted)',
            background: active ? 'var(--soft)' : 'transparent',
            fontWeight: active ? 500 : 400,
          };

          const iconSpan = (
            <span style={{ color: active ? 'var(--accent)' : 'var(--muted)', display: 'flex', flexShrink: 0 }}>
              {item.icon}
            </span>
          );

          if (item.panel) {
            return (
              <button
                key={item.label}
                onClick={() => navigate('/query-generator?panel=' + item.panel)}
                style={style}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {iconSpan}
                {item.label}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href!}
              style={style}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {iconSpan}
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* Collections */}
      {collections && collections.length > 0 && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginTop: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 8px 6px 8px',
            fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--muted)',
          }}>
            <span>Collections</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{collections.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {collections.map((col) => {
              const active = activeCollection === col.name;
              return (
                <button
                  key={col.name}
                  onClick={() => onCollectionSelect?.(col.name)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--fg)' : 'var(--muted)',
                    fontSize: 12.5, fontFamily: 'var(--font-body)', marginBottom: 1,
                    textAlign: 'left', transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" style={{ marginRight: 7, flexShrink: 0, color: active ? 'var(--accent)' : 'var(--muted)' }}>
                    <ellipse cx="8" cy="4" rx="6" ry="2"/><path d="M2 4v8c0 1.1 2.7 2 6 2s6-.9 6-2V4M2 8c0 1.1 2.7 2 6 2s6-.9 6-2"/>
                  </svg>
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                    fontFamily: 'var(--font-mono)', fontSize: 11.5,
                  }}>{col.name}</span>
                  <span style={{
                    fontSize: 10, color: 'var(--muted)', flexShrink: 0, marginLeft: 4,
                    fontFamily: 'var(--font-mono)',
                  }}>{col.count.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Health / bottom */}
      <div style={{
        marginTop: 'auto', padding: '8px 10px',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span className="qa-dot ok" />
        <span style={{ fontSize: 11.5, color: 'var(--muted)', flex: 1 }}>
          Cluster healthy{latencyMs != null ? ` · ${latencyMs}ms` : ''}
        </span>
        <button
          onClick={logout}
          title="Sign out"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 5,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--fg)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6"/>
          </svg>
        </button>
      </div>
    </aside>
  );
};

export default AppSidebar;
