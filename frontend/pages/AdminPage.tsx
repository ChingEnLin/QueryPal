import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useRoles } from '../hooks/useRoles';
import {
  getAdminUsers, assignUserRole, removeUserRole, AdminUser,
  getAuthenticatedToken, listPostgresServers, pgListAccess, pgGrantAccess, pgRevokeAccess,
  pgGrantWrite, pgRevokeWrite, PostgresServer,
} from '../services/dbService';
import AppLayout from '../components/AppLayout';

const ROLES = ['Admin', 'Analyst', 'Viewer'] as const;

const chipColor: Record<string, string> = {
  Admin: 'var(--status-err)',
  Analyst: 'var(--accent)',
  Viewer: 'var(--muted)',
};

// Human-readable capabilities per role (cumulative). Kept in sync with the
// permission sets in hooks/useRoles.ts + backend services/rbac.py.
const ROLE_INFO: { name: string; caps: string[] }[] = [
  { name: 'Viewer', caps: ['Run queries & browse data (read-only)', 'See own write activity'] },
  { name: 'Analyst', caps: ['Everything a Viewer can', 'Create, edit & delete data', 'Run data-quality audits'] },
  { name: 'Admin', caps: ['Everything an Analyst can', 'View the full audit log (all users)', 'Manage roles & database access (this page)'] },
];

export default function AdminPage() {
  const { can } = useRoles();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});

  // PostgreSQL access provisioning
  const [pgServers, setPgServers] = useState<PostgresServer[]>([]);
  const [pgServerId, setPgServerId] = useState<string>('');
  const [pgAccess, setPgAccess] = useState<Set<string>>(new Set());
  const [pgWrite, setPgWrite] = useState<Set<string>>(new Set());
  const [pgAccessLoading, setPgAccessLoading] = useState(false);
  const [pgAccessError, setPgAccessError] = useState<string | null>(null);
  const [pgBusy, setPgBusy] = useState<Record<string, boolean>>({});

  // All hooks must be called before any early return (rules of hooks).
  // Load users AND PG-server discovery together so the table (and whether the
  // PostgreSQL column exists) renders once, with no pop-in afterwards.
  useEffect(() => {
    if (!can('system:admin')) return;
    (async () => {
      try {
        const [adminUsers] = await Promise.all([
          getAdminUsers(),
          // PG provisioning is optional — never fail the page over it.
          (async () => {
            try {
              const token = await getAuthenticatedToken();
              const servers = await listPostgresServers(token);
              setPgServers(servers);
              if (servers.length > 0) setPgServerId(servers[0].id);
            } catch { /* absence just hides the column */ }
          })(),
        ]);
        setUsers(adminUsers);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load who currently has access whenever the selected server changes.
  useEffect(() => {
    if (!pgServerId) return;
    let cancelled = false;
    setPgAccessLoading(true);
    setPgAccessError(null);
    getAuthenticatedToken()
      .then((token) => pgListAccess(token, pgServerId))
      .then((entries) => {
        if (cancelled) return;
        setPgAccess(new Set(entries.map((e) => e.email.toLowerCase())));
        setPgWrite(new Set(entries.filter((e) => e.write).map((e) => e.email.toLowerCase())));
      })
      .catch((e) => { if (!cancelled) { setPgAccess(new Set()); setPgWrite(new Set()); setPgAccessError(e?.message || 'Failed to load PostgreSQL access'); } })
      .finally(() => { if (!cancelled) setPgAccessLoading(false); });
    return () => { cancelled = true; };
  }, [pgServerId]);

  const setMembership = (setter: typeof setPgAccess) => (email: string, has: boolean) =>
    setter((prev) => {
      const next = new Set(prev);
      if (has) next.add(email.toLowerCase()); else next.delete(email.toLowerCase());
      return next;
    });
  const setPgAccessFor = setMembership(setPgAccess);
  const setPgWriteFor = setMembership(setPgWrite);

  const handlePgGrant = async (oid: string, email: string) => {
    setPgBusy((p) => ({ ...p, [oid]: true }));
    setActionError((p) => ({ ...p, [oid]: '' }));
    try {
      const token = await getAuthenticatedToken();
      await pgGrantAccess(token, pgServerId, email);
      setPgAccessFor(email, true);
    } catch (e: any) {
      setActionError((p) => ({ ...p, [oid]: e.message }));
    } finally {
      setPgBusy((p) => ({ ...p, [oid]: false }));
    }
  };

  const handlePgRevoke = async (oid: string, email: string) => {
    setPgBusy((p) => ({ ...p, [oid]: true }));
    setActionError((p) => ({ ...p, [oid]: '' }));
    try {
      const token = await getAuthenticatedToken();
      await pgRevokeAccess(token, pgServerId, email);
      setPgAccessFor(email, false);
      setPgWriteFor(email, false); // dropping the role removes write too
    } catch (e: any) {
      setActionError((p) => ({ ...p, [oid]: e.message }));
    } finally {
      setPgBusy((p) => ({ ...p, [oid]: false }));
    }
  };

  const handlePgGrantWrite = async (oid: string, email: string) => {
    setPgBusy((p) => ({ ...p, [oid]: true }));
    setActionError((p) => ({ ...p, [oid]: '' }));
    try {
      const token = await getAuthenticatedToken();
      await pgGrantWrite(token, pgServerId, email);
      setPgWriteFor(email, true);
    } catch (e: any) {
      setActionError((p) => ({ ...p, [oid]: e.message }));
    } finally {
      setPgBusy((p) => ({ ...p, [oid]: false }));
    }
  };

  const handlePgRevokeWrite = async (oid: string, email: string) => {
    setPgBusy((p) => ({ ...p, [oid]: true }));
    setActionError((p) => ({ ...p, [oid]: '' }));
    try {
      const token = await getAuthenticatedToken();
      await pgRevokeWrite(token, pgServerId, email);
      setPgWriteFor(email, false);
    } catch (e: any) {
      setActionError((p) => ({ ...p, [oid]: e.message }));
    } finally {
      setPgBusy((p) => ({ ...p, [oid]: false }));
    }
  };

  const handleAssign = async (oid: string) => {
    const role = pendingRole[oid];
    if (!role) return;
    try {
      setActionError((prev) => ({ ...prev, [oid]: '' }));
      const newAssignment = await assignUserRole(oid, role);
      setUsers((prev) => prev.map((u) =>
        u.oid === oid ? { ...u, roles: [...u.roles, newAssignment] } : u
      ));
      setPendingRole((prev) => ({ ...prev, [oid]: '' }));
    } catch (e: any) {
      setActionError((prev) => ({ ...prev, [oid]: e.message }));
    }
  };

  const handleRemove = async (oid: string, assignmentId: string) => {
    try {
      setActionError((prev) => ({ ...prev, [oid]: '' }));
      await removeUserRole(oid, assignmentId);
      setUsers((prev) => prev.map((u) =>
        u.oid === oid ? { ...u, roles: u.roles.filter((r) => r.assignment_id !== assignmentId) } : u
      ));
    } catch (e: any) {
      setActionError((prev) => ({ ...prev, [oid]: e.message }));
    }
  };

  if (!can('system:admin')) return <Navigate to="/hub" replace />;

  return (
    <AppLayout>
      <div style={{ padding: '28px 32px', maxWidth: 820, fontFamily: 'var(--font-body)' }}>
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, color: 'var(--fg)', margin: 0 }}>
            Role Management
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '6px 0 0' }}>
            Changes take effect on the user&apos;s next sign-in.
          </p>
        </div>

        {/* Roles & permissions reference */}
        <div className="qa-card" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 12 }}>Roles &amp; permissions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {ROLE_INFO.map((r) => (
              <div key={r.name} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: 62, textAlign: 'center', fontSize: 11, fontWeight: 600, padding: '2px 0',
                  borderRadius: 5, color: chipColor[r.name], background: `color-mix(in oklch, ${chipColor[r.name]} 14%, var(--panel))`,
                  border: `1px solid color-mix(in oklch, ${chipColor[r.name]} 35%, var(--border))`,
                }}>{r.name}</span>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
                  {r.caps.join(' · ')}
                </div>
              </div>
            ))}
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '14px 0 12px' }} />
          <div style={{ fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--fg)', fontWeight: 500 }}>Scope:</strong> roles are cumulative and apply
            app-wide (across every connection).{pgServers.length > 0 && (
              <> <strong style={{ color: 'var(--fg)', fontWeight: 500 }}>PostgreSQL access</strong> (right column below)
              is separate and scoped to a single server via Entra: <em>Read</em> grants SELECT; <em>Write</em> adds
              INSERT / UPDATE / DELETE. Editing rows needs an Analyst/Admin role <em>and</em> PostgreSQL write access.</>
            )}
          </div>
        </div>

        {pgServers.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>PostgreSQL server:</span>
            <select
              value={pgServerId}
              onChange={(e) => setPgServerId(e.target.value)}
              style={{ fontSize: 12, fontFamily: 'var(--font-body)', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', color: 'var(--fg)', cursor: 'pointer' }}
            >
              {pgServers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {pgAccessLoading && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Loading access…</span>}
          </div>
        )}

        {pgAccessError && (
          <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 8, fontSize: 12, lineHeight: 1.5, background: 'color-mix(in oklch, var(--status-err) 10%, var(--bg))', border: '1px solid color-mix(in oklch, var(--status-err) 30%, var(--border))', color: 'var(--status-err)', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
            Couldn&apos;t load PostgreSQL access: {pgAccessError}
          </div>
        )}

        {loading && (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Loading users…</div>
        )}

        {error && (
          <div style={{ color: 'var(--status-err)', fontSize: 13 }}>Error: {error}</div>
        )}

        {!loading && !error && users.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>No users have signed in yet.</div>
        )}

        {!loading && !error && users.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Current Roles', 'Add Role', ...(pgServers.length > 0 ? ['PostgreSQL'] : [])].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--muted)', fontWeight: 500, fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.oid} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="qa-avatar" style={{ width: 28, height: 28, fontSize: 12, flexShrink: 0 }}>
                        {(u.display_name ?? u.email).charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--fg)' }}>{u.display_name ?? u.email}</div>
                        {u.display_name && <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{u.email}</div>}
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '10px 10px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {u.roles.length === 0 && (
                        <span className="qa-chip" style={{ color: 'var(--muted)', fontSize: 11 }}>Viewer (default)</span>
                      )}
                      {u.roles.map((r) => (
                        <span key={r.assignment_id} className="qa-chip" style={{ display: 'flex', alignItems: 'center', gap: 4, color: chipColor[r.role_name] ?? 'var(--fg)' }}>
                          {r.role_name}
                          <button
                            onClick={() => handleRemove(u.oid, r.assignment_id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', lineHeight: 1, color: 'inherit', opacity: 0.7 }}
                            title={`Remove ${r.role_name}`}
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>

                  <td style={{ padding: '10px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <select
                        value={pendingRole[u.oid] ?? ''}
                        onChange={(e) => setPendingRole((prev) => ({ ...prev, [u.oid]: e.target.value }))}
                        style={{ fontSize: 12, fontFamily: 'var(--font-body)', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', color: 'var(--fg)', cursor: 'pointer' }}
                      >
                        <option value="">Select role…</option>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button
                        className="qa-btn"
                        disabled={!pendingRole[u.oid]}
                        onClick={() => handleAssign(u.oid)}
                        style={{ fontSize: 12, padding: '4px 10px' }}
                      >
                        Add
                      </button>
                    </div>
                    {actionError[u.oid] && (
                      <div style={{ fontSize: 11.5, color: 'var(--status-err)', marginTop: 4 }}>{actionError[u.oid]}</div>
                    )}
                  </td>

                  {pgServers.length > 0 && (
                    <td style={{ padding: '10px 10px', minWidth: 120 }}>
                      {pgAccessLoading ? (
                        <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Checking…</span>
                      ) : pgAccess.has(u.email.toLowerCase()) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="qa-chip ok" style={{ fontSize: 11 }}>● read</span>
                          {pgWrite.has(u.email.toLowerCase()) ? (
                            <>
                              <span className="qa-chip accent" style={{ fontSize: 11 }}>● write</span>
                              <button
                                className="qa-btn"
                                disabled={pgBusy[u.oid]}
                                onClick={() => handlePgRevokeWrite(u.oid, u.email)}
                                style={{ fontSize: 12, padding: '4px 10px' }}
                                title="Remove INSERT/UPDATE/DELETE, keep read"
                              >
                                {pgBusy[u.oid] ? '…' : 'Revoke write'}
                              </button>
                            </>
                          ) : (
                            <button
                              className="qa-btn"
                              disabled={pgBusy[u.oid]}
                              onClick={() => handlePgGrantWrite(u.oid, u.email)}
                              style={{ fontSize: 12, padding: '4px 10px' }}
                              title="Allow INSERT/UPDATE/DELETE (pg_write_all_data)"
                            >
                              {pgBusy[u.oid] ? '…' : 'Grant write'}
                            </button>
                          )}
                          <button
                            className="qa-btn"
                            disabled={pgBusy[u.oid]}
                            onClick={() => handlePgRevoke(u.oid, u.email)}
                            style={{ fontSize: 12, padding: '4px 10px' }}
                            title="Remove all access"
                          >
                            {pgBusy[u.oid] ? '…' : 'Revoke'}
                          </button>
                        </div>
                      ) : (
                        <button
                          className="qa-btn primary"
                          disabled={pgBusy[u.oid]}
                          onClick={() => handlePgGrant(u.oid, u.email)}
                          style={{ fontSize: 12, padding: '4px 10px' }}
                        >
                          {pgBusy[u.oid] ? '…' : 'Grant'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppLayout>
  );
}
