import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
import { API_BASE_URL, USE_MSAL_AUTH } from '../app.config';
import AppLayout from '../components/AppLayout';
import ChartDisplay, { VisualizationConfig } from '../components/ChartDisplay';
import { MOCK_AUDIT_EVENTS } from '../services/mockAuditData';

/* ── operation vocabulary ─────────────────────────────────────────────────── */
type Operation = 'insert' | 'update' | 'delete';

const OP: Record<Operation, { label: string; verb: string; color: string }> = {
    insert: { label: 'Insert', verb: 'created', color: '#3a8c5f' },
    update: { label: 'Update', verb: 'updated', color: '#2f6df0' },
    delete: { label: 'Delete', verb: 'deleted', color: '#c94250' },
};
const OP_ORDER: Operation[] = ['insert', 'update', 'delete'];

/* ── raw + derived event shapes ───────────────────────────────────────────── */
interface RawAuditEvent {
    user_email: string;
    operation: Operation;
    database_name: string;
    collection_name: string;
    document_id: string | null;
    diff_data: any;
    timestamp_utc: string;
}

interface AuditEvent extends RawAuditEvent {
    id: string;
    document_id: string;
    ts: Date;
    person: { name: string; team: string };
    changedFields: string[];
}

/* ── tiny utils ───────────────────────────────────────────────────────────── */
function relTime(d: Date, now: number): string {
    const m = Math.floor((now - d.getTime()) / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
}
function absTime(d: Date): string {
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}
const initials = (name: string) => name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const shortId = (id: string) => (id.length > 12 ? id.slice(0, 6) + '…' + id.slice(-4) : id);

const TEAM_HINTS: Record<string, string> = {
    ci: 'System',
    pipeline: 'System',
    bot: 'System',
};

/** Derive a human display name + team from an Entra email (no directory lookup). */
function personFromEmail(email: string): { name: string; team: string } {
    const local = (email.split('@')[0] || email).toLowerCase();
    const tokens = local.split(/[._-]+/).filter(Boolean);
    const name = tokens
        .map((t) => (t.length <= 2 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1)))
        .join(' ');
    const team = tokens.some((t) => TEAM_HINTS[t]) ? 'System' : 'Member';
    return { name: name || email, team };
}

function deriveEvent(r: RawAuditEvent, i: number): AuditEvent {
    const fields = r.operation === 'update' && r.diff_data && typeof r.diff_data === 'object'
        ? Object.keys(r.diff_data)
        : [];
    return {
        ...r,
        id: `evt_${String(i).padStart(4, '0')}`,
        document_id: r.document_id || '—',
        ts: new Date(r.timestamp_utc),
        person: personFromEmail(r.user_email),
        changedFields: fields,
    };
}

/* ── operation badge ──────────────────────────────────────────────────────── */
function OpBadge({ op, withLabel = true }: { op: Operation; withLabel?: boolean }) {
    const o = OP[op];
    const icon = {
        insert: <path d="M8 3v10M3 8h10" />,
        update: <path d="M3 11l6-6 2 2-6 6H3zM10 4l2 2" />,
        delete: <path d="M4 5h8M6 5V3h4v2M5 5l.6 8h4.8L11 5" />,
    }[op];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 22,
            padding: withLabel ? '0 9px 0 7px' : 0, width: withLabel ? 'auto' : 22,
            justifyContent: 'center', borderRadius: 99,
            background: `color-mix(in oklch, ${o.color} 14%, var(--panel))`, color: o.color, fontSize: 11, fontWeight: 600,
        }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
            {withLabel && o.label}
        </span>
    );
}

/* ── KPI stat card + sparkline ────────────────────────────────────────────── */
function Sparkline({ points, color }: { points: number[]; color: string }) {
    const max = Math.max(...points, 1);
    const w = 100, h = 22;
    const step = w / (points.length - 1 || 1);
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - (p / max) * h).toFixed(1)}`).join(' ');
    return (
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
            <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" opacity="0.85" />
        </svg>
    );
}

function StatCard({ label, value, sub, accent, spark }: {
    label: string; value: React.ReactNode; sub?: string; accent?: string; spark?: React.ReactNode;
}) {
    return (
        <div className="qa-card" style={{ padding: '13px 16px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>{label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 27, letterSpacing: '-0.02em', color: accent || 'var(--fg)' }}>{value}</div>
                {sub && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{sub}</div>}
            </div>
            {spark}
        </div>
    );
}

/* ── write-activity stacked bar chart ─────────────────────────────────────── */
function ActivityChart({ events, days, now }: { events: AuditEvent[]; days: number; now: number }) {
    const buckets = useMemo(() => {
        const out: { label: string; short: string; insert: number; update: number; delete: number }[] = [];
        const dayMs = 86400000;
        const end = new Date(now); end.setHours(23, 59, 59, 999);
        for (let i = days - 1; i >= 0; i--) {
            const start = new Date(end.getTime() - i * dayMs); start.setHours(0, 0, 0, 0);
            const stop = new Date(start.getTime() + dayMs);
            const inDay = events.filter((e) => e.ts >= start && e.ts < stop);
            out.push({
                label: start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                short: start.toLocaleDateString('en-GB', { weekday: 'short' })[0],
                insert: inDay.filter((e) => e.operation === 'insert').length,
                update: inDay.filter((e) => e.operation === 'update').length,
                delete: inDay.filter((e) => e.operation === 'delete').length,
            });
        }
        return out;
    }, [events, days, now]);

    const max = Math.max(...buckets.map((b) => b.insert + b.update + b.delete), 1);
    return (
        <div className="qa-card" style={{ padding: '15px 20px 12px', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>Write activity</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>last {days} days</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 14 }}>
                    {OP_ORDER.map((k) => (
                        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: OP[k].color }} />{OP[k].label}
                        </span>
                    ))}
                </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: buckets.length > 30 ? 2 : 6, height: 120 }}>
                {buckets.map((b, i) => {
                    const total = b.insert + b.update + b.delete;
                    return (
                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 0 }} title={`${b.label}: ${total} writes`}>
                            <div style={{ width: '100%', maxWidth: 26, height: 96, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 1.5 }}>
                                {(['delete', 'update', 'insert'] as Operation[]).map((k) => b[k] > 0 && (
                                    <div key={k} style={{ height: `${(b[k] / max) * 96}px`, background: OP[k].color, borderRadius: 2, minHeight: 3, opacity: 0.92 }} />
                                ))}
                                {total === 0 && <div style={{ height: 3, background: 'var(--border)', borderRadius: 2 }} />}
                            </div>
                            {(buckets.length <= 14 || i % Math.ceil(buckets.length / 10) === 0) &&
                                <div style={{ fontSize: 9, color: 'var(--muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>{buckets.length <= 10 ? b.label : b.short}</div>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ── who & where insights ─────────────────────────────────────────────────── */
function MiniOpBar({ counts, total }: { counts: Record<Operation, number>; total: number }) {
    return (
        <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--soft)', width: 64 }}>
            {OP_ORDER.map((k) => counts[k] > 0 &&
                <div key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: OP[k].color }} />)}
        </div>
    );
}

function InsightsPanel({ events }: { events: AuditEvent[] }) {
    const byUser = useMemo(() => {
        const m: Record<string, { email: string; person: AuditEvent['person']; total: number } & Record<Operation, number>> = {};
        events.forEach((e) => {
            const u = (m[e.user_email] ||= { email: e.user_email, person: e.person, total: 0, insert: 0, update: 0, delete: 0 });
            u.total++; u[e.operation]++;
        });
        return Object.values(m).sort((a, b) => b.total - a.total);
    }, [events]);

    const byColl = useMemo(() => {
        const m: Record<string, number> = {};
        events.forEach((e) => { m[e.collection_name] = (m[e.collection_name] || 0) + 1; });
        return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }, [events]);
    const collMax = Math.max(...byColl.map((c) => c.count), 1);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="qa-card" style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="5" r="2.4" /><path d="M3 13c0-2.5 2.2-4 5-4s5 1.5 5 4" /></svg>
                    Who changed things
                </div>
                {byUser.length === 0 ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>No activity in range.</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                        {byUser.map((u) => (
                            <div key={u.email} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="qa-avatar" style={{ width: 24, height: 24, fontSize: 10, background: 'var(--soft)', color: 'var(--muted)' }}>{initials(u.person.name)}</div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.person.name}</div>
                                    <div style={{ fontSize: 10.5, color: 'var(--muted)' }}>{u.person.team}</div>
                                </div>
                                <MiniOpBar counts={u} total={u.total} />
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, width: 24, textAlign: 'right' }}>{u.total}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="qa-card" style={{ padding: '14px 16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><ellipse cx="8" cy="4" rx="6" ry="2" /><path d="M2 4v8c0 1.1 2.7 2 6 2s6-.9 6-2V4M2 8c0 1.1 2.7 2 6 2s6-.9 6-2" /></svg>
                    Most-changed collections
                </div>
                {byColl.length === 0 ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>No activity in range.</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {byColl.map((c) => (
                            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, width: 86, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                                <div style={{ flex: 1, height: 7, background: 'var(--soft)', borderRadius: 4, position: 'relative' }}>
                                    <div style={{ position: 'absolute', inset: `0 ${100 - (c.count / collMax) * 100}% 0 0`, background: 'var(--accent)', borderRadius: 4 }} />
                                </div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg)', width: 22, textAlign: 'right' }}>{c.count}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── diff drawer (faithful to DocumentHistoryDialog) ──────────────────────── */
function JsonBlock({ value }: { value: any }) {
    return (
        <pre style={{
            margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.5,
            background: 'var(--soft)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--fg)',
        }}>
            {JSON.stringify(value, null, 2)}
        </pre>
    );
}

function ValueCell({ value }: { value: any }) {
    if (value === null || value === undefined)
        return <span style={{ fontStyle: 'italic', color: 'var(--muted)' }}>null</span>;
    if (typeof value === 'object') return <JsonBlock value={value} />;
    return <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)', wordBreak: 'break-word' }}>{typeof value === 'string' ? `"${value}"` : String(value)}</span>;
}

function DiffDrawer({ event, onClose, now }: { event: AuditEvent | null; onClose: () => void; now: number }) {
    if (!event) return null;
    const o = OP[event.operation];
    const sysFields = ['datetime_creation', 'datetime_last_modified'];
    const diff = event.diff_data && typeof event.diff_data === 'object' ? event.diff_data : {};
    const entries = event.operation === 'update'
        ? Object.entries(diff).filter(([k]) => !sysFields.includes(k))
        : [];
    const doc = { ...diff }; sysFields.forEach((k) => delete (doc as any)[k]);

    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'color-mix(in oklch, var(--fg) 28%, transparent)', display: 'flex', justifyContent: 'flex-end', zIndex: 200, animation: 'ad-fade .18s ease' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '92%', background: 'var(--panel)', borderLeft: '1px solid var(--border)', height: '100%', display: 'flex', flexDirection: 'column', animation: 'ad-slide .22s cubic-bezier(.2,.7,.3,1)' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <OpBadge op={event.operation} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                            {event.person.name} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>{o.verb} a document in</span> <span style={{ fontFamily: 'var(--font-mono)' }}>{event.collection_name}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>{absTime(event.ts)} · {relTime(event.ts, now)}</div>
                    </div>
                    <div className="qa-btn" onClick={onClose} style={{ flexShrink: 0, width: 30, height: 30, padding: 0, justifyContent: 'center' }}>
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
                    </div>
                </div>

                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 14px', fontSize: 12 }}>
                    {[['Actor', event.user_email], ['Database', event.database_name], ['Collection', event.collection_name], ['Document', event.document_id]].map(([k, v]) => (
                        <React.Fragment key={k}>
                            <span style={{ color: 'var(--muted)' }}>{k}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, wordBreak: 'break-all' }}>{v}</span>
                        </React.Fragment>
                    ))}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                    {event.operation === 'update' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)' }}>{entries.length} field{entries.length !== 1 ? 's' : ''} changed</div>
                            {entries.map(([field, ch]) => (
                                <div key={field} style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                                    <div style={{ padding: '7px 11px', background: 'var(--soft)', borderBottom: '1px solid var(--border)' }}>
                                        <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 500 }}>{field}</code>
                                    </div>
                                    <div style={{ padding: '10px 11px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                                        <div style={{ borderLeft: '2px solid #c94250', paddingLeft: 9 }}>
                                            <div style={{ fontSize: 10, fontWeight: 600, color: '#c94250', marginBottom: 4, letterSpacing: '0.04em' }}>BEFORE</div>
                                            <ValueCell value={(ch as any)?.before} />
                                        </div>
                                        <div style={{ borderLeft: '2px solid #3a8c5f', paddingLeft: 9 }}>
                                            <div style={{ fontSize: 10, fontWeight: 600, color: '#3a8c5f', marginBottom: 4, letterSpacing: '0.04em' }}>AFTER</div>
                                            <ValueCell value={(ch as any)?.after} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {event.operation === 'insert' && (
                        <div>
                            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#3a8c5f', marginBottom: 9, fontWeight: 600 }}>Document created with</div>
                            <JsonBlock value={doc} />
                        </div>
                    )}

                    {event.operation === 'delete' && (
                        <div>
                            <div style={{ fontSize: 12.5, color: '#c94250', fontWeight: 500, marginBottom: 9, display: 'flex', alignItems: 'center', gap: 7 }}>
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 5v4M8 11h.01M8 1.5L1 14h14z" /></svg>
                                Document was deleted. Snapshot at time of deletion:
                            </div>
                            <JsonBlock value={doc} />
                        </div>
                    )}
                </div>

                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
                    <button className="qa-btn" style={{ gap: 6 }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 8l3 3 7-7" /></svg>
                        Open document
                    </button>
                    <button className="qa-btn" style={{ marginLeft: 'auto', gap: 6 }} onClick={() => navigator.clipboard?.writeText(JSON.stringify(event.diff_data, null, 2))}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="8" height="10" rx="1" /><path d="M5 3V1.5h6V11" /></svg>
                        Copy JSON
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ── event log feed ───────────────────────────────────────────────────────── */
function FieldChips({ fields }: { fields: string[] }) {
    const shown = fields.slice(0, 3);
    return (
        <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            {shown.map((f) => <span key={f} style={{ display: 'inline-flex', alignItems: 'center', height: 18, padding: '0 7px', borderRadius: 4, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--muted)', border: '1px solid var(--border)' }}>{f}</span>)}
            {fields.length > 3 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>+{fields.length - 3}</span>}
        </span>
    );
}

function EventRow({ e, onOpen, now }: { e: AuditEvent; onOpen: (e: AuditEvent) => void; now: number }) {
    let summary: React.ReactNode;
    const d = e.diff_data || {};
    if (e.operation === 'update') summary = <FieldChips fields={e.changedFields} />;
    else summary = <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{d.studyId || d.name || d.title || (e.operation === 'insert' ? 'new document' : 'document removed')}</span>;

    return (
        <tr className="ad-row" onClick={() => onOpen(e)}>
            <td style={{ padding: '9px 14px' }}><OpBadge op={e.operation} /></td>
            <td style={{ padding: '9px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="qa-avatar" style={{ width: 22, height: 22, fontSize: 9.5, background: 'var(--soft)', color: 'var(--muted)' }}>{initials(e.person.name)}</div>
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{e.person.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>{e.user_email}</div>
                    </div>
                </div>
            </td>
            <td style={{ padding: '9px 14px' }}><span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{e.collection_name}</span></td>
            <td style={{ padding: '9px 14px' }}><span style={{ display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 7px', borderRadius: 4, background: 'var(--soft)', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }} title={e.document_id}>{shortId(e.document_id)}</span></td>
            <td style={{ padding: '9px 14px' }}>{summary}</td>
            <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 11.5 }}>{relTime(e.ts, now)}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)' }}>{absTime(e.ts)}</div>
            </td>
            <td style={{ padding: '9px 10px 9px 0', textAlign: 'right' }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="1.5" style={{ opacity: 0.6 }}><path d="M6 3l5 5-5 5" /></svg>
            </td>
        </tr>
    );
}

interface DropdownOption { value: string; label: string; dot?: string }
function Dropdown({ label, value, options, onChange }: { label: string; value: string; options: DropdownOption[]; onChange: (v: string) => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const h = (ev: MouseEvent) => { if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, []);
    const current = options.find((o) => o.value === value);
    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button className="qa-btn" onClick={() => setOpen((o) => !o)} style={{ gap: 7 }}>
                <span style={{ color: 'var(--muted)' }}>{label}</span>
                <span style={{ fontWeight: 500 }}>{current ? current.label : 'All'}</span>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4" /></svg>
            </button>
            {open && (
                <div className="qa-card" style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, minWidth: 180, padding: 4, zIndex: 20, borderRadius: 'var(--radius-md)', boxShadow: '0 8px 28px color-mix(in oklch, var(--fg) 14%, transparent)', maxHeight: 280, overflowY: 'auto' }}>
                    {options.map((o) => (
                        <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                            style={{ padding: '6px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: o.value === value ? 'var(--soft)' : 'transparent' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--soft)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = o.value === value ? 'var(--soft)' : 'transparent')}>
                            {o.dot && <span style={{ width: 8, height: 8, borderRadius: 2, background: o.dot }} />}
                            {o.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function EventLog({ events, onOpen, now }: { events: AuditEvent[]; onOpen: (e: AuditEvent) => void; now: number }) {
    const cols = ['Operation', 'Actor', 'Collection', 'Document', 'What changed', 'When', ''];

    const exportCsv = () => {
        const header = ['operation', 'user_email', 'collection_name', 'document_id', 'timestamp_utc'];
        const lines = [header.join(',')].concat(events.map((e) =>
            [e.operation, e.user_email, e.collection_name, e.document_id, e.ts.toISOString()].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')
        ));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'audit-log.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="qa-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, padding: 0, borderRadius: 'var(--radius-md)' }}>
            <div style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>Event log</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)' }}>{events.length} events</span>
                <button className="qa-btn" onClick={exportCsv} style={{ marginLeft: 'auto', gap: 6, height: 26, border: 'none', background: 'transparent', color: 'var(--muted)' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" /></svg>
                    Export CSV
                </button>
            </div>
            <div style={{ overflowY: 'auto', minHeight: 0 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'var(--panel)', zIndex: 1 }}>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            {cols.map((c, i) => (
                                <th key={i} style={{ padding: '8px 14px', textAlign: i === cols.length - 2 ? 'right' : 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{c}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {events.length === 0 ? (
                            <tr><td colSpan={cols.length} style={{ padding: '40px 14px', textAlign: 'center', color: 'var(--muted)', fontSize: 12.5 }}>No events match these filters.</td></tr>
                        ) : events.map((e) => <EventRow key={e.id} e={e} onOpen={onOpen} now={now} />)}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ── Ask the log (NL → SQL via existing backend) ──────────────────────────── */
interface AskResult { sql_query: string; results: any[]; summary: string; visualization?: VisualizationConfig }

function AskPanel({ getToken }: { getToken: () => Promise<string | null> }) {
    const [q, setQ] = useState('How many documents were updated in the last 7 days, grouped by collection?');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<AskResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const run = async () => {
        if (!q.trim()) return;
        setLoading(true); setError(null); setData(null);
        try {
            const token = await getToken();
            const res = await fetch(`${API_BASE_URL}/audit/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ question: q }),
            });
            if (!res.ok) throw new Error('Failed to analyze audit log');
            setData(await res.json());
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 760 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M8 1.5l1.6 4.4L14 7.5l-4.4 1.6L8 13.5 6.4 9.1 2 7.5l4.4-1.6z" /></svg>
                    Ask in plain English · Gemini 2.5 Flash → PostgreSQL
                </div>
                <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={2}
                    style={{ padding: '11px 14px', border: '1px solid var(--accent)', borderRadius: 10, background: 'var(--panel)', color: 'var(--fg)', fontFamily: 'var(--font-body)', fontSize: 13.5, resize: 'vertical', outline: 'none', lineHeight: 1.5, width: '100%' }} />
                <button className="qa-btn primary" onClick={run} disabled={loading} style={{ alignSelf: 'flex-start', gap: 6, opacity: loading ? 0.65 : 1 }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><polygon points="4,2 14,8 4,14" /></svg>
                    {loading ? 'Analyzing…' : 'Analyze'}
                </button>
            </div>

            {error && (
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'color-mix(in oklch, var(--status-err) 12%, var(--bg))', border: '1px solid color-mix(in oklch, var(--status-err) 25%, var(--border))', color: 'var(--status-err)', fontSize: 13 }}>{error}</div>
            )}

            {data && (
                <>
                    <div className="qa-card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 10 }}>AI insight</div>
                        <div style={{ fontSize: 13.5, lineHeight: 1.65 }}><ReactMarkdown>{data.summary}</ReactMarkdown></div>
                    </div>

                    {data.visualization && <ChartDisplay config={data.visualization} data={data.results} />}

                    <div className="qa-card" style={{ padding: 0, overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ padding: '9px 16px', borderBottom: '1px solid var(--border)', fontSize: 11.5, color: 'var(--muted)' }}>Generated SQL</div>
                        <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', padding: '12px 16px', fontSize: 12, lineHeight: 1.55, color: 'var(--fg)', overflowX: 'auto' }}>{data.sql_query}</pre>
                    </div>
                </>
            )}
        </div>
    );
}

/* ── main dashboard ───────────────────────────────────────────────────────── */
const AuditPage: React.FC = () => {
    const { getToken } = useUnifiedAuth();
    const [allEvents, setAllEvents] = useState<AuditEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [tab, setTab] = useState<'activity' | 'ask'>('activity');
    const [range, setRange] = useState(7);
    const [opFilter, setOpFilter] = useState('all');
    const [userFilter, setUserFilter] = useState('all');
    const [collFilter, setCollFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<AuditEvent | null>(null);

    // Anchor "now" to the newest event so relative times read naturally even
    // against historical/mock data; fall back to wall clock when empty.
    const now = useMemo(() => (allEvents[0]?.ts.getTime() ?? Date.now()), [allEvents]);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true); setLoadError(null);
            try {
                if (!USE_MSAL_AUTH) {
                    if (!cancelled) setAllEvents(MOCK_AUDIT_EVENTS.map(deriveEvent).sort((a, b) => b.ts.getTime() - a.ts.getTime()));
                    return;
                }
                const token = await getToken();
                const res = await fetch(`${API_BASE_URL}/audit/events?days=90&limit=1000`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error('Failed to load audit events');
                const raw: RawAuditEvent[] = await res.json();
                if (!cancelled) setAllEvents(raw.map(deriveEvent).sort((a, b) => b.ts.getTime() - a.ts.getTime()));
            } catch (err: any) {
                if (!cancelled) setLoadError(err.message || 'An error occurred');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [getToken]);

    const windowed = useMemo(() => {
        const cutoff = now - range * 86400000;
        return allEvents.filter((e) => e.ts.getTime() >= cutoff);
    }, [allEvents, range, now]);

    const filtered = useMemo(() => windowed.filter((e) =>
        (opFilter === 'all' || e.operation === opFilter) &&
        (userFilter === 'all' || e.user_email === userFilter) &&
        (collFilter === 'all' || e.collection_name === collFilter) &&
        (!search || e.document_id.toLowerCase().includes(search.toLowerCase()) || e.user_email.toLowerCase().includes(search.toLowerCase()))
    ), [windowed, opFilter, userFilter, collFilter, search]);

    const counts = useMemo(() => ({
        total: windowed.length,
        insert: windowed.filter((e) => e.operation === 'insert').length,
        update: windowed.filter((e) => e.operation === 'update').length,
        delete: windowed.filter((e) => e.operation === 'delete').length,
        users: new Set(windowed.map((e) => e.user_email)).size,
        docs: new Set(windowed.map((e) => e.document_id)).size,
    }), [windowed]);

    const dailyTotals = useMemo(() => {
        const out: number[] = []; const dayMs = 86400000;
        for (let i = range - 1; i >= 0; i--) {
            const start = new Date(now - i * dayMs); start.setHours(0, 0, 0, 0);
            const stop = new Date(start.getTime() + dayMs);
            out.push(windowed.filter((e) => e.ts >= start && e.ts < stop).length);
        }
        return out;
    }, [windowed, range, now]);

    const userOpts: DropdownOption[] = [{ value: 'all', label: 'All users' },
        ...[...new Map(allEvents.map((e) => [e.user_email, e.person.name])).entries()].map(([email, name]) => ({ value: email, label: name }))];
    const collOpts: DropdownOption[] = [{ value: 'all', label: 'All collections' },
        ...[...new Set(allEvents.map((e) => e.collection_name))].map((c) => ({ value: c, label: c }))];
    const opOpts: DropdownOption[] = [{ value: 'all', label: 'All operations' },
        ...OP_ORDER.map((k) => ({ value: k, label: OP[k].label, dot: OP[k].color }))];
    const ranges: [number, string][] = [[1, '24h'], [7, '7d'], [30, '30d'], [90, '90d']];

    // Parse account/database from the newest event's "account.database" string for the shell.
    const dbParts = (allEvents[0]?.database_name || '').split('.');
    const accountName = dbParts[0] || undefined;
    const databaseName = dbParts.slice(1).join('.') || undefined;
    const hasFilters = opFilter !== 'all' || userFilter !== 'all' || collFilter !== 'all' || !!search;

    return (
        <AppLayout accountName={accountName} databaseName={databaseName}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, fontFamily: 'var(--font-body)' }}>
                {/* page header */}
                <div style={{ padding: '20px 28px 0', display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 23, letterSpacing: '-0.02em' }}>Audit log</div>
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                            Every write{databaseName ? <> to <span style={{ fontFamily: 'var(--font-mono)' }}>{databaseName}</span></> : ''} — who changed what, and when.
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 10 }}>
                                <span className="qa-dot ok" style={{ animation: 'ad-pulse 2s infinite' }} /> live
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, background: 'var(--soft)', padding: 3, borderRadius: 8 }}>
                        {([['activity', 'Activity'], ['ask', 'Ask the log']] as const).map(([k, l]) => (
                            <button key={k} onClick={() => setTab(k)} style={{ border: 'none', cursor: 'pointer', padding: '5px 13px', fontSize: 12.5, borderRadius: 6, fontFamily: 'inherit', fontWeight: tab === k ? 500 : 400,
                                background: tab === k ? 'var(--panel)' : 'transparent', boxShadow: tab === k ? '0 0 0 1px var(--border)' : 'none', color: tab === k ? 'var(--fg)' : 'var(--muted)' }}>{l}</button>
                        ))}
                    </div>
                </div>

                {tab === 'ask' ? (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '22px 28px' }}><AskPanel getToken={getToken} /></div>
                ) : (
                    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 28px 26px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* range selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ display: 'flex', gap: 2, background: 'var(--soft)', padding: 3, borderRadius: 8 }}>
                                {ranges.map(([d, l]) => (
                                    <button key={d} onClick={() => setRange(d)} style={{ border: 'none', cursor: 'pointer', padding: '4px 12px', fontSize: 12, borderRadius: 6, fontFamily: 'inherit', fontWeight: range === d ? 500 : 400,
                                        background: range === d ? 'var(--panel)' : 'transparent', boxShadow: range === d ? '0 0 0 1px var(--border)' : 'none', color: range === d ? 'var(--fg)' : 'var(--muted)' }}>{l}</button>
                                ))}
                            </div>
                            <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{counts.total} writes by {counts.users} actors across {counts.docs} documents</span>
                        </div>

                        {loadError && (
                            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'color-mix(in oklch, var(--status-err) 12%, var(--bg))', border: '1px solid color-mix(in oklch, var(--status-err) 25%, var(--border))', color: 'var(--status-err)', fontSize: 13 }}>{loadError}</div>
                        )}

                        {/* KPI strip */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                            <StatCard label="Total writes" value={counts.total} sub={`/ ${range}d`} spark={<Sparkline points={dailyTotals} color="var(--accent)" />} />
                            <StatCard label="Updates" value={counts.update} accent={OP.update.color} sub="modified" />
                            <StatCard label="Inserts" value={counts.insert} accent={OP.insert.color} sub="created" />
                            <StatCard label="Deletes" value={counts.delete} accent={OP.delete.color} sub="removed" />
                            <StatCard label="Active actors" value={counts.users} sub="incl. CI" />
                        </div>

                        {/* chart */}
                        <ActivityChart events={windowed} days={range} now={now} />

                        {/* filter bar */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Dropdown label="Op" value={opFilter} options={opOpts} onChange={setOpFilter} />
                            <Dropdown label="User" value={userFilter} options={userOpts} onChange={setUserFilter} />
                            <Dropdown label="Collection" value={collFilter} options={collOpts} onChange={setCollFilter} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 30, padding: '0 10px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 7, minWidth: 200 }}>
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="1.4"><circle cx="7" cy="7" r="4.5" /><path d="M11 11l3 3" /></svg>
                                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search document id or actor…"
                                    style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: 'var(--fg)', flex: 1, minWidth: 0 }} />
                            </div>
                            {hasFilters && (
                                <button className="qa-btn" onClick={() => { setOpFilter('all'); setUserFilter('all'); setCollFilter('all'); setSearch(''); }} style={{ gap: 5, color: 'var(--muted)', border: 'none', background: 'transparent' }}>
                                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>Clear
                                </button>
                            )}
                        </div>

                        {/* log + insights */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 290px', gap: 16, alignItems: 'start' }}>
                            <EventLog events={filtered} onOpen={setSelected} now={now} />
                            <InsightsPanel events={windowed} />
                        </div>

                        {loading && allEvents.length === 0 && (
                            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12.5, padding: '8px 0' }}>Loading audit events…</div>
                        )}
                    </div>
                )}

                <DiffDrawer event={selected} onClose={() => setSelected(null)} now={now} />
            </div>
        </AppLayout>
    );
};

export default AuditPage;
