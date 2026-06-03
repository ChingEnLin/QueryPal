import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
import { useRoles } from '../hooks/useRoles';
import { CollectionSummary, DbInfo, CosmosDBAccount } from '../types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  accountId?: string;
  databaseName?: string;
  collections?: CollectionSummary[];
  availableDbs?: DbInfo[];
  availableAccounts?: CosmosDBAccount[];
  onSwitchDatabase?: (db: DbInfo) => void;
  onSwitchAccount?: (account: CosmosDBAccount) => void;
  onCollectionSelect?: (name: string) => void;
  onNewQuery?: () => void;
}

interface Command {
  id: string;
  label: string;
  description?: string;
  group: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string;
  shortcut?: string[];
}

const NavIcon = ({ d }: { d: string }) => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
    <path d={d} />
  </svg>
);

const Kbd: React.FC<{ keys: string[] }> = ({ keys }) => (
  <span style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
    {keys.map((k, i) => (
      <kbd key={i} style={{
        display: 'inline-block',
        padding: '1px 5px', borderRadius: 4,
        background: 'var(--soft)', border: '1px solid var(--border)',
        fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--muted)',
        lineHeight: 1.6,
      }}>{k}</kbd>
    ))}
  </span>
);

const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  accountId,
  databaseName,
  collections,
  availableDbs,
  availableAccounts,
  onSwitchDatabase,
  onSwitchAccount,
  onCollectionSelect,
  onNewQuery,
}) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { logout } = useUnifiedAuth();
  const { can } = useRoles();
  const canAudit = can('audit:read');

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const explorerHref = accountId && databaseName
    ? `/data-explorer/${encodeURIComponent(accountId)}/${encodeURIComponent(databaseName)}`
    : null;

  const run = useCallback((action: () => void) => {
    onClose();
    action();
  }, [onClose]);

  const commands = useMemo<Command[]>(() => {
    const cmds: Command[] = [];

    // Navigation
    cmds.push({
      id: 'nav-workspace',
      label: 'Workspace',
      description: 'Query generator & AI assistant',
      group: 'Navigate',
      keywords: 'query generator ai',
      shortcut: ['⌘', '⇧', '1'],
      icon: <NavIcon d="M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z" />,
      action: () => navigate('/query-generator'),
    });

    cmds.push({
      id: 'nav-explorer',
      label: 'Explorer',
      description: explorerHref ? `Browse ${databaseName}` : 'Connect to a database first',
      group: 'Navigate',
      keywords: 'data browse documents',
      shortcut: ['⌘', '⇧', '2'],
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M2 3h12v3H2zM2 7h12v3H2zM2 11h12v3H2z" />
        </svg>
      ),
      action: () => { if (explorerHref) navigate(explorerHref); },
    });

    cmds.push({
      id: 'nav-analytics',
      label: 'Analytics',
      description: 'Database audit & insights',
      group: 'Navigate',
      keywords: 'charts insights audit schema',
      shortcut: ['⌘', '⇧', '3'],
      icon: <NavIcon d="M2 13h12M4 11V6M7 11V3M10 11V8M13 11V5" />,
      action: () => navigate('/analytics'),
    });

    if (canAudit) {
      cmds.push({
        id: 'nav-audit',
        label: 'Audit Log',
        description: 'Document change history',
        group: 'Navigate',
        keywords: 'history changes log',
        shortcut: ['⌘', '⇧', '4'],
        icon: <NavIcon d="M3 2h7l3 3v9H3zM6 7h5M6 9h5M6 11h3" />,
        action: () => navigate('/audit'),
      });
    }

    // Actions
    if (onNewQuery) {
      cmds.push({
        id: 'action-new-query',
        label: 'New query',
        description: 'Start a blank AI query',
        group: 'Actions',
        keywords: 'new blank query generate',
        shortcut: ['⌘', 'N'],
        icon: (
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M8 3v10M3 8h10" />
          </svg>
        ),
        action: onNewQuery,
      });
    }

    cmds.push({
      id: 'action-saved-queries',
      label: 'Saved queries',
      description: 'Open saved queries panel',
      group: 'Actions',
      keywords: 'saved bookmarks history',
      shortcut: ['⌘', '⇧', 'S'],
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M4 2h6l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
          <path d="M6 7h5M6 10h3" />
        </svg>
      ),
      action: () => navigate('/query-generator?panel=saved'),
    });

    cmds.push({
      id: 'action-theme',
      label: theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode',
      group: 'Actions',
      keywords: 'theme dark light appearance',
      icon: theme === 'light' ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ),
      action: toggleTheme,
    });

    cmds.push({
      id: 'action-signout',
      label: 'Sign out',
      group: 'Actions',
      keywords: 'logout sign out',
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" />
        </svg>
      ),
      action: logout,
    });

    // Switch database
    if (availableDbs && availableDbs.length > 1) {
      availableDbs.forEach(db => {
        const isCurrent = db.name === databaseName;
        cmds.push({
          id: `db-${db.name}`,
          label: db.name,
          description: isCurrent ? 'Current database' : `Switch to ${db.name}`,
          group: 'Switch database',
          keywords: db.name,
          icon: (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
              <ellipse cx="8" cy="4" rx="6" ry="2" />
              <path d="M2 4v8c0 1.1 2.7 2 6 2s6-.9 6-2V4M2 8c0 1.1 2.7 2 6 2s6-.9 6-2" />
            </svg>
          ),
          action: () => { if (!isCurrent) onSwitchDatabase?.(db); },
        });
      });
    }

    // Switch account
    if (availableAccounts && availableAccounts.length > 1) {
      availableAccounts.forEach(acc => {
        const isCurrent = acc.id === accountId;
        cmds.push({
          id: `acc-${acc.id}`,
          label: acc.name,
          description: isCurrent ? 'Current account' : `Switch to ${acc.name}`,
          group: 'Switch account',
          keywords: acc.name,
          icon: (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="1" y="3" width="14" height="10" rx="2" />
              <path d="M1 7h14" />
            </svg>
          ),
          action: () => { if (!isCurrent) onSwitchAccount?.(acc); },
        });
      });
    }

    // Collections
    if (collections && collections.length > 0) {
      collections.forEach(col => {
        cmds.push({
          id: `col-${col.name}`,
          label: col.name,
          description: `${col.count.toLocaleString()} documents`,
          group: 'Jump to collection',
          keywords: col.name,
          icon: (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
              <ellipse cx="8" cy="4" rx="6" ry="2" />
              <path d="M2 4v8c0 1.1 2.7 2 6 2s6-.9 6-2V4M2 8c0 1.1 2.7 2 6 2s6-.9 6-2" />
            </svg>
          ),
          action: () => {
            onCollectionSelect?.(col.name);
            if (explorerHref) navigate(explorerHref, { state: { initialCollection: col.name } });
          },
        });
      });
    }

    return cmds;
  }, [navigate, explorerHref, databaseName, accountId, theme, toggleTheme, logout, canAudit, onNewQuery, availableDbs, availableAccounts, collections, onSwitchDatabase, onSwitchAccount, onCollectionSelect]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.description?.toLowerCase().includes(q)) ||
      (c.keywords?.toLowerCase().includes(q)) ||
      c.group.toLowerCase().includes(q)
    );
  }, [commands, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Command[]>();
    filtered.forEach(cmd => {
      if (!map.has(cmd.group)) map.set(cmd.group, []);
      map.get(cmd.group)!.push(cmd);
    });
    return map;
  }, [filtered]);

  const flat = useMemo(() => filtered, [filtered]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIdx(i => Math.min(i, Math.max(flat.length - 1, 0)));
  }, [flat.length]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-cmd-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flat.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = flat[activeIdx];
        if (cmd) run(cmd.action);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [open, flat, activeIdx, onClose, run]);

  if (!open) return null;

  let globalIdx = 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 80,
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--panel)', borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', maxHeight: 'calc(100vh - 160px)',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5l3 3" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
            placeholder="Search commands…"
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 13.5, color: 'var(--fg)', fontFamily: 'var(--font-body)',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 2 }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          )}
          <kbd style={kbdStyle}>esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', padding: '6px 0' }}>
          {flat.length === 0 ? (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            Array.from(grouped.entries()).map(([group, cmds]) => (
              <div key={group}>
                <div style={{
                  padding: '6px 14px 3px',
                  fontSize: 10.5, fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  color: 'var(--muted)',
                }}>
                  {group}
                </div>
                {cmds.map(cmd => {
                  const idx = globalIdx++;
                  const isActive = idx === activeIdx;
                  const isCurrent =
                    (cmd.id === 'nav-workspace' && location.pathname === '/query-generator') ||
                    (cmd.id === 'nav-explorer' && location.pathname.startsWith('/data-explorer')) ||
                    (cmd.id === 'nav-analytics' && location.pathname === '/analytics') ||
                    (cmd.id === 'nav-audit' && location.pathname === '/audit') ||
                    (cmd.id.startsWith('db-') && cmd.description === 'Current database') ||
                    (cmd.id.startsWith('acc-') && cmd.description === 'Current account');
                  return (
                    <button
                      key={cmd.id}
                      data-cmd-idx={idx}
                      onClick={() => run(cmd.action)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '7px 14px', border: 'none', cursor: 'pointer', textAlign: 'left',
                        background: isActive ? 'var(--soft)' : 'transparent',
                        color: isCurrent ? 'var(--accent)' : 'var(--fg)',
                        fontSize: 13,
                      }}
                    >
                      <span style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                        background: isActive ? 'var(--panel)' : 'var(--soft)',
                        color: isCurrent ? 'var(--accent)' : 'var(--muted)',
                        border: '1px solid var(--border)',
                      }}>
                        {cmd.icon}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontWeight: isCurrent ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {cmd.label}
                        </span>
                        {cmd.description && (
                          <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                            {cmd.description}
                          </span>
                        )}
                      </span>
                      {/* Right-side: shortcut badges + current checkmark */}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {cmd.shortcut && <Kbd keys={cmd.shortcut} />}
                        {isCurrent && (
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)' }}>
                            <path d="M3 8l4 4 6-6" />
                          </svg>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div style={{
          padding: '8px 14px', borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)',
        }}>
          <span><kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> navigate</span>
          <span><kbd style={kbdStyle}>↵</kbd> select</span>
          <span><kbd style={kbdStyle}>esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
};

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 4px', borderRadius: 4,
  background: 'var(--soft)', border: '1px solid var(--border)',
  fontSize: 10, fontFamily: 'var(--font-mono)',
  marginRight: 3,
};

export default CommandPalette;
