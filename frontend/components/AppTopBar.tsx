import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useNotifications, AppNotification } from '../contexts/NotificationsContext';
import UserMenuButton from './UserMenuButton';

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
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const notifsRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, activeRuns, runProgress, markAllRead, dismiss, clearAll } = useNotifications();

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
    if (n.kind === 'argus_done' || n.kind === 'argus_error') {
      navigate('/analytics', n.reportId ? { state: { reportId: n.reportId } } : undefined);
    }
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
            activeRuns.length > 0
              ? `Notifications (${activeRuns.length} running)`
              : 'Notifications'
          }
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8 1.5A3.5 3.5 0 0111.5 5v3.5l1 1.5H3.5l1-1.5V5A3.5 3.5 0 018 1.5z"/>
            <path d="M6.5 13a1.5 1.5 0 003 0"/>
          </svg>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: 1, right: 1,
              minWidth: 14, height: 14, borderRadius: 7,
              background: 'var(--status-err)', color: '#fff',
              fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-body)',
              display: 'grid', placeItems: 'center', padding: '0 3px',
              border: '1px solid var(--bg)', lineHeight: 1,
            }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
          {unreadCount === 0 && activeRuns.length > 0 && (
            <span style={{
              position: 'absolute', top: 4, right: 4,
              width: 6, height: 6, borderRadius: 3,
              background: 'var(--accent)',
              border: '1px solid var(--bg)',
            }} />
          )}
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
              {activeRuns.length > 0 && (
                <div style={{
                  padding: '8px 12px', borderBottom: '1px solid var(--border)',
                  background: 'var(--soft)',
                }}>
                  <div style={{
                    fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'var(--muted)', marginBottom: 4, fontFamily: 'var(--font-body)',
                  }}>In progress</div>
                  {activeRuns.map((r) => {
                    const prog = runProgress[r.jobId];
                    const agg = prog?.aggregates;
                    const tokens = (agg?.input_tokens ?? 0) + (agg?.output_tokens ?? 0);
                    const detail = agg
                      ? [
                          agg.current_iter ? `iter ${agg.current_iter}` : null,
                          agg.findings_count ? `${agg.findings_count} finding${agg.findings_count === 1 ? '' : 's'}` : null,
                          tokens ? `${tokens.toLocaleString()} tok` : null,
                          agg.last_tool ? `→ ${agg.last_tool}` : (agg.last_action ? `→ ${agg.last_action}` : null),
                        ].filter(Boolean).join(' · ')
                      : '';
                    return (
                      <div key={r.jobId} style={{ padding: '4px 0' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
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
                        {detail && (
                          <div style={{
                            marginLeft: 19, marginTop: 2,
                            fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {detail}
                            {agg && agg.tool_errors && agg.tool_errors > 0 ? (
                              <span style={{ marginLeft: 6, color: 'var(--status-err)' }}>
                                · {agg.tool_errors} tool error{agg.tool_errors === 1 ? '' : 's'}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
      <UserMenuButton />
    </header>
  );
};

export default AppTopBar;
