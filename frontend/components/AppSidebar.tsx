import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CollectionSummary, DbInfo, CosmosDBAccount } from '../types';
import { API_BASE_URL } from '../app.config';
import { getAuthenticatedToken, getAzureCosmosAccounts, listPostgresServers, PostgresServer } from '../services/dbService';

interface AppSidebarProps {
  accountName?: string;
  accountId?: string;
  databaseName?: string;
  collections?: CollectionSummary[];
  activeCollection?: string;
  onCollectionSelect?: (name: string, ev?: { ctrlKey?: boolean; metaKey?: boolean }) => void;
  activeCollections?: string[];
  collectionSeverity?: Record<string, 'critical' | 'warning' | 'info' | 'clean'>;
  collectionFindings?: Record<string, number>;
  availableDbs?: DbInfo[];
  onSwitchDatabase?: (db: DbInfo) => void;
  availableAccounts?: CosmosDBAccount[];
  onSwitchAccount?: (account: CosmosDBAccount) => void;
  chipLoading?: boolean;
  // PostgreSQL workspace: table tree + database switching live in the sidebar,
  // mirroring how Cosmos collections do.
  pgSchema?: { schema: string; tables: { name: string; rowEstimate: number }[] }[];
  activePgTables?: string[]; // ["schema.table", ...]
  onPgTableSelect?: (schema: string, table: string, ev?: { ctrlKey?: boolean; metaKey?: boolean }) => void;
  // True while the PG schema/tables (and thus the switched-to database) are
  // loading — drives the small spinners in the chip dropdown + tables panel.
  pgSchemaLoading?: boolean;
}

// Small spinner reused by the PG database/table loading indicators.
const MiniSpinner: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"
    style={{ animation: 'ws-spin 0.7s linear infinite', flexShrink: 0, color: 'var(--accent)' }}>
    <path d="M8 2a6 6 0 1 0 6 6" />
  </svg>
);

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
    label: 'Analytics',
    href: '/analytics',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M2 13h12M4 11V6M7 11V3M10 11V8M13 11V5"/>
      </svg>
    ),
  },
  {
    label: 'Audit',
    href: '/audit',
    icon: (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M4 2h6l3 3v9H4z"/><path d="M6 7.5h5M6 10.5h5"/>
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
  accountId,
  databaseName,
  collections,
  activeCollection,
  onCollectionSelect,
  activeCollections,
  collectionSeverity,
  collectionFindings,
  availableDbs,
  onSwitchDatabase,
  availableAccounts,
  onSwitchAccount,
  chipLoading,
  pgSchema,
  activePgTables,
  onPgTableSelect,
  pgSchemaLoading,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isPg = location.pathname.startsWith('/postgres');
  const [showDbPicker, setShowDbPicker] = useState(false);
  const [pgServers, setPgServers] = useState<PostgresServer[]>([]);
  const [cosmosAccounts, setCosmosAccounts] = useState<CosmosDBAccount[]>([]);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    getAuthenticatedToken()
      .then((token) => listPostgresServers(token))
      .then(setPgServers)
      .catch(() => { /* best-effort; absence just hides the PostgreSQL group */ });
    // Fetch Cosmos accounts too, so the account switcher is available from any
    // workspace (including PostgreSQL), not just Cosmos pages that pass them in.
    getAzureCosmosAccounts()
      .then(setCosmosAccounts)
      .catch(() => { /* best-effort; absence just hides the Cosmos group */ });
  }, []);
  const [collectionSort, setCollectionSort] = useState<'name_asc' | 'name_desc' | 'count_desc' | 'count_asc' | 'findings_desc' | 'findings_asc'>('name_asc');
  const chipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDbPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) {
        setShowDbPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDbPicker]);

  // Measure API latency by pinging /health every 30s
  useEffect(() => {
    const measure = async () => {
      try {
        const t0 = performance.now();
        await fetch(`${API_BASE_URL}/health`, { method: 'GET', cache: 'no-store' });
        setLatencyMs(Math.round(performance.now() - t0));
      } catch {
        setLatencyMs(null);
      }
    };
    measure();
    const id = setInterval(measure, 30_000);
    return () => clearInterval(id);
  }, []);

  const pgWorkspaceHref = isPg && accountId
    ? `/postgres/${encodeURIComponent(accountId)}${databaseName ? '/' + encodeURIComponent(databaseName) : ''}`
    : null;
  const explorerHref = !accountId || !databaseName
    ? null
    : isPg
      ? `/postgres-explorer/${encodeURIComponent(accountId)}/${encodeURIComponent(databaseName)}`
      : `/data-explorer/${encodeURIComponent(accountId)}/${encodeURIComponent(databaseName)}`;
  const pgAuditHref = isPg && accountId ? `/postgres-audit/${encodeURIComponent(accountId)}` : null;
  const isPgExplorer = location.pathname.startsWith('/postgres-explorer');
  const isPgAudit = location.pathname.startsWith('/postgres-audit');
  // Workspace paths are /postgres/:id[/db]; the -explorer/-audit variants don't
  // start with '/postgres/' so they're correctly excluded here.
  const isPgWorkspace = isPg && location.pathname.startsWith('/postgres/');

  // In a PG workspace the sidebar's own listPostgresServers fetch can lose the
  // race with the page's OBO calls (error swallowed above), so fall back to the
  // current server we already know — keeps the PostgreSQL group consistent with
  // the Cosmos workspace, which always shows it.
  const pgServerList = React.useMemo(() => {
    if (!isPg || !accountId || !accountName || pgServers.some((s) => s.id === accountId)) {
      return pgServers;
    }
    return [{ id: accountId, name: accountName, fqdn: '' }, ...pgServers];
  }, [isPg, accountId, accountName, pgServers]);

  // Cosmos accounts: the page passes them on Cosmos pages; otherwise fall back to
  // the sidebar's own fetch so the switcher is present in the PG workspace too.
  const accountList = availableAccounts && availableAccounts.length > 0 ? availableAccounts : cosmosAccounts;

  const showAccounts = accountList.length > 0;
  const showDbs = !!availableDbs && availableDbs.length > 1;
  const showPgServers = pgServerList.length > 0;

  const hasPicker = showAccounts || showDbs || showPgServers;

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

        {/* Connection chip — always rendered so the brand section never changes height */}
        <div ref={chipRef} style={{ position: 'relative', filter: chipLoading ? 'blur(3px)' : undefined, pointerEvents: chipLoading ? 'none' : undefined, transition: 'filter 0.18s ease' }}>
          {!accountName ? (
            /* Placeholder keeps the same height as the real chip */
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 9px', background: 'var(--soft)', borderRadius: 7 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ height: 11, borderRadius: 3, background: 'var(--border)', width: '65%', marginBottom: 4 }} />
                <div style={{ height: 9, borderRadius: 3, background: 'var(--border)', width: '45%' }} />
              </div>
            </div>
          ) : (
            <>
              <div
                onClick={() => hasPicker ? setShowDbPicker(v => !v) : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '5px 9px', background: 'var(--soft)', borderRadius: 7,
                  cursor: hasPicker ? 'pointer' : 'default',
                }}
              >
                <span style={{ width: 14, height: 14, borderRadius: 4, background: '#1d6cf2', flexShrink: 0 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {accountName}
                  </div>
                  {databaseName && (
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {databaseName}
                    </div>
                  )}
                </div>
                {hasPicker && (
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                    <path d="M4 6l4 4 4-4"/>
                  </svg>
                )}
              </div>

              {showDbPicker && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                  background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden',
                }}>
                  {showAccounts && (
                    <>
                      <div style={{ padding: '6px 10px 4px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 500 }}>
                        Cosmos account
                      </div>
                      {accountList.map(acc => {
                        const isCurrent = acc.id === accountId;
                        return (
                          <button
                            key={acc.id}
                            onClick={() => {
                              if (isCurrent) return;
                              setShowDbPicker(false);
                              if (onSwitchAccount) onSwitchAccount(acc);
                              else navigate('/query-generator', { state: { preselectedAccountId: acc.id, preselectedAccountName: acc.name } });
                            }}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                              padding: '7px 10px', border: 'none', textAlign: 'left',
                              cursor: isCurrent ? 'default' : 'pointer',
                              background: isCurrent ? 'var(--accent-soft)' : 'transparent',
                              color: isCurrent ? 'var(--accent)' : 'var(--fg)',
                              fontSize: 12.5, fontFamily: 'var(--font-body)',
                            }}
                            onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                            onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: isCurrent ? '#1d6cf2' : 'var(--muted)', flexShrink: 0 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</span>
                            {isCurrent && (
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}>
                                <path d="M3 8l4 4 6-6"/>
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}
                  {showPgServers && (
                    <>
                      {showAccounts && (
                        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                      )}
                      <div style={{ padding: '6px 10px 4px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 500 }}>
                        PostgreSQL
                      </div>
                      {pgServerList.map(srv => {
                        const isCurrent = srv.id === accountId;
                        return (
                          <button
                            key={srv.id}
                            onClick={() => {
                              setShowDbPicker(false);
                              if (isCurrent) return;
                              // Switching server keeps you in the current section
                              // (audit / explorer), not always the workspace.
                              const base = (isPgAudit || location.pathname === '/audit')
                                ? '/postgres-audit'
                                : isPgExplorer ? '/postgres-explorer' : '/postgres';
                              navigate(`${base}/${encodeURIComponent(srv.id)}`);
                            }}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                              padding: '7px 10px', border: 'none', textAlign: 'left',
                              cursor: isCurrent ? 'default' : 'pointer',
                              background: isCurrent ? 'var(--accent-soft)' : 'transparent',
                              color: isCurrent ? 'var(--accent)' : 'var(--fg)',
                              fontSize: 12.5, fontFamily: 'var(--font-body)',
                            }}
                            onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                            onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <span style={{ width: 10, height: 10, borderRadius: 3, background: isCurrent ? '#1d6cf2' : 'var(--muted)', flexShrink: 0 }} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{srv.name}</span>
                            {isCurrent && (
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}>
                                <path d="M3 8l4 4 6-6"/>
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </>
                  )}
                  {showDbs && (
                    <>
                      {(showAccounts || showPgServers) && (
                        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                      )}
                      <div style={{ padding: '6px 10px 4px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 500 }}>
                        Database
                      </div>
                      {availableDbs.map(db => {
                        const isCurrent = db.name === databaseName;
                        return (
                          <button
                            key={db.name}
                            onClick={() => {
                              if (isCurrent) return;
                              // Keep the picker open during a PG switch so its
                              // spinner is visible; Cosmos (no loading flag) closes.
                              if (pgSchemaLoading === undefined) setShowDbPicker(false);
                              onSwitchDatabase?.(db);
                            }}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                              padding: '7px 10px', border: 'none', cursor: 'pointer', textAlign: 'left',
                              background: isCurrent ? 'var(--accent-soft)' : 'transparent',
                              color: isCurrent ? 'var(--accent)' : 'var(--fg)',
                              fontSize: 12.5, fontFamily: 'var(--font-mono)',
                            }}
                            onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                            onMouseLeave={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" style={{ color: isCurrent ? 'var(--accent)' : 'var(--muted)', flexShrink: 0 }}>
                              <ellipse cx="8" cy="4" rx="6" ry="2"/><path d="M2 4v8c0 1.1 2.7 2 6 2s6-.9 6-2V4M2 8c0 1.1 2.7 2 6 2s6-.9 6-2"/>
                            </svg>
                            {db.name}
                            {isCurrent && pgSchemaLoading ? (
                              <span style={{ marginLeft: 'auto', display: 'flex' }}><MiniSpinner /></span>
                            ) : isCurrent ? (
                              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', color: 'var(--accent)', flexShrink: 0 }}>
                                <path d="M3 8l4 4 6-6"/>
                              </svg>
                            ) : null}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Navigation */}

      <div style={{ padding: '8px 8px 0', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <div style={{
          fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
          color: 'var(--muted)', padding: '0 8px 6px', fontWeight: 500,
        }}>Workspace</div>

        {NAV_ITEMS.map((item) => {
          let resolvedHref = item.href;
          if (item.label === 'Explorer') resolvedHref = explorerHref ?? item.href;
          else if (isPg && item.label === 'Workspace') resolvedHref = pgWorkspaceHref ?? item.href;
          else if (isPg && item.label === 'Audit') resolvedHref = pgAuditHref ?? item.href;
          const active = isPg && item.label === 'Workspace'
            ? isPgWorkspace
            : isPg && item.label === 'Explorer'
              ? isPgExplorer
              : isPg && item.label === 'Audit'
                ? isPgAudit
                : (resolvedHref ? isActive(resolvedHref, item.matchPrefix) : false);
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

          // PostgreSQL has no Analytics page.
          if (isPg && item.label === 'Analytics') {
            return (
              <span
                key={item.label}
                style={{ ...style, opacity: 0.4, cursor: 'not-allowed' }}
                title="Not available for PostgreSQL"
              >
                {iconSpan}
                {item.label}
              </span>
            );
          }

          if (item.label === 'Explorer' && !explorerHref) {
            return (
              <span
                key={item.label}
                style={{ ...style, opacity: 0.4, cursor: 'not-allowed' }}
                title="Connect to a database first"
              >
                {iconSpan}
                {item.label}
              </span>
            );
          }

          if (item.label === 'Analytics' && !databaseName) {
            return (
              <span
                key={item.label}
                style={{ ...style, opacity: 0.4, cursor: 'not-allowed' }}
                title="Loading database…"
              >
                {iconSpan}
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={resolvedHref}
              to={resolvedHref!}
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

      {collections && collections.length > 0 && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginTop: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 8px 6px 8px',
            fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--muted)',
          }}>
            <span>Collections <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{collections.length}</span></span>
            <select
              value={collectionSort}
              onChange={(e) => setCollectionSort(e.target.value as typeof collectionSort)}
              title="Sort collections"
              style={{
                fontSize: 10, fontFamily: 'var(--font-body)', color: 'var(--muted)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '1px 2px', borderRadius: 4, outline: 'none',
                appearance: 'none', WebkitAppearance: 'none',
              }}
            >
              <option value="name_asc">A → Z</option>
              <option value="name_desc">Z → A</option>
              <option value="count_desc">Most docs</option>
              <option value="count_asc">Fewest docs</option>
              {collectionFindings && (
                <>
                  <option value="findings_desc">Most findings</option>
                  <option value="findings_asc">Fewest findings</option>
                </>
              )}
            </select>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {([...collections].sort((a, b) => {
              if (collectionSort === 'name_asc') return a.name.localeCompare(b.name);
              if (collectionSort === 'name_desc') return b.name.localeCompare(a.name);
              if (collectionSort === 'count_desc') return b.count - a.count;
              if (collectionSort === 'count_asc') return a.count - b.count;
              const af = collectionFindings?.[a.name] ?? -1;
              const bf = collectionFindings?.[b.name] ?? -1;
              if (collectionSort === 'findings_desc') return bf - af || a.name.localeCompare(b.name);
              return af - bf || a.name.localeCompare(b.name);
            })).map((col) => {
              const active = activeCollection === col.name || (activeCollections?.includes(col.name) ?? false);
              const status = collectionSeverity?.[col.name];
              const railColor =
                status === 'critical' ? '#c94250'
                : status === 'warning' ? '#c98d42'
                : status === 'info' ? '#6a85a8'
                : status === 'clean' ? '#5a9a78'
                : null;
              const restBg = status === 'critical' ? '#fdf0f1' : 'transparent';
              const hoverBg = status === 'critical' ? '#fbe5e8' : 'var(--soft)';
              const statusLabel =
                status === 'critical' ? 'Critical findings'
                : status === 'warning' ? 'Warning findings'
                : status === 'info' ? 'Info findings'
                : status === 'clean' ? 'Audited — no findings'
                : undefined;
              return (
                <button
                  key={col.name}
                  onClick={(e) => onCollectionSelect?.(col.name, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })}
                  title={statusLabel}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center',
                    padding: '5px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
                    background: active ? 'var(--accent-soft)' : restBg,
                    color: active ? 'var(--fg)' : 'var(--muted)',
                    fontSize: 12.5, fontFamily: 'var(--font-body)', marginBottom: 1,
                    textAlign: 'left', transition: 'background 0.1s',
                    boxShadow: railColor ? `inset 2px 0 0 ${railColor}` : 'none',
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = hoverBg; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = restBg; }}
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

      {((pgSchema && pgSchema.length > 0) || pgSchemaLoading) && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginTop: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 8px 6px 8px',
            fontSize: 10.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--muted)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Tables {pgSchemaLoading
              ? <MiniSpinner size={10} />
              : <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>{(pgSchema ?? []).reduce((n, g) => n + g.tables.length, 0)}</span>}
            </span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
            {pgSchemaLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px', fontSize: 12, color: 'var(--muted)' }}>
                <MiniSpinner /> Loading tables…
              </div>
            ) : (pgSchema ?? []).map((g) => (
              <div key={g.schema} style={{ marginBottom: 8 }}>
                {(pgSchema?.length ?? 0) > 1 && (
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 500, padding: '2px 6px', fontFamily: 'var(--font-mono)' }}>{g.schema}</div>
                )}
                {g.tables.map((t) => {
                  const active = activePgTables?.includes(`${g.schema}.${t.name}`) ?? false;
                  return (
                    <button
                      key={t.name}
                      title="Click to open · ⌘/Ctrl-click to add for a cross-table query"
                      onClick={(e) => onPgTableSelect?.(g.schema, t.name, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })}
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
                        <rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.5h12M6 6.5V13"/>
                      </svg>
                      <span style={{
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                        fontFamily: 'var(--font-mono)', fontSize: 11.5,
                      }}>{t.name}</span>
                      <span style={{
                        fontSize: 10, color: 'var(--muted)', flexShrink: 0, marginLeft: 4,
                        fontFamily: 'var(--font-mono)',
                      }}>{t.rowEstimate.toLocaleString()}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health / bottom */}
      <div style={{
        marginTop: 'auto', padding: '8px 10px',
        borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {latencyMs == null ? (
          <span className="qa-dot" style={{ background: 'var(--muted)', opacity: 0.4 }} />
        ) : latencyMs < 150 ? (
          <span className="qa-dot ok" />
        ) : latencyMs < 500 ? (
          <span className="qa-dot" style={{ background: 'var(--status-warn, #d97706)' }} />
        ) : (
          <span className="qa-dot" style={{ background: 'var(--status-err)' }} />
        )}
        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
          {latencyMs == null ? 'Connecting…' : latencyMs < 150 ? `${latencyMs}ms · healthy` : latencyMs < 500 ? `${latencyMs}ms · slow` : `${latencyMs}ms · degraded`}
        </span>
      </div>
    </aside>
  );
};

export default AppSidebar;
