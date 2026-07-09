import React, { useMemo, useState } from 'react';

interface Column { name: string; type: string; nullable: boolean; pk?: boolean; fk?: string | null }

const isBool = (t: string) => t === 'boolean';
const isNumber = (t: string) => /int|numeric|real|double|decimal|serial/i.test(t);
const isJson = (t: string) => /json/i.test(t);

const PgRowDrawer: React.FC<{
  columns: Column[];
  pk: string[];
  mode: 'edit' | 'new';
  row: Record<string, unknown> | null;
  onClose: () => void;
  onSave: (values: Record<string, unknown>) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}> = ({ columns, pk, mode, row, onClose, onSave, onDelete }) => {
  // Editable = every non-pk column (serial/default pks are filled by the DB).
  const editable = useMemo(() => columns.filter((c) => !pk.includes(c.name)), [columns, pk]);
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(editable.map((c) => {
      const v = row?.[c.name];
      return [c.name, v === null || v === undefined ? '' : String(v)];
    })));
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const noPk = pk.length === 0;

  const coerce = (c: Column, raw: string): unknown => {
    if (raw === '') return c.nullable ? null : '';
    if (isBool(c.type)) return raw === 'true';
    if (isNumber(c.type)) { const n = Number(raw); return Number.isNaN(n) ? raw : n; }
    return raw;
  };

  const submit = async () => {
    setBusy(true);
    try {
      const values = Object.fromEntries(editable.map((c) => [c.name, coerce(c, form[c.name])]));
      await onSave(values);
    } finally { setBusy(false); }
  };

  return (
    <aside style={{ width: 340, borderLeft: '1px solid var(--border)', background: 'var(--panel)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{mode === 'new' ? 'New row' : 'Edit row'}</span>
        <button className="qa-iconbtn" style={{ marginLeft: 'auto' }} onClick={onClose} title="Close">&#x2715;</button>
      </div>
      <div style={{ padding: '12px 14px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {noPk && <div className="qa-chip" style={{ color: 'var(--status-warn)', borderColor: 'var(--status-warn)' }}>No primary key — read-only.</div>}
        {mode === 'edit' && pk.map((c) => (
          <label key={c} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--muted)' }}>
            {c} <span className="ws-keybadge pk">PK</span>
            <input aria-label={c} value={String(row?.[c] ?? '')} readOnly
              style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--soft)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
          </label>
        ))}
        {editable.map((c) => (
          <label key={c.name} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--fg)' }}>
            <span>{c.name} <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>{c.type}{c.fk ? ` -> ${c.fk}` : ''}</span></span>
            {isBool(c.type) ? (
              <select aria-label={c.name} disabled={noPk} value={form[c.name]} onChange={(e) => setForm((f) => ({ ...f, [c.name]: e.target.value }))}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--panel)', color: 'var(--fg)' }}>
                <option value="">(null)</option><option value="true">true</option><option value="false">false</option>
              </select>
            ) : isJson(c.type) ? (
              <textarea aria-label={c.name} disabled={noPk} rows={3} value={form[c.name]} onChange={(e) => setForm((f) => ({ ...f, [c.name]: e.target.value }))}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--panel)', color: 'var(--fg)', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            ) : (
              <input aria-label={c.name} disabled={noPk} type={isNumber(c.type) ? 'number' : 'text'} value={form[c.name]}
                onChange={(e) => setForm((f) => ({ ...f, [c.name]: e.target.value }))}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--panel)', color: 'var(--fg)', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            )}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
        <button className="qa-btn primary" disabled={noPk || busy} onClick={submit}>Save</button>
        {mode === 'edit' && (
          confirmDelete
            ? <button className="qa-btn" style={{ color: 'var(--status-err)', borderColor: 'var(--status-err)' }} disabled={busy} onClick={onDelete}>Confirm delete</button>
            : <button className="qa-btn" style={{ color: 'var(--status-err)' }} disabled={noPk} onClick={() => setConfirmDelete(true)}>Delete</button>
        )}
        <button className="qa-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>Cancel</button>
      </div>
    </aside>
  );
};

export default PgRowDrawer;
