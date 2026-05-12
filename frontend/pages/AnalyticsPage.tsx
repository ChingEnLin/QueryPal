import React from 'react';
import AppLayout from '../components/AppLayout';

/* Static demo data matching the design's QP_DATA shape */
const runs14d = [42, 38, 51, 47, 55, 49, 62, 58, 71, 67, 74, 69, 82, 78];
const fails14d = [3, 2, 4, 3, 5, 4, 6, 3, 5, 4, 7, 5, 4, 6];
const studiesByMonth = [78, 84, 72, 91, 103, 118, 127, 134, 142, 128, 151, 164];
const MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
const BY_DEPT = [
  { name: 'Cardiac', count: 524, pct: 43 },
  { name: 'Ortho', count: 318, pct: 26 },
  { name: 'Vascular', count: 187, pct: 15 },
  { name: 'Neuro', count: 142, pct: 12 },
  { name: 'Other', count: 76, pct: 4 },
];
const DEPT_COLORS = ['var(--accent)', '#7c8a4a', '#4a7c8a', '#8a4a7c', '#a89070'];

const SCATTER = [
  { x: 0.8, y: 1.94, ok: true }, { x: 1.2, y: 2.14, ok: true }, { x: 1.6, y: 1.71, ok: true },
  { x: 2.0, y: 1.42, ok: false }, { x: 0.4, y: 2.62, ok: true }, { x: 1.0, y: 2.04, ok: true },
  { x: 1.8, y: 1.62, ok: false }, { x: 2.4, y: 1.18, ok: false }, { x: 0.6, y: 2.81, ok: true },
  { x: 1.4, y: 1.88, ok: true }, { x: 2.2, y: 1.51, ok: false }, { x: 0.9, y: 2.32, ok: true },
  { x: 1.1, y: 2.21, ok: true }, { x: 1.7, y: 1.55, ok: false }, { x: 0.5, y: 2.94, ok: true },
];

/* ── Sparkline (140×36 SVG) ── */
const Sparkline: React.FC<{ data: number[]; color?: string; fill?: boolean }> = ({
  data, color = 'var(--accent)', fill = true,
}) => {
  const W = 140, H = 36, pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (W - pad * 2),
    y: H - pad - ((v - min) / range) * (H - pad * 2),
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const fillPath = `${path} L${pts[pts.length - 1].x},${H} L${pts[0].x},${H} Z`;
  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      {fill && (
        <defs>
          <linearGradient id={`sg-${color.replace(/[^a-z]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2"/>
            <stop offset="100%" stopColor={color} stopOpacity="0"/>
          </linearGradient>
        </defs>
      )}
      {fill && <path d={fillPath} fill={`url(#sg-${color.replace(/[^a-z]/gi, '')})`}/>}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
};

/* ── Area chart (full width) ── */
const AreaChart: React.FC<{ data: number[]; labels: string[] }> = ({ data, labels }) => {
  const W = 600, H = 160, padL = 36, padB = 24, padR = 16, padT = 12;
  const iW = W - padL - padR, iH = H - padB - padT;
  const min = 0, max = Math.max(...data) * 1.1;
  const xs = data.map((_, i) => padL + (i / (data.length - 1)) * iW);
  const ys = data.map((v) => padT + iH - ((v - min) / (max - min)) * iH);
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const fillPath = `${path} L${xs[xs.length - 1]},${padT + iH} L${xs[0]},${padT + iH} Z`;
  const yTicks = [0, Math.round(max * 0.25), Math.round(max * 0.5), Math.round(max * 0.75), Math.round(max)];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      <defs>
        <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {yTicks.map((t) => {
        const y = padT + iH - ((t - min) / (max - min)) * iH;
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--border)" strokeWidth="1"/>
            <text x={padL - 4} y={y + 3.5} textAnchor="end" fontSize="9" fill="var(--muted)">{t}</text>
          </g>
        );
      })}
      {/* X labels */}
      {xs.map((x, i) => (
        <text key={i} x={x} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--muted)">{labels[i]}</text>
      ))}
      <path d={fillPath} fill="url(#area-fill)"/>
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Dots on last point */}
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="4" fill="var(--accent)" stroke="var(--panel)" strokeWidth="2"/>
    </svg>
  );
};

/* ── Donut chart ── */
const DonutChart: React.FC<{ data: typeof BY_DEPT }> = ({ data }) => {
  const R = 52, cx = 70, cy = 70, strokeW = 20;
  const total = data.reduce((s, d) => s + d.count, 0);
  let angle = -Math.PI / 2;
  const arcs = data.map((d, i) => {
    const sweep = (d.count / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle);
    const y1 = cy + R * Math.sin(angle);
    angle += sweep;
    const x2 = cx + R * Math.cos(angle);
    const y2 = cy + R * Math.sin(angle);
    return { x1, y1, x2, y2, sweep, large: sweep > Math.PI ? 1 : 0, color: DEPT_COLORS[i], ...d };
  });
  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        {arcs.map((a, i) => {
          const d = `M${a.x1.toFixed(2)},${a.y1.toFixed(2)} A${R},${R} 0 ${a.large},1 ${a.x2.toFixed(2)},${a.y2.toFixed(2)}`;
          return <path key={i} d={d} fill="none" stroke={a.color} strokeWidth={strokeW} strokeLinecap="butt"/>;
        })}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="18" fontWeight="500" fill="var(--fg)" fontFamily="var(--font-display)">{total.toLocaleString()}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="9" fill="var(--muted)">studies</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {arcs.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color, flexShrink: 0 }}/>
            <span style={{ color: 'var(--muted)' }}>{a.name}</span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg)' }}>{a.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Scatter plot ── */
const ScatterPlot: React.FC<{ data: typeof SCATTER }> = ({ data }) => {
  const W = 260, H = 160, padL = 36, padB = 28, padR = 16, padT = 12;
  const iW = W - padL - padR, iH = H - padB - padT;
  const xMin = 0, xMax = 2.8, yMin = 1, yMax = 3.2;
  const toX = (v: number) => padL + ((v - xMin) / (xMax - xMin)) * iW;
  const toY = (v: number) => padT + iH - ((v - yMin) / (yMax - yMin)) * iH;
  const thresholdY = toY(2.0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
      {/* Threshold line */}
      <line x1={padL} y1={thresholdY} x2={W - padR} y2={thresholdY} stroke="var(--status-err)" strokeWidth="1" strokeDasharray="4 3"/>
      <text x={W - padR + 2} y={thresholdY + 3} fontSize="8" fill="var(--status-err)">SF 2.0</text>
      {/* Axes */}
      <line x1={padL} y1={padT} x2={padL} y2={padT + iH} stroke="var(--border)" strokeWidth="1"/>
      <line x1={padL} y1={padT + iH} x2={W - padR} y2={padT + iH} stroke="var(--border)" strokeWidth="1"/>
      <text x={padL - 4} y={padT + 4} textAnchor="end" fontSize="8" fill="var(--muted)">SF</text>
      <text x={(padL + W - padR) / 2} y={H - 2} textAnchor="middle" fontSize="8" fill="var(--muted)">Mesh size (M elements)</text>
      {/* Points */}
      {data.map((pt, i) => (
        <circle
          key={i}
          cx={toX(pt.x)} cy={toY(pt.y)} r="4"
          fill={pt.ok ? 'var(--accent)' : 'var(--status-err)'}
          fillOpacity="0.7"
          stroke={pt.ok ? 'var(--accent)' : 'var(--status-err)'}
          strokeWidth="1"
        />
      ))}
    </svg>
  );
};

/* ── KPI card ── */
const KpiCard: React.FC<{
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  sparkData?: number[];
  sparkColor?: string;
}> = ({ label, value, delta, positive, sparkData, sparkColor }) => (
  <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
      <div>
        <div style={{ fontSize: 26, fontWeight: 500, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
        {delta && (
          <div style={{ fontSize: 11.5, color: positive ? 'var(--accent)' : 'var(--status-err)', marginTop: 4 }}>
            {positive ? '↑' : '↓'} {delta} vs prev 14d
          </div>
        )}
      </div>
      {sparkData && <Sparkline data={sparkData} color={sparkColor || 'var(--accent)'} fill />}
    </div>
  </div>
);

/* ──────────────────────────────────────────────────────────── */

const AnalyticsPage: React.FC = () => {
  const totalRuns = runs14d.reduce((a, b) => a + b, 0);
  const totalFails = fails14d.reduce((a, b) => a + b, 0);

  return (
    <AppLayout>
      <div style={{ padding: '28px 32px', maxWidth: 1100, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, letterSpacing: '-0.02em', margin: 0 }}>
              Analytics
            </h1>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '4px 0 0' }}>
              Last updated · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button className="qa-btn">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 8A6 6 0 112 8M14 8l-2-2M14 8l-2 2"/>
            </svg>
            Refresh
          </button>
        </div>

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <KpiCard label="Studies run (14d)" value={totalRuns.toLocaleString()} delta="12%" positive sparkData={runs14d} />
          <KpiCard label="Diverged (14d)" value={totalFails.toLocaleString()} delta="8%" positive={false} sparkData={fails14d} sparkColor="var(--status-err)" />
          <KpiCard label="Avg safety factor" value="1.92" delta="0.07" positive={false} sparkData={runs14d.map(v => v / 40 + 1.6)} />
          <KpiCard label="Avg runtime" value="3h 24m" delta="11m" positive sparkData={runs14d.map(v => v / 82 * 3.6 + 1.2)} />
        </div>

        {/* Charts row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, marginBottom: 20 }}>
          {/* Area chart */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 22 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 14, color: 'var(--fg)' }}>Studies completed by month</div>
            <AreaChart data={studiesByMonth} labels={MONTHS} />
          </div>
          {/* Donut */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 22, minWidth: 260 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 14, color: 'var(--fg)' }}>By department</div>
            <DonutChart data={BY_DEPT} />
          </div>
        </div>

        {/* Charts row 2 */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 22, maxWidth: 380 }}>
          <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 14, color: 'var(--fg)' }}>Mesh size vs. safety factor</div>
          <ScatterPlot data={SCATTER} />
        </div>
      </div>
    </AppLayout>
  );
};

export default AnalyticsPage;
