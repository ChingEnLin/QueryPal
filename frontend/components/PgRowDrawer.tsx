import React, { useMemo, useState } from 'react';

interface Column { name: string; type: string; nullable: boolean; pk?: boolean; fk?: string | null }

const isBool = (t: string) => t === 'boolean';
const isNumber = (t: string) => /int|numeric|real|double|decimal|serial/i.test(t);
const isJson = (t: string) => /json/i.test(t);
// information_schema reports array columns as data_type "ARRAY"; some setups
// surface "integer[]" etc. Match both.
const isArray = (t: string) => /array|\[\]/i.test(t);

// One-line input help for types that aren't obvious to type by hand.
const typeHint = (t: string): string =>
  isArray(t) ? 'array — {1,2,3} or ["a","b"]'
    : isJson(t) ? 'JSON — e.g. {"key": "value"}'
    : '';

// Parse array input into a real JS array (sent as JSON; psycopg2 adapts a list
// to a PG array and handles quoting). Accepts JSON [1,3], PG {1,3}, or 1,3.
const parseArray = (raw: string): unknown => {
  const s = raw.trim();
  try { const v = JSON.parse(s); if (Array.isArray(v)) return v; } catch { /* not JSON */ }
  const inner = s.replace(/^\{/, '').replace(/\}$/, '');
  if (inner.trim() === '') return [];
  return inner.split(',').map((x) => {
    const el = x.trim().replace(/^["']|["']$/g, '');
    const n = Number(el);
    return el !== '' && !Number.isNaN(n) ? n : el;
  });
};

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
  const [err, setErr] = useState<string | null>(null);
  const noPk = pk.length === 0;

  const coerce = (c: Column, raw: string): unknown => {
    if (raw === '') return c.nullable ? null : '';
    if (isBool(c.type)) return raw === 'true';
    if (isArray(c.type)) return parseArray(raw);
    if (isNumber(c.type)) { const n = Number(raw); return Number.isNaN(n) ? raw : n; }
    if (isJson(c.type)) { try { return JSON.parse(raw); } catch { return raw; } }
    return raw;
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      // On insert, omit fields the user left blank so the column's DB default
      // (serial, now(), etc.) applies instead of sending '' into a typed column.
      const values: Record<string, unknown> = {};
      for (const c of editable) {
        const raw = form[c.name];
        if (mode === 'new' && raw === '') continue;
        values[c.name] = coerce(c, raw);
      }
      await onSave(values);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onDelete();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
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
            ) : (isJson(c.type) || isArray(c.type)) ? (
              <textarea aria-label={c.name} disabled={noPk} rows={isArray(c.type) ? 1 : 3} value={form[c.name]}
                placeholder={isArray(c.type) ? '{1,2,3}' : '{"key": "value"}'}
                onChange={(e) => setForm((f) => ({ ...f, [c.name]: e.target.value }))}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--panel)', color: 'var(--fg)', fontFamily: 'var(--font-mono)', fontSize: 12, resize: 'vertical' }} />
            ) : (
              <input aria-label={c.name} disabled={noPk} type={isNumber(c.type) ? 'number' : 'text'} value={form[c.name]}
                onChange={(e) => setForm((f) => ({ ...f, [c.name]: e.target.value }))}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--panel)', color: 'var(--fg)', fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            )}
            {typeHint(c.type) && (
              <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>{typeHint(c.type)}</span>
            )}
          </label>
        ))}
      </div>
      {err && (
        <div style={{ margin: '0 14px 10px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11.5, lineHeight: 1.45, background: 'color-mix(in oklch, var(--status-err) 10%, var(--bg))', border: '1px solid color-mix(in oklch, var(--status-err) 30%, var(--border))', color: 'var(--status-err)', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
          {err}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
        <button className="qa-btn primary" disabled={noPk || busy} onClick={submit}>Save</button>
        {mode === 'edit' && (
          confirmDelete
            ? <button className="qa-btn" style={{ color: 'var(--status-err)', borderColor: 'var(--status-err)' }} disabled={busy} onClick={doDelete}>Confirm delete</button>
            : <button className="qa-btn" style={{ color: 'var(--status-err)' }} disabled={noPk} onClick={() => setConfirmDelete(true)}>Delete</button>
        )}
        <button className="qa-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>Cancel</button>
      </div>
    </aside>
  );
};

export default PgRowDrawer;
