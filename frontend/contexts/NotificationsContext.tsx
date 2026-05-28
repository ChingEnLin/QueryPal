import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { getArgusJob, getArgusJobEvents, ArgusLiveAggregates } from '../services/argusService';

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

export interface RunProgress {
  aggregates: Partial<ArgusLiveAggregates>;
  cursor: number;
  updatedAt: number;
}

interface NotificationsContextType {
  notifications: AppNotification[];
  unreadCount: number;
  activeRuns: TrackedRun[];
  runProgress: Record<string, RunProgress>;
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
  const [runProgress, setRunProgress] = useState<Record<string, RunProgress>>({});
  const runsRef = useRef<TrackedRun[]>(activeRuns);
  runsRef.current = activeRuns;
  const pollingRef = useRef<Set<string>>(new Set());
  const cursorRef = useRef<Record<string, number>>({});

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
    delete cursorRef.current[jobId];
    setRunProgress((prev) => {
      if (!(jobId in prev)) return prev;
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
  }, []);

  const pollOnce = useCallback(async (run: TrackedRun) => {
    if (pollingRef.current.has(run.jobId)) return;
    pollingRef.current.add(run.jobId);
    try {
      // Status + live events fetched in parallel. Events are best-effort:
      // if the endpoint 404s (old backend, evicted job) we let the status
      // call drive removal.
      const cursor = cursorRef.current[run.jobId] ?? 0;
      const [job, snapshot] = await Promise.all([
        getArgusJob(run.jobId),
        getArgusJobEvents(run.jobId, cursor).catch(() => null),
      ]);
      if (snapshot) {
        cursorRef.current[run.jobId] = snapshot.next_cursor;
        setRunProgress((prev) => ({
          ...prev,
          [run.jobId]: {
            aggregates: snapshot.aggregates,
            cursor: snapshot.next_cursor,
            updatedAt: Date.now(),
          },
        }));
      }
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
      notifications, unreadCount, activeRuns, runProgress,
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
