import React, { useState } from 'react';
import {
  ArgusEscalationVerdict,
  resolveArgusEscalation,
} from '../services/argusService';
import { useNotifications } from '../contexts/NotificationsContext';

/**
 * Arm B — modal review surface for pending_review escalations.
 *
 * Opens from the topbar notification dropdown. Walks the user through one
 * escalation at a time so they can land a verdict (TP / FP / Need info)
 * without context-switching to the Analytics page. Refreshes the queue after
 * each action so the next pending finding pops up immediately.
 */
export const EscalationReviewModal: React.FC<{
  open: boolean;
  onClose: () => void;
}> = ({ open, onClose }) => {
  const { pendingEscalations, refreshEscalations } = useNotifications();
  const [busy, setBusy] = useState<ArgusEscalationVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);

  // Reset to the first item whenever the queue length shrinks (resolve) or
  // grows past the current cursor (new arrivals).
  React.useEffect(() => {
    if (cursor >= pendingEscalations.length) setCursor(0);
  }, [pendingEscalations.length, cursor]);

  if (!open) return null;

  const current = pendingEscalations[cursor] ?? null;

  const resolve = async (verdict: ArgusEscalationVerdict) => {
    if (!current || busy) return;
    setBusy(verdict);
    setError(null);
    try {
      await resolveArgusEscalation({
        reportId: current.report_id,
        findingId: current.finding_id,
        verdict,
      });
      await refreshEscalations();
      // Cursor stays — refresh shifts the next pending item into this slot.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 100%)', maxHeight: '85vh',
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          fontFamily: 'var(--font-body)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg)' }}>
            Argus escalations
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            {pendingEscalations.length === 0
              ? 'queue empty'
              : `${cursor + 1} of ${pendingEscalations.length}`}
          </span>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              cursor: 'pointer', color: 'var(--muted)', padding: 4,
            }}
            title="Close"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {current === null ? (
          <div style={{
            padding: '36px 18px', textAlign: 'center', color: 'var(--muted)',
            fontSize: 12.5,
          }}>
            Nothing to review. New low-confidence findings will appear here
            after the next Argus run.
          </div>
        ) : (
          <>
            <div style={{ padding: '16px 18px', overflowY: 'auto', flex: 1 }}>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
                marginBottom: 10,
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13.5, fontWeight: 500, color: 'var(--fg)',
                }}>{current.field}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  background: 'var(--soft)', padding: '2px 7px', borderRadius: 4,
                  color: 'var(--muted)',
                }}>{current.category}</span>
                <span style={{
                  fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.06em',
                  color: 'var(--muted)',
                }}>{current.severity}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>
                  confidence{' '}
                  <span style={{
                    fontFamily: 'var(--font-mono)', color: 'var(--fg)', fontWeight: 500,
                  }}>{current.confidence?.toFixed(2) ?? '—'}</span>
                </span>
              </div>

              <p style={{ margin: '0 0 10px', fontSize: 12.5, lineHeight: 1.5, color: 'var(--fg)' }}>
                {current.description}
              </p>

              <div style={{
                fontSize: 11, color: 'var(--muted)', marginBottom: 10,
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)' }}>
                  {current.affected_count.toLocaleString()}
                </span>{' '}docs affected ·{' '}
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)' }}>
                  {(current.affected_pct * 100).toFixed(1)}%
                </span>{' '}of sample ·{' '}
                <span style={{ fontFamily: 'var(--font-mono)' }}>{current.collection}</span>
              </div>

              {current.confidence_reason && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
                    color: 'var(--muted)', marginBottom: 4,
                  }}>Agent's reasoning</div>
                  <p style={{
                    margin: 0, padding: '8px 10px', background: 'var(--soft)',
                    border: '1px solid var(--border)', borderRadius: 8,
                    fontSize: 11.5, lineHeight: 1.5, color: 'var(--fg)',
                  }}>{current.confidence_reason}</p>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: 'var(--muted)', marginBottom: 4,
                }}>Evidence query</div>
                <pre style={{
                  margin: 0, padding: '8px 10px', background: 'var(--soft)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5,
                  color: 'var(--fg)', whiteSpace: 'pre-wrap', overflow: 'auto',
                }}>{current.evidence_query}</pre>
              </div>

              {error && (
                <div style={{
                  fontSize: 11.5, color: 'var(--status-err)', marginTop: 6,
                }}>{error}</div>
              )}
            </div>

            {/* Footer — verdict buttons */}
            <div style={{
              padding: '12px 18px', borderTop: '1px solid var(--border)',
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              {pendingEscalations.length > 1 && (
                <>
                  <button
                    onClick={() => setCursor((c) => (c - 1 + pendingEscalations.length) % pendingEscalations.length)}
                    disabled={!!busy}
                    style={{
                      padding: '5px 10px', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--panel)',
                      color: 'var(--fg)', fontSize: 11.5, cursor: 'pointer',
                    }}
                  >‹ Prev</button>
                  <button
                    onClick={() => setCursor((c) => (c + 1) % pendingEscalations.length)}
                    disabled={!!busy}
                    style={{
                      padding: '5px 10px', borderRadius: 6,
                      border: '1px solid var(--border)', background: 'var(--panel)',
                      color: 'var(--fg)', fontSize: 11.5, cursor: 'pointer',
                    }}
                  >Next ›</button>
                </>
              )}
              <div style={{ flex: 1 }} />
              <button
                onClick={() => resolve('need_info')}
                disabled={!!busy}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  border: '1px solid var(--border)', background: 'var(--panel)',
                  color: 'var(--muted)', fontSize: 12, cursor: busy ? 'progress' : 'pointer',
                  fontWeight: 500,
                }}
              >
                {busy === 'need_info' ? 'Saving…' : 'Need info'}
              </button>
              <button
                onClick={() => resolve('fp')}
                disabled={!!busy}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  border: '1px solid var(--status-err)',
                  background: 'color-mix(in oklch, var(--status-err) 10%, var(--panel))',
                  color: 'var(--status-err)', fontSize: 12,
                  cursor: busy ? 'progress' : 'pointer', fontWeight: 600,
                }}
              >
                {busy === 'fp' ? 'Saving…' : 'False positive'}
              </button>
              <button
                onClick={() => resolve('tp')}
                disabled={!!busy}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  border: '1px solid var(--status-ok)',
                  background: 'color-mix(in oklch, var(--status-ok) 10%, var(--panel))',
                  color: 'var(--status-ok)', fontSize: 12,
                  cursor: busy ? 'progress' : 'pointer', fontWeight: 600,
                }}
              >
                {busy === 'tp' ? 'Saving…' : 'True positive'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
