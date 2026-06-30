import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import {
  getAuthenticatedToken,
  getPgDatabases,
  getPgSchema,
  getPgTableInfo,
  listPostgresServers,
  pgExecute,
  pgNl2Sql,
} from '../services/dbService';

// Shapes returned by the /postgres backend (see backend/services/azure_postgres_resources.py).
interface SchemaGroup {
  schema: string;
  tables: { name: string; rowEstimate: number }[];
}
interface TableInfo {
  schema: string;
  table: string;
  columns: { name: string; type: string; nullable: boolean }[];
  indexes: string[];
  sample: { columns: string[]; rows: any[][] };
}
interface SqlResult {
  columns: string[];
  rows: any[][];
}

const cellText = (v: any): string =>
  v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

const ResultTable: React.FC<{ columns: string[]; rows: any[][] }> = ({ columns, rows }) => (
  <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
    <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} style={{ textAlign: 'left', padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'var(--soft)', color: 'var(--muted)', position: 'sticky', top: 0 }}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((v, j) => (
              <td key={j} style={{ padding: '6px 10px', borderBottom: '1px solid var(--border)', color: 'var(--fg)', whiteSpace: 'nowrap' }}>
                {cellText(v)}
              </td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && (
          <tr><td colSpan={Math.max(columns.length, 1)} style={{ padding: '10px', color: 'var(--muted)' }}>No rows.</td></tr>
        )}
      </tbody>
    </table>
  </div>
);

const PostgresExplorerPage: React.FC = () => {
  const { serverId: rawServerId, database: rawDatabase } = useParams<{ serverId: string; database?: string }>();
  const navigate = useNavigate();
  const serverId = rawServerId ? decodeURIComponent(rawServerId) : '';
  const database = rawDatabase ? decodeURIComponent(rawDatabase) : '';

  const [serverName, setServerName] = useState<string>('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [schema, setSchema] = useState<SchemaGroup[]>([]);
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // NL->SQL state
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sql, setSql] = useState('');
  const [sqlResult, setSqlResult] = useState<SqlResult | null>(null);
  const [sqlWriteNotice, setSqlWriteNotice] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // schema_context handed to the NL->SQL agent.
  const schemaContext = useMemo(
    () =>
      schema
        .flatMap((g) => g.tables.map((t) => `${g.schema}.${t.name}`))
        .join('\n'),
    [schema],
  );

  // Resolve server name + database list; if no database in URL, redirect to the first one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
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
          navigate(`/postgres/${encodeURIComponent(serverId)}/${encodeURIComponent(first)}`, { replace: true });
          return;
        }

        const overview = await getPgSchema(token, serverId, database);
        if (cancelled) return;
        setSchema(overview);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [serverId, database, navigate]);

  const openTable = useCallback(async (schemaName: string, table: string) => {
    try {
      setError(null);
      const token = await getAuthenticatedToken();
      const info = await getPgTableInfo(token, serverId, database, schemaName, table);
      setTableInfo(info);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [serverId, database]);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    try {
      setGenerating(true);
      setError(null);
      setSqlResult(null);
      setSqlWriteNotice(null);
      const token = await getAuthenticatedToken();
      const out = await pgNl2Sql(token, {
        server_id: serverId,
        database,
        schema_context: schemaContext,
        user_input: prompt,
      });
      setSql(out.generated_code || '');
      if (out.is_write_action) {
        setSqlWriteNotice('Write/DDL detected — not executed. Review before running manually.');
      } else if (out.query_result && typeof out.query_result === 'object' && 'columns' in out.query_result) {
        setSqlResult(out.query_result as SqlResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [prompt, serverId, database, schemaContext]);

  const runSql = useCallback(async () => {
    if (!sql.trim()) return;
    try {
      setRunning(true);
      setError(null);
      const token = await getAuthenticatedToken();
      const out = await pgExecute(token, serverId, database, sql);
      setSqlResult(out as SqlResult);
      setSqlWriteNotice(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }, [sql, serverId, database]);

  const switchDatabase = (db: string) =>
    navigate(`/postgres/${encodeURIComponent(serverId)}/${encodeURIComponent(db)}`);

  return (
    <AppLayout accountName={serverName || 'PostgreSQL'} accountId={serverId} databaseName={database}>
      <div style={{ display: 'flex', height: '100%', background: 'var(--bg)' }}>
        {/* Left: database picker + schema/tables */}
        <div style={{ width: 280, borderRight: '1px solid var(--border)', overflow: 'auto', padding: 14, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span className="qa-chip accent" style={{ fontSize: 11 }}>PostgreSQL</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--muted)' }}>{serverName}</span>
          </div>
          <label style={{ fontSize: 11, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Database</label>
          <select
            value={database}
            onChange={(e) => switchDatabase(e.target.value)}
            style={{ width: '100%', marginBottom: 16, padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--fg)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}
          >
            {databases.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          {schema.map((g) => (
            <div key={g.schema} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{g.schema}</div>
              {g.tables.map((t) => (
                <button
                  key={t.name}
                  onClick={() => openTable(g.schema, t.name)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', width: '100%', textAlign: 'left',
                    padding: '5px 8px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    background: tableInfo?.table === t.name && tableInfo?.schema === g.schema ? 'var(--accent-soft)' : 'transparent',
                    color: 'var(--fg)', fontFamily: 'var(--font-mono)', fontSize: 12.5,
                  }}
                >
                  <span>{t.name}</span>
                  <span style={{ color: 'var(--muted)' }}>{t.rowEstimate}</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Right: detail + NL->SQL */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {error && (
            <div style={{ color: 'var(--status-err)', fontSize: 13, marginBottom: 14, fontFamily: 'var(--font-body)' }}>Error: {error}</div>
          )}
          {loading && <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}

          {/* NL -> SQL */}
          <div className="qa-card" style={{ padding: 16, marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginBottom: 8 }}>Ask in natural language</div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. list the 10 most recent patients"
              rows={2}
              style={{ width: '100%', padding: 8, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--fg)', fontFamily: 'var(--font-body)', fontSize: 13, resize: 'vertical' }}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button className="qa-btn primary" disabled={generating || !prompt.trim()} onClick={generate}>
                {generating ? 'Generating…' : 'Generate SQL'}
              </button>
              {sql && (
                <button className="qa-btn" disabled={running} onClick={runSql}>
                  {running ? 'Running…' : 'Run'}
                </button>
              )}
            </div>
            {sql && (
              <pre style={{ marginTop: 12, padding: 12, background: 'var(--soft)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--fg)', whiteSpace: 'pre-wrap', overflow: 'auto' }}>{sql}</pre>
            )}
            {sqlWriteNotice && (
              <div className="qa-chip warn" style={{ marginTop: 8 }}>{sqlWriteNotice}</div>
            )}
            {sqlResult && (
              <div style={{ marginTop: 12 }}><ResultTable columns={sqlResult.columns} rows={sqlResult.rows} /></div>
            )}
          </div>

          {/* Table detail */}
          {tableInfo && (
            <div className="qa-card" style={{ padding: 16 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, marginBottom: 4 }}>
                {tableInfo.schema}.{tableInfo.table}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
                {tableInfo.columns.length} columns · indexes: {tableInfo.indexes.join(', ') || 'none'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {tableInfo.columns.map((c) => (
                  <span key={c.name} className="qa-chip" style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                    {c.name} <span style={{ color: 'var(--muted)' }}>{c.type}{c.nullable ? '?' : ''}</span>
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Sample rows</div>
              <ResultTable columns={tableInfo.sample.columns} rows={tableInfo.sample.rows} />
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default PostgresExplorerPage;
