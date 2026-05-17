import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CollectionSummary } from '../types';
import {
  ArgusDiff,
  ArgusFinding,
  ArgusJobStatus,
  ArgusProfile,
  ArgusReport,
  ArgusRunSummary,
  ArgusSeverity,
  getArgusJob,
  getArgusReport,
  listArgusRuns,
  startArgusAudit,
} from '../services/argusService';

const JOB_STORAGE_KEY = 'qp_argus_jobs';

type JobMap = Record<string, string>;

const readJobMap = (): JobMap => {
  try { return JSON.parse(sessionStorage.getItem(JOB_STORAGE_KEY) ?? '{}'); }
  catch { return {}; }
};

const writeJobMap = (map: JobMap) => {
  sessionStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(map));
};

const jobKey = (accountId: string, database: string, collection: string) =>
  `${accountId}::${database}::${collection}`;

const PROFILE_INFO: Record<ArgusProfile, { tagline: string; speed: string; cost: string; body: string }> = {
  fast: {
    tagline: 'Quick scan — rule-based checks only.',
    speed: '~20–40s',
    cost: 'lowest',
    body: 'Looks for missing fields, type mismatches, and obvious anomalies using fixed rules. No second-pass review, so findings reflect the agent\'s initial judgment. Best for a quick health check or smoke test before a deeper run.',
  },
  balanced: {
    tagline: 'Recommended — rules + a self-review pass.',
    speed: '~40–90s',
    cost: 'moderate',
    body: 'Runs the same rule checks, then has the agent re-examine each finding and weigh them against the overall picture before reporting. Catches more real issues and filters out noise. The best default for most collections.',
  },
  thorough: {
    tagline: 'Deepest review — uses a separate judge model.',
    speed: '~2–4 min',
    cost: 'highest',
    body: 'Adds a second, independent AI model that audits the run end-to-end and grades each finding. Slowest and priciest, but the most defensible results — use before sharing a report externally or making schema changes.',
  },
};

interface InfoPopoverProps {
  title: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
}

const InfoPopover: React.FC<InfoPopoverProps> = ({ title, children, align = 'left' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label={`About ${title}`}
        title={title}
        style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '1px solid var(--border)', background: 'var(--soft)',
          color: 'var(--muted)', cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontFamily: 'var(--font-body)', lineHeight: 1, fontWeight: 600,
        }}
      >?</button>
      {open && (
        <div
          role="dialog"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)',
            [align === 'right' ? 'right' : 'left']: 0,
            zIndex: 200, width: 280,
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '10px 12px', fontFamily: 'var(--font-body)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg)', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--muted)' }}>{children}</div>
        </div>
      )}
    </span>
  );
};

const ProfileChip: React.FC<{
  p: ArgusProfile;
  active: boolean;
  onSelect: () => void;
}> = ({ p, active, onSelect }) => {
  const [hover, setHover] = useState(false);
  const info = PROFILE_INFO[p];
  return (
    <span style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        onClick={onSelect}
        style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11.5,
          background: active ? 'var(--panel)' : 'transparent',
          boxShadow: active ? '0 0 0 1px var(--border)' : 'none',
          color: active ? 'var(--fg)' : 'var(--muted)',
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          textTransform: 'capitalize',
        }}
      >{p}</span>
      {hover && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)', zIndex: 200, width: 240,
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          padding: '8px 10px', fontFamily: 'var(--font-body)',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--fg)', marginBottom: 3, textTransform: 'capitalize' }}>
            {p} · {info.tagline}
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--muted)', marginBottom: 5 }}>
            {info.body}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', display: 'flex', gap: 10 }}>
            <span><span style={{ color: 'var(--fg)' }}>{info.speed}</span> typical</span>
            <span>·</span>
            <span><span style={{ color: 'var(--fg)' }}>{info.cost}</span> cost</span>
          </div>
        </div>
      )}
    </span>
  );
};

interface AnalyticsPageProps {
  accountId?: string;
  databaseName?: string;
  collections?: CollectionSummary[];
}

const SEVER_COLOR: Record<ArgusSeverity, string> = {
  critical: '#c94250',
  warning: '#c98d42',
  info: 'var(--muted)',
};
const SEVER_BG: Record<ArgusSeverity, string> = {
  critical: '#fdf0f1',
  warning: '#fdf6ed',
  info: 'var(--soft)',
};
const DIFF_COLOR: Record<ArgusDiff, string> = {
  new: '#1d6cf2',
  regressed: '#c98d42',
  existing: 'var(--muted)',
  resolved: 'var(--accent)',
};

const ScoreArc: React.FC<{ score: number }> = ({ score }) => {
  const R = 48, cx = 60, cy = 60;
  const pct = score / 100;
  const col = score >= 80 ? '#3a8c5f' : score >= 60 ? '#c98d42' : '#c94250';
  const sweep = 270;
  const start = 135;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + R * Math.cos(rad(start));
  const y1 = cy + R * Math.sin(rad(start));
  const end = start + sweep;
  const x2 = cx + R * Math.cos(rad(end));
  const y2 = cy + R * Math.sin(rad(end));
  const bgArc = `M ${x1} ${y1} A ${R} ${R} 0 1 1 ${x2} ${y2}`;
  const filledEnd = start + sweep * pct;
  const xe = cx + R * Math.cos(rad(filledEnd));
  const ye = cy + R * Math.sin(rad(filledEnd));
  const largeArc = sweep * pct > 180 ? 1 : 0;
  const fgArc = `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${xe.toFixed(2)} ${ye.toFixed(2)}`;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <path d={bgArc} fill="none" stroke="var(--border)" strokeWidth="8" strokeLinecap="round" />
      <path d={fgArc} fill="none" stroke={col} strokeWidth="8" strokeLinecap="round" />
      <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="500" fontFamily="var(--font-display)" fill="var(--fg)">{score}</text>
      <text x="60" y="72" textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--font-body)">/ 100</text>
      <text x="60" y="88" textAnchor="middle" fontSize="9" fill={col} fontFamily="var(--font-body)">
        {score >= 80 ? 'GOOD' : score >= 60 ? 'MODERATE' : 'POOR'}
      </text>
    </svg>
  );
};

const tagStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '0 6px', height: 18, borderRadius: 4,
  fontSize: 10, fontFamily: 'var(--font-body)',
  border: '1px solid var(--border)', background: 'var(--soft)',
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'var(--muted)', marginBottom: 6,
  display: 'flex', alignItems: 'center', gap: 6,
  fontFamily: 'var(--font-body)',
};

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ accountId, databaseName, collections }) => {
  const hasConnection = !!(accountId && databaseName);
  const [collection, setCollection] = useState<string>(collections?.[0]?.name ?? '');
  const [profile, setProfile] = useState<ArgusProfile>('fast');
  const [report, setReport] = useState<ArgusReport | null>(null);
  const [jobStatus, setJobStatus] = useState<ArgusJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'findings' | 'history'>('findings');
  const [history, setHistory] = useState<ArgusRunSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const pollRef = useRef<number | null>(null);

  const refreshHistory = useCallback(async () => {
    if (!accountId || !databaseName || !collection) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const rows = await listArgusRuns({
        accountId,
        database: databaseName,
        collection,
        limit: 20,
      });
      setHistory(rows);
    } catch (e) {
      // History fetch failures shouldn't block the run flow.
      console.warn('listArgusRuns failed', e);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [accountId, databaseName, collection]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  const loadHistoricalReport = useCallback(async (reportId: string) => {
    setError(null);
    try {
      const r = await getArgusReport(reportId);
      setReport(r);
      setSelId(r.findings[0]?.id ?? null);
      setActiveTab('findings');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const loading = jobStatus === 'queued' || jobStatus === 'running';

  const findings = report?.findings ?? [];
  const sel: ArgusFinding | null = useMemo(() => {
    if (!findings.length) return null;
    return findings.find((f) => f.id === selId) ?? findings[0];
  }, [findings, selId]);

  const clearPoll = () => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const clearStoredJob = useCallback((aid: string, db: string, col: string) => {
    const map = readJobMap();
    delete map[jobKey(aid, db, col)];
    writeJobMap(map);
  }, []);

  const pollJob = useCallback(async (id: string, aid: string, db: string, col: string) => {
    try {
      const job = await getArgusJob(id);
      setJobStatus(job.status);
      if (job.status === 'done' && job.report) {
        setReport(job.report);
        setSelId(job.report.findings[0]?.id ?? null);
        clearPoll();
        clearStoredJob(aid, db, col);
        refreshHistory();
      } else if (job.status === 'error') {
        setError(job.error || 'Audit failed.');
        clearPoll();
        clearStoredJob(aid, db, col);
      }
    } catch (e) {
      // 404 means the job was evicted (backend restarted, etc.) — drop it.
      setError(e instanceof Error ? e.message : String(e));
      clearPoll();
      clearStoredJob(aid, db, col);
    }
  }, [clearStoredJob, refreshHistory]);

  // Resume an in-flight poll when the page mounts or the collection changes.
  useEffect(() => {
    clearPoll();
    setReport(null);
    setError(null);
    setJobStatus(null);
    setSelId(null);
    setActiveTab('findings');
    if (!accountId || !databaseName || !collection) return;
    const stored = readJobMap()[jobKey(accountId, databaseName, collection)];
    if (!stored) return;
    setJobStatus('running');
    pollJob(stored, accountId, databaseName, collection);
    pollRef.current = window.setInterval(
      () => pollJob(stored, accountId, databaseName, collection),
      3000,
    );
    return clearPoll;
  }, [accountId, databaseName, collection, pollJob]);

  const runAudit = async () => {
    if (!accountId || !databaseName || !collection) return;
    clearPoll();
    setError(null);
    setReport(null);
    setSelId(null);
    setJobStatus('queued');
    try {
      const { job_id } = await startArgusAudit({
        accountId,
        database: databaseName,
        collection,
        profile,
      });
      const map = readJobMap();
      map[jobKey(accountId, databaseName, collection)] = job_id;
      writeJobMap(map);
      pollJob(job_id, accountId, databaseName, collection);
      pollRef.current = window.setInterval(
        () => pollJob(job_id, accountId, databaseName, collection),
        3000,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setJobStatus('error');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', minHeight: 0 }}>
      {/* QueryArgus + controls row */}
      <div style={{
        padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 4, background: 'var(--fg)', color: 'var(--bg)',
            display: 'grid', placeItems: 'center', fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600,
          }}>A</div>
          <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)' }}>QueryArgus</span>
          <span style={tagStyle}>data quality</span>
          <InfoPopover title="What is QueryArgus?">
            <p style={{ margin: '0 0 6px' }}>
              QueryArgus is an automated reviewer that inspects a collection and flags data-quality issues
              — missing fields, inconsistent types, duplicate keys, suspicious values, and more.
            </p>
            <p style={{ margin: '0 0 6px' }}>
              It works like a careful analyst: it samples documents, asks itself questions, runs follow-up
              queries to confirm hunches, and writes a short report with evidence for every finding.
            </p>
            <p style={{ margin: 0 }}>
              Use it before a migration, when onboarding a new collection, or whenever a dashboard
              starts looking wrong. No changes are made to your data.
            </p>
          </InfoPopover>
        </div>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
          {databaseName ?? '—'}
        </span>
        {hasConnection && (collections?.length ?? 0) > 0 && (
          <select
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 12,
              padding: '3px 8px', borderRadius: 6,
              background: 'var(--panel)', color: 'var(--fg)',
              border: '1px solid var(--border)', cursor: 'pointer',
            }}
          >
            {collections!.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Profile</span>
          <InfoPopover title="Profiles" align="right">
            <p style={{ margin: '0 0 6px' }}>
              Profiles control how carefully QueryArgus checks itself — they trade speed and cost for
              confidence in the report.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li style={{ marginBottom: 4 }}><strong style={{ color: 'var(--fg)' }}>Fast</strong> — rules only, no AI review of findings.</li>
              <li style={{ marginBottom: 4 }}><strong style={{ color: 'var(--fg)' }}>Balanced</strong> — adds a self-review pass. Recommended.</li>
              <li><strong style={{ color: 'var(--fg)' }}>Thorough</strong> — adds an independent judge model.</li>
            </ul>
            <p style={{ margin: '6px 0 0', fontSize: 11 }}>Hover any profile chip for full details.</p>
          </InfoPopover>
          <div style={{
            display: 'flex', background: 'var(--soft)', borderRadius: 6,
            border: '1px solid var(--border)', padding: 2, gap: 1,
          }}>
            {(['fast', 'balanced', 'thorough'] as ArgusProfile[]).map((p) => (
              <ProfileChip key={p} p={p} active={p === profile} onSelect={() => setProfile(p)} />
            ))}
          </div>
          <button
            className="qa-btn primary"
            disabled={!hasConnection || !collection || loading}
            onClick={runAudit}
            style={{ gap: 6, opacity: !hasConnection || !collection || loading ? 0.6 : 1 }}
          >
            {loading ? (
              <>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" opacity="0.3" />
                  <path d="M14 8a6 6 0 0 0-6-6">
                    <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.9s" repeatCount="indefinite" />
                  </path>
                </svg>
                Running…
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="4,2 14,8 4,14" />
                </svg>
                Run audit
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status bar */}
      {report && (
        <div style={{
          padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid var(--border)', background: 'var(--soft)',
          fontSize: 11, color: 'var(--muted)', flexShrink: 0, fontFamily: 'var(--font-body)',
        }}>
          <span className="qa-dot ok"></span>
          <span>
            {new Date(report.run_at).toLocaleString()} · {report.duration_seconds.toFixed(1)}s
          </span>
          <span>·</span>
          <span>{report.iterations} iterations · {report.total_tokens.toLocaleString()} tokens</span>
          <span>·</span>
          <span>{report.model} · {report.profile}</span>
          {report.created_by && (
            <>
              <span>·</span>
              <span>Ran by <span style={{ color: 'var(--fg)' }}>{report.created_by}</span></span>
            </>
          )}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
            {report.diff.new > 0 && (
              <span style={{ color: '#1d6cf2', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
                {report.diff.new} new
              </span>
            )}
            {report.diff.resolved > 0 && (
              <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
                {report.diff.resolved} resolved
              </span>
            )}
            {report.diff.regressed > 0 && (
              <span style={{ color: '#c98d42', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
                {report.diff.regressed} regressed
              </span>
            )}
          </span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '10px 18px', background: '#fdf0f1', color: '#c94250',
          borderBottom: '1px solid var(--border)', fontSize: 12,
          fontFamily: 'var(--font-body)', flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {/* Body */}
      {!hasConnection ? (
        <EmptyState
          title="No database connected"
          body="Connect to a Cosmos DB from Workspace or Explorer first, then return here to run an audit."
        />
      ) : !report && !loading && history.length > 0 ? (
        <PreRunHistory
          history={history}
          historyLoading={historyLoading}
          onSelect={loadHistoricalReport}
        />
      ) : !report && !loading ? (
        <EmptyState
          title="Run an audit"
          body={`QueryArgus will sample ${collection || 'a collection'} and report data-quality findings. Pick a profile and press Run.`}
        />
      ) : loading && !report ? (
        <EmptyState
          title={jobStatus === 'queued' ? 'Queued…' : 'Running audit…'}
          body="The ReAct agent is sampling, querying, and writing findings. Safe to navigate away — results will be waiting when you return to this collection."
        />
      ) : report && sel ? (
        <ReportBody
          report={report}
          findings={findings}
          sel={sel}
          selId={selId ?? findings[0]?.id ?? null}
          onSelect={setSelId}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          history={history}
          historyLoading={historyLoading}
          onSelectHistorical={loadHistoricalReport}
        />
      ) : report ? (
        <EmptyState title="No findings" body="QueryArgus completed without flagging any data-quality issues in this collection." />
      ) : null}
    </div>
  );
};

const EmptyState: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div style={{
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '48px 32px', minHeight: 0,
  }}>
    <div style={{ maxWidth: 460, textAlign: 'center' }}>
      <div style={{
        fontSize: 15, fontWeight: 500, color: 'var(--fg)',
        fontFamily: 'var(--font-display)', marginBottom: 6,
      }}>{title}</div>
      <div style={{
        fontSize: 13, color: 'var(--muted)', lineHeight: 1.55,
        fontFamily: 'var(--font-body)',
      }}>{body}</div>
    </div>
  </div>
);

const ReportBody: React.FC<{
  report: ArgusReport;
  findings: ArgusFinding[];
  sel: ArgusFinding;
  selId: string | null;
  onSelect: (id: string) => void;
  activeTab: 'findings' | 'history';
  onTabChange: (tab: 'findings' | 'history') => void;
  history: ArgusRunSummary[];
  historyLoading: boolean;
  onSelectHistorical: (reportId: string) => void;
}> = ({ report, findings, sel, selId, onSelect, activeTab, onTabChange, history, historyLoading, onSelectHistorical }) => {
  const { counts } = report;
  const score = report.quality_score ?? 0;

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 400px', minHeight: 0 }}>
      {/* LEFT — score + findings */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
        {/* Score row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <ScoreArc score={score} />
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, paddingLeft: 18 }}>
            {([
              ['Critical', counts.critical, '#c94250', '#fdf0f1'],
              ['Warning', counts.warning, '#c98d42', '#fdf6ed'],
              ['Info', counts.info, 'var(--muted)', 'var(--soft)'],
              ['Dismissed', counts.dismissed, 'var(--muted)', 'var(--soft)'],
            ] as const).map(([l, v, c, bg]) => (
              <div key={l} style={{
                background: bg, borderRadius: 8, padding: '8px 10px',
                display: 'flex', flexDirection: 'column', gap: 3,
                border: '1px solid var(--border)',
              }}>
                <span style={{
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: 'var(--muted)', fontFamily: 'var(--font-body)',
                }}>{l}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: c, lineHeight: 1 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
          {(['findings', 'history'] as const).map(tab => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                style={{
                  padding: '8px 16px', fontSize: 12.5,
                  color: active ? 'var(--fg)' : 'var(--muted)',
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  fontWeight: active ? 500 : 400,
                  fontFamily: 'var(--font-body)',
                  background: 'none', border: 'none', borderRadius: 0,
                  cursor: 'pointer',
                }}
              >
                {tab === 'findings' ? `Findings · ${findings.length}` : `Run history · ${history.length}`}
              </button>
            );
          })}
        </div>

        {/* Tab body */}
        {activeTab === 'history' ? (
          <HistoryList
            history={history}
            historyLoading={historyLoading}
            currentReportId={report.report_id}
            onSelect={onSelectHistorical}
          />
        ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {findings.map((f) => {
            const isSel = f.id === (selId ?? findings[0]?.id);
            return (
              <div
                key={f.id}
                onClick={() => onSelect(f.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 16px', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: isSel ? 'var(--accent-soft)' : 'transparent',
                  borderLeft: `3px solid ${SEVER_COLOR[f.severity]}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--fg)' }}>
                      {f.field}
                    </span>
                    <span style={{
                      ...tagStyle, background: SEVER_BG[f.severity], color: SEVER_COLOR[f.severity],
                      borderColor: 'transparent',
                    }}>{f.category.replace(/_/g, ' ')}</span>
                    {f.diff !== 'existing' && (
                      <span style={{
                        fontSize: 10, color: DIFF_COLOR[f.diff],
                        marginLeft: 'auto', flexShrink: 0, fontWeight: 500,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        fontFamily: 'var(--font-body)',
                      }}>{f.diff}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
                    {f.summary}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{f.affected.toLocaleString()}</span>
                    {' / '}{f.total.toLocaleString()} docs affected ({f.affected_pct.toFixed(1)}%)
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* RIGHT — detail */}
      <aside style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: SEVER_COLOR[sel.severity] }}>
              {sel.field}
            </span>
            <span style={{ ...tagStyle, background: SEVER_BG[sel.severity], color: SEVER_COLOR[sel.severity], borderColor: 'transparent', fontSize: 10.5 }}>
              {sel.category.replace(/_/g, ' ')}
            </span>
            <span style={{ ...tagStyle, background: SEVER_BG[sel.severity], color: SEVER_COLOR[sel.severity], borderColor: 'transparent', fontSize: 10.5 }}>
              {sel.severity}
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: 10.5, fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: DIFF_COLOR[sel.diff], fontFamily: 'var(--font-body)',
            }}>{sel.diff}</span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
            {sel.description}
          </p>
          <div style={{
            marginTop: 8, fontSize: 11.5, color: 'var(--muted)',
            display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-body)',
          }}>
            <span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)', fontWeight: 500 }}>
                {sel.affected.toLocaleString()}
              </span>{' '}docs affected
            </span>
            <span>·</span>
            <span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)' }}>
                {sel.affected_pct.toFixed(1)}%
              </span>{' '}of collection
            </span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={sectionLabel}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M2 8h8M2 12h5" />
              </svg>
              Evidence query
            </div>
            <pre style={{
              margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.65,
              background: 'var(--soft)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px',
              whiteSpace: 'pre-wrap', overflow: 'auto', color: 'var(--fg)',
            }}>{sel.evidence}</pre>
          </div>

          <div>
            <div style={sectionLabel}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8l3 3 7-7" />
              </svg>
              ReAct trace
            </div>
            <pre style={{
              margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7,
              background: 'var(--soft)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px',
              whiteSpace: 'pre-wrap', overflow: 'auto', color: 'var(--muted)',
            }}>{sel.trace || '(no trace lines matched this field)'}</pre>
          </div>
        </div>
      </aside>
    </div>
  );
};

const localPart = (email: string | null) =>
  email ? email.split('@')[0] : 'unknown';

const HistoryList: React.FC<{
  history: ArgusRunSummary[];
  historyLoading: boolean;
  currentReportId?: string;
  onSelect: (reportId: string) => void;
}> = ({ history, historyLoading, currentReportId, onSelect }) => {
  if (historyLoading && history.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12.5, fontFamily: 'var(--font-body)' }}>
        Loading run history…
      </div>
    );
  }
  if (history.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12.5, fontFamily: 'var(--font-body)' }}>
        No prior runs for this collection yet.
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {history.map((row) => {
        const isCurrent = row.report_id === currentReportId;
        const score = row.quality_score;
        const scoreColor = score == null
          ? 'var(--muted)'
          : score >= 80 ? '#3a8c5f' : score >= 60 ? '#c98d42' : '#c94250';
        return (
          <div
            key={row.report_id}
            onClick={() => onSelect(row.report_id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: isCurrent ? 'var(--accent-soft)' : 'transparent',
              fontFamily: 'var(--font-body)',
            }}
          >
            <div style={{
              width: 32, textAlign: 'center', fontFamily: 'var(--font-display)',
              fontSize: 18, fontWeight: 500, color: scoreColor, flexShrink: 0,
            }}>
              {score ?? '—'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--fg)' }}>
                {row.run_at ? new Date(row.run_at).toLocaleString() : '—'}
                {isCurrent && (
                  <span style={{ ...tagStyle, marginLeft: 8, fontSize: 10 }}>current</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{localPart(row.created_by)}</span>
                {' · '}{row.findings_count} findings
                {' · '}{row.total_tokens.toLocaleString()} tokens
                {row.run_eval_verdict && <> · <span>{row.run_eval_verdict}</span></>}
              </div>
            </div>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--muted)', flexShrink: 0 }}>
              <path d="M6 4l4 4-4 4" />
            </svg>
          </div>
        );
      })}
    </div>
  );
};

const PreRunHistory: React.FC<{
  history: ArgusRunSummary[];
  historyLoading: boolean;
  onSelect: (reportId: string) => void;
}> = ({ history, historyLoading, onSelect }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <div style={{
      padding: '12px 18px 8px', fontSize: 11,
      color: 'var(--muted)', fontFamily: 'var(--font-body)',
      borderBottom: '1px solid var(--border)',
    }}>
      Prior runs for this collection — pick one to load, or press Run to start a fresh audit.
    </div>
    <HistoryList history={history} historyLoading={historyLoading} onSelect={onSelect} />
  </div>
);

export default AnalyticsPage;
