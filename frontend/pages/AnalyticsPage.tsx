import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CollectionSummary } from '../types';
import {
  ArgusDiff,
  ArgusFinding,
  ArgusJobStatus,
  ArgusMinSeverity,
  ArgusProfile,
  ArgusReport,
  ArgusRunSummary,
  ArgusSeverity,
  SavedArgusProfile,
  createSavedProfile,
  deleteSavedProfile,
  getArgusJob,
  getArgusReport,
  listArgusRuns,
  listSavedProfiles,
  startArgusAudit,
} from '../services/argusService';
import { ArgusTrendsPanel } from '../components/ArgusTrendsPanel';
import { useNotifications } from '../contexts/NotificationsContext';

const DEFAULT_MAX_ITER = 20;
const DEFAULT_SAMPLE_SIZE = 200;
const DEFAULT_MIN_SEVERITY: ArgusMinSeverity = 'low';
const MIN_SEVERITIES: ArgusMinSeverity[] = ['low', 'medium', 'high', 'critical'];

type EvalStrategy = 'none' | 'rules' | 'self' | 'judge' | 'composite';
type JudgeProvider = 'gemini' | 'openai' | 'anthropic';
type RejectedPolicy = 'drop' | 'log_only' | 'demote_severity';
type RunFailPolicy = 'continue' | 'warn_only' | 'abort';

interface EvalState {
  action_evaluator: EvalStrategy;
  finding_evaluator: EvalStrategy;
  run_evaluator: EvalStrategy;
  judge_provider: JudgeProvider | null;
  judge_model: string | null;
  action_pass_threshold: number;
  finding_pass_threshold: number;
  run_pass_threshold: number;
  rejected_finding_policy: RejectedPolicy;
  run_fail_policy: RunFailPolicy;
}

// Baselines must match backend `PROFILE_*` in queryargus/models/config.py.
const PROFILE_BASELINES: Record<ArgusProfile, EvalState> = {
  fast: {
    action_evaluator: 'rules', finding_evaluator: 'rules', run_evaluator: 'rules',
    judge_provider: null, judge_model: null,
    action_pass_threshold: 0.6, finding_pass_threshold: 0.7, run_pass_threshold: 0.5,
    rejected_finding_policy: 'log_only', run_fail_policy: 'continue',
  },
  balanced: {
    action_evaluator: 'rules', finding_evaluator: 'composite', run_evaluator: 'self',
    judge_provider: null, judge_model: null,
    action_pass_threshold: 0.6, finding_pass_threshold: 0.7, run_pass_threshold: 0.5,
    rejected_finding_policy: 'log_only', run_fail_policy: 'continue',
  },
  thorough: {
    action_evaluator: 'rules', finding_evaluator: 'composite', run_evaluator: 'judge',
    judge_provider: 'openai', judge_model: 'gpt-4o',
    action_pass_threshold: 0.6, finding_pass_threshold: 0.7, run_pass_threshold: 0.5,
    rejected_finding_policy: 'log_only', run_fail_policy: 'continue',
  },
};

const EVAL_STRATEGIES: EvalStrategy[] = ['none', 'rules', 'self', 'judge', 'composite'];
const JUDGE_PROVIDERS: JudgeProvider[] = ['gemini', 'openai', 'anthropic'];
const REJECTED_POLICIES: RejectedPolicy[] = ['drop', 'log_only', 'demote_severity'];
const RUN_FAIL_POLICIES: RunFailPolicy[] = ['continue', 'warn_only', 'abort'];

const diffEvalState = (
  current: EvalState,
  baseline: EvalState,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  (Object.keys(baseline) as Array<keyof EvalState>).forEach((k) => {
    if (current[k] !== baseline[k]) out[k] = current[k];
  });
  return out;
};

const JOB_STORAGE_KEY = 'qp_argus_jobs';

type JobMap = Record<string, string>;

const readJobMap = (): JobMap => {
  try { return JSON.parse(sessionStorage.getItem(JOB_STORAGE_KEY) ?? '{}'); }
  catch { return {}; }
};

const writeJobMap = (map: JobMap) => {
  sessionStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(map));
};

const jobKey = (accountId: string, database: string, collection: string) =>
  `${accountId}::${database}::${collection}`;

const PROFILE_INFO: Record<ArgusProfile, { tagline: string; speed: string; cost: string; body: string }> = {
  fast: {
    tagline: 'Quick scan — rule-based checks only.',
    speed: '~20–40s',
    cost: 'lowest',
    body: 'Looks for missing fields, type mismatches, and obvious anomalies using fixed rules. No second-pass review, so findings reflect the agent\'s initial judgment. Best for a quick health check or smoke test before a deeper run.',
  },
  balanced: {
    tagline: 'Recommended — rules + a self-review pass.',
    speed: '~40–90s',
    cost: 'moderate',
    body: 'Runs the same rule checks, then has the agent re-examine each finding and weigh them against the overall picture before reporting. Catches more real issues and filters out noise. The best default for most collections.',
  },
  thorough: {
    tagline: 'Deepest review — uses a separate judge model.',
    speed: '~2–4 min',
    cost: 'highest',
    body: 'Adds a second, independent AI model that audits the run end-to-end and grades each finding. Slowest and priciest, but the most defensible results — use before sharing a report externally or making schema changes.',
  },
};

interface InfoPopoverProps {
  title: string;
  children: React.ReactNode;
  align?: 'left' | 'right';
}

const InfoPopover: React.FC<InfoPopoverProps> = ({ title, children, align = 'left' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        aria-label={`About ${title}`}
        title={title}
        style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '1px solid var(--border)', background: 'var(--soft)',
          color: 'var(--muted)', cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontFamily: 'var(--font-body)', lineHeight: 1, fontWeight: 600,
        }}
      >?</button>
      {open && (
        <div
          role="dialog"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)',
            [align === 'right' ? 'right' : 'left']: 0,
            zIndex: 200, width: 280,
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '10px 12px', fontFamily: 'var(--font-body)',
            textTransform: 'none', letterSpacing: 'normal',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg)', marginBottom: 4 }}>{title}</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5, color: 'var(--muted)' }}>{children}</div>
        </div>
      )}
    </span>
  );
};

const ProfileChip: React.FC<{
  p: ArgusProfile;
  active: boolean;
  onSelect: () => void;
}> = ({ p, active, onSelect }) => {
  const [hover, setHover] = useState(false);
  const info = PROFILE_INFO[p];
  return (
    <span style={{ position: 'relative' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        onClick={onSelect}
        style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11.5,
          background: active ? 'var(--panel)' : 'transparent',
          boxShadow: active ? '0 0 0 1px var(--border)' : 'none',
          color: active ? 'var(--fg)' : 'var(--muted)',
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          textTransform: 'capitalize',
        }}
      >{p}</span>
      {hover && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)', zIndex: 200, width: 240,
          background: 'var(--panel)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          padding: '8px 10px', fontFamily: 'var(--font-body)',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--fg)', marginBottom: 3, textTransform: 'capitalize' }}>
            {p} · {info.tagline}
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--muted)', marginBottom: 5 }}>
            {info.body}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', display: 'flex', gap: 10 }}>
            <span><span style={{ color: 'var(--fg)' }}>{info.speed}</span> typical</span>
            <span>·</span>
            <span><span style={{ color: 'var(--fg)' }}>{info.cost}</span> cost</span>
          </div>
        </div>
      )}
    </span>
  );
};

const SavedProfileChip: React.FC<{
  profile: SavedArgusProfile;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ profile, active, onSelect, onDelete }) => {
  const [hover, setHover] = useState(false);
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 6px 2px 8px', borderRadius: 4, fontSize: 11.5,
        background: active ? 'var(--panel)' : 'transparent',
        boxShadow: active ? '0 0 0 1px var(--border)' : 'none',
        color: active ? 'var(--fg)' : 'var(--muted)',
        cursor: 'pointer', fontFamily: 'var(--font-body)',
      }}
      title={`Based on ${profile.base_profile}`}
    >
      <span onClick={onSelect} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 2h6l2 2v10l-4-2-4 2V2z" strokeLinejoin="round" />
        </svg>
        {profile.name}
      </span>
      {hover && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (confirm(`Delete profile "${profile.name}"?`)) onDelete(); }}
          aria-label="Delete profile"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', padding: 0, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', width: 12, height: 12,
          }}
        >
          <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  );
};

const OverrideSlider: React.FC<{
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  value: number;
  defaultValue: number;
  onChange: (v: number) => void;
}> = ({ label, help, min, max, step, value, defaultValue, onChange }) => {
  const modified = value !== defaultValue;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240, flex: '0 1 280px' }}>
      <div style={{
        fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--font-body)',
      }}>
        <span>{label}</span>
        <InfoPopover title={label}>{help}</InfoPopover>
        {modified && (
          <span style={{
            marginLeft: 'auto', fontSize: 9, color: 'var(--accent)',
            background: 'var(--accent-soft)', padding: '0 5px', borderRadius: 8,
            textTransform: 'none', letterSpacing: 0,
          }}>modified</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg)',
          minWidth: 40, textAlign: 'right',
        }}>{value}</span>
      </div>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
        <span>{min}</span>
        <span>default {defaultValue}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

const ThresholdInput: React.FC<{
  label: string;
  help: string;
  value: number;
  defaultValue: number;
  onChange: (v: number) => void;
}> = ({ label, help, value, defaultValue, onChange }) => {
  const modified = value !== defaultValue;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140 }}>
      <div style={{
        fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--font-body)',
      }}>
        <span>{label}</span>
        <InfoPopover title={label}>{help}</InfoPopover>
        {modified && (
          <span style={{
            fontSize: 9, color: 'var(--accent)', background: 'var(--accent-soft)',
            padding: '0 5px', borderRadius: 8, textTransform: 'none', letterSpacing: 0,
          }}>modified</span>
        )}
      </div>
      <input
        type="number"
        min={0} max={1} step={0.05}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(Math.min(1, Math.max(0, n)));
        }}
        style={{
          padding: '4px 8px', borderRadius: 6, fontSize: 12,
          background: 'var(--panel)', color: 'var(--fg)',
          border: '1px solid var(--border)', fontFamily: 'var(--font-mono)',
          width: 90,
        }}
      />
    </div>
  );
};

interface AnalyticsPageProps {
  accountId?: string;
  databaseName?: string;
  collections?: CollectionSummary[];
}

const SEVER_COLOR: Record<ArgusSeverity, string> = {
  critical: '#c94250',
  warning: '#c98d42',
  info: 'var(--muted)',
};
const SEVER_BG: Record<ArgusSeverity, string> = {
  critical: '#fdf0f1',
  warning: '#fdf6ed',
  info: 'var(--soft)',
};
const DIFF_COLOR: Record<ArgusDiff, string> = {
  new: '#1d6cf2',
  regressed: '#c98d42',
  existing: 'var(--muted)',
  resolved: 'var(--accent)',
};

const ScoreArc: React.FC<{ score: number }> = ({ score }) => {
  const R = 48, cx = 60, cy = 60;
  const pct = score / 100;
  const col = score >= 80 ? '#3a8c5f' : score >= 60 ? '#c98d42' : '#c94250';
  const sweep = 270;
  const start = 135;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + R * Math.cos(rad(start));
  const y1 = cy + R * Math.sin(rad(start));
  const end = start + sweep;
  const x2 = cx + R * Math.cos(rad(end));
  const y2 = cy + R * Math.sin(rad(end));
  const bgArc = `M ${x1} ${y1} A ${R} ${R} 0 1 1 ${x2} ${y2}`;
  const filledEnd = start + sweep * pct;
  const xe = cx + R * Math.cos(rad(filledEnd));
  const ye = cy + R * Math.sin(rad(filledEnd));
  const largeArc = sweep * pct > 180 ? 1 : 0;
  const fgArc = `M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${xe.toFixed(2)} ${ye.toFixed(2)}`;
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <path d={bgArc} fill="none" stroke="var(--border)" strokeWidth="8" strokeLinecap="round" />
      <path d={fgArc} fill="none" stroke={col} strokeWidth="8" strokeLinecap="round" />
      <text x="60" y="58" textAnchor="middle" fontSize="22" fontWeight="500" fontFamily="var(--font-display)" fill="var(--fg)">{score}</text>
      <text x="60" y="72" textAnchor="middle" fontSize="10" fill="var(--muted)" fontFamily="var(--font-body)">/ 100</text>
      <text x="60" y="88" textAnchor="middle" fontSize="9" fill={col} fontFamily="var(--font-body)">
        {score >= 80 ? 'Good' : score >= 60 ? 'Moderate' : 'Poor'}
      </text>
    </svg>
  );
};

const tagStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center',
  padding: '0 6px', height: 18, borderRadius: 4,
  fontSize: 10, fontFamily: 'var(--font-body)',
  border: '1px solid var(--border)', background: 'var(--soft)',
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em',
  color: 'var(--muted)', marginBottom: 6,
  display: 'flex', alignItems: 'center', gap: 6,
  fontFamily: 'var(--font-body)',
};

const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ accountId, databaseName, collections }) => {
  const hasConnection = !!(accountId && databaseName);
  const { trackArgusRun } = useNotifications();
  const [collection, setCollection] = useState<string>(() => {
    if (!collections || collections.length === 0) return '';
    return [...collections].sort((a, b) => a.name.localeCompare(b.name))[0].name;
  });
  const [collectionDefaulting, setCollectionDefaulting] = useState(false);
  const userPickedCollectionRef = useRef(false);
  // Reset the "user picked" flag whenever the account/database scope changes
  // so the next auto-default can run for the new scope.
  useEffect(() => { userPickedCollectionRef.current = false; }, [accountId, databaseName]);
  // Default the dropdown to the collection with the most recent persisted run
  // for this account/database; fall back to the first alphabetical collection.
  useEffect(() => {
    if (userPickedCollectionRef.current) return;
    if (!collections || collections.length === 0) return;
    const alphaFirst = [...collections].sort((a, b) => a.name.localeCompare(b.name))[0].name;
    let cancelled = false;
    setCollectionDefaulting(true);
    (async () => {
      let target = alphaFirst;
      if (accountId && databaseName) {
        try {
          const rows = await listArgusRuns({ accountId, database: databaseName, limit: 1 });
          const recent = rows[0]?.collection;
          if (recent && collections.some((c) => c.name === recent)) target = recent;
        } catch {
          // ignore — fall back to alphabetical
        }
      }
      if (!cancelled && !userPickedCollectionRef.current) setCollection(target);
      if (!cancelled) setCollectionDefaulting(false);
    })();
    return () => { cancelled = true; };
  }, [accountId, databaseName, collections]);
  const [profile, setProfile] = useState<ArgusProfile>('fast');
  const [report, setReport] = useState<ArgusReport | null>(null);
  const [jobStatus, setJobStatus] = useState<ArgusJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'findings' | 'history' | 'trends'>('findings');
  const [history, setHistory] = useState<ArgusRunSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openingReportId, setOpeningReportId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  // Tier 2 — Customize this run
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [maxIter, setMaxIter] = useState<number>(DEFAULT_MAX_ITER);
  const [sampleSize, setSampleSize] = useState<number>(DEFAULT_SAMPLE_SIZE);
  const [minSeverity, setMinSeverity] = useState<ArgusMinSeverity>(DEFAULT_MIN_SEVERITY);
  // Tier 3 — Advanced evaluator config (rebased onto profile baseline)
  const [evalState, setEvalState] = useState<EvalState>(PROFILE_BASELINES.fast);
  // Reset evaluator state when profile changes so the matrix reflects the new baseline.
  useEffect(() => { setEvalState(PROFILE_BASELINES[profile]); }, [profile]);
  const evalBaseline = PROFILE_BASELINES[profile];
  const evalDiff = useMemo(() => diffEvalState(evalState, evalBaseline), [evalState, evalBaseline]);
  const evalOverrideCount = Object.keys(evalDiff).length;
  const overrideCount =
    (maxIter !== DEFAULT_MAX_ITER ? 1 : 0) +
    (sampleSize !== DEFAULT_SAMPLE_SIZE ? 1 : 0) +
    (minSeverity !== DEFAULT_MIN_SEVERITY ? 1 : 0) +
    evalOverrideCount;
  const judgeEnabled = evalState.action_evaluator === 'judge' || evalState.action_evaluator === 'composite' ||
    evalState.finding_evaluator === 'judge' || evalState.finding_evaluator === 'composite' ||
    evalState.run_evaluator === 'judge' || evalState.run_evaluator === 'composite';
  const resetOverrides = () => {
    setMaxIter(DEFAULT_MAX_ITER);
    setSampleSize(DEFAULT_SAMPLE_SIZE);
    setMinSeverity(DEFAULT_MIN_SEVERITY);
    setEvalState(PROFILE_BASELINES[profile]);
  };
  const updateEval = <K extends keyof EvalState>(k: K, v: EvalState[K]) =>
    setEvalState((s) => ({ ...s, [k]: v }));

  // Tier 4 — saved custom profiles
  const [savedProfiles, setSavedProfiles] = useState<SavedArgusProfile[]>([]);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);

  const refreshProfiles = useCallback(async () => {
    try {
      const rows = await listSavedProfiles();
      setSavedProfiles(rows);
    } catch (e) {
      console.warn('listSavedProfiles failed', e);
    }
  }, []);
  useEffect(() => { refreshProfiles(); }, [refreshProfiles]);

  const applySavedProfile = (p: SavedArgusProfile) => {
    setActiveSavedId(p.id);
    setProfile(p.base_profile);
    // setProfile schedules a useEffect that resets evalState to baseline;
    // queue our overrides for the next tick.
    setTimeout(() => {
      const base = PROFILE_BASELINES[p.base_profile];
      setEvalState({ ...base, ...p.evaluator_overrides } as EvalState);
      const argus = p.argus_overrides || {};
      setMaxIter(typeof argus.max_iterations === 'number' ? argus.max_iterations : DEFAULT_MAX_ITER);
      setSampleSize(typeof argus.sample_size === 'number' ? argus.sample_size : DEFAULT_SAMPLE_SIZE);
      setMinSeverity((argus.min_severity as ArgusMinSeverity | undefined) ?? DEFAULT_MIN_SEVERITY);
    }, 0);
  };

  // Clear the active saved-profile pointer when the user tweaks anything by hand.
  useEffect(() => {
    if (!activeSavedId) return;
    const sp = savedProfiles.find((p) => p.id === activeSavedId);
    if (!sp) return;
    const base = PROFILE_BASELINES[sp.base_profile];
    const expectedEval = { ...base, ...sp.evaluator_overrides };
    const matchesEval = (Object.keys(base) as Array<keyof EvalState>).every(
      (k) => (expectedEval as EvalState)[k] === evalState[k],
    );
    const argus = sp.argus_overrides || {};
    const matchesArgus =
      maxIter === (typeof argus.max_iterations === 'number' ? argus.max_iterations : DEFAULT_MAX_ITER) &&
      sampleSize === (typeof argus.sample_size === 'number' ? argus.sample_size : DEFAULT_SAMPLE_SIZE) &&
      minSeverity === ((argus.min_severity as ArgusMinSeverity | undefined) ?? DEFAULT_MIN_SEVERITY) &&
      sp.base_profile === profile;
    if (!matchesEval || !matchesArgus) setActiveSavedId(null);
  }, [evalState, maxIter, sampleSize, minSeverity, profile, activeSavedId, savedProfiles]);

  const handleSaveProfile = async () => {
    if (!saveName.trim()) { setSaveError('Name is required'); return; }
    setSaveBusy(true); setSaveError(null);
    try {
      const argus: Record<string, unknown> = {};
      if (maxIter !== DEFAULT_MAX_ITER) argus.max_iterations = maxIter;
      if (sampleSize !== DEFAULT_SAMPLE_SIZE) argus.sample_size = sampleSize;
      if (minSeverity !== DEFAULT_MIN_SEVERITY) argus.min_severity = minSeverity;
      const created = await createSavedProfile({
        name: saveName.trim(),
        baseProfile: profile,
        evaluatorOverrides: evalDiff as never,
        argusOverrides: argus as never,
      });
      setSavedProfiles((s) => [created, ...s]);
      setActiveSavedId(created.id);
      setSaveDialogOpen(false);
      setSaveName('');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaveBusy(false);
    }
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      await deleteSavedProfile(id);
      setSavedProfiles((s) => s.filter((p) => p.id !== id));
      if (activeSavedId === id) setActiveSavedId(null);
    } catch (e) {
      console.warn('deleteSavedProfile failed', e);
    }
  };

  const refreshHistory = useCallback(async () => {
    if (!accountId || !databaseName || !collection) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    try {
      const rows = await listArgusRuns({
        accountId,
        database: databaseName,
        collection,
        limit: 20,
      });
      setHistory(rows);
    } catch (e) {
      // History fetch failures shouldn't block the run flow.
      console.warn('listArgusRuns failed', e);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [accountId, databaseName, collection]);

  useEffect(() => { refreshHistory(); }, [refreshHistory]);

  const loadHistoricalReport = useCallback(async (reportId: string) => {
    setError(null);
    setOpeningReportId(reportId);
    try {
      const r = await getArgusReport(reportId);
      setReport(r);
      setSelId(r.findings[0]?.id ?? null);
      setActiveTab('findings');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setOpeningReportId(null);
    }
  }, []);

  const loading = jobStatus === 'queued' || jobStatus === 'running';

  const findings = report?.findings ?? [];
  const sel: ArgusFinding | null = useMemo(() => {
    if (!findings.length) return null;
    return findings.find((f) => f.id === selId) ?? findings[0];
  }, [findings, selId]);

  const clearPoll = () => {
    if (pollRef.current != null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const clearStoredJob = useCallback((aid: string, db: string, col: string) => {
    const map = readJobMap();
    delete map[jobKey(aid, db, col)];
    writeJobMap(map);
  }, []);

  const pollJob = useCallback(async (id: string, aid: string, db: string, col: string) => {
    try {
      const job = await getArgusJob(id);
      setJobStatus(job.status);
      if (job.status === 'done' && job.report) {
        setReport(job.report);
        setSelId(job.report.findings[0]?.id ?? null);
        clearPoll();
        clearStoredJob(aid, db, col);
        refreshHistory();
      } else if (job.status === 'error') {
        setError(job.error || 'Audit failed.');
        clearPoll();
        clearStoredJob(aid, db, col);
      }
    } catch (e) {
      // 404 means the job was evicted (backend restarted, etc.) — drop it.
      setError(e instanceof Error ? e.message : String(e));
      clearPoll();
      clearStoredJob(aid, db, col);
    }
  }, [clearStoredJob, refreshHistory]);

  // Resume an in-flight poll when the page mounts or the collection changes.
  useEffect(() => {
    clearPoll();
    setReport(null);
    setError(null);
    setJobStatus(null);
    setSelId(null);
    setActiveTab('findings');
    if (!accountId || !databaseName || !collection) return;
    const stored = readJobMap()[jobKey(accountId, databaseName, collection)];
    if (!stored) return;
    setJobStatus('running');
    trackArgusRun({
      jobId: stored,
      accountId,
      database: databaseName,
      collection,
      startedAt: Date.now(),
    });
    pollJob(stored, accountId, databaseName, collection);
    pollRef.current = window.setInterval(
      () => pollJob(stored, accountId, databaseName, collection),
      3000,
    );
    return clearPoll;
  }, [accountId, databaseName, collection, pollJob, trackArgusRun]);

  const runAudit = async () => {
    if (!accountId || !databaseName || !collection) return;
    clearPoll();
    setError(null);
    setReport(null);
    setSelId(null);
    setJobStatus('queued');
    try {
      const argusOverrides: Record<string, unknown> = {};
      if (maxIter !== DEFAULT_MAX_ITER) argusOverrides.max_iterations = maxIter;
      if (sampleSize !== DEFAULT_SAMPLE_SIZE) argusOverrides.sample_size = sampleSize;
      if (minSeverity !== DEFAULT_MIN_SEVERITY) argusOverrides.min_severity = minSeverity;
      const { job_id } = await startArgusAudit({
        accountId,
        database: databaseName,
        collection,
        profile,
        maxIterations: maxIter,
        argusOverrides: Object.keys(argusOverrides).length ? argusOverrides : undefined,
        configOverrides: evalOverrideCount > 0 ? (evalDiff as never) : undefined,
        savedProfileId: activeSavedId ?? undefined,
      });
      const map = readJobMap();
      map[jobKey(accountId, databaseName, collection)] = job_id;
      writeJobMap(map);
      trackArgusRun({
        jobId: job_id,
        accountId,
        database: databaseName,
        collection,
        startedAt: Date.now(),
      });
      pollJob(job_id, accountId, databaseName, collection);
      pollRef.current = window.setInterval(
        () => pollJob(job_id, accountId, databaseName, collection),
        3000,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setJobStatus('error');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg)', minHeight: 0 }}>
      {/* QueryArgus + controls row */}
      <div style={{
        padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 20, height: 20, borderRadius: 4, background: 'var(--fg)', color: 'var(--bg)',
            display: 'grid', placeItems: 'center', fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600,
          }}>A</div>
          <span style={{ fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-body)' }}>QueryArgus</span>
          <span style={tagStyle}>data quality</span>
          <InfoPopover title="What is QueryArgus?">
            <p style={{ margin: '0 0 6px' }}>
              QueryArgus is an automated reviewer that inspects a collection and flags data-quality issues
              — missing fields, inconsistent types, duplicate keys, suspicious values, and more.
            </p>
            <p style={{ margin: '0 0 6px' }}>
              It works like a careful analyst: it samples documents, asks itself questions, runs follow-up
              queries to confirm hunches, and writes a short report with evidence for every finding.
            </p>
            <p style={{ margin: 0 }}>
              Use it before a migration, when onboarding a new collection, or whenever a dashboard
              starts looking wrong. No changes are made to your data.
            </p>
          </InfoPopover>
        </div>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
          {databaseName ?? '—'}
        </span>
        {hasConnection && (collections?.length ?? 0) > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <select
              value={collection}
              onChange={(e) => { userPickedCollectionRef.current = true; setCollection(e.target.value); }}
              disabled={collectionDefaulting}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                padding: '3px 8px', borderRadius: 6,
                background: 'var(--panel)', color: 'var(--fg)',
                border: '1px solid var(--border)',
                cursor: collectionDefaulting ? 'progress' : 'pointer',
                opacity: collectionDefaulting ? 0.7 : 1,
              }}
            >
              {[...collections!]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
            </select>
            {collectionDefaulting && (
              <svg
                width="13" height="13" viewBox="0 0 16 16" fill="none"
                stroke="var(--muted)" strokeWidth="1.5"
                style={{ animation: 'qp-spin 0.8s linear infinite' }}
                aria-label="Loading recent run"
              >
                <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                <path d="M8 2a6 6 0 0 1 6 6" />
              </svg>
            )}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Profile</span>
          <InfoPopover title="Profiles" align="right">
            <p style={{ margin: '0 0 6px' }}>
              Profiles control how carefully QueryArgus checks itself — they trade speed and cost for
              confidence in the report.
            </p>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              <li style={{ marginBottom: 4 }}><strong style={{ color: 'var(--fg)' }}>Fast</strong> — rules only, no AI review of findings.</li>
              <li style={{ marginBottom: 4 }}><strong style={{ color: 'var(--fg)' }}>Balanced</strong> — adds a self-review pass. Recommended.</li>
              <li><strong style={{ color: 'var(--fg)' }}>Thorough</strong> — adds an independent judge model.</li>
            </ul>
            <p style={{ margin: '6px 0 0', fontSize: 11 }}>Hover any profile chip for full details.</p>
          </InfoPopover>
          <div style={{
            display: 'flex', background: 'var(--soft)', borderRadius: 6,
            border: '1px solid var(--border)', padding: 2, gap: 1,
          }}>
            {(['fast', 'balanced', 'thorough'] as ArgusProfile[]).map((p) => (
              <ProfileChip key={p} p={p} active={p === profile && !activeSavedId} onSelect={() => { setProfile(p); setActiveSavedId(null); }} />
            ))}
          </div>
          {savedProfiles.length > 0 && (
            <div style={{
              display: 'flex', background: 'var(--soft)', borderRadius: 6,
              border: '1px solid var(--border)', padding: 2, gap: 1,
              maxWidth: 280, overflowX: 'auto',
            }}>
              {savedProfiles.map((sp) => (
                <SavedProfileChip
                  key={sp.id}
                  profile={sp}
                  active={activeSavedId === sp.id}
                  onSelect={() => applySavedProfile(sp)}
                  onDelete={() => handleDeleteSaved(sp.id)}
                />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setCustomizeOpen(v => !v)}
            title="Customize this run"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 6, fontSize: 11.5,
              background: customizeOpen || overrideCount > 0 ? 'var(--accent-soft)' : 'var(--soft)',
              color: overrideCount > 0 ? 'var(--accent)' : 'var(--fg)',
              border: '1px solid var(--border)', cursor: 'pointer',
              fontFamily: 'var(--font-body)',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 5h10M5 8h6M7 11h2" strokeLinecap="round" />
            </svg>
            Customize
            {overrideCount > 0 && (
              <span style={{
                background: 'var(--accent)', color: 'var(--bg)',
                padding: '0 5px', borderRadius: 8, fontSize: 10, fontWeight: 500,
              }}>+{overrideCount}</span>
            )}
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
              style={{ transform: customizeOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            className="qa-btn primary"
            disabled={!hasConnection || !collection || loading}
            onClick={runAudit}
            style={{ gap: 6, opacity: !hasConnection || !collection || loading ? 0.6 : 1 }}
          >
            {loading ? (
              <>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" opacity="0.3" />
                  <path d="M14 8a6 6 0 0 0-6-6">
                    <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.9s" repeatCount="indefinite" />
                  </path>
                </svg>
                Running…
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="4,2 14,8 4,14" />
                </svg>
                Run audit
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tier 2 — Customize this run */}
      {customizeOpen && (
        <div style={{
          padding: '12px 18px', borderBottom: '1px solid var(--border)',
          background: 'var(--soft)', flexShrink: 0, fontFamily: 'var(--font-body)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <OverrideSlider
            label="Max iterations"
            help="How many think-and-check rounds the agent runs. Higher = more thorough, more cost."
            min={5} max={50} step={1} value={maxIter}
            defaultValue={DEFAULT_MAX_ITER}
            onChange={setMaxIter}
          />
          <OverrideSlider
            label="Sample size"
            help="How many documents the agent samples per probe. Larger samples catch rarer issues but cost more."
            min={50} max={1000} step={50} value={sampleSize}
            defaultValue={DEFAULT_SAMPLE_SIZE}
            onChange={setSampleSize}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
            <div style={sectionLabel}>
              <span>Minimum severity</span>
              <InfoPopover title="Minimum severity">
                Drops findings below this level from the report. Use higher floors when you only care
                about issues worth acting on right now.
              </InfoPopover>
            </div>
            <div style={{
              display: 'flex', background: 'var(--panel)', borderRadius: 6,
              border: '1px solid var(--border)', padding: 2, width: 'fit-content',
            }}>
              {MIN_SEVERITIES.map((s) => (
                <span
                  key={s}
                  onClick={() => setMinSeverity(s)}
                  style={{
                    padding: '3px 10px', borderRadius: 4, fontSize: 11.5,
                    cursor: 'pointer', textTransform: 'capitalize',
                    background: minSeverity === s ? 'var(--soft)' : 'transparent',
                    color: minSeverity === s ? 'var(--fg)' : 'var(--muted)',
                    boxShadow: minSeverity === s ? '0 0 0 1px var(--border)' : 'none',
                  }}
                >{s}</span>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {overrideCount > 0 && (
              <button
                type="button"
                onClick={resetOverrides}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: 11.5, fontFamily: 'var(--font-body)',
                  textDecoration: 'underline',
                }}
              >Reset to profile defaults</button>
            )}
            {overrideCount > 0 && (
              <button
                type="button"
                onClick={() => { setSaveDialogOpen(true); setSaveError(null); }}
                className="qa-btn"
                style={{ fontSize: 11.5 }}
              >Save as profile…</button>
            )}
          </div>
        </div>

        {/* Tier 3 — Advanced */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <button
            type="button"
            onClick={() => setAdvancedOpen(v => !v)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--fg)', fontSize: 11.5, fontFamily: 'var(--font-body)',
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: 0,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
              style={{ transform: advancedOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
              <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Advanced
            {evalOverrideCount > 0 && (
              <span style={{
                background: 'var(--accent)', color: 'var(--bg)',
                padding: '0 5px', borderRadius: 8, fontSize: 10, fontWeight: 500,
              }}>+{evalOverrideCount}</span>
            )}
            <InfoPopover title="Advanced evaluator controls">
              Tune QueryArgus's quality gates per-gate. Most users should not need this — the profile
              presets pick sensible defaults. Overriding here applies to this run only.
            </InfoPopover>
          </button>

          {advancedOpen && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Per-gate strategy matrix */}
              <div>
                <div style={{ ...sectionLabel, marginBottom: 8 }}>
                  <span>Evaluator strategy per gate</span>
                  <InfoPopover title="Evaluator strategy">
                    Each gate decides whether an action, a finding, or the whole run passes.
                    <strong> Rules</strong> is fast and deterministic; <strong>self</strong> asks the same model;
                    <strong> judge</strong> uses an independent model; <strong>composite</strong> combines them.
                  </InfoPopover>
                </div>
                <table style={{ borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 11.5 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '4px 8px', color: 'var(--muted)', fontWeight: 400, textAlign: 'left' }}>Gate</th>
                      {EVAL_STRATEGIES.map(s => (
                        <th key={s} style={{ padding: '4px 10px', color: 'var(--muted)', fontWeight: 400, textTransform: 'capitalize' }}>{s}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(['action_evaluator', 'finding_evaluator', 'run_evaluator'] as const).map((gate) => {
                      const label = gate.replace('_evaluator', '');
                      const current = evalState[gate];
                      const baseline = evalBaseline[gate];
                      const modified = current !== baseline;
                      return (
                        <tr key={gate}>
                          <td style={{ padding: '4px 8px', color: 'var(--fg)', textTransform: 'capitalize' }}>
                            {label}
                            {modified && (
                              <span style={{
                                marginLeft: 6, fontSize: 9, color: 'var(--accent)',
                                background: 'var(--accent-soft)', padding: '0 5px', borderRadius: 8,
                              }}>modified</span>
                            )}
                          </td>
                          {EVAL_STRATEGIES.map(s => {
                            const isCurrent = current === s;
                            const isBaseline = baseline === s;
                            return (
                              <td key={s} style={{ padding: 2, textAlign: 'center' }}>
                                <span
                                  onClick={() => updateEval(gate, s)}
                                  title={isBaseline ? 'Profile default' : undefined}
                                  style={{
                                    display: 'inline-block', padding: '3px 10px', borderRadius: 4,
                                    cursor: 'pointer', textTransform: 'capitalize',
                                    background: isCurrent ? 'var(--panel)' : 'transparent',
                                    color: isCurrent ? 'var(--fg)' : 'var(--muted)',
                                    boxShadow: isCurrent ? '0 0 0 1px var(--border)' : 'none',
                                    border: isBaseline && !isCurrent ? '1px dashed var(--border)' : '1px solid transparent',
                                  }}
                                >{s}</span>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 4 }}>
                  Dashed cells are the profile default.
                </div>
              </div>

              {/* Thresholds */}
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <ThresholdInput label="Action pass" help="Minimum score (0–1) for an action to pass the action gate."
                  value={evalState.action_pass_threshold} defaultValue={evalBaseline.action_pass_threshold}
                  onChange={(v) => updateEval('action_pass_threshold', v)} />
                <ThresholdInput label="Finding pass" help="Minimum score (0–1) for a finding to be kept."
                  value={evalState.finding_pass_threshold} defaultValue={evalBaseline.finding_pass_threshold}
                  onChange={(v) => updateEval('finding_pass_threshold', v)} />
                <ThresholdInput label="Run pass" help="Minimum score (0–1) for the run to be considered successful."
                  value={evalState.run_pass_threshold} defaultValue={evalBaseline.run_pass_threshold}
                  onChange={(v) => updateEval('run_pass_threshold', v)} />
              </div>

              {/* Judge */}
              <div style={{
                display: 'flex', gap: 12, alignItems: 'flex-end',
                opacity: judgeEnabled ? 1 : 0.5,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                  <div style={sectionLabel}>
                    <span>Judge provider</span>
                    <InfoPopover title="Judge model">
                      The independent model used by the <strong>judge</strong> and <strong>composite</strong> strategies.
                      Disabled when no gate uses them.
                    </InfoPopover>
                  </div>
                  <select
                    disabled={!judgeEnabled}
                    value={evalState.judge_provider ?? ''}
                    onChange={(e) => updateEval('judge_provider', (e.target.value || null) as JudgeProvider | null)}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 12,
                      background: 'var(--panel)', color: 'var(--fg)',
                      border: '1px solid var(--border)', fontFamily: 'var(--font-body)',
                    }}
                  >
                    <option value="">(none)</option>
                    {JUDGE_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
                  <div style={sectionLabel}><span>Judge model</span></div>
                  <input
                    type="text"
                    disabled={!judgeEnabled}
                    placeholder="e.g. gpt-4o"
                    value={evalState.judge_model ?? ''}
                    onChange={(e) => updateEval('judge_model', e.target.value || null)}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 12,
                      background: 'var(--panel)', color: 'var(--fg)',
                      border: '1px solid var(--border)', fontFamily: 'var(--font-mono)',
                    }}
                  />
                </div>
              </div>

              {/* Policies */}
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220 }}>
                  <div style={sectionLabel}>
                    <span>Rejected finding policy</span>
                    <InfoPopover title="Rejected finding policy">
                      What to do with findings the evaluator rejects. <strong>drop</strong> hides them,
                      <strong> log_only</strong> keeps them visible as dismissed,
                      <strong> demote_severity</strong> downgrades them one notch.
                    </InfoPopover>
                  </div>
                  <select
                    value={evalState.rejected_finding_policy}
                    onChange={(e) => updateEval('rejected_finding_policy', e.target.value as RejectedPolicy)}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 12,
                      background: 'var(--panel)', color: 'var(--fg)',
                      border: '1px solid var(--border)', fontFamily: 'var(--font-body)',
                    }}
                  >
                    {REJECTED_POLICIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 200 }}>
                  <div style={sectionLabel}>
                    <span>Run fail policy</span>
                    <InfoPopover title="Run fail policy">
                      What happens if the run gate fails. <strong>continue</strong> emits the report anyway,
                      <strong> warn_only</strong> tags it with a warning, <strong>abort</strong> discards it.
                    </InfoPopover>
                  </div>
                  <select
                    value={evalState.run_fail_policy}
                    onChange={(e) => updateEval('run_fail_policy', e.target.value as RunFailPolicy)}
                    style={{
                      padding: '4px 8px', borderRadius: 6, fontSize: 12,
                      background: 'var(--panel)', color: 'var(--fg)',
                      border: '1px solid var(--border)', fontFamily: 'var(--font-body)',
                    }}
                  >
                    {RUN_FAIL_POLICIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      {/* Status bar */}
      {report && (
        <div style={{
          padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid var(--border)', background: 'var(--soft)',
          fontSize: 11, color: 'var(--muted)', flexShrink: 0, fontFamily: 'var(--font-body)',
        }}>
          <span className="qa-dot ok"></span>
          <span>
            {new Date(report.run_at).toLocaleString()} · {report.duration_seconds.toFixed(1)}s
          </span>
          <span>·</span>
          <span>{report.iterations} iterations · {report.total_tokens.toLocaleString()} tokens</span>
          <span>·</span>
          <span>{report.model} · {report.profile}</span>
          {report.created_by && (
            <>
              <span>·</span>
              <span>Ran by <span style={{ color: 'var(--fg)' }}>{report.created_by}</span></span>
            </>
          )}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              vs prior run
            </span>
            <InfoPopover title="What the diff badges mean" align="right">
              <p style={{ margin: '0 0 6px' }}>Compared against the previous persisted run on the same collection:</p>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li style={{ marginBottom: 3 }}><strong style={{ color: '#1d6cf2' }}>New</strong> — first time this field+category combination has been flagged.</li>
                <li style={{ marginBottom: 3 }}><strong style={{ color: '#c98d42' }}>Regressed</strong> — the same field is flagged at a higher severity than before.</li>
                <li><strong style={{ color: 'var(--accent)' }}>Resolved</strong> — present in the prior run but no longer flagged.</li>
              </ul>
              <p style={{ margin: '6px 0 0', fontSize: 11 }}>
                If this is the first run for the collection, everything counts as new.
              </p>
            </InfoPopover>
            {report.diff.new === 0 && report.diff.resolved === 0 && report.diff.regressed === 0 && (
              <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>no changes</span>
            )}
            {report.diff.new > 0 && (
              <span style={{ color: '#1d6cf2', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
                {report.diff.new} new
              </span>
            )}
            {report.diff.resolved > 0 && (
              <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
                {report.diff.resolved} resolved
              </span>
            )}
            {report.diff.regressed > 0 && (
              <span style={{ color: '#c98d42', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }} />
                {report.diff.regressed} regressed
              </span>
            )}
          </span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div style={{
          padding: '10px 18px', background: '#fdf0f1', color: '#c94250',
          borderBottom: '1px solid var(--border)', fontSize: 12,
          fontFamily: 'var(--font-body)', flexShrink: 0,
        }}>
          {error}
        </div>
      )}

      {/* Body */}
      {!hasConnection ? (
        <EmptyState
          title="No database connected"
          body="Connect to a Cosmos DB from Workspace or Explorer first, then return here to run an audit."
        />
      ) : !report && !loading && history.length > 0 ? (
        <PreRunHistory
          history={history}
          historyLoading={historyLoading}
          openingReportId={openingReportId}
          onSelect={loadHistoricalReport}
        />
      ) : !report && !loading ? (
        <EmptyState
          title="Run an audit"
          body={`QueryArgus will sample ${collection || 'a collection'} and report data-quality findings. Pick a profile and press Run.`}
        />
      ) : loading && !report ? (
        <EmptyState
          title={jobStatus === 'queued' ? 'Queued…' : 'Running audit…'}
          body="The ReAct agent is sampling, querying, and writing findings. Safe to navigate away — results will be waiting when you return to this collection."
        />
      ) : report && sel ? (
        <ReportBody
          report={report}
          findings={findings}
          sel={sel}
          selId={selId ?? findings[0]?.id ?? null}
          onSelect={setSelId}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          history={history}
          historyLoading={historyLoading}
          openingReportId={openingReportId}
          onSelectHistorical={loadHistoricalReport}
        />
      ) : report ? (
        <EmptyState title="No findings" body="QueryArgus completed without flagging any data-quality issues in this collection." />
      ) : null}

      {/* Tier 4 — Save profile dialog */}
      {saveDialogOpen && (
        <div
          role="dialog"
          onClick={() => !saveBusy && setSaveDialogOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
            zIndex: 1000, display: 'grid', placeItems: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--panel)', borderRadius: 10, padding: 18,
              width: 360, border: '1px solid var(--border)',
              fontFamily: 'var(--font-body)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>Save as profile</div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 12 }}>
              Save the current overrides on top of <strong style={{ color: 'var(--fg)' }}>{profile}</strong>.
              Visible only to you.
            </div>
            <input
              type="text"
              autoFocus
              placeholder="Profile name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !saveBusy) handleSaveProfile(); }}
              style={{
                width: '100%', padding: '6px 10px', borderRadius: 6,
                background: 'var(--bg)', color: 'var(--fg)',
                border: '1px solid var(--border)', fontSize: 12,
                fontFamily: 'var(--font-body)', marginBottom: 8, boxSizing: 'border-box',
              }}
            />
            {saveError && (
              <div style={{ fontSize: 11.5, color: '#c94250', marginBottom: 8 }}>{saveError}</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSaveDialogOpen(false)}
                disabled={saveBusy}
                className="qa-btn"
                style={{ fontSize: 12 }}
              >Cancel</button>
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={saveBusy}
                className="qa-btn primary"
                style={{ fontSize: 12 }}
              >{saveBusy ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes qp-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

const EmptyState: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div style={{
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '48px 32px', minHeight: 0,
  }}>
    <div style={{ maxWidth: 460, textAlign: 'center' }}>
      <div style={{
        fontSize: 15, fontWeight: 500, color: 'var(--fg)',
        fontFamily: 'var(--font-display)', marginBottom: 6,
      }}>{title}</div>
      <div style={{
        fontSize: 13, color: 'var(--muted)', lineHeight: 1.55,
        fontFamily: 'var(--font-body)',
      }}>{body}</div>
    </div>
  </div>
);

const COUNT_HELP: Record<string, string> = {
  Critical: 'Severe data-quality issues that almost certainly need action — broken constraints, large-scale corruption, or unsafe values.',
  Warning: 'Real issues worth reviewing but not necessarily urgent — drift, partial inconsistencies, or noisy fields.',
  Info: 'Observations and minor anomalies. Useful for context, rarely actionable on their own.',
  Dismissed: 'Findings the evaluator rejected (low confidence, weak evidence, or filtered by the rejected-finding policy). Kept here for transparency.',
};

const ReportBody: React.FC<{
  report: ArgusReport;
  findings: ArgusFinding[];
  sel: ArgusFinding;
  selId: string | null;
  onSelect: (id: string) => void;
  activeTab: 'findings' | 'history' | 'trends';
  onTabChange: (tab: 'findings' | 'history' | 'trends') => void;
  history: ArgusRunSummary[];
  historyLoading: boolean;
  openingReportId: string | null;
  onSelectHistorical: (reportId: string) => void;
}> = ({ report, findings, sel, selId, onSelect, activeTab, onTabChange, history, historyLoading, openingReportId, onSelectHistorical }) => {
  const { counts } = report;
  const score = report.quality_score ?? 0;
  const scoreBand = score >= 80 ? 'Good' : score >= 60 ? 'Moderate' : 'Poor';
  const scoreBandColor = score >= 80 ? '#3a8c5f' : score >= 60 ? '#c98d42' : '#c94250';

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 400px', minHeight: 0, position: 'relative' }}>
      {openingReportId && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(1px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, color: 'var(--muted)', fontSize: 12.5,
          fontFamily: 'var(--font-body)', pointerEvents: 'all',
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6" opacity="0.3" />
            <path d="M14 8a6 6 0 0 0-6-6">
              <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.9s" repeatCount="indefinite" />
            </path>
          </svg>
          Loading report…
        </div>
      )}
      {/* LEFT — score + findings */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
        {/* Score row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <ScoreArc score={score} />
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-body)',
            }}>
              <span>Audit confidence</span>
              <InfoPopover title="How audit confidence works">
                <p style={{ margin: '0 0 6px' }}>
                  The score (0–100) is produced by the <strong>run evaluator</strong> — a sanity check
                  on the audit itself, not the data. It does not deduct points per finding.
                </p>
                <p style={{ margin: '0 0 6px' }}>
                  The evaluator runs a set of rules; each triggered rule contributes a verdict:
                  <strong> pass = 1.0</strong>, <strong>warn = 0.5</strong>, <strong>fail = 0.0</strong>.
                  The final score is the <strong>worst</strong> rule's score × 100.
                </p>
                <p style={{ margin: '0 0 6px' }}>Typical bands:</p>
                <ul style={{ margin: '0 0 6px', paddingLeft: 16 }}>
                  <li><strong style={{ color: '#3a8c5f' }}>≥ 80 Good</strong> — no rules tripped; trust the report.</li>
                  <li><strong style={{ color: '#c98d42' }}>60–79 Moderate</strong> — a warn rule fired (e.g. zero findings on a large sample).</li>
                  <li><strong style={{ color: '#c94250' }}>&lt; 60 Poor</strong> — the audit ended too early or covered too few fields. Re-run with more iterations.</li>
                </ul>
                <p style={{ margin: 0, fontSize: 11 }}>
                  The score does <em>not</em> reflect how clean your data is — a perfect-score run can still surface critical findings.
                </p>
              </InfoPopover>
            </div>
            <span style={{ fontSize: 10, color: scoreBandColor, fontFamily: 'var(--font-body)' }}>
              {scoreBand} audit
            </span>
          </div>
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, paddingLeft: 18 }}>
            {([
              ['Critical', counts.critical, '#c94250', '#fdf0f1'],
              ['Warning', counts.warning, '#c98d42', '#fdf6ed'],
              ['Info', counts.info, 'var(--muted)', 'var(--soft)'],
              ['Dismissed', counts.dismissed, 'var(--muted)', 'var(--soft)'],
            ] as const).map(([l, v, c, bg]) => (
              <div key={l} style={{
                background: bg, borderRadius: 8, padding: '8px 10px',
                display: 'flex', flexDirection: 'column', gap: 3,
                border: '1px solid var(--border)',
              }}>
                <span style={{
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: 'var(--muted)', fontFamily: 'var(--font-body)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  {l}
                  <InfoPopover title={l}>{COUNT_HELP[l]}</InfoPopover>
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: c, lineHeight: 1 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
          {(['findings', 'history', 'trends'] as const).map(tab => {
            const active = activeTab === tab;
            const label =
              tab === 'findings' ? `Findings · ${findings.length}`
              : tab === 'history' ? `Run history · ${history.length}`
              : `Trends · ${history.length}`;
            return (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                style={{
                  padding: '8px 16px', fontSize: 12.5,
                  color: active ? 'var(--fg)' : 'var(--muted)',
                  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                  fontWeight: active ? 500 : 400,
                  fontFamily: 'var(--font-body)',
                  background: 'none', border: 'none', borderRadius: 0,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab body */}
        {activeTab === 'history' ? (
          <HistoryList
            history={history}
            historyLoading={historyLoading}
            currentReportId={report.report_id}
            openingReportId={openingReportId}
            onSelect={onSelectHistorical}
          />
        ) : activeTab === 'trends' ? (
          <ArgusTrendsPanel
            history={history}
            currentReportId={report.report_id}
            onSelectRun={onSelectHistorical}
          />
        ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {findings.map((f) => {
            const isSel = f.id === (selId ?? findings[0]?.id);
            return (
              <div
                key={f.id}
                onClick={() => onSelect(f.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 16px', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: isSel ? 'var(--accent-soft)' : 'transparent',
                  borderLeft: `3px solid ${SEVER_COLOR[f.severity]}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, color: 'var(--fg)' }}>
                      {f.field}
                    </span>
                    <span style={{
                      ...tagStyle, background: SEVER_BG[f.severity], color: SEVER_COLOR[f.severity],
                      borderColor: 'transparent',
                    }}>{f.category.replace(/_/g, ' ')}</span>
                    {f.diff !== 'existing' && (
                      <span style={{
                        fontSize: 10, color: DIFF_COLOR[f.diff],
                        marginLeft: 'auto', flexShrink: 0, fontWeight: 500,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        fontFamily: 'var(--font-body)',
                      }}>{f.diff}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
                    {f.summary}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{f.affected.toLocaleString()}</span>
                    {' / '}{f.total.toLocaleString()} docs affected ({f.affected_pct.toFixed(1)}%)
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* RIGHT — detail */}
      <aside style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg)' }}>
        <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: SEVER_COLOR[sel.severity] }}>
              {sel.field}
            </span>
            <span style={{ ...tagStyle, background: SEVER_BG[sel.severity], color: SEVER_COLOR[sel.severity], borderColor: 'transparent', fontSize: 10.5 }}>
              {sel.category.replace(/_/g, ' ')}
            </span>
            <span style={{ ...tagStyle, background: SEVER_BG[sel.severity], color: SEVER_COLOR[sel.severity], borderColor: 'transparent', fontSize: 10.5 }}>
              {sel.severity}
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: 10.5, fontWeight: 500,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              color: DIFF_COLOR[sel.diff], fontFamily: 'var(--font-body)',
            }}>{sel.diff}</span>
          </div>
          <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
            {sel.description}
          </p>
          <div style={{
            marginTop: 8, fontSize: 11.5, color: 'var(--muted)',
            display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-body)',
          }}>
            <span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)', fontWeight: 500 }}>
                {sel.affected.toLocaleString()}
              </span>{' '}docs affected
            </span>
            <span>·</span>
            <span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)' }}>
                {sel.affected_pct.toFixed(1)}%
              </span>{' '}of collection
            </span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={sectionLabel}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h12M2 8h8M2 12h5" />
              </svg>
              Evidence query
              <InfoPopover title="Evidence query">
                The MongoDB query the agent ran to confirm this finding. Paste it into Mongo
                shell or the Data Explorer to reproduce the result yourself — every claim in the
                report is backed by one of these.
              </InfoPopover>
            </div>
            <pre style={{
              margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.65,
              background: 'var(--soft)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px',
              whiteSpace: 'pre-wrap', overflow: 'auto', color: 'var(--fg)',
            }}>{sel.evidence}</pre>
          </div>

          <div>
            <div style={sectionLabel}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8l3 3 7-7" />
              </svg>
              ReAct trace
              <InfoPopover title="ReAct trace">
                The agent's step-by-step reasoning that led to this finding — each line is one
                think-and-check round. Useful for spotting false positives or understanding why a
                field was flagged the way it was.
              </InfoPopover>
            </div>
            <pre style={{
              margin: 0, fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7,
              background: 'var(--soft)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px',
              whiteSpace: 'pre-wrap', overflow: 'auto', color: 'var(--muted)',
            }}>{sel.trace || '(no trace lines matched this field)'}</pre>
          </div>
        </div>
      </aside>
    </div>
  );
};

const localPart = (email: string | null) =>
  email ? email.split('@')[0] : 'unknown';

const SeverityChip: React.FC<{
  value: number;
  color: string;
  bg: string;
  label: string;
}> = ({ value, color, bg, label }) => (
  <span
    title={`${value} ${label}`}
    style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 22, height: 20, padding: '0 5px',
      borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11.5,
      color: value > 0 ? color : 'var(--muted)',
      background: value > 0 ? bg : 'transparent',
      border: `1px solid ${value > 0 ? 'transparent' : 'var(--border)'}`,
      opacity: value > 0 ? 1 : 0.55,
    }}
  >
    {value}
  </span>
);

const HistoryList: React.FC<{
  history: ArgusRunSummary[];
  historyLoading: boolean;
  currentReportId?: string;
  openingReportId?: string | null;
  onSelect: (reportId: string) => void;
}> = ({ history, historyLoading, currentReportId, openingReportId, onSelect }) => {
  if (historyLoading && history.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12.5, fontFamily: 'var(--font-body)' }}>
        Loading run history…
      </div>
    );
  }
  if (history.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 12.5, fontFamily: 'var(--font-body)' }}>
        No prior runs for this collection yet.
      </div>
    );
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {history.map((row) => {
        const isCurrent = row.report_id === currentReportId;
        const isOpening = row.report_id === openingReportId;
        const score = row.quality_score;
        const scoreColor = score == null
          ? 'var(--muted)'
          : score >= 80 ? '#3a8c5f' : score >= 60 ? '#c98d42' : '#c94250';
        const counts = row.counts;
        return (
          <div
            key={row.report_id}
            onClick={() => { if (!openingReportId) onSelect(row.report_id); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', borderBottom: '1px solid var(--border)',
              cursor: openingReportId ? 'wait' : 'pointer',
              background: isOpening
                ? 'var(--accent-soft)'
                : isCurrent ? 'var(--accent-soft)' : 'transparent',
              opacity: openingReportId && !isOpening ? 0.55 : 1,
              fontFamily: 'var(--font-body)',
              transition: 'background 0.12s, opacity 0.12s',
            }}
          >
            {/* PRIMARY — data-quality signal (severity strip) */}
            {counts ? (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, minWidth: 96 }}
                title={`${counts.critical} critical · ${counts.warning} warning · ${counts.info} info`}
              >
                <SeverityChip color="#c94250" bg="#fdf0f1" value={counts.critical} label="critical" />
                <SeverityChip color="#c98d42" bg="#fdf6ed" value={counts.warning} label="warning" />
                <SeverityChip color="var(--muted)" bg="var(--soft)" value={counts.info} label="info" />
              </div>
            ) : (
              <div style={{
                minWidth: 96, fontFamily: 'var(--font-mono)', fontSize: 12,
                color: 'var(--muted)', flexShrink: 0,
              }}>
                {row.findings_count} findings
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: 'var(--fg)' }}>
                {row.run_at ? new Date(row.run_at).toLocaleString() : '—'}
                {isCurrent && (
                  <span style={{ ...tagStyle, marginLeft: 8, fontSize: 10 }}>current</span>
                )}
                {isOpening && (
                  <span style={{ ...tagStyle, marginLeft: 8, fontSize: 10, color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                    loading…
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{localPart(row.created_by)}</span>
                {' · '}{row.total_tokens.toLocaleString()} tokens
                {row.run_eval_verdict && <> · <span>{row.run_eval_verdict}</span></>}
              </div>
            </div>
            {/* SECONDARY — audit confidence (not data quality) */}
            <div
              title="Audit confidence — how reliable this audit was, not how clean the data is"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                gap: 1, flexShrink: 0, marginRight: 6,
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 12, color: scoreColor, lineHeight: 1,
              }}>
                {score ?? '—'}
              </span>
              <span style={{ fontSize: 9, color: 'var(--muted)' }}>confidence</span>
            </div>
            {isOpening ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                <circle cx="8" cy="8" r="6" opacity="0.3" />
                <path d="M14 8a6 6 0 0 0-6-6">
                  <animateTransform attributeName="transform" type="rotate" from="0 8 8" to="360 8 8" dur="0.9s" repeatCount="indefinite" />
                </path>
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--muted)', flexShrink: 0 }}>
                <path d="M6 4l4 4-4 4" />
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
};

const PreRunHistory: React.FC<{
  history: ArgusRunSummary[];
  historyLoading: boolean;
  openingReportId: string | null;
  onSelect: (reportId: string) => void;
}> = ({ history, historyLoading, openingReportId, onSelect }) => (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <div style={{
      padding: '12px 18px 8px', fontSize: 11,
      color: 'var(--muted)', fontFamily: 'var(--font-body)',
      borderBottom: '1px solid var(--border)',
    }}>
      Prior runs for this collection — pick one to load, or press Run to start a fresh audit.
    </div>
    <HistoryList
      history={history}
      historyLoading={historyLoading}
      openingReportId={openingReportId}
      onSelect={onSelect}
    />
  </div>
);

export default AnalyticsPage;
