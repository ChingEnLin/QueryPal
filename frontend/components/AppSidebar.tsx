import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
import { CollectionSummary } from '../types';

interface AppSidebarProps {
  accountName?: string;
  databaseName?: string;
  collections?: CollectionSummary[];
  activeCollection?: string;
  onCollectionSelect?: (name: string) => void;
}

const NAV_ITEMS = [
  {
    label: 'Workspace',
    href: '/query-generator',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
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
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 4h12M2 8h12M2 12h7"/>
      </svg>
    ),
    matchPrefix: true,
  },
  {
    label: 'Analytics',
    href: '/analytics',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 13L6 8l3 3 3-5 2 2"/>
      </svg>
    ),
  },
  {
    label: 'Audit Log',
    href: '/audit',
    icon: (
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
        <path d="M6 6h4M6 9h3"/>
      </svg>
    ),
  },
];

const AppSidebar: React.FC<AppSidebarProps> = ({
  accountName,
  databaseName,
  collections,
  activeCollection,
  onCollectionSelect,
}) => {
  const location = useLocation();
  const { logout } = useUnifiedAuth();

  const isActive = (href: string, matchPrefix?: boolean) => {
    if (matchPrefix) return location.pathname.startsWith(href);
    return location.pathname === href;
  };

  return (
    <aside className="qp-sidebar" style={{ fontFamily: 'var(--font-body)' }}>
      {/* Brand */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
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
            marginTop: 10, display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 8px', background: 'var(--soft)', borderRadius: 7,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0,
            }} />
            <div style={{ minWidth: 0 }}>
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
      <nav style={{ padding: '8px 8px 0' }}>
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.matchPrefix);
          return (
            <Link
              key={item.href}
              to={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px',
                borderRadius: 7, textDecoration: 'none', marginBottom: 2,
                fontSize: 13, fontWeight: active ? 500 : 400,
                color: active ? 'var(--fg)' : 'var(--muted)',
                background: active ? 'var(--soft)' : 'transparent',
                transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={{ color: active ? 'var(--accent)' : 'var(--muted)', display: 'flex' }}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Collections */}
      {collections && collections.length > 0 && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          <div style={{
            padding: '6px 16px 4px',
            fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--muted)',
          }}>Collections</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {collections.map((col) => {
              const active = activeCollection === col.name;
              return (
                <button
                  key={col.name}
                  onClick={() => onCollectionSelect?.(col.name)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 8px', borderRadius: 7, border: 'none', cursor: 'pointer',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--fg)' : 'var(--muted)',
                    fontSize: 12.5, fontFamily: 'var(--font-body)', marginBottom: 1,
                    textAlign: 'left', transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
        marginTop: 'auto', padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          Connected
        </div>
        <button
          onClick={logout}
          title="Sign out"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 5,
          }}
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
