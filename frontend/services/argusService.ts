import { USE_MSAL_AUTH, API_BASE_URL } from '../app.config';
import { msalInstance, loginRequest } from '../authConfig';

export type ArgusProfile = 'fast' | 'balanced' | 'thorough';
export type ArgusSeverity = 'critical' | 'warning' | 'info';
export type ArgusDiff = 'new' | 'regressed' | 'existing' | 'resolved';
export type ArgusJobStatus = 'queued' | 'running' | 'done' | 'error';
export type ArgusUserLabel = 'tp' | 'fp';
export type ArgusFindingStatus = 'published' | 'pending_review' | 'dropped';
export type ArgusEscalationVerdict = 'tp' | 'fp' | 'need_info';

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
  // Arm A — most recent human verdict for this finding, when present.
  user_label?: ArgusUserLabel | null;
  // Arm B — self-assessment + lifecycle marker. Pending findings are
  // filtered out of report.findings server-side; these fields are still
  // surfaced on the rare path where the UI inspects them directly.
  confidence?: number | null;
  confidence_reason?: string | null;
  status?: ArgusFindingStatus;
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
  counts: { critical: number; warning: number; info: number; dismissed: number; pending_review?: number };
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

export type ArgusMinSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ArgusOverrides {
  sample_size?: number;
  max_iterations?: number;
  min_severity?: ArgusMinSeverity;
}

export interface EvaluatorOverrides {
  action_evaluator?: 'none' | 'rules' | 'self' | 'judge' | 'composite';
  finding_evaluator?: 'none' | 'rules' | 'self' | 'judge' | 'composite';
  run_evaluator?: 'none' | 'rules' | 'self' | 'judge' | 'composite';
  judge_provider?: 'gemini' | 'openai' | 'anthropic' | null;
  judge_model?: string | null;
  action_pass_threshold?: number;
  finding_pass_threshold?: number;
  run_pass_threshold?: number;
  rejected_finding_policy?: 'drop' | 'log_only' | 'demote_severity';
  run_fail_policy?: 'continue' | 'warn_only' | 'abort';
}

export interface StartArgusAuditArgs {
  accountId: string;
  database: string;
  collection: string;
  profile: ArgusProfile;
  maxIterations?: number;
  argusOverrides?: ArgusOverrides;
  configOverrides?: EvaluatorOverrides;
  savedProfileId?: string;
}

export interface SavedArgusProfile {
  id: string;
  name: string;
  base_profile: ArgusProfile;
  evaluator_overrides: EvaluatorOverrides;
  argus_overrides: ArgusOverrides;
  created_at?: string | null;
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
      ...(args.argusOverrides ? { argus_overrides: args.argusOverrides } : {}),
      ...(args.configOverrides ? { config_overrides: args.configOverrides } : {}),
      ...(args.savedProfileId ? { saved_profile_id: args.savedProfileId } : {}),
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
  counts?: { critical: number; warning: number; info: number };
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

export const listSavedProfiles = async (): Promise<SavedArgusProfile[]> => {
  if (!USE_MSAL_AUTH) return [];
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/argus/profiles`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to list profiles (${response.status})`);
  }
  const data = await response.json();
  return data.profiles ?? [];
};

export interface CreateSavedProfileArgs {
  name: string;
  baseProfile: ArgusProfile;
  evaluatorOverrides: EvaluatorOverrides;
  argusOverrides: ArgusOverrides;
}

export const createSavedProfile = async (
  args: CreateSavedProfileArgs,
): Promise<SavedArgusProfile> => {
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/argus/profiles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: args.name,
      base_profile: args.baseProfile,
      evaluator_overrides: args.evaluatorOverrides,
      argus_overrides: args.argusOverrides,
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to save profile (${response.status})`);
  }
  return response.json();
};

export const deleteSavedProfile = async (profileId: string): Promise<void> => {
  const token = await getToken();
  const response = await fetch(
    `${API_BASE_URL}/argus/profiles/${encodeURIComponent(profileId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to delete profile (${response.status})`);
  }
};

export interface RateArgusFindingArgs {
  reportId: string;
  findingId: string;
  label: ArgusUserLabel;
}

export const rateArgusFinding = async (
  args: RateArgusFindingArgs,
): Promise<{ user_label: ArgusUserLabel; rated_by: string }> => {
  if (!USE_MSAL_AUTH) throw new Error('Sign in to rate findings.');
  const token = await getToken();
  const response = await fetch(
    `${API_BASE_URL}/argus/findings/${encodeURIComponent(args.reportId)}/${encodeURIComponent(args.findingId)}/rate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ label: args.label }),
    },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to rate finding (${response.status})`);
  }
  return response.json();
};

// ---------------------------------------------------------------------------
// Arm B — self-escalation queue
// ---------------------------------------------------------------------------

export interface ArgusEscalation {
  finding_id: string;
  report_id: string;
  collection: string;
  database: string;
  cosmos_account: string;
  field: string;
  category: string;
  severity: string;
  description: string;
  hypothesis: string;
  evidence_query: string;
  affected_count: number;
  affected_pct: number;
  confidence: number | null;
  confidence_reason: string | null;
  sample_values: unknown[];
  created_at: string | null;
  escalated_at: string | null;
}

export const listArgusEscalations = async (limit = 50): Promise<ArgusEscalation[]> => {
  if (!USE_MSAL_AUTH) return [];
  const token = await getToken();
  const response = await fetch(`${API_BASE_URL}/argus/escalations?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to list escalations (${response.status})`);
  }
  const data = await response.json();
  return data.escalations ?? [];
};

export const resolveArgusEscalation = async (args: {
  reportId: string;
  findingId: string;
  verdict: ArgusEscalationVerdict;
}): Promise<{ verdict: ArgusEscalationVerdict; resolved_by: string }> => {
  if (!USE_MSAL_AUTH) throw new Error('Sign in to resolve escalations.');
  const token = await getToken();
  const response = await fetch(
    `${API_BASE_URL}/argus/escalations/${encodeURIComponent(args.reportId)}/${encodeURIComponent(args.findingId)}/resolve`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ verdict: args.verdict }),
    },
  );
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to resolve escalation (${response.status})`);
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
