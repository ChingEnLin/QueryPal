import React, { useMemo, useState } from 'react';
import { CollectionSummary } from '../types';
import {
  ArgusDiff,
  ArgusFinding,
  ArgusProfile,
  ArgusReport,
  ArgusSeverity,
  runArgusAudit,
} from '../services/argusService';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);

  const findings = report?.findings ?? [];
  const sel: ArgusFinding | null = useMemo(() => {
    if (!findings.length) return null;
    return findings.find((f) => f.id === selId) ?? findings[0];
  }, [findings, selId]);

  const runAudit = async () => {
    if (!accountId || !databaseName || !collection) return;
    setLoading(true);
    setError(null);
    setReport(null);
    setSelId(null);
    try {
      const r = await runArgusAudit({
        accountId,
        database: databaseName,
        collection,
        profile,
      });
      setReport(r);
      setSelId(r.findings[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
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
          <div style={{
            display: 'flex', background: 'var(--soft)', borderRadius: 6,
            border: '1px solid var(--border)', padding: 2, gap: 1,
          }}>
            {(['fast', 'balanced', 'thorough'] as ArgusProfile[]).map((p) => (
              <span
                key={p}
                onClick={() => setProfile(p)}
                style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11.5,
                  background: p === profile ? 'var(--panel)' : 'transparent',
                  boxShadow: p === profile ? '0 0 0 1px var(--border)' : 'none',
                  color: p === profile ? 'var(--fg)' : 'var(--muted)',
                  cursor: 'pointer', fontFamily: 'var(--font-body)',
                }}
              >{p}</span>
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
      ) : !report && !loading ? (
        <EmptyState
          title="Run an audit"
          body={`QueryArgus will sample ${collection || 'a collection'} and report data-quality findings. Pick a profile and press Run.`}
        />
      ) : loading && !report ? (
        <EmptyState title="Running audit…" body="The ReAct agent is sampling, querying, and writing findings. This usually takes 20–90 seconds depending on profile." />
      ) : report && sel ? (
        <ReportBody
          report={report}
          findings={findings}
          sel={sel}
          selId={selId ?? findings[0]?.id ?? null}
          onSelect={setSelId}
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
}> = ({ report, findings, sel, selId, onSelect }) => {
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

        {/* Tab bar (history deferred) */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
          <div style={{
            padding: '8px 16px', fontSize: 12.5, color: 'var(--fg)',
            borderBottom: '2px solid var(--accent)', fontWeight: 500,
            fontFamily: 'var(--font-body)',
          }}>
            Findings · {findings.length}
          </div>
          <div style={{
            padding: '8px 16px', fontSize: 12.5, color: 'var(--muted)',
            borderBottom: '2px solid transparent', cursor: 'not-allowed',
            fontFamily: 'var(--font-body)',
          }} title="Run history requires ReportStore persistence (not yet wired).">
            Run history
          </div>
        </div>

        {/* Findings list */}
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

export default AnalyticsPage;
