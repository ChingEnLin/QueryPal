import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications, AppNotification } from '../contexts/NotificationsContext';
import { EscalationReviewModal } from './EscalationReviewModal';

interface AppTopBarProps {
  accountName?: string;
  databaseName?: string;
  collectionName?: string;
  onNewQuery?: () => void;
  onOpenPalette?: () => void;
}

const AppTopBar: React.FC<AppTopBarProps> = ({
  accountName,
  databaseName,
  collectionName,
  onNewQuery,
  onOpenPalette,
}) => {
  const { user, logout } = useUnifiedAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [escalationsOpen, setEscalationsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifsRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, activeRuns, pendingEscalations, markAllRead, dismiss, clearAll } = useNotifications();

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

  useEffect(() => {
    if (!showNotifs) return;
    const handleClick = (e: MouseEvent) => {
      if (notifsRef.current && !notifsRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifs]);

  const handleNotifClick = (n: AppNotification) => {
    setShowNotifs(false);
    if (n.kind === 'argus_done' || n.kind === 'argus_error') navigate('/analytics');
  };

  const openNotifs = () => {
    setShowNotifs((v) => {
      const next = !v;
      if (next && unreadCount > 0) markAllRead();
      return next;
    });
  };

  const formatRelative = (ts: number): string => {
    const diff = Math.max(0, Date.now() - ts);
    const s = Math.floor(diff / 1000);
    if (s < 45) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  const handleAvatarClick = () => {
    setShowUserMenu(v => !v);
    setShowSignOutConfirm(false);
  };

  const handleSignOutClick = () => {
    setShowSignOutConfirm(true);
  };

  const handleSignOutConfirm = () => {
    logout();
  };

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

      {/* ⌘K command palette trigger */}
      <button
        onClick={onOpenPalette}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', border: '1px solid var(--border)', borderRadius: 7,
          background: 'var(--soft)', color: 'var(--muted)', fontSize: 12,
          cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}
        title="Command palette (⌘K)"
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

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title="Toggle theme"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', display: 'flex', padding: 5, borderRadius: 6,
        }}
      >
        {theme === 'light' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        )}
      </button>

      {/* Notifications */}
      <div ref={notifsRef} style={{ position: 'relative' }}>
        <button
          onClick={openNotifs}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', display: 'flex', padding: 5, borderRadius: 6,
            position: 'relative',
          }}
          title={
            pendingEscalations.length > 0
              ? `${pendingEscalations.length} Argus escalation${pendingEscalations.length === 1 ? '' : 's'} awaiting review`
              : activeRuns.length > 0
                ? `Notifications (${activeRuns.length} running)`
                : 'Notifications'
          }
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1.5A3.5 3.5 0 0111.5 5v3.5l1 1.5H3.5l1-1.5V5A3.5 3.5 0 018 1.5z"/>
            <path d="M6.5 13a1.5 1.5 0 003 0"/>
          </svg>
          {(() => {
            const badge = unreadCount + pendingEscalations.length;
            if (badge > 0) {
              return (
                <span style={{
                  position: 'absolute', top: 1, right: 1,
                  minWidth: 14, height: 14, borderRadius: 7,
                  background: pendingEscalations.length > 0 ? 'var(--accent)' : 'var(--status-err)',
                  color: '#fff',
                  fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-body)',
                  display: 'grid', placeItems: 'center', padding: '0 3px',
                  border: '1px solid var(--bg)', lineHeight: 1,
                }}>{badge > 9 ? '9+' : badge}</span>
              );
            }
            if (activeRuns.length > 0) {
              return (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 6, height: 6, borderRadius: 3,
                  background: 'var(--accent)',
                  border: '1px solid var(--bg)',
                }} />
              );
            }
            return null;
          })()}
        </button>

        {showNotifs && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 200,
            background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 320, maxHeight: 420,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              padding: '10px 12px 8px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
                Notifications
              </span>
              <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
                {activeRuns.length > 0 ? `${activeRuns.length} running` : ''}
              </span>
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  style={{
                    marginLeft: 'auto', background: 'none', border: 'none',
                    color: 'var(--muted)', fontSize: 11, cursor: 'pointer',
                    fontFamily: 'var(--font-body)', padding: 0,
                  }}
                  title="Clear all"
                >Clear all</button>
              )}
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {pendingEscalations.length > 0 && (
                <div style={{
                  padding: '8px 12px', borderBottom: '1px solid var(--border)',
                  background: 'color-mix(in oklch, var(--accent) 8%, var(--panel))',
                }}>
                  <div style={{
                    fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'var(--muted)', marginBottom: 4, fontFamily: 'var(--font-body)',
                  }}>Needs your review</div>
                  <div style={{
                    fontSize: 12, color: 'var(--fg)', fontFamily: 'var(--font-body)',
                    marginBottom: 6,
                  }}>
                    Argus parked{' '}
                    <strong>{pendingEscalations.length}</strong>{' '}
                    finding{pendingEscalations.length === 1 ? '' : 's'} at mid-confidence.
                  </div>
                  <button
                    onClick={() => { setShowNotifs(false); setEscalationsOpen(true); }}
                    className="qa-btn primary"
                    style={{ fontSize: 11.5, padding: '4px 10px' }}
                  >
                    Review now
                  </button>
                </div>
              )}
              {activeRuns.length > 0 && (
                <div style={{
                  padding: '8px 12px', borderBottom: '1px solid var(--border)',
                  background: 'var(--soft)',
                }}>
                  <div style={{
                    fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'var(--muted)', marginBottom: 4, fontFamily: 'var(--font-body)',
                  }}>In progress</div>
                  {activeRuns.map((r) => (
                    <div key={r.jobId} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                      fontSize: 12, color: 'var(--fg)', fontFamily: 'var(--font-body)',
                    }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none"
                           stroke="var(--accent)" strokeWidth="1.5"
                           style={{ animation: 'qp-spin 0.8s linear infinite', flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                        <path d="M8 2a6 6 0 0 1 6 6" />
                      </svg>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11.5,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{r.collection}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--muted)' }}>
                        {formatRelative(r.startedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {notifications.length === 0 && activeRuns.length === 0 && (
                <div style={{
                  padding: '24px 12px', textAlign: 'center', color: 'var(--muted)',
                  fontSize: 12, fontFamily: 'var(--font-body)',
                }}>No notifications yet.</div>
              )}

              {notifications.map((n) => {
                const isErr = n.kind === 'argus_error';
                return (
                  <div key={n.id}
                    onClick={() => handleNotifClick(n)}
                    style={{
                      padding: '10px 12px', borderBottom: '1px solid var(--border)',
                      cursor: 'pointer', display: 'flex', gap: 9, alignItems: 'flex-start',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <span style={{
                      width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0,
                      background: isErr ? 'var(--status-err)' : 'var(--status-ok)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12.5, color: 'var(--fg)', fontWeight: 500,
                        fontFamily: 'var(--font-body)', marginBottom: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{n.title}</div>
                      <div style={{
                        fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-body)',
                        lineHeight: 1.35,
                      }}>{n.body}</div>
                      <div style={{
                        fontSize: 10.5, color: 'var(--muted)', marginTop: 3,
                        fontFamily: 'var(--font-body)',
                      }}>{formatRelative(n.createdAt)}</div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                      title="Dismiss"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--muted)', padding: 2, borderRadius: 4, flexShrink: 0,
                      }}
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 3l10 10M13 3L3 13"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* User avatar + dropdown */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={handleAvatarClick}
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
                <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
                  {user.email}
                </div>
              )}
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

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--border)', margin: '0 6px' }} />

            {/* Sign out */}
            <div style={{ padding: '6px 6px' }}>
              {!showSignOutConfirm ? (
                <button
                  onClick={handleSignOutClick}
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
                      onClick={handleSignOutConfirm}
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
      <EscalationReviewModal
        open={escalationsOpen}
        onClose={() => setEscalationsOpen(false)}
      />
    </header>
  );
};

export default AppTopBar;
