import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
import { useTheme } from '../contexts/ThemeContext';
import { getAzureCosmosAccounts, getDatabasesForAccount } from '../services/dbService';
import { CosmosDBAccount } from '../types';
import { API_BASE_URL } from '../app.config';

interface RecentActivityItem {
  database_name: string;
  collection_name: string;
  operation: string;
  document_id: string;
  user_email: string;
  timestamp_utc: string;
}

/* ── tiny inline styles matching Direction A design tokens ── */
const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    fontFamily: 'var(--font-body)',
    color: 'var(--fg)',
  } as React.CSSProperties,

  topbar: {
    height: 54,
    padding: '0 28px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    borderBottom: '1px solid var(--border)',
    background: 'var(--panel)',
  } as React.CSSProperties,

  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    textDecoration: 'none',
    color: 'var(--fg)',
  } as React.CSSProperties,

  brandMark: {
    width: 24,
    height: 24,
    borderRadius: 7,
    background: 'var(--fg)',
    color: 'var(--bg)',
    display: 'grid',
    placeItems: 'center',
    fontFamily: 'var(--font-display)',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: '-0.04em',
    flexShrink: 0,
  } as React.CSSProperties,

  body: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '52px 64px 80px',
    display: 'flex',
    flexDirection: 'column',
    gap: 48,
  } as React.CSSProperties,
};

/* ── DB engine cards (static config) ── */
const DB_ENGINES = [
  {
    key: 'cosmos',
    mark: 'C',
    markBg: '#1a4f8c',
    label: 'Azure Cosmos DB',
    sub: 'MongoDB API',
    badge: 'Generally available',
    badgeOk: true,
    locked: false,
  },
  {
    key: 'pg',
    mark: 'P',
    markBg: '#326690',
    label: 'PostgreSQL',
    sub: 'Azure Flexible Server',
    badge: 'Unavailable',
    badgeOk: false,
    locked: true,
    opacity: 0.4,
  },
  {
    key: 'snow',
    mark: 'S',
    markBg: '#5da4d6',
    label: 'Snowflake',
    sub: 'Data Cloud',
    badge: 'Unavailable',
    badgeOk: false,
    locked: true,
    opacity: 0.4,
  },
  {
    key: 'bq',
    mark: 'B',
    markBg: '#3f6acb',
    label: 'BigQuery',
    sub: 'Google Cloud',
    badge: 'Unavailable',
    badgeOk: false,
    locked: true,
    opacity: 0.4,
  },
  {
    key: 'ch',
    mark: 'Ch',
    markBg: '#d4a52a',
    label: 'ClickHouse',
    sub: 'Open source OLAP',
    badge: 'Unavailable',
    badgeOk: false,
    locked: true,
    opacity: 0.4,
  },
];

/* ──────────────────────────────────────────────────────────── */

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

const HubPage: React.FC = () => {
  const { user, logout, getToken } = useUnifiedAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<CosmosDBAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);

  useEffect(() => {
    getAzureCosmosAccounts()
      .then((accs) => { setAccounts(accs); })
      .catch((err) => { setError(err.message || 'Failed to load accounts'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE_URL}/audit/recent?limit=8`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRecentActivity(data);
        }
      } catch {
        // silently ignore — recent activity is non-critical
      }
    };
    fetchRecent();
  }, []);

  const firstName = user?.name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'open' | 'explorer' | null>(null);

  const handleOpenAccount = (account: CosmosDBAccount) => {
    if (busyAccountId) return;
    setBusyAccountId(account.id);
    setBusyAction('open');
    navigate('/query-generator', { state: { preselectedAccountId: account.id, preselectedAccountName: account.name } });
  };

  const handleOpenExplorer = async (account: CosmosDBAccount) => {
    if (busyAccountId) return;
    setBusyAccountId(account.id);
    setBusyAction('explorer');
    try {
      const databases = await getDatabasesForAccount(account.id);
      if (databases.length === 0) {
        setBusyAccountId(null);
        setBusyAction(null);
        return;
      }
      const firstDb = databases[0];
      navigate(`/data-explorer/${encodeURIComponent(account.id)}/${encodeURIComponent(firstDb.name)}`);
    } catch (e) {
      console.error('Failed to open explorer:', e);
      setBusyAccountId(null);
      setBusyAction(null);
    }
  };

  return (
    <div style={s.page}>
      {/* Top bar */}
      <header style={s.topbar}>
        <Link to="/hub" style={s.brand}>
          <span style={s.brandMark}>Q</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 14.5 }}>QueryPal</span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 8 }}>
          {[
            { label: 'Home', href: '/hub', active: true },
            { label: 'Analytics', href: '/analytics', active: false },
          ].map((item) => (
            <Link
              key={item.href}
              to={item.href}
              style={{
                fontSize: 12.5,
                color: item.active ? 'var(--fg)' : 'var(--muted)',
                textDecoration: 'none',
                padding: '6px 9px',
                borderRadius: 6,
                fontWeight: item.active ? 500 : 400,
                background: item.active ? 'var(--soft)' : 'transparent',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Theme toggle — shows icon for what you'll switch TO */}
          <button
            onClick={toggleTheme}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 5, borderRadius: 6 }}
            title="Toggle theme"
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
          {/* User avatar */}
          <div
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--accent-soft)', color: 'var(--accent)',
              display: 'grid', placeItems: 'center',
              fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-body)',
            }}
            title={user?.name || user?.email}
          >
            {initials}
          </div>
          <button
            onClick={logout}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, fontFamily: 'var(--font-body)' }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={s.body}>
        {/* Greeting */}
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 36,
            lineHeight: 1.05, letterSpacing: '-0.025em', margin: 0,
          }}>
            {greeting},{' '}
            <em style={{ fontStyle: 'italic', color: 'var(--accent)', fontWeight: 500 }}>{firstName}</em>
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.5 }}>
            Pick a connection to start querying.
          </p>
        </div>

        {/* Connections */}
        <section>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', margin: 0 }}>
              Your connections
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {loading && (
              <div style={{
                background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14,
                padding: 22, gridColumn: '1 / -1', color: 'var(--muted)', fontSize: 13,
              }}>
                Loading connections…
              </div>
            )}
            {error && (
              <div style={{
                background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14,
                padding: 22, gridColumn: '1 / -1', color: 'var(--status-err)', fontSize: 13,
              }}>
                {error}
              </div>
            )}
            {!loading && !error && accounts.length === 0 && (
              <div style={{
                background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14,
                padding: 22, color: 'var(--muted)', fontSize: 13,
              }}>
                No Cosmos DB accounts found. Add a connection below.
              </div>
            )}
            {accounts.map((account) => (
              <ConnectionCard
                key={account.id}
                account={account}
                onOpen={handleOpenAccount}
                onOpenExplorer={handleOpenExplorer}
                busyAction={busyAccountId === account.id ? busyAction : null}
                disabled={!!busyAccountId && busyAccountId !== account.id}
              />
            ))}
          </div>
        </section>

        {/* Available databases */}
        <section>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', margin: 0 }}>
              Available databases
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {DB_ENGINES.map((engine) => (
              <DbEngineCard key={engine.key} engine={engine} />
            ))}
          </div>
        </section>

        {/* Recent activity */}
        <section>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', margin: 0 }}>
              Recent activity
            </h2>
            <Link to="/audit" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>
              View all →
            </Link>
          </div>

          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {/* Header row */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1.6fr 1.4fr 0.7fr 0.8fr 0.7fr',
              gap: 14, padding: '8px 16px',
              fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.07em',
              borderBottom: '1px solid var(--border)',
            }}>
              {['Database · Collection', 'Document', 'Op', 'User', 'When'].map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
            {recentActivity.length === 0 && (
              <div style={{ padding: '20px 16px', fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>
                No recent activity found.
              </div>
            )}
            {recentActivity.map((row, i) => (
              <div
                key={i}
                style={{
                  display: 'grid', gridTemplateColumns: '1.6fr 1.4fr 0.7fr 0.8fr 0.7fr',
                  gap: 14, padding: '11px 16px', alignItems: 'center',
                  fontSize: 12.5, borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s', cursor: 'default',
                }}
                onMouseEnter={(e) => (e.currentTarget as HTMLDivElement).style.background = 'var(--soft)'}
                onMouseLeave={(e) => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
              >
                <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.database_name} · {row.collection_name}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg)' }}>
                  {row.document_id}
                </span>
                <span>
                  <span className={`qa-chip${row.operation === 'insert' ? ' ok' : row.operation === 'delete' ? ' err' : ''}`} style={{ fontSize: 10 }}>
                    {row.operation}
                  </span>
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.user_email}</span>
                <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>{formatRelativeTime(row.timestamp_utc)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

/* ── Inline spinner ── */
const Spinner: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6" opacity="0.3" />
    <path d="M14 8a6 6 0 0 0-6-6">
      <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.9s" repeatCount="indefinite" />
    </path>
  </svg>
);

/* ── Connection card ── */
const ConnectionCard: React.FC<{
  account: CosmosDBAccount;
  onOpen: (a: CosmosDBAccount) => void;
  onOpenExplorer: (a: CosmosDBAccount) => void;
  busyAction: 'open' | 'explorer' | null;
  disabled: boolean;
}> = ({ account, onOpen, onOpenExplorer, busyAction, disabled }) => {
  const [hovered, setHovered] = useState(false);
  const [explorerHovered, setExplorerHovered] = useState(false);
  const isOpenBusy = busyAction === 'open';
  const isExplorerBusy = busyAction === 'explorer';
  const anyBusy = !!busyAction;
  const inert = disabled || anyBusy;
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--panel)',
        border: `1px solid ${hovered && !disabled ? 'color-mix(in oklch, var(--accent) 35%, var(--border))' : 'var(--border)'}`,
        borderRadius: 14, padding: 22,
        display: 'flex', flexDirection: 'column', gap: 14,
        transform: hovered && !disabled ? 'translateY(-1px)' : 'none',
        boxShadow: hovered && !disabled ? '0 12px 24px -16px rgba(20,18,14,0.18)' : 'none',
        transition: 'transform 0.12s, border-color 0.12s, box-shadow 0.12s, opacity 0.12s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 9, background: '#1a4f8c', color: '#fff',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, letterSpacing: '-0.03em',
          flexShrink: 0,
        }}>C</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {account.name}
          </div>
          <div style={{
            fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2,
          }}>
            {account.id}
          </div>
        </div>
      </div>

      <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="qa-chip ok">● live</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => onOpenExplorer(account)}
            onMouseEnter={() => setExplorerHovered(true)}
            onMouseLeave={() => setExplorerHovered(false)}
            disabled={inert}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, padding: '5px 10px', borderRadius: 6,
              border: `1px solid ${isExplorerBusy ? 'var(--accent)' : explorerHovered && !inert ? 'var(--accent)' : 'var(--border)'}`,
              background: isExplorerBusy ? 'var(--accent-soft)' : explorerHovered && !inert ? 'var(--accent-soft)' : 'var(--soft)',
              color: isExplorerBusy ? 'var(--accent)' : explorerHovered && !inert ? 'var(--accent)' : 'var(--muted)',
              cursor: inert ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
              transition: 'border-color 0.12s, background 0.12s, color 0.12s',
              opacity: inert && !isExplorerBusy ? 0.6 : 1,
            }}
          >
            {isExplorerBusy ? (
              <>
                <Spinner />
                Loading…
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3h12v3H2zM2 7h12v3H2zM2 11h12v3H2z"/>
                </svg>
                Explorer
              </>
            )}
          </button>
          <button
            onClick={() => onOpen(account)}
            disabled={inert}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12.5, padding: '5px 10px', borderRadius: 6,
              border: 'none', background: 'none',
              color: 'var(--accent)',
              cursor: inert ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)',
              opacity: inert && !isOpenBusy ? 0.6 : 1,
            }}
          >
            {isOpenBusy ? (
              <>
                <Spinner />
                Loading…
              </>
            ) : (
              <>
                Open
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="M3 8h10M9 4l4 4-4 4"/>
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── DB engine card ── */
const DbEngineCard: React.FC<{ engine: typeof DB_ENGINES[0] }> = ({ engine }) => {
  return (
    <div
      style={{
        background: engine.locked ? 'var(--soft)' : 'var(--panel)',
        border: '1px solid var(--border)', borderRadius: 12,
        padding: 18, display: 'flex', flexDirection: 'column', gap: 10,
        minHeight: 160, opacity: engine.opacity ?? 1,
        cursor: engine.locked ? 'default' : 'pointer',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 8,
        background: engine.markBg, color: '#fff',
        display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600,
      }}>
        {engine.mark}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{engine.label}</div>
        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{engine.sub}</div>
      </div>
      <div style={{ marginTop: 'auto' }}>
        <span
          className={`qa-chip${engine.badgeOk ? ' ok' : ''}`}
          style={!engine.badgeOk ? { fontSize: 10.5 } : { fontSize: 10.5 }}
        >
          {engine.badge}
        </span>
      </div>
    </div>
  );
};

export default HubPage;
