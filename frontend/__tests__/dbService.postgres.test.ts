import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPostgresServers, pgExecute, pgGrantAccess, pgRevokeAccess } from '../services/dbService';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('postgres dbService', () => {
  it('lists servers from /postgres/servers', async () => {
    const servers = [{ name: 'database-patient-server', id: '/sub/.../s', fqdn: 's.postgres.database.azure.com' }];
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => servers })));
    const out = await listPostgresServers('tok');
    expect(out[0].name).toBe('database-patient-server');
    expect((fetch as any).mock.calls[0][0]).toContain('/postgres/servers');
  });

  it('posts sql to /postgres/execute', async () => {
    const body = { columns: ['id'], rows: [[1]] };
    const f = vi.fn(async () => ({ ok: true, json: async () => body }));
    vi.stubGlobal('fetch', f);
    const out = await pgExecute('tok', '/sub/.../s', 'appdb', 'SELECT id FROM patients');
    expect(out).toEqual(body);
    expect(f.mock.calls[0][0]).toContain('/postgres/execute');
  });

  it('grants access via /postgres/grant', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ granted: 'u@x.io', created: true }) }));
    vi.stubGlobal('fetch', f);
    await pgGrantAccess('tok', '/s', 'u@x.io');
    expect(f.mock.calls[0][0]).toContain('/postgres/grant');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ server_id: '/s', user_email: 'u@x.io' });
  });

  it('revokes access via /postgres/revoke', async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ revoked: 'u@x.io' }) }));
    vi.stubGlobal('fetch', f);
    await pgRevokeAccess('tok', '/s', 'u@x.io');
    expect(f.mock.calls[0][0]).toContain('/postgres/revoke');
  });
});
