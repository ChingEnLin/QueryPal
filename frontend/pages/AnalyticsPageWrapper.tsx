import React, { useCallback, useEffect, useRef, useState } from 'react';
import AppLayout from '../components/AppLayout';
import AnalyticsPage from './AnalyticsPage';
import { CollectionSummary, DbInfo, CosmosDBAccount } from '../types';
import { getDatabasesForAccount } from '../services/dbService';
import { listArgusRuns } from '../services/argusService';

export type CollectionAuditStatus = 'critical' | 'warning' | 'info' | 'clean';

interface SessionConnection {
  accountId?: string;
  databaseName?: string;
  accountName?: string;
  collections?: CollectionSummary[];
  availableAccounts?: CosmosDBAccount[];
  availableDbs?: DbInfo[];
}

const readSessionConnection = (): SessionConnection | null => {
  try {
    const saved = sessionStorage.getItem('qp_connection');
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
};

const writeSessionConnection = (conn: SessionConnection) => {
  sessionStorage.setItem('qp_connection', JSON.stringify(conn));
};

const auditStatus = (
  counts?: { critical: number; warning: number; info: number },
): CollectionAuditStatus => {
  if (counts?.critical) return 'critical';
  if (counts?.warning) return 'warning';
  if (counts?.info) return 'info';
  return 'clean';
};

const AnalyticsPageWrapper: React.FC = () => {
  const [conn, setConn] = useState<SessionConnection | null>(() => readSessionConnection());
  const [collection, setCollection] = useState<string>('');
  const [collectionDefaulting, setCollectionDefaulting] = useState(false);
  const [collectionSeverity, setCollectionSeverity] = useState<Record<string, CollectionAuditStatus>>({});
  const [collectionFindings, setCollectionFindings] = useState<Record<string, number>>({});
  const [isAccountSwitching, setIsAccountSwitching] = useState(false);
  const userPickedRef = useRef(false);

  const accountId = conn?.accountId;
  const databaseName = conn?.databaseName;
  const collections = conn?.collections;

  // Reset "user picked" flag when scope changes so auto-default can re-run.
  useEffect(() => {
    userPickedRef.current = false;
  }, [accountId, databaseName]);

  // Fetch latest runs across all collections to build the severity map and
  // pick a sensible default collection (most recent run, else alphabetical).
  useEffect(() => {
    if (!collections || collections.length === 0) {
      setCollectionSeverity({});
      setCollectionFindings({});
      if (!userPickedRef.current) setCollection('');
      return;
    }
    const alphaFirst = [...collections].sort((a, b) => a.name.localeCompare(b.name))[0].name;
    let cancelled = false;
    setCollectionDefaulting(true);
    (async () => {
      const severityMap: Record<string, CollectionAuditStatus> = {};
      const findingsMap: Record<string, number> = {};
      let recentCollection: string | undefined;
      if (accountId && databaseName) {
        try {
          // Fetch a generous slice of recent runs; backend returns newest first.
          const rows = await listArgusRuns({ accountId, database: databaseName, limit: 100 });
          recentCollection = rows[0]?.collection;
          const seen = new Set<string>();
          for (const row of rows) {
            if (seen.has(row.collection)) continue;
            seen.add(row.collection);
            severityMap[row.collection] = auditStatus(row.counts);
            findingsMap[row.collection] = row.findings_count ?? 0;
          }
        } catch (e) {
          console.warn('listArgusRuns failed (sidebar severity)', e);
        }
      }
      if (cancelled) return;
      setCollectionSeverity(severityMap);
      setCollectionFindings(findingsMap);
      if (!userPickedRef.current) {
        const target = recentCollection && collections.some((c) => c.name === recentCollection)
          ? recentCollection
          : alphaFirst;
        setCollection(target);
      }
      setCollectionDefaulting(false);
    })();
    return () => { cancelled = true; };
  }, [accountId, databaseName, collections]);

  const handleCollectionSelect = useCallback((name: string) => {
    userPickedRef.current = true;
    setCollection(name);
  }, []);

  const handleSwitchDatabase = useCallback((db: DbInfo) => {
    if (!conn) return;
    const next: SessionConnection = {
      ...conn,
      databaseName: db.name,
      collections: db.collections,
    };
    writeSessionConnection(next);
    setConn(next);
  }, [conn]);

  const handleSwitchAccount = useCallback(async (account: CosmosDBAccount) => {
    if (!conn || account.id === conn.accountId) return;
    setIsAccountSwitching(true);
    try {
      const databases = await getDatabasesForAccount(account.id);
      if (!databases.length) return;
      const firstDb = databases[0];
      const next: SessionConnection = {
        accountId: account.id,
        accountName: account.name,
        databaseName: firstDb.name,
        collections: firstDb.collections,
        availableAccounts: conn.availableAccounts,
        availableDbs: databases,
      };
      writeSessionConnection(next);
      setConn(next);
    } catch (e) {
      console.error('Failed to switch account:', e);
    } finally {
      setIsAccountSwitching(false);
    }
  }, [conn]);

  return (
    <AppLayout
      accountId={conn?.accountId}
      accountName={conn?.accountName}
      databaseName={conn?.databaseName}
      collections={conn?.collections}
      activeCollection={collection || undefined}
      onCollectionSelect={handleCollectionSelect}
      collectionSeverity={collectionSeverity}
      collectionFindings={collectionFindings}
      availableAccounts={conn?.availableAccounts}
      availableDbs={conn?.availableDbs}
      onSwitchDatabase={handleSwitchDatabase}
      onSwitchAccount={handleSwitchAccount}
    >
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <AnalyticsPage
          accountId={conn?.accountId}
          databaseName={conn?.databaseName}
          collections={conn?.collections}
          collection={collection}
          onCollectionChange={handleCollectionSelect}
          collectionDefaulting={collectionDefaulting}
        />
        {isAccountSwitching && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--panel)', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ animation: 'qp-spin 0.8s linear infinite' }}>
                <circle cx="8" cy="8" r="6" strokeOpacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>Switching account...</span>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AnalyticsPageWrapper;
