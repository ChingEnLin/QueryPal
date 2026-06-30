import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPostgresServers, pgExecute } from '../services/dbService';

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
});
