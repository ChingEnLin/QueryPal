import { USE_MSAL_AUTH, API_BASE_URL } from '../app.config';
import { msalInstance, loginRequest } from '../authConfig';

export type ArgusProfile = 'fast' | 'balanced' | 'thorough';
export type ArgusSeverity = 'critical' | 'warning' | 'info';
export type ArgusDiff = 'new' | 'regressed' | 'existing' | 'resolved';
export type ArgusJobStatus = 'queued' | 'running' | 'done' | 'error';

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
  created_by: string | null;
  history: unknown | null;
}

export interface ArgusJob {
  job_id: string;
  status: ArgusJobStatus;
  started_at: string;
  finished_at: string | null;
  collection: string;
  database: string;
  profile: ArgusProfile;
  report: ArgusReport | null;
  error: string | null;
}

export interface StartArgusAuditArgs {
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

export const startArgusAudit = async (
  args: StartArgusAuditArgs,
): Promise<{ job_id: string; status: ArgusJobStatus }> => {
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

export interface ArgusRunSummary {
  report_id: string;
  collection: string;
  database: string;
  cosmos_account: string;
  run_at: string | null;
  quality_score: number | null;
  run_eval_verdict: string | null;
  total_tokens: number;
  created_by: string | null;
  findings_count: number;
}

export interface ListArgusRunsArgs {
  accountId?: string;
  database?: string;
  collection?: string;
  limit?: number;
}

export const listArgusRuns = async (
  args: ListArgusRunsArgs = {},
): Promise<ArgusRunSummary[]> => {
  if (!USE_MSAL_AUTH) return [];
  const token = await getToken();
  const params = new URLSearchParams();
  if (args.accountId) params.set('account_id', args.accountId);
  if (args.database) params.set('database', args.database);
  if (args.collection) params.set('collection', args.collection);
  if (args.limit != null) params.set('limit', String(args.limit));
  const qs = params.toString();
  const response = await fetch(
    `${API_BASE_URL}/argus/runs${qs ? `?${qs}` : ''}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to list runs (${response.status})`);
  }
  const data = await response.json();
  return data.runs ?? [];
};

export const getArgusReport = async (reportId: string): Promise<ArgusReport> => {
  if (!USE_MSAL_AUTH) throw new Error('Sign in to load reports.');
  const token = await getToken();
  const response = await fetch(
    `${API_BASE_URL}/argus/reports/${encodeURIComponent(reportId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch report (${response.status})`);
  }
  return response.json();
};

export const getArgusJob = async (jobId: string): Promise<ArgusJob> => {
  const response = await fetch(`${API_BASE_URL}/argus/runs/${encodeURIComponent(jobId)}`, {
    method: 'GET',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch job (${response.status})`);
  }
  return response.json();
};
