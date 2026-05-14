import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement,
  PointElement, LineElement,
  PolarAreaController, RadarController,
  DoughnutController, PieController,
  BarController, LineController,
  ScatterController, BubbleController,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { AnalysisResult } from '../types';
import { useTheme } from '../contexts/ThemeContext';

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend, ArcElement,
  PointElement, LineElement,
  PolarAreaController, RadarController,
  DoughnutController, PieController,
  BarController, LineController,
  ScatterController, BubbleController,
);

interface AnalysisResultDisplayProps {
  result: AnalysisResult;
}

const SparkleIcon = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round">
    <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M3.05 12.95l2.12-2.12M10.83 5.17l2.12-2.12" />
  </svg>
);

const CHART_TYPE_LABELS: Record<string, string> = {
  bar: 'Bar chart',
  line: 'Line chart',
  pie: 'Pie chart',
  doughnut: 'Doughnut chart',
  polarArea: 'Polar area',
  radar: 'Radar chart',
  scatter: 'Scatter plot',
  bubble: 'Bubble chart',
};

const AnalysisResultDisplay: React.FC<AnalysisResultDisplayProps> = ({ result }) => {
  const { theme } = useTheme();

  const themedChartOptions = React.useMemo(() => {
    const isDark = theme === 'dark';
    const textColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
    const base = result.chartOptions || {};

    return {
      ...base,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        ...base.plugins,
        legend: {
          ...base.plugins?.legend,
          labels: {
            ...base.plugins?.legend?.labels,
            color: textColor,
            font: { family: 'Geist, sans-serif', size: 11 },
            boxWidth: 10,
            padding: 14,
          },
        },
        title: { ...base.plugins?.title, color: textColor },
        tooltip: {
          ...base.plugins?.tooltip,
          backgroundColor: isDark ? 'rgba(30,30,36,0.95)' : 'rgba(255,255,255,0.98)',
          titleColor: isDark ? '#e2e8f0' : '#1e293b',
          bodyColor: isDark ? '#94a3b8' : '#475569',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          titleFont: { family: 'Geist, sans-serif', size: 12, weight: '600' },
          bodyFont: { family: 'Geist Mono, monospace', size: 11 },
        },
      },
      scales: {
        x: {
          ...base.scales?.x,
          ticks: { ...base.scales?.x?.ticks, color: textColor, font: { family: 'Geist Mono, monospace', size: 10 } },
          grid: { ...base.scales?.x?.grid, color: gridColor },
          border: { color: gridColor },
          title: { ...base.scales?.x?.title, color: textColor },
        },
        y: {
          ...base.scales?.y,
          ticks: { ...base.scales?.y?.ticks, color: textColor, font: { family: 'Geist Mono, monospace', size: 10 } },
          grid: { ...base.scales?.y?.grid, color: gridColor },
          border: { color: gridColor },
          title: { ...base.scales?.y?.title, color: textColor },
        },
      },
    };
  }, [result.chartOptions, theme]);

  const chartLabel = CHART_TYPE_LABELS[result.chartType] ?? result.chartType;

  return (
    <div
      className="qa-card"
      style={{ padding: 0, overflow: 'hidden', animation: 'fadeIn 0.25s' }}
    >
      {/* Header — matches QueryResult card header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <span style={{
          width: 24, height: 24, borderRadius: 6, flexShrink: 0,
          background: 'var(--accent-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SparkleIcon />
        </span>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
          AI Analysis
        </span>
        <span className="qa-chip accent" style={{ textTransform: 'capitalize', marginLeft: 2 }}>
          {chartLabel}
        </span>
      </div>

      {/* Body — insight + chart side by side */}
      <div style={{ display: 'flex', minHeight: 320 }}>
        {/* Insight panel */}
        <div style={{
          width: 220, flexShrink: 0,
          padding: '16px 18px',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 10,
          background: 'var(--soft)',
        }}>
          <div style={{
            fontSize: 10.5, fontWeight: 500,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: 'var(--muted)', fontFamily: 'var(--font-body)',
          }}>
            Insight
          </div>
          <p style={{
            fontSize: 13, color: 'var(--fg)', lineHeight: 1.65,
            fontFamily: 'var(--font-body)', margin: 0,
          }}>
            {result.insight}
          </p>
        </div>

        {/* Chart panel */}
        <div style={{ flex: 1, padding: '20px 24px', position: 'relative', minWidth: 0 }}>
          <Chart
            type={result.chartType}
            data={result.chartData}
            options={themedChartOptions}
          />
        </div>
      </div>
    </div>
  );
};

export default AnalysisResultDisplay;
