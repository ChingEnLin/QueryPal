import { useUnifiedAuth } from './useUnifiedAuth';

const VIEWER = ['query:read', 'self:manage'];
const ANALYST = [...VIEWER, 'data:write', 'argus:write'];
const ADMIN = [...ANALYST, 'audit:read', 'system:admin'];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  Viewer: VIEWER,
  Analyst: ANALYST,
  Admin: ADMIN,
};

const DEFAULT_ROLE = 'Analyst';

export function permissionsFor(roles: string[]): Set<string> {
  const effective = roles.length ? roles : [DEFAULT_ROLE];
  const perms = new Set<string>();
  for (const role of effective) {
    (ROLE_PERMISSIONS[role] ?? []).forEach((p) => perms.add(p));
  }
  return perms;
}

export function canWith(roles: string[], permission: string): boolean {
  return permissionsFor(roles).has(permission);
}

export function useRoles() {
  const { user } = useUnifiedAuth();
  const roles = user?.roles ?? [];
  return {
    roles,
    can: (permission: string) => canWith(roles, permission),
  };
}
