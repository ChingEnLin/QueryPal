import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
import { useRoles } from '../hooks/useRoles';

const UserMenuButton: React.FC = () => {
  const { user, logout } = useUnifiedAuth();
  const { can } = useRoles();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  useEffect(() => {
    if (!showUserMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
        setShowSignOutConfirm(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showUserMenu]);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setShowUserMenu(v => !v); setShowSignOutConfirm(false); }}
        title={user?.name || user?.email}
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: showUserMenu ? 'var(--accent)' : 'var(--accent-soft)',
          color: showUserMenu ? '#fff' : 'var(--accent)',
          display: 'grid', placeItems: 'center',
          fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)',
          cursor: 'pointer', border: 'none',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        {initials}
      </button>

      {showUserMenu && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200,
          background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220,
          overflow: 'hidden',
        }}>
          {/* User info */}
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-body)', marginBottom: 2 }}>
              {user?.name || 'User'}
            </div>
            {user?.email && (
              <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-body)', marginBottom: 6 }}>
                {user.email}
              </div>
            )}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(user?.roles?.length ? user.roles : ['Viewer']).map((r) => (
                <span
                  key={r}
                  className={`qa-chip${r === 'Admin' ? ' accent' : ''}`}
                  style={{ fontSize: 10.5, padding: '2px 7px', ...(r === 'Viewer' ? { color: 'var(--muted)' } : {}) }}
                >
                  {r}
                </span>
              ))}
            </div>
          </div>

          {/* Saved queries */}
          <div style={{ padding: '6px 6px' }}>
            <button
              onClick={() => { setShowUserMenu(false); navigate('/query-generator?panel=saved'); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                padding: '7px 10px', borderRadius: 7, border: 'none',
                background: 'transparent', color: 'var(--fg)',
                fontSize: 12.5, fontFamily: 'var(--font-body)', cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                <path d="M4 2h6l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
                <path d="M6 7h5M6 10h3"/>
              </svg>
              Saved queries
            </button>
          </div>

          {/* Admin link */}
          {can('system:admin') && (
            <div style={{ padding: '0 6px' }}>
              <button
                onClick={() => { setShowUserMenu(false); navigate('/admin'); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 10px', borderRadius: 7, border: 'none',
                  background: 'transparent', color: 'var(--fg)',
                  fontSize: 12.5, fontFamily: 'var(--font-body)', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                  <circle cx="8" cy="5" r="3"/>
                  <path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/>
                </svg>
                Role management
              </button>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '0 6px' }} />

          {/* Sign out */}
          <div style={{ padding: '6px 6px' }}>
            {!showSignOutConfirm ? (
              <button
                onClick={() => setShowSignOutConfirm(true)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 10px', borderRadius: 7, border: 'none',
                  background: 'transparent', color: 'var(--fg)',
                  fontSize: 12.5, fontFamily: 'var(--font-body)', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--status-err) 8%, var(--panel))'; (e.currentTarget as HTMLElement).style.color = 'var(--status-err)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--fg)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                  <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6"/>
                </svg>
                Sign out
              </button>
            ) : (
              <div style={{
                padding: '10px 10px 8px',
                background: 'color-mix(in oklch, var(--status-err) 7%, var(--panel))',
                borderRadius: 7,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--status-err)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                    <path d="M8 1L15 14H1L8 1z"/><path d="M8 6v4M8 11.5v.5"/>
                  </svg>
                  <span style={{ fontSize: 12, color: 'var(--status-err)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
                    Sign out of QueryPal?
                  </span>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-body)', margin: '0 0 10px', lineHeight: 1.4 }}>
                  Any unsaved changes will be lost.
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => setShowSignOutConfirm(false)}
                    style={{
                      flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid var(--border)',
                      background: 'var(--panel)', color: 'var(--fg)', fontSize: 12,
                      fontFamily: 'var(--font-body)', cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={logout}
                    style={{
                      flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid var(--status-err)',
                      background: 'var(--status-err)', color: '#fff', fontSize: 12,
                      fontFamily: 'var(--font-body)', cursor: 'pointer', fontWeight: 600,
                    }}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenuButton;
