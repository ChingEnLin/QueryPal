import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import PgRowDrawer from '../components/PgRowDrawer';
import { DbInfo } from '../types';
import {
  getAuthenticatedToken, getPgDatabases, getPgSchema, getPgTableInfo,
  getPgRows, pgInsertRow, pgUpdateRow, pgDeleteRow, listPostgresServers,
  PgFilter, PgSort,
} from '../services/dbService';

export interface Column { name: string; type: string; nullable: boolean; pk?: boolean; fk?: string | null }
interface SchemaGroup { schema: string; tables: { name: string; rowEstimate: number }[] }

const PAGE_SIZE = 50;
const cellText = (v: unknown): string =>
  v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

const KeyBadge: React.FC<{ col: Column }> = ({ col }) =>
  col.pk ? <span className="ws-keybadge pk" title="Primary key">PK</span>
    : col.fk ? <span className="ws-keybadge fk" title={`Foreign key -> ${col.fk}`}>FK</span>
      : <span className="ws-keybadge none">·</span>;

const PostgresDataExplorerPage: React.FC = () => {
  const { serverId: rawServerId, database: rawDatabase } = useParams<{ serverId: string; database?: string }>();
  const navigate = useNavigate();
  const serverId = rawServerId ? decodeURIComponent(rawServerId) : '';
  const database = rawDatabase ? decodeURIComponent(rawDatabase) : '';

  const [serverName, setServerName] = useState('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [schema, setSchema] = useState<SchemaGroup[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [pk, setPk] = useState<string[]>([]);
  const [rows, setRows] = useState<unknown[][]>([]);
  const [colNames, setColNames] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<PgFilter[]>([]);
  const [sort, setSort] = useState<PgSort | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<{ mode: 'edit' | 'new'; row?: Record<string, unknown> } | null>(null);

  const [activeSchema, activeTable] = activeKey ? activeKey.split(/\.(.*)/s) : [null, null];

  // Resolve server name + schema tree; redirect to first db if none in URL.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const token = await getAuthenticatedToken();
        const servers = await listPostgresServers(token);
        const srv = servers.find((s) => s.id === serverId);
        if (!srv) throw new Error('PostgreSQL server not found or not accessible.');
        if (cancelled) return;
        setServerName(srv.name);
        const dbs = await getPgDatabases(token, serverId);
        if (cancelled) return;
        setDatabases(dbs);
        if (!database) {
          const first = dbs[0];
          if (!first) throw new Error('No databases found on this server.');
          navigate(`/postgres-explorer/${encodeURIComponent(serverId)}/${encodeURIComponent(first)}`, { replace: true });
          return;
        }
        setActiveKey(null); // dropping the selected table when the database changes
        const overview = await getPgSchema(token, serverId, database) as SchemaGroup[];
        if (!cancelled) setSchema(overview);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [serverId, database, navigate]);

  // On table change: load column metadata, reset view.
  useEffect(() => {
    if (!activeSchema || !activeTable) return;
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        const token = await getAuthenticatedToken();
        const info = await getPgTableInfo(token, serverId, database, activeSchema, activeTable) as { columns: Column[] };
        if (cancelled) return;
        setColumns(info.columns);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [activeKey, serverId, database]);

  const fetchRows = useCallback(async () => {
    if (!activeSchema || !activeTable) return;
    try {
      setLoading(true); setError(null);
      const token = await getAuthenticatedToken();
      const out = await getPgRows(token, {
        serverId, database, schema: activeSchema, table: activeTable,
        filters, sort, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
      });
      setRows(out.rows); setColNames(out.columns); setTotal(out.total); setPk(out.pk);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [activeKey, serverId, database, filters, sort, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Manual table pick clears the view; the column-load effect only loads
  // columns (it must NOT reset filters, or FK-nav filters below get clobbered).
  const onPgTableSelect = useCallback((s: string, t: string) => {
    setActiveKey(`${s}.${t}`); setFilters([]); setSort(null); setPage(0);
  }, []);

  // Connection-chip database switcher (parity with the Cosmos explorer). DbInfo
  // needs name/collections/totalDocuments/size, but the chip only reads .name.
  const availableDbs = useMemo<DbInfo[]>(
    () => databases.map((name) => ({ name, collections: [], totalDocuments: 0, size: null })),
    [databases],
  );
  const switchDatabase = useCallback((db: DbInfo) => {
    if (db.name === database) return;
    navigate(`/postgres-explorer/${encodeURIComponent(serverId)}/${encodeURIComponent(db.name)}`);
  }, [database, serverId, navigate]);

  const toggleSort = (col: string) => setSort((prev) =>
    prev?.column === col ? { column: col, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { column: col, dir: 'asc' });

  const onFkClick = (fk: string, value: unknown) => {
    const [refTable, refCol] = fk.split('.');
    setSort(null); setPage(0);
    setActiveKey(`${activeSchema}.${refTable}`);
    setFilters([{ column: refCol, op: '=', value }]);
  };

  // Filter builder (column -> operator -> value; AND-combined chips).
  const OPS = ['=', '!=', '<', '>', '<=', '>=', 'ilike', 'isnull', 'isnotnull'];
  const [draft, setDraft] = useState<{ column: string; op: string; value: string }>({ column: '', op: '=', value: '' });
  const addFilter = () => {
    if (!draft.column) return;
    const nullary = draft.op === 'isnull' || draft.op === 'isnotnull';
    setFilters((fs) => [...fs, { column: draft.column, op: draft.op, ...(nullary ? {} : { value: draft.value }) }]);
    setDraft({ column: '', op: '=', value: '' });
    setPage(0);
  };

  const rowToObject = (r: unknown[]): Record<string, unknown> =>
    Object.fromEntries(colNames.map((c, i) => [c, r[i]]));
  const pkOf = (row: Record<string, unknown>) => Object.fromEntries(pk.map((c) => [c, row[c]]));

  const saveRow = async (values: Record<string, unknown>) => {
    const token = await getAuthenticatedToken();
    if (drawer?.mode === 'edit' && drawer.row) {
      await pgUpdateRow(token, { serverId, database, schema: activeSchema!, table: activeTable!, pk: pkOf(drawer.row), values });
    } else {
      await pgInsertRow(token, { serverId, database, schema: activeSchema!, table: activeTable!, values });
    }
    setDrawer(null);
    await fetchRows();
  };

  const deleteRow = async () => {
    if (!drawer?.row) return;
    const token = await getAuthenticatedToken();
    await pgDeleteRow(token, { serverId, database, schema: activeSchema!, table: activeTable!, pk: pkOf(drawer.row) });
    setDrawer(null);
    await fetchRows();
  };

  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const colFor = useMemo(() => new Map(columns.map((c) => [c.name, c])), [columns]);

  return (
    <AppLayout
      accountName={serverName || 'PostgreSQL'}
      accountId={serverId}
      databaseName={database}
      pgSchema={schema}
      activePgTables={activeKey ? [activeKey] : []}
      onPgTableSelect={onPgTableSelect}
      availableDbs={availableDbs}
      onSwitchDatabase={switchDatabase}
    >
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg)', color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: '18px 22px 0' }}>
          {error && (
            <div style={{ background: 'color-mix(in oklch, var(--status-err) 10%, var(--bg))', border: '1px solid color-mix(in oklch, var(--status-err) 30%, var(--border))', color: 'var(--status-err)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13, marginBottom: 12 }}>
              <strong>Error: </strong>{error}
            </div>
          )}

          {!activeKey ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
              Select a table from the sidebar to browse its rows.
            </div>
          ) : (
            <>
              {/* Header bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 500 }}>{activeKey}</span>
                <button className="qa-btn primary" style={{ height: 28 }} disabled={pk.length === 0}
                  title={pk.length === 0 ? 'Table has no primary key — read-only' : 'Insert a new row'}
                  onClick={() => setDrawer({ mode: 'new' })}>+ New row</button>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  {from}-{to} of {total.toLocaleString()}
                </span>
                <button className="qa-iconbtn" disabled={page === 0} onClick={() => setPage((p) => p - 1)} title="Previous page">&#x2039;</button>
                <button className="qa-iconbtn" disabled={to >= total} onClick={() => setPage((p) => p + 1)} title="Next page">&#x203a;</button>
              </div>

              {/* Filter builder */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={draft.column} onChange={(e) => setDraft((d) => ({ ...d, column: e.target.value }))}
                  className="qa-btn" style={{ appearance: 'auto', height: 28 }}>
                  <option value="">filter column…</option>
                  {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <select value={draft.op} onChange={(e) => setDraft((d) => ({ ...d, op: e.target.value }))}
                  className="qa-btn" style={{ appearance: 'auto', height: 28 }}>
                  {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                {draft.op !== 'isnull' && draft.op !== 'isnotnull' && (
                  <input value={draft.value} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value }))}
                    placeholder="value"
                    style={{ padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--panel)', color: 'var(--fg)', fontFamily: 'var(--font-mono)', fontSize: 12, height: 28, boxSizing: 'border-box' }} />
                )}
                <button className="qa-btn" style={{ height: 28 }} disabled={!draft.column} onClick={addFilter}>Add filter</button>
              </div>

              {/* Filter chips */}
              {filters.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  {filters.map((f, i) => (
                    <span key={i} className="qa-chip accent" style={{ cursor: 'pointer' }}
                      title="Remove filter"
                      onClick={() => { setFilters((fs) => fs.filter((_, j) => j !== i)); setPage(0); }}>
                      {f.column} {f.op} {cellText(f.value)} &#x2715;
                    </span>
                  ))}
                </div>
              )}

              {/* Grid */}
              <div className="qa-card" style={{ padding: 0, overflow: 'auto', flex: 1, minHeight: 0 }}>
                <table className="ws-grid">
                  <thead>
                    <tr>
                      <th className="rownum"></th>
                      {colNames.map((c) => {
                        const meta = colFor.get(c);
                        return (
                          <th key={c} onClick={() => toggleSort(c)} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} title={meta?.type}>
                            {meta && <KeyBadge col={meta} />} {c}
                            {sort?.column === c ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={colNames.length + 1} style={{ padding: 16, color: 'var(--muted)' }}>Loading…</td></tr>}
                    {!loading && rows.length === 0 && <tr><td colSpan={colNames.length + 1} style={{ padding: 16, color: 'var(--muted)' }}>No rows.</td></tr>}
                    {!loading && rows.map((r, i) => (
                      <tr key={i} style={{ cursor: 'pointer' }} onClick={() => setDrawer({ mode: 'edit', row: rowToObject(r as unknown[]) })}>
                        <td className="rownum">{from + i}</td>
                        {(r as unknown[]).map((v, j) => {
                          const meta = colFor.get(colNames[j]);
                          if (v === null || v === undefined) return <td key={j} className="null">NULL</td>;
                          if (meta?.fk) return (
                            <td key={j} onClick={(e) => { e.stopPropagation(); onFkClick(meta.fk!, v); }} style={{ color: 'var(--accent)', cursor: 'pointer' }} title={`Go to ${meta.fk}`}>{cellText(v)} →</td>
                          );
                          if (typeof v === 'number') return <td key={j} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</td>;
                          const text = cellText(v);
                          return <td key={j} title={text} style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {drawer && activeSchema && activeTable && (
          <PgRowDrawer
            columns={columns}
            pk={pk}
            mode={drawer.mode}
            row={drawer.row ?? null}
            onClose={() => setDrawer(null)}
            onSave={saveRow}
            onDelete={deleteRow}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default PostgresDataExplorerPage;
