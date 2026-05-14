import React from 'react';

interface AnalyticsPageProps {
  accountId?: string;
  databaseName?: string;
}

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ accountId, databaseName }) => {
  const hasConnection = !!(accountId && databaseName);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', minHeight: 0,
    }}>
      {/* Page header */}
      <div style={{
        padding: '20px 28px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--panel)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'var(--accent-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.4">
              <path d="M2 13h12M4 11V6M7 11V3M10 11V8M13 11V5"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
              Analytics
            </div>
            {hasConnection && (
              <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                {databaseName}
              </div>
            )}
          </div>
          <span className="qa-chip accent" style={{ marginLeft: 6 }}>Coming soon</span>
        </div>
      </div>

      {/* Coming soon body */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 32px',
      }}>
        <div style={{
          maxWidth: 560, width: '100%',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32,
          textAlign: 'center',
        }}>
          {/* Icon cluster */}
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20,
              background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18h18M6 14V9M9 14V5M12 14v-3M15 14V7M18 14v-6"/>
              </svg>
            </div>
            {/* Small badge */}
            <div style={{
              position: 'absolute', bottom: -6, right: -6,
              width: 24, height: 24, borderRadius: 8,
              background: 'var(--panel)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6"/><path d="M8 5v4M8 10.5v.5"/>
              </svg>
            </div>
          </div>

          {/* Heading */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h2 style={{
              fontSize: 22, fontWeight: 600, margin: 0,
              fontFamily: 'var(--font-display)', color: 'var(--fg)',
              letterSpacing: '-0.02em',
            }}>
              Database Audit & Insights
            </h2>
            <p style={{
              fontSize: 13.5, color: 'var(--muted)', margin: 0, lineHeight: 1.6,
              fontFamily: 'var(--font-body)',
            }}>
              {"This tab will surface automated collection audits powered by "}
              <span style={{ color: 'var(--fg)', fontWeight: 500 }}>QueryArgus</span>
              {" — an AI agent that analyses your collections for schema inconsistencies, missing indexes, high-cardinality fields, and query performance opportunities."}
            </p>
          </div>

          {/* Feature preview cards */}
          <div style={{
            width: '100%', display: 'grid',
            gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            {[
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M3 2h7l3 3v9H3z"/><path d="M6 7h5M6 9h5M6 11h3"/>
                  </svg>
                ),
                title: 'Schema findings',
                desc: 'Inconsistent field types, sparse fields, and structural anomalies across documents.',
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M2 13h12M4 11V6M7 11V3M10 11V8M13 11V5"/>
                  </svg>
                ),
                title: 'Performance insights',
                desc: 'Missing index recommendations, high-cardinality fields, and costly query patterns.',
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <circle cx="8" cy="8" r="6"/><path d="M8 5v3.5L10 10"/>
                  </svg>
                ),
                title: 'Audit history',
                desc: 'Track findings over time to measure how your database health evolves.',
              },
              {
                icon: (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <path d="M8 1L15 14H1L8 1z"/><path d="M8 6v4M8 11.5v.5"/>
                  </svg>
                ),
                title: 'Severity scoring',
                desc: 'Each finding is evaluated and scored so you can triage the most impactful issues first.',
              },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', flexDirection: 'column', gap: 6,
                textAlign: 'left',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ color: 'var(--accent)', display: 'flex', flexShrink: 0 }}>{icon}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
                    {title}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.5, fontFamily: 'var(--font-body)' }}>
                  {desc}
                </p>
              </div>
            ))}
          </div>

          {/* Context note */}
          {hasConnection ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 8,
              background: 'var(--accent-soft)',
              border: '1px solid color-mix(in oklch, var(--accent) 20%, var(--border))',
            }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5.5v.5"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--font-body)' }}>
                {"When available, audits will run against "}
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{databaseName}</span>
                {" — no reconnection needed."}
              </span>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 8,
              background: 'var(--soft)',
              border: '1px solid var(--border)',
            }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5.5v.5"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
                Connect to a database from Workspace or Explorer first, then return here to run an audit.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
