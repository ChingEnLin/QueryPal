import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import type { ArgusRunSummary } from '../services/argusService';

interface Props {
  history: ArgusRunSummary[];
  currentReportId?: string;
  onSelectRun?: (reportId: string) => void;
}

interface ChartRow {
  idx: number;
  label: string;
  fullDate: string;
  critical: number;
  warning: number;
  info: number;
  findings: number;
  confidence: number | null;
  tokens: number;
  reportId: string;
  verdict: string | null;
}

const SEVER = {
  critical: { color: '#c94250', bg: '#fdf0f1', label: 'Critical' },
  warning: { color: '#c98d42', bg: '#fdf6ed', label: 'Warning' },
  info: { color: 'var(--muted)', bg: 'var(--soft)', label: 'Info' },
} as const;

const formatShortDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const formatFullDate = (iso: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
};

const confidenceColor = (score: number | null): string => {
  if (score == null) return 'var(--muted)';
  if (score >= 80) return '#3a8c5f';
  if (score >= 60) return '#c98d42';
  return '#c94250';
};

const InfoDot: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label={`About ${title}`}
        style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '1px solid var(--border)', background: 'var(--soft)',
          color: 'var(--muted)', cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontFamily: 'var(--font-body)', lineHeight: 1, fontWeight: 600,
        }}
      >?</button>
      {open && (
        <div role="dialog" style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          zIndex: 200, width: 280,
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          padding: '10px 12px', fontFamily: 'var(--font-body)',
          textTransform: 'none', letterSpacing: 'normal',
        }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg)', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--muted)' }}>{children}</div>
        </div>
      )}
    </span>
  );
};

const SeverityTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 10px',
      fontFamily: 'var(--font-body)',
      fontSize: 11.5,
      color: 'var(--fg)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      minWidth: 160,
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 6, fontSize: 11 }}>{row.fullDate}</div>
      {(['critical', 'warning', 'info'] as const).map((k) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
          <span style={{ color: SEVER[k].color }}>● {SEVER[k].label}</span>
          <span>{row[k]}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
        <span style={{ color: 'var(--muted)' }}>Total</span>
        <span>{row.findings}</span>
      </div>
    </div>
  );
};

const ConfidenceTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 10px',
      fontFamily: 'var(--font-body)',
      fontSize: 11.5,
      color: 'var(--fg)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 4, fontSize: 11 }}>{row.fullDate}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: confidenceColor(row.confidence) }}>
        {row.confidence == null ? '—' : `${row.confidence.toFixed(0)} / 100`}
      </div>
      {row.verdict && (
        <div style={{ color: 'var(--muted)', marginTop: 4, fontSize: 10.5 }}>{row.verdict}</div>
      )}
    </div>
  );
};

const TokensTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 10px',
      fontFamily: 'var(--font-body)',
      fontSize: 11.5,
      color: 'var(--fg)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <div style={{ color: 'var(--muted)', marginBottom: 4, fontSize: 11 }}>{row.fullDate}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        {row.tokens.toLocaleString()} tokens
      </div>
    </div>
  );
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10.5,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--muted)',
  fontFamily: 'var(--font-body)',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const cardStyle: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 220,
};

const axisProps = {
  stroke: 'var(--muted)',
  tick: { fontSize: 10.5, fill: 'var(--muted)', fontFamily: 'var(--font-mono)' as const },
  tickLine: false,
  axisLine: { stroke: 'var(--border)' as const },
};

export const ArgusTrendsPanel: React.FC<Props> = ({ history, currentReportId, onSelectRun }) => {
  const rows: ChartRow[] = useMemo(() => {
    return [...history]
      .filter((r) => r.run_at != null)
      .sort((a, b) => new Date(a.run_at!).getTime() - new Date(b.run_at!).getTime())
      .map((r, i) => {
        // Fall back when older runs don't have per-severity counts cached.
        const c = r.counts ?? { critical: 0, warning: 0, info: r.findings_count };
        return {
          idx: i,
          label: formatShortDate(r.run_at),
          fullDate: formatFullDate(r.run_at),
          critical: c.critical,
          warning: c.warning,
          info: c.info,
          findings: r.findings_count,
          confidence: r.quality_score,
          tokens: r.total_tokens,
          reportId: r.report_id,
          verdict: r.run_eval_verdict,
        };
      });
  }, [history]);

  if (rows.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--muted)', fontSize: 12.5, fontFamily: 'var(--font-body)',
      }}>
        No runs to plot yet. Trends appear once this collection has at least one persisted run.
      </div>
    );
  }

  if (rows.length === 1) {
    const r = rows[0];
    return (
      <div style={{ flex: 1, padding: 16, fontFamily: 'var(--font-body)', color: 'var(--muted)', fontSize: 12.5 }}>
        Only one run on record ({r.fullDate}). Trends need at least two runs — kick off another audit to see history develop.
      </div>
    );
  }

  const latest = rows[rows.length - 1];
  const first = rows[0];
  const criticalDelta = latest.critical - first.critical;
  const findingsDelta = latest.findings - first.findings;
  const tokensTotal = rows.reduce((acc, r) => acc + r.tokens, 0);
  const confidenceLatest = latest.confidence;

  const handleBarClick = (data: unknown) => {
    const row = (data as { payload?: ChartRow } | undefined)?.payload;
    if (row?.reportId && onSelectRun) onSelectRun(row.reportId);
  };

  const summaryItem = (
    label: React.ReactNode,
    value: React.ReactNode,
    hint?: React.ReactNode,
  ) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={sectionLabel}>{label}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--fg)', lineHeight: 1 }}>{value}</span>
      {hint && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>{hint}</span>}
    </div>
  );

  const fmtDelta = (n: number) => `${n >= 0 ? '+' : ''}${n}`;
  const deltaColorBad = (n: number) =>
    n > 0 ? '#c94250' : n < 0 ? '#3a8c5f' : 'var(--muted)';

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Summary strip — leads with collection-health metrics, audit confidence is last */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
      }}>
        {summaryItem(
          'Runs',
          rows.length,
          `${first.label} → ${latest.label}`,
        )}
        {summaryItem(
          <>Critical now</>,
          <span style={{ color: latest.critical > 0 ? SEVER.critical.color : 'var(--fg)' }}>
            {latest.critical}
          </span>,
          <span style={{ color: deltaColorBad(criticalDelta) }}>
            {fmtDelta(criticalDelta)} vs first
          </span>,
        )}
        {summaryItem(
          'Findings now',
          latest.findings,
          <span style={{ color: deltaColorBad(findingsDelta) }}>
            {fmtDelta(findingsDelta)} vs first
          </span>,
        )}
        {summaryItem(
          <>
            Audit confidence
            <InfoDot title="Audit confidence ≠ data quality">
              The confidence score grades how reliable each audit was (did it cover enough fields,
              run enough iterations, etc.) — not how clean your data is. A perfect-confidence run
              can still surface critical findings, and a noisy audit can miss real ones.
            </InfoDot>
          </>,
          <span style={{ color: confidenceColor(confidenceLatest), fontSize: 18 }}>
            {confidenceLatest == null ? '—' : `${confidenceLatest.toFixed(0)} / 100`}
          </span>,
          'latest run',
        )}
        {summaryItem('Tokens used', tokensTotal.toLocaleString(), 'cumulative')}
      </div>

      {/* PRIMARY — findings by severity over time (the actual data-quality signal) */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={sectionLabel}>
            <span>Findings by severity over time</span>
            <InfoDot title="What this chart shows">
              Each bar is one persisted audit, stacked by severity (critical / warning / info). Use
              this to see whether your collection is trending toward more or fewer issues. This is
              the data-quality trend.
            </InfoDot>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 10.5, fontFamily: 'var(--font-body)', color: 'var(--muted)' }}>
            {(['critical', 'warning', 'info'] as const).map((k) => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: SEVER[k].color }} />
                {SEVER[k].label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" {...axisProps} />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip content={<SeverityTooltip />} cursor={{ fill: 'var(--accent-soft)' }} />
              <Bar
                dataKey="info"
                stackId="sev"
                fill={SEVER.info.color === 'var(--muted)' ? '#9aa0a6' : SEVER.info.color}
                radius={[0, 0, 0, 0]}
                isAnimationActive={false}
                onClick={handleBarClick}
                cursor={onSelectRun ? 'pointer' : 'default'}
              />
              <Bar
                dataKey="warning"
                stackId="sev"
                fill={SEVER.warning.color}
                radius={[0, 0, 0, 0]}
                isAnimationActive={false}
                onClick={handleBarClick}
                cursor={onSelectRun ? 'pointer' : 'default'}
              />
              <Bar
                dataKey="critical"
                stackId="sev"
                fill={SEVER.critical.color}
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
                onClick={handleBarClick}
                cursor={onSelectRun ? 'pointer' : 'default'}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* SECONDARY — audit confidence and tokens side by side, smaller */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={{ ...cardStyle, minHeight: 180 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={sectionLabel}>
              <span>Audit confidence per run</span>
              <InfoDot title="Read this as: how reliable were the audits?">
                Reflects the run evaluator's view of each audit — coverage, iterations, calibration.
                A dip here means a less-trustworthy audit, <em>not</em> dirtier data. Don't read this
                line as a quality trend for the collection.
              </InfoDot>
            </div>
            <span style={{ fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
              not a data-quality metric
            </span>
          </div>
          <div style={{ flex: 1, minHeight: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis domain={[0, 100]} {...axisProps} />
                <Tooltip content={<ConfidenceTooltip />} cursor={{ stroke: 'var(--accent)', strokeOpacity: 0.3 }} />
                <ReferenceLine y={80} stroke="#3a8c5f" strokeDasharray="2 4" strokeOpacity={0.5} />
                <ReferenceLine y={60} stroke="#c98d42" strokeDasharray="2 4" strokeOpacity={0.5} />
                <Line
                  type="monotone"
                  dataKey="confidence"
                  stroke="var(--muted)"
                  strokeWidth={1.5}
                  dot={(props: { cx?: number; cy?: number; payload?: ChartRow }) => {
                    const { cx, cy, payload } = props;
                    if (cx == null || cy == null || !payload) return <g />;
                    const isCurrent = payload.reportId === currentReportId;
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isCurrent ? 4.5 : 3}
                        fill={isCurrent ? 'var(--accent)' : 'var(--panel)'}
                        stroke={isCurrent ? 'var(--accent)' : 'var(--muted)'}
                        strokeWidth={1.5}
                      />
                    );
                  }}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ ...cardStyle, minHeight: 180 }}>
          <div style={sectionLabel}>Tokens per run</div>
          <div style={{ flex: 1, minHeight: 140, marginTop: 6 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 4, left: -4 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis
                  {...axisProps}
                  tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip content={<TokensTooltip />} cursor={{ fill: 'var(--accent-soft)' }} />
                <Bar
                  dataKey="tokens"
                  fill="var(--accent)"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                  onClick={handleBarClick}
                  cursor={onSelectRun ? 'pointer' : 'default'}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {onSelectRun && (
        <div style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)', textAlign: 'center' }}>
          Click any bar to open that run.
        </div>
      )}
    </div>
  );
};
