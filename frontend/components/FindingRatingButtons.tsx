import React, { useState } from 'react';
import { rateArgusFinding, ArgusUserLabel } from '../services/argusService';

/**
 * Arm A — post-hoc finding rating.
 *
 * Optimistically swaps the selected label, calls the backend, and rolls back
 * with an inline error if the request fails. Compact enough to live in the
 * finding-detail header without crowding existing chips.
 */
export const FindingRatingButtons: React.FC<{
  reportId: string;
  findingId: string;
  value: ArgusUserLabel | null | undefined;
  onChange?: (label: ArgusUserLabel) => void;
}> = ({ reportId, findingId, value, onChange }) => {
  const [busy, setBusy] = useState<ArgusUserLabel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState<ArgusUserLabel | null>(value ?? null);

  // Keep the optimistic local state in sync when the caller swaps findings.
  React.useEffect(() => { setLocal(value ?? null); }, [value, findingId]);

  const submit = async (label: ArgusUserLabel) => {
    if (busy || local === label) return;
    const previous = local;
    setBusy(label);
    setError(null);
    setLocal(label);
    try {
      await rateArgusFinding({ reportId, findingId, label });
      onChange?.(label);
    } catch (e) {
      setLocal(previous);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const button = (label: ArgusUserLabel) => {
    const selected = local === label;
    const isTp = label === 'tp';
    const accent = isTp ? 'var(--status-ok)' : 'var(--status-err)';
    return (
      <button
        key={label}
        type="button"
        onClick={() => submit(label)}
        disabled={!!busy}
        title={isTp ? 'Mark this finding as a true positive' : 'Mark this finding as a false positive'}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 999, fontSize: 11,
          fontFamily: 'var(--font-body)', fontWeight: 500,
          border: `1px solid ${selected ? accent : 'var(--border)'}`,
          background: selected ? `color-mix(in oklch, ${accent} 12%, var(--panel))` : 'var(--panel)',
          color: selected ? accent : 'var(--muted)',
          cursor: busy ? 'progress' : 'pointer',
          opacity: busy && busy !== label ? 0.6 : 1,
          transition: 'background 0.12s, color 0.12s, border-color 0.12s',
        }}
      >
        {isTp ? (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 8l3 3 7-7" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        )}
        {isTp ? 'True positive' : 'False positive'}
      </button>
    );
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {button('tp')}
      {button('fp')}
      {error && (
        <span
          role="alert"
          style={{ fontSize: 10.5, color: 'var(--status-err)', fontFamily: 'var(--font-body)' }}
        >
          {error}
        </span>
      )}
    </div>
  );
};
