import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { getArgusJob, listArgusEscalations, ArgusEscalation } from '../services/argusService';
import { USE_MSAL_AUTH } from '../app.config';

export type NotificationKind = 'argus_done' | 'argus_error';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  // Routing hints for click-through.
  accountId?: string;
  database?: string;
  collection?: string;
  reportId?: string;
}

interface TrackedRun {
  jobId: string;
  accountId: string;
  database: string;
  collection: string;
  startedAt: number;
}

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  activeRuns: TrackedRun[];
  // Arm B — pending escalations awaiting human resolution. Refreshed on a
  // slow interval and on demand after the user acts on one.
  pendingEscalations: ArgusEscalation[];
  refreshEscalations: () => Promise<void>;
  trackArgusRun: (run: TrackedRun) => void;
  markAllRead: () => void;
  markRead: (id: string) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

const NOTIFS_KEY = 'qp:notifications:v1';
const RUNS_KEY = 'qp:notifications:active-runs:v1';
const POLL_MS = 4000;
const ESCALATIONS_POLL_MS = 20000;  // slower than job polls; escalations don't change as fast
const MAX_NOTIFS = 50;

const readNotifs = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(NOTIFS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};
const writeNotifs = (n: AppNotification[]) => {
  try { localStorage.setItem(NOTIFS_KEY, JSON.stringify(n.slice(0, MAX_NOTIFS))); } catch { /* quota */ }
};
const readRuns = (): TrackedRun[] => {
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};
const writeRuns = (r: TrackedRun[]) => {
  try { localStorage.setItem(RUNS_KEY, JSON.stringify(r)); } catch { /* quota */ }
};

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const NotificationsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => readNotifs());
  const [activeRuns, setActiveRuns] = useState<TrackedRun[]>(() => readRuns());
  const [pendingEscalations, setPendingEscalations] = useState<ArgusEscalation[]>([]);
  const knownEscalationIdsRef = useRef<Set<string>>(new Set());
  const runsRef = useRef<TrackedRun[]>(activeRuns);
  runsRef.current = activeRuns;
  const pollingRef = useRef<Set<string>>(new Set());

  useEffect(() => { writeNotifs(notifications); }, [notifications]);
  useEffect(() => { writeRuns(activeRuns); }, [activeRuns]);

  const pushNotification = useCallback((n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
    setNotifications((prev) => [
      { ...n, id: makeId(), createdAt: Date.now(), read: false },
      ...prev,
    ].slice(0, MAX_NOTIFS));
  }, []);

  const removeRun = useCallback((jobId: string) => {
    setActiveRuns((prev) => prev.filter((r) => r.jobId !== jobId));
  }, []);

  const pollOnce = useCallback(async (run: TrackedRun) => {
    if (pollingRef.current.has(run.jobId)) return;
    pollingRef.current.add(run.jobId);
    try {
      const job = await getArgusJob(run.jobId);
      if (job.status === 'done') {
        const findingsCount = job.report?.findings.length ?? 0;
        pushNotification({
          kind: 'argus_done',
          title: `Audit complete — ${run.collection}`,
          body: findingsCount === 0
            ? 'No data-quality findings.'
            : `${findingsCount} finding${findingsCount === 1 ? '' : 's'} reported.`,
          accountId: run.accountId,
          database: run.database,
          collection: run.collection,
          reportId: job.report?.report_id,
        });
        removeRun(run.jobId);
      } else if (job.status === 'error') {
        pushNotification({
          kind: 'argus_error',
          title: `Audit failed — ${run.collection}`,
          body: job.error || 'The audit job returned an error.',
          accountId: run.accountId,
          database: run.database,
          collection: run.collection,
        });
        removeRun(run.jobId);
      }
    } catch (e) {
      // 404 means the job was evicted (backend restart). Drop it silently —
      // the local AnalyticsPage poll will surface the error inline if needed.
      removeRun(run.jobId);
      // Avoid logging on every interval tick.
      void e;
    } finally {
      pollingRef.current.delete(run.jobId);
    }
  }, [pushNotification, removeRun]);

  useEffect(() => {
    const tick = () => {
      const runs = runsRef.current;
      if (runs.length === 0) return;
      runs.forEach((r) => { void pollOnce(r); });
    };
    // Fire immediately on mount so a freshly tracked run gets checked without
    // waiting a full interval.
    tick();
    const handle = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(handle);
  }, [pollOnce]);

  const trackArgusRun = useCallback((run: TrackedRun) => {
    setActiveRuns((prev) => {
      if (prev.some((r) => r.jobId === run.jobId)) return prev;
      return [...prev, run];
    });
  }, []);

  // Arm B — pending-review escalations. Refreshed on a slow interval and
  // whenever the caller resolves one (so the queue reflects current state
  // without waiting for the next poll). Emits a notification for newly-seen
  // pending findings so the bell can surface them without the user being on
  // the Analytics page.
  const refreshEscalations = useCallback(async () => {
    if (!USE_MSAL_AUTH) return;
    try {
      const rows = await listArgusEscalations();
      setPendingEscalations(rows);
      const seen = knownEscalationIdsRef.current;
      const fresh = rows.filter((r) => !seen.has(r.finding_id));
      fresh.forEach((r) => seen.add(r.finding_id));
      if (fresh.length > 0 && seen.size > fresh.length) {
        // Skip first-load avalanche: only notify when we already had a baseline
        // of known ids and brand-new ones appeared on top of it.
        pushNotification({
          kind: 'argus_done',
          title: `Argus needs review on ${fresh.length} finding${fresh.length === 1 ? '' : 's'}`,
          body: fresh
            .slice(0, 3)
            .map((r) => `${r.collection}: ${r.field}`)
            .join(' · '),
          accountId: fresh[0].cosmos_account,
          database: fresh[0].database,
          collection: fresh[0].collection,
          reportId: fresh[0].report_id,
        });
      } else if (seen.size === 0 && rows.length === 0) {
        // First poll with no rows — record empty baseline so future arrivals notify.
        knownEscalationIdsRef.current = new Set();
      } else if (fresh.length === rows.length) {
        // Cold start with existing escalations — silently baseline them.
        knownEscalationIdsRef.current = new Set(rows.map((r) => r.finding_id));
      }
      // Drop ids for findings that are no longer pending so a re-escalation later
      // (e.g. user marked need_info, agent re-emits next run) would re-notify.
      const currentIds = new Set(rows.map((r) => r.finding_id));
      const pruned = new Set<string>();
      knownEscalationIdsRef.current.forEach((id) => {
        if (currentIds.has(id)) pruned.add(id);
      });
      knownEscalationIdsRef.current = pruned;
    } catch (e) {
      console.warn('listArgusEscalations failed', e);
    }
  }, [pushNotification]);

  useEffect(() => {
    if (!USE_MSAL_AUTH) return;
    refreshEscalations();
    const handle = window.setInterval(refreshEscalations, ESCALATIONS_POLL_MS);
    return () => window.clearInterval(handle);
  }, [refreshEscalations]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => n.read ? n : { ...n, read: true }));
  }, []);
  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }, []);
  const dismiss = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);
  const clearAll = useCallback(() => setNotifications([]), []);

  const unreadCount = notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);

  return (
    <NotificationsContext.Provider value={{
      notifications, unreadCount, activeRuns,
      pendingEscalations, refreshEscalations,
      trackArgusRun, markAllRead, markRead, dismiss, clearAll,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextType => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
};
