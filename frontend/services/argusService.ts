import { USE_MSAL_AUTH, API_BASE_URL } from '../app.config';
import { msalInstance, loginRequest } from '../authConfig';

export type ArgusProfile = 'fast' | 'balanced' | 'thorough';
export type ArgusSeverity = 'critical' | 'warning' | 'info';
export type ArgusDiff = 'new' | 'regressed' | 'existing' | 'resolved';

export interface ArgusFinding {
  id: string;
  severity: ArgusSeverity;
  field: string;
  category: string;
  summary: string;
  description: string;
  evidence: string;
  affected: number;
  total: number;
  affected_pct: number;
  diff: ArgusDiff;
  trace: string;
}

export interface ArgusReport {
  report_id: string;
  collection: string;
  database: string;
  cosmos_account: string;
  run_at: string;
  duration_seconds: number;
  documents_sampled: number;
  collection_size: number | null;
  iterations: number;
  total_tokens: number;
  model: string;
  profile: ArgusProfile;
  quality_score: number | null;
  counts: { critical: number; warning: number; info: number; dismissed: number };
  diff: { new: number; resolved: number; regressed: number };
  findings: ArgusFinding[];
  history: unknown | null;
}

export interface RunArgusAuditArgs {
  accountId: string;
  database: string;
  collection: string;
  profile: ArgusProfile;
  maxIterations?: number;
}

const getToken = async (): Promise<string> => {
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) throw new Error('No signed-in user found.');
  const response = await msalInstance.acquireTokenSilent({
    ...loginRequest,
    account: accounts[0],
  });
  return response.accessToken;
};

export const runArgusAudit = async (args: RunArgusAuditArgs): Promise<ArgusReport> => {
  if (!USE_MSAL_AUTH) {
    throw new Error('QueryArgus runs require Azure authentication. Enable MSAL in app.config.ts.');
  }
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/argus/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      account_id: args.accountId,
      database: args.database,
      collection: args.collection,
      profile: args.profile,
      max_iterations: args.maxIterations ?? 20,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Argus run failed (${response.status})`);
  }
  return response.json();
};
