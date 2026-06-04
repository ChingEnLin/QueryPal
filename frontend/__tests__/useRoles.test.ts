import { describe, it, expect } from 'vitest';
import { permissionsFor, canWith } from '../hooks/useRoles';

describe('rbac permissions', () => {
  it('viewer can read but not write', () => {
    expect(canWith(['Viewer'], 'query:read')).toBe(true);
    expect(canWith(['Viewer'], 'data:write')).toBe(false);
  });

  it('analyst can write data', () => {
    expect(canWith(['Analyst'], 'data:write')).toBe(true);
    expect(canWith(['Analyst'], 'audit:read')).toBe(false);
  });

  it('admin can read audit', () => {
    expect(canWith(['Admin'], 'audit:read')).toBe(true);
    expect(canWith(['Admin'], 'system:admin')).toBe(true);
  });

  it('no roles defaults to analyst permissions', () => {
    expect(permissionsFor([]).has('query:read')).toBe(true);
    expect(permissionsFor([]).has('data:write')).toBe(true);
    expect(permissionsFor([]).has('audit:read')).toBe(false);
  });
});
