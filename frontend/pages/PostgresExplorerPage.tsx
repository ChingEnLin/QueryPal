import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import AgentVerdict from '../components/AgentVerdict';
import SavedQueriesPanel from '../components/SavedQueriesPanel';
import SaveQueryDialog from '../components/SaveQueryDialog';
import ShareQueryDialog from '../components/ShareQueryDialog';
import { SavedQuery } from '../types';
import { msalInstance } from '../authConfig';
import { getSavedQueries, saveQuery, updateSavedQuery, deleteSavedQuery } from '../services/userDataService';
import {
  getAuthenticatedToken,
  getPgDatabases,
  getPgSchema,
  getPgTableInfo,
  listPostgresServers,
  pgAnalyze,
  pgExecute,
  pgNl2Sql,
} from '../services/dbService';

// Shapes returned by the /postgres backend (see backend/services/azure_postgres_resources.py).
interface SchemaGroup {
  schema: string;
  tables: { name: string; rowEstimate: number }[];
}
interface Column {
  name: string;
  type: string;
  nullable: boolean;
  pk?: boolean;
  fk?: string | null;
}
interface IndexInfo {
  name: string;
  cols: string;
  kind: 'uniq' | 'gin' | 'index';
}
interface TableInfo {
  schema: string;
  table: string;
  columns: Column[];
  indexes: IndexInfo[];
  sample: { columns: string[]; rows: any[][]; error?: string };
}
interface SqlResult {
  columns: string[];
  rows: any[][];
}
interface Insight {
  summary: string;
  points: string[];
  followups: string[];
}
type Message = { t: string; kind: 'ok' | 'err'; msg: string };
type RunState = 'idle' | 'running' | 'done';

const cellText = (v: any): string =>
  v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);

const now = () =>
  new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

// ── SQL syntax highlighter (ported from the Query Workspace design) ──────────
const SQL_KW = new Set(['select', 'from', 'where', 'join', 'left', 'right', 'inner', 'outer', 'full', 'on', 'and', 'or', 'not', 'null', 'as', 'order', 'by', 'group', 'having', 'limit', 'offset', 'distinct', 'ilike', 'like', 'in', 'is', 'asc', 'desc', 'case', 'when', 'then', 'else', 'end', 'explain', 'analyze', 'interval', 'union', 'all', 'using', 'between', 'exists', 'with']);
const SQL_FN = new Set(['count', 'sum', 'avg', 'min', 'max', 'now', 'coalesce', 'date_trunc', 'lower', 'upper', 'round', 'age', 'extract', 'array_agg', 'cast']);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function highlightSQL(code: string): string {
  let out = '';
  let i = 0;
  const re = /--[^\n]*|'(?:[^'\\]|\\.)*'|\b\d+\.?\d*\b|[A-Za-z_][A-Za-z0-9_]*|\s+|[^\sA-Za-z0-9_]/y;
  while (i < code.length) {
    re.lastIndex = i;
    const m = re.exec(code);
    if (!m) { out += esc(code[i]); i++; continue; }
    const t = m[0];
    if (t.startsWith('--')) out += `<span class="tk-cm">${esc(t)}</span>`;
    else if (t[0] === "'") out += `<span class="tk-st">${esc(t)}</span>`;
    else if (/^\d/.test(t)) out += `<span class="tk-nm">${esc(t)}</span>`;
    else if (/^[A-Za-z_]/.test(t)) {
      const l = t.toLowerCase();
      out += SQL_KW.has(l) ? `<span class="tk-kw">${esc(t)}</span>`
        : SQL_FN.has(l) ? `<span class="tk-fn">${esc(t)}</span>` : esc(t);
    } else if (/^\s+$/.test(t)) out += t;
    else out += `<span class="tk-pu">${esc(t)}</span>`;
    i += t.length;
  }
  return out;
}
function highlightPlan(text: string): string {
  return esc(text)
    .replace(/\b(Limit|Sort|Hash Join|Hash|Seq Scan|Index Scan|Index Only Scan|Bitmap Heap Scan|Nested Loop|Aggregate|Gather|Materialize)\b/g, '<span class="pn">$1</span>')
    .replace(/\b(cost|actual time|rows|loops|width|Memory|Buckets|Batches)\b/g, '<span class="pc">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span class="pv">$1</span>');
}

const SparkIcon = ({ stroke = 'currentColor' }: { stroke?: string }) => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={stroke} strokeWidth="1.5"><path d="M8 1.5l1.4 3.8L13 6.5l-3.6 1.2L8 11.5 6.6 7.7 3 6.5l3.6-1.2z" /></svg>
);
const Spinner = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ animation: 'ws-spin 0.7s linear infinite' }}><path d="M8 2a6 6 0 1 0 6 6" /></svg>
);
const PlayIcon = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><polygon points="4,2 14,8 4,14" /></svg>
);
const dbIcon = (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" style={{ flexShrink: 0 }}>
    <ellipse cx="8" cy="4" rx="6" ry="2" /><path d="M2 4v8c0 1.1 2.7 2 6 2s6-.9 6-2V4M2 8c0 1.1 2.7 2 6 2s6-.9 6-2" />
  </svg>
);

// ── Column key badge (PK / FK / none) ───────────────────────────────────────
const KeyBadge: React.FC<{ col: Column }> = ({ col }) => {
  if (col.pk) return <span className="ws-keybadge pk" title="Primary key">PK</span>;
  if (col.fk) return <span className="ws-keybadge fk" title={`Foreign key → ${col.fk}`}>FK</span>;
  return <span className="ws-keybadge none">·</span>;
};

// ── Two-column schema card ───────────────────────────────────────────────────
const SchemaCard: React.FC<{
  info: TableInfo;
  rowEstimate: number | null;
  open: boolean;
  onToggle: () => void;
  onInsert: (snippet: string) => void;
  onQueryTable: () => void;
}> = ({ info, rowEstimate, open, onToggle, onInsert, onQueryTable }) => {
  const fks = info.columns.filter((c) => c.fk);
  return (
    <div className="qa-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderBottom: open ? '1px solid var(--border)' : 'none' }}>
        <span style={{ color: 'var(--accent)', display: 'flex' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="3" width="12" height="10" rx="1.5" /><path d="M2 6.5h12M6 6.5V13" /></svg>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 500 }}>{info.schema}.{info.table}</span>
        {rowEstimate != null && <span className="qa-tag">~{rowEstimate.toLocaleString()} rows</span>}
        <span className="qa-tag">{info.columns.length} cols</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, alignItems: 'center' }}>
          <button className="qa-btn primary" style={{ height: 27, gap: 6 }} onClick={onQueryTable}>
            <PlayIcon /> Query table
          </button>
          <button className="qa-iconbtn" onClick={onToggle} title={open ? 'Collapse schema' : 'Expand schema'}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .12s' }}><path d="M4 6l4 4 4-4" /></svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="ws-schemacard">
          <div className="ws-scol">
            <div className="ws-sec-h">Columns <span className="n">{info.columns.length}</span></div>
            {info.columns.map((c) => (
              <div className="ws-col" key={c.name} onClick={() => onInsert(`${info.table}.${c.name}`)} title={`Insert ${info.table}.${c.name}`}>
                <KeyBadge col={c} />
                <span className={'ws-col-name' + (c.fk ? ' fk' : '')}>{c.name}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ws-col-type">{c.type}</span>
                  <span className={'ws-nn ' + (!c.nullable ? 'on' : 'off')} title={!c.nullable ? 'NOT NULL' : 'nullable'} />
                  <svg className="ws-col-add" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 3v10M3 8h10" /></svg>
                </span>
              </div>
            ))}
          </div>
          <div className="ws-scol">
            <div className="ws-sec-h">Indexes <span className="n">{info.indexes.length}</span></div>
            {info.indexes.length === 0
              ? <div style={{ padding: '2px 6px', fontSize: 11.5, color: 'var(--muted)' }}>No indexes.</div>
              : info.indexes.map((ix) => (
                <div className="ws-idx" key={ix.name}>
                  <span className={'ws-idx-kind ' + (ix.kind === 'uniq' ? 'uniq' : ix.kind === 'gin' ? 'gin' : '')}>{ix.kind === 'uniq' ? 'UQ' : ix.kind === 'gin' ? 'GIN' : 'IDX'}</span>
                  <span className="ws-idx-name" title={ix.name}>{ix.name}</span>
                  {ix.cols && <span className="ws-idx-cols">({ix.cols})</span>}
                </div>
              ))}
            <div className="ws-sec-h" style={{ marginTop: 14 }}>Foreign keys <span className="n">{fks.length}</span></div>
            {fks.length === 0
              ? <div style={{ padding: '2px 6px', fontSize: 11.5, color: 'var(--muted)' }}>No outbound references.</div>
              : fks.map((c) => (
                <div className="ws-fk" key={c.name}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="1.4" style={{ flexShrink: 0 }}><path d="M6 10a3 3 0 0 1 0-4l1-1a3 3 0 0 1 4 4M10 6a3 3 0 0 1 0 4l-1 1a3 3 0 0 1-4-4" /></svg>
                  <span className="src">{c.name}</span><span className="arr">→</span><span className="dst">{c.fk}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Dark SQL editor with highlight overlay ───────────────────────────────────
const SqlEditor: React.FC<{
  sql: string;
  onChange: (v: string) => void;
  taRef: React.RefObject<HTMLTextAreaElement | null>;
  onRun: () => void;
  onExplain: () => void;
  onSave: () => void;
  running: boolean;
}> = ({ sql, onChange, taRef, onRun, onExplain, onSave, running }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard?.writeText(sql); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <div className="qa-card" style={{ padding: '10px 14px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg)' }}>// generated SQL</span>
      </div>
      <div className="ws-editor">
        <pre className="hl" aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlightSQL(sql) + '\n' }} />
        <textarea ref={taRef} value={sql} spellCheck={false} onChange={(e) => onChange(e.target.value)} />
        <button className="ws-copy" onClick={copy} style={{ color: copied ? '#8fce9e' : undefined }}>{copied ? '✓ copied' : 'copy'}</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <button className="qa-btn" style={{ height: 30, gap: 6 }} disabled={!sql.trim()} onClick={onSave} title="Save this query to your saved queries">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 2h8l3 3v9H3z" /><path d="M6 2v4h4M6 14v-4h5v4" /></svg>
          Save
        </button>
        <button className="qa-btn" style={{ height: 30, gap: 6 }} disabled={running || !sql.trim()} onClick={onExplain} title="Run EXPLAIN to show the query plan without executing the query">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 13h12M4 11V7M7 11V4M10 11V8M13 11V5" /></svg>
          Explain
        </button>
        <button className="qa-btn primary" style={{ height: 30, gap: 6 }} disabled={running || !sql.trim()} onClick={onRun}>
          {running ? <><Spinner size={12} /> Running</> : <><PlayIcon /> Run</>}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>⌘↩ run</span>
      </div>
    </div>
  );
};

// ── Results grid ─────────────────────────────────────────────────────────────
const ResultsGrid: React.FC<{ columns: string[]; rows: any[][] }> = ({ columns, rows }) => (
  <table className="ws-grid">
    <thead><tr><th className="rownum"></th>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
    <tbody>
      {rows.map((r, i) => (
        <tr key={i}>
          <td className="rownum">{i + 1}</td>
          {r.map((v, j) => {
            if (v === null || v === undefined) return <td key={j} className="null">NULL</td>;
            if (typeof v === 'number') return <td key={j} style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</td>;
            const text = cellText(v);
            return <td key={j} title={text} style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</td>;
          })}
        </tr>
      ))}
      {rows.length === 0 && <tr><td colSpan={columns.length + 1} style={{ padding: 12, color: 'var(--muted)' }}>No rows.</td></tr>}
    </tbody>
  </table>
);

// ── Right-rail AI insights ───────────────────────────────────────────────────
const InsightsPanel: React.FC<{
  hasResult: boolean;
  insight: Insight | null;
  analyzing: boolean;
  onAnalyze: () => void;
  onFollowup: (f: string) => void;
}> = ({ hasResult, insight, analyzing, onAnalyze, onFollowup }) => {
  const [width, setWidth] = useState(316);
  const drag = useRef<{ startX: number; startW: number } | null>(null);
  const onResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    drag.current = { startX: e.clientX, startW: width };
    const onMove = (ev: PointerEvent) => {
      if (!drag.current) return;
      // Panel is docked right, so dragging left (smaller clientX) widens it.
      setWidth(Math.min(640, Math.max(240, drag.current.startW + (drag.current.startX - ev.clientX))));
    };
    const onUp = () => {
      drag.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  return (
  <aside className="ws-insights" style={{ width, position: 'relative' }}>
    <div
      onPointerDown={onResizeStart}
      title="Drag to resize"
      style={{ position: 'absolute', top: 0, left: -3, width: 6, height: '100%', cursor: 'col-resize', zIndex: 2 }}
    />
    <div className="ws-ins-hd">
      <SparkIcon stroke="var(--accent)" />
      <span className="t">Insights</span>
      <span className="qa-tag" style={{ marginLeft: 'auto' }}>AI</span>
    </div>
    <div className="ws-ins-body">
      {!hasResult ? (
        <div style={{ padding: '8px 2px' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 5 }}>Run a query to see AI insights</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>After executing, use “Analyze” on the results to get patterns, anomalies, and follow-up suggestions.</div>
        </div>
      ) : !insight ? (
        <div className="ws-anim" style={{ padding: '8px 2px' }}>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 12 }}>
            Results ready. Analyze them for patterns, anomalies and suggested follow-ups.
          </div>
          <button className="qa-btn primary" style={{ width: '100%', justifyContent: 'center', height: 34 }} disabled={analyzing} onClick={onAnalyze}>
            {analyzing ? <><Spinner /> Analyzing…</> : <><SparkIcon /> Analyze results</>}
          </button>
        </div>
      ) : (
        <div className="ws-anim" style={{ padding: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', fontWeight: 500, marginBottom: 7 }}>Summary</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{insight.summary}</div>
          </div>
          {insight.points.length > 0 && (
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', fontWeight: 500, marginBottom: 7 }}>Patterns</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {insight.points.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12.5, lineHeight: 1.5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {insight.followups.length > 0 && (
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)', fontWeight: 500, marginBottom: 3 }}>Suggested follow-ups</div>
              {insight.followups.map((f, i) => (
                <button key={i} className="ws-sug" onClick={() => onFollowup(f)}>
                  <span style={{ color: 'var(--accent)', marginRight: 6 }}>→</span>{f}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  </aside>
  );
};

const EXAMPLES = ['count rows per table', 'the 10 most recent records', 'rows added in the last 7 days'];

const PostgresExplorerPage: React.FC = () => {
  const { serverId: rawServerId, database: rawDatabase } = useParams<{ serverId: string; database?: string }>();
  const navigate = useNavigate();
  const serverId = rawServerId ? decodeURIComponent(rawServerId) : '';
  const database = rawDatabase ? decodeURIComponent(rawDatabase) : '';

  const [serverName, setServerName] = useState('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [schema, setSchema] = useState<SchemaGroup[]>([]);
  // Multi-select: keys are "schema.table" (in selection order); infos holds the
  // fetched column/FK metadata per selected table.
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [infos, setInfos] = useState<Record<string, TableInfo>>({});
  const [schemaOpen, setSchemaOpen] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // NL -> SQL
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState('gemini-2.5-flash');
  const [maxIterations, setMaxIterations] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [sql, setSql] = useState('');
  const [sqlWriteNotice, setSqlWriteNotice] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<{ isValid?: boolean; explanation?: string } | null>(null);

  // Execution / results
  const [runState, setRunState] = useState<RunState>('idle');
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<'results' | 'plan' | 'messages'>('results');
  const [sqlResult, setSqlResult] = useState<SqlResult | null>(null);
  const [plan, setPlan] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [meta, setMeta] = useState('');

  // Insights
  const [insight, setInsight] = useState<Insight | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Saved queries (engine=pg)
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [savedPanelOpen, setSavedPanelOpen] = useState(false);
  const [saveDialog, setSaveDialog] = useState<{ isOpen: boolean; data?: Partial<SavedQuery> & { prompt: string; code: string } }>({ isOpen: false });
  const [shareDialog, setShareDialog] = useState<{ isOpen: boolean; query?: SavedQuery }>({ isOpen: false });
  const [savingQuery, setSavingQuery] = useState(false);
  const currentUserEmail = msalInstance.getAllAccounts()[0]?.username || 'dev.user@example.com';
  const [searchParams, setSearchParams] = useSearchParams();

  const taRef = useRef<HTMLTextAreaElement>(null);

  const selectedInfos = useMemo(
    () => selectedKeys.map((k) => infos[k]).filter(Boolean) as TableInfo[],
    [selectedKeys, infos],
  );

  // Ground the NL->SQL agent in the selected tables' real columns + FK links so
  // it writes correct joins; fall back to bare table names when nothing is picked.
  const schemaContext = useMemo(() => {
    if (selectedInfos.length === 0) {
      return schema.flatMap((g) => g.tables.map((t) => `${g.schema}.${t.name}`)).join('\n');
    }
    return selectedInfos
      .map((t) => {
        const cols = t.columns
          .map((c) => {
            const tags = [c.pk && 'PK', c.fk && `FK -> ${c.fk}`, !c.nullable && 'NOT NULL']
              .filter(Boolean)
              .join(', ');
            return `  - ${c.name} ${c.type}${tags ? ` [${tags}]` : ''}`;
          })
          .join('\n');
        return `${t.schema}.${t.table}\n${cols}`;
      })
      .join('\n\n');
  }, [selectedInfos, schema]);

  const rowEstimateFor = useCallback(
    (info: TableInfo) => {
      const g = schema.find((s) => s.schema === info.schema);
      return g?.tables.find((t) => t.name === info.table)?.rowEstimate ?? null;
    },
    [schema],
  );

  // Resolve server name + database list; redirect to first db if none in URL.
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

  const resetResults = () => { setRunState('idle'); setSqlResult(null); setPlan(''); setMessages([]); setInsight(null); setVerdict(null); };

  const openTable = useCallback(async (
    schemaName: string, table: string, ev?: { ctrlKey?: boolean; metaKey?: boolean },
  ) => {
    const key = `${schemaName}.${table}`;
    const multi = !!(ev?.ctrlKey || ev?.metaKey);
    // Cmd/Ctrl-click an already-selected table -> deselect it.
    if (multi && selectedKeys.includes(key)) {
      setSelectedKeys((ks) => ks.filter((k) => k !== key));
      return;
    }
    setSelectedKeys((ks) => (multi ? [...ks, key] : [key]));
    setSchemaOpen(true);
    if (infos[key]) return; // metadata already fetched
    try {
      setError(null);
      setTableLoading(true);
      const token = await getAuthenticatedToken();
      const info = await getPgTableInfo(token, serverId, database, schemaName, table);
      setInfos((m) => ({ ...m, [key]: info }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setTableLoading(false);
    }
  }, [serverId, database, selectedKeys, infos]);

  const insertAtCaret = useCallback((snippet: string) => {
    const ta = taRef.current;
    if (!ta) { setSql((s) => s + snippet); return; }
    const start = ta.selectionStart ?? sql.length;
    const end = ta.selectionEnd ?? sql.length;
    setSql(sql.slice(0, start) + snippet + sql.slice(end));
    requestAnimationFrame(() => { ta.focus(); const p = start + snippet.length; ta.setSelectionRange(p, p); });
  }, [sql]);

  const queryTable = useCallback((info: TableInfo) => {
    const cols = info.columns.slice(0, 6).map((c) => c.name).join(', ') || '*';
    setSql(`SELECT ${cols}\nFROM ${info.schema}.${info.table}\nLIMIT 100;`);
    resetResults();
    requestAnimationFrame(() => taRef.current?.focus());
  }, []);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    try {
      setGenerating(true);
      setError(null);
      setSqlWriteNotice(null);
      resetResults();
      const token = await getAuthenticatedToken();
      const out = await pgNl2Sql(token, {
        server_id: serverId, database, schema_context: schemaContext,
        user_input: prompt, model, max_iterations: maxIterations,
      });
      setSql(out.generated_code || '');
      setVerdict({ isValid: out.is_valid, explanation: out.explanation });
      if (out.is_write_action) {
        setSqlWriteNotice('Write/DDL detected — not executed. Review before running manually.');
      } else if (out.query_result && typeof out.query_result === 'object' && 'columns' in out.query_result) {
        const res = out.query_result as SqlResult;
        setSqlResult(res);
        setRunState('done');
        setTab('results');
        setMeta(`${res.rows.length} row${res.rows.length === 1 ? '' : 's'}`);
        setMessages([{ t: now(), kind: 'ok', msg: `Generated query returned ${res.rows.length} rows` }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  }, [prompt, serverId, database, schemaContext, model, maxIterations]);

  const execSql = useCallback(async (sqlText: string) => {
    if (!sqlText.trim()) return;
    setRunning(true);
    setError(null);
    setRunState('running');
    setTab('results');
    setInsight(null);
    const t0 = performance.now();
    try {
      const token = await getAuthenticatedToken();
      const out = await pgExecute(token, serverId, database, sqlText) as SqlResult;
      const ms = Math.round(performance.now() - t0);
      setSqlResult(out);
      setSqlWriteNotice(null);
      setRunState('done');
      setMeta(`${out.rows.length} row${out.rows.length === 1 ? '' : 's'} · ${ms} ms`);
      setMessages([{ t: now(), kind: 'ok', msg: `Query OK — ${out.rows.length} rows in ${ms} ms` }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setRunState('done');
      setTab('messages');
      setMessages([{ t: now(), kind: 'err', msg }]);
    } finally {
      setRunning(false);
    }
  }, [serverId, database]);

  const runSql = useCallback(() => execSql(sql), [execSql, sql]);

  const explain = useCallback(async () => {
    if (!sql.trim()) return;
    setRunning(true);
    setError(null);
    setRunState('running');
    setTab('plan');
    try {
      const token = await getAuthenticatedToken();
      const out = await pgExecute(token, serverId, database, `EXPLAIN ${sql}`) as SqlResult;
      setPlan(out.rows.map((r) => cellText(r[0])).join('\n'));
      setRunState('done');
      setMessages([{ t: now(), kind: 'ok', msg: 'Explain plan generated' }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setRunState('done');
      setTab('messages');
      setMessages([{ t: now(), kind: 'err', msg }]);
    } finally {
      setRunning(false);
    }
  }, [sql, serverId, database]);

  const analyze = useCallback(async () => {
    if (!sqlResult) return;
    try {
      setAnalyzing(true);
      const token = await getAuthenticatedToken();
      const out = await pgAnalyze(token, { columns: sqlResult.columns, rows: sqlResult.rows.slice(0, 200), user_input: prompt });
      setInsight(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalyzing(false);
    }
  }, [sqlResult, prompt]);

  const followup = useCallback((f: string) => {
    setPrompt(f);
    document.getElementById('pg-nl-prompt')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (document.getElementById('pg-nl-prompt') as HTMLTextAreaElement | null)?.focus();
  }, []);

  // --- Saved queries (engine=pg) ---
  useEffect(() => {
    let cancelled = false;
    setLoadingSaved(true);
    getSavedQueries('pg')
      .then((qs) => { if (!cancelled) setSavedQueries(qs); })
      .catch(() => { /* non-critical */ })
      .finally(() => { if (!cancelled) setLoadingSaved(false); });
    return () => { cancelled = true; };
  }, []);

  // Open the panel when deep-linked with ?panel=saved (from the profile menu).
  useEffect(() => {
    if (searchParams.get('panel') === 'saved') {
      setSavedPanelOpen(true);
      searchParams.delete('panel');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const openSaveDialog = useCallback(() => {
    if (!sql.trim()) return;
    setSaveDialog({ isOpen: true, data: { prompt, code: sql } });
  }, [sql, prompt]);

  const handleSaveOrUpdate = useCallback(async (data: Pick<SavedQuery, 'name' | 'prompt' | 'code'> | SavedQuery) => {
    setSavingQuery(true);
    try {
      if ('id' in data) {
        const updated = await updateSavedQuery(data as SavedQuery);
        setSavedQueries((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
      } else {
        const created = await saveQuery({ ...(data as Pick<SavedQuery, 'name' | 'prompt' | 'code'>), engine: 'pg' });
        setSavedQueries((prev) => [...prev, created]);
      }
      setSaveDialog({ isOpen: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingQuery(false);
    }
  }, []);

  const handleDeleteSaved = useCallback(async (id: string) => {
    const prev = savedQueries;
    setSavedQueries((qs) => qs.filter((q) => q.id !== id));
    try { await deleteSavedQuery(id); } catch { setSavedQueries(prev); }
  }, [savedQueries]);

  const loadSaved = useCallback((q: SavedQuery) => {
    setPrompt(q.prompt);
    setSql(q.code);
    resetResults();
    setSavedPanelOpen(false);
  }, []);

  const handleUpdateSharing = useCallback(async (q: SavedQuery) => {
    setSavedQueries((prev) => prev.map((x) => (x.id === q.id ? q : x)));
    setShareDialog({ isOpen: false });
    try { await updateSavedQuery(q); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);

  const switchDatabase = (db: string) => {
    setSelectedKeys([]);
    setInfos({});
    resetResults();
    navigate(`/postgres/${encodeURIComponent(serverId)}/${encodeURIComponent(db)}`);
  };

  const onEditorKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!running) runSql(); }
  };

  return (
    <AppLayout
      accountName={serverName || 'PostgreSQL'}
      accountId={serverId}
      databaseName={database}
      pgSchema={schema}
      activePgTables={selectedKeys}
      onPgTableSelect={openTable}
    >
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--bg)', fontFamily: 'var(--font-body)', color: 'var(--fg)' }} onKeyDown={onEditorKey}>
        {/* ── Middle + right rail (table tree + db switch now live in the app sidebar) ── */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, minWidth: 0 }}>
          <div className="pg-workspace-mid" style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 22px 26px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            {error && (
              <div style={{ background: 'color-mix(in oklch, var(--status-err) 10%, var(--bg))', border: '1px solid color-mix(in oklch, var(--status-err) 30%, var(--border))', color: 'var(--status-err)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
                <strong>Error: </strong>{error}
              </div>
            )}

            {/* Scope row: database selector + breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--muted)' }}>
              <span style={{ color: 'var(--muted)', display: 'flex' }}>{dbIcon}</span>
              <select
                value={database}
                onChange={(e) => switchDatabase(e.target.value)}
                title="Switch database"
                style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--fg)', fontFamily: 'var(--font-mono)', fontSize: 12, cursor: 'pointer', outline: 'none' }}
              >
                {databases.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              {selectedKeys.length > 0 && <span>›</span>}
              {selectedKeys.map((k) => (
                <span key={k} className="qa-chip accent" style={{ fontSize: 11 }}>{k}</span>
              ))}
              {selectedKeys.length > 1 && (
                <span style={{ fontSize: 11 }}>· {selectedKeys.length} tables — ⌘/Ctrl-click a table to add or remove</span>
              )}
            </div>

            {/* Schema cards (one per selected table) */}
            {loading && selectedKeys.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading schema…</div>}
            {selectedInfos.map((info) => (
              <React.Fragment key={`${info.schema}.${info.table}`}>
                <SchemaCard info={info} rowEstimate={rowEstimateFor(info)} open={schemaOpen}
                  onToggle={() => setSchemaOpen((o) => !o)} onInsert={insertAtCaret} onQueryTable={() => queryTable(info)} />
                {info.sample.error && (
                  <div className="qa-chip" style={{ fontSize: 11.5 }}>Sample data unavailable — {info.sample.error}</div>
                )}
              </React.Fragment>
            ))}
            {tableLoading && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Loading table metadata…</div>}

            {/* NL generator */}
            <div className="qa-card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--muted)' }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 8h.01M8 8h.01M12 8h.01" /><rect x="2" y="3" width="12" height="10" rx="2" /></svg>
                Ask in plain English
              </div>
              <textarea id="pg-nl-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (!generating && prompt.trim()) generate(); } }}
                placeholder="Describe the data you want…"
                style={{ padding: '4px 2px', border: 'none', background: 'transparent', color: 'var(--fg)', fontFamily: 'var(--font-body)', fontSize: 15, resize: 'vertical', outline: 'none', lineHeight: 1.5 }} disabled={generating} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button className="qa-btn primary" style={{ height: 34 }} disabled={generating || !prompt.trim()} onClick={generate}>
                  {generating ? <><Spinner /> Generating…</> : <><SparkIcon /> Generate query</>}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted)' }}>
                  <span title="More iterations let the agent self-correct by re-generating and re-testing. Max 10.">Iterations:</span>
                  <input type="range" min={1} max={10} value={maxIterations} onChange={(e) => setMaxIterations(+e.target.value)} disabled={generating} style={{ width: 90, accentColor: 'var(--accent)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', width: 12 }}>{maxIterations}</span>
                </div>
                <select value={model} onChange={(e) => setModel(e.target.value)} className="qa-btn" style={{ appearance: 'auto', height: 30, color: 'var(--fg)' }}>
                  <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>Try:</span>
                {EXAMPLES.map((ex) => (
                  <button key={ex} className="qa-chip" style={{ cursor: 'pointer', lineHeight: '20px' }} onClick={() => setPrompt(ex)} title={ex}>{ex}</button>
                ))}
              </div>
            </div>

            {sqlWriteNotice && <div className="qa-chip" style={{ borderColor: 'var(--status-warn)', color: 'var(--status-warn)' }}>{sqlWriteNotice}</div>}

            {/* SQL editor */}
            {sql ? (
              <SqlEditor sql={sql} onChange={setSql} taRef={taRef} onRun={runSql} onExplain={explain} onSave={openSaveDialog} running={running} />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '28px 0', border: '1.5px dashed var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
                Generate a query above, click a column to build one, or “Query table”.
              </div>
            )}

            {verdict && <AgentVerdict isValid={verdict.isValid} explanation={verdict.explanation} />}

            {/* Results card */}
            {runState !== 'idle' && (
              <div className="qa-card ws-anim" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', borderBottom: '1px solid var(--border)' }}>
                  {([
                    ['results', `Results${runState === 'done' && sqlResult ? ` · ${sqlResult.rows.length}` : ''}`, 'Rows returned by the query'],
                    ['plan', 'Query plan', 'The PostgreSQL EXPLAIN plan — how the query would be executed'],
                    ['messages', 'Messages', 'Execution log: status, timing and any errors'],
                  ] as const).map(([k, l, tip]) => (
                    <button key={k} onClick={() => setTab(k)} title={tip} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 12px', fontSize: 12.5, fontWeight: tab === k ? 500 : 400, color: tab === k ? 'var(--fg)' : 'var(--muted)', borderBottom: tab === k ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 }}>{l}</button>
                  ))}
                  {runState === 'done' && meta && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{meta}</span>
                  )}
                </div>
                <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                  {runState === 'running' && (
                    <div style={{ minHeight: 140, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 12.5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Spinner size={15} /> Executing on {database}…</div>
                    </div>
                  )}
                  {runState === 'done' && tab === 'results' && (
                    sqlResult ? <ResultsGrid columns={sqlResult.columns} rows={sqlResult.rows} />
                      : <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12.5 }}>No result set. See the Messages tab.</div>
                  )}
                  {runState === 'done' && tab === 'plan' && (
                    plan ? <pre className="ws-plan" dangerouslySetInnerHTML={{ __html: highlightPlan(plan) }} />
                      : <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12.5 }}>Click “Explain” to generate a query plan.</div>
                  )}
                  {runState === 'done' && tab === 'messages' && (
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {messages.length === 0 && <span style={{ color: 'var(--muted)', fontSize: 12 }}>No messages.</span>}
                      {messages.map((m, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                          <span style={{ color: 'var(--muted)' }}>{m.t}</span>
                          <span style={{ width: 5, height: 5, borderRadius: 99, background: m.kind === 'ok' ? 'var(--status-ok)' : 'var(--status-err)', alignSelf: 'center', flexShrink: 0 }} />
                          <span style={{ color: m.kind === 'ok' ? 'var(--fg)' : 'var(--status-err)' }}>{m.msg}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right insights rail */}
          <InsightsPanel hasResult={!!sqlResult} insight={insight} analyzing={analyzing} onAnalyze={analyze} onFollowup={followup} />
        </div>
      </div>

      {savedPanelOpen && createPortal(
        <SavedQueriesPanel
          onClose={() => setSavedPanelOpen(false)}
          queries={savedQueries}
          onLoad={loadSaved}
          onLoadAndRun={(q) => { loadSaved(q); execSql(q.code); }}
          onEdit={(q) => setSaveDialog({ isOpen: true, data: q })}
          onDelete={handleDeleteSaved}
          onShare={(q) => setShareDialog({ isOpen: true, query: q })}
          isLoading={loadingSaved}
          dbReady={!loading && !!database}
          currentUserEmail={currentUserEmail}
        />,
        document.body,
      )}

      {saveDialog.isOpen && createPortal(
        <SaveQueryDialog
          isOpen={saveDialog.isOpen}
          onClose={() => setSaveDialog({ isOpen: false })}
          onSave={handleSaveOrUpdate}
          isSaving={savingQuery}
          initialData={saveDialog.data!}
        />,
        document.body,
      )}

      {shareDialog.isOpen && shareDialog.query && createPortal(
        <ShareQueryDialog
          isOpen={shareDialog.isOpen}
          onClose={() => setShareDialog({ isOpen: false })}
          onSave={handleUpdateSharing}
          query={shareDialog.query}
        />,
        document.body,
      )}
    </AppLayout>
  );
};

export default PostgresExplorerPage;
