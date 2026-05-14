import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import DataExplorerPage from './DataExplorerPage';
import AppLayout from '../components/AppLayout';
import { SelectedResource, DbInfo, CosmosDBAccount, CollectionSummary } from '../types';
import { getAzureCosmosAccounts, getDatabasesForAccount } from '../services/dbService';
import { FilterState } from '../utils/queryHandover';

interface LocationState {
  dbInfo?: DbInfo;
  accountName?: string;
  availableDbs?: DbInfo[];
  availableAccounts?: CosmosDBAccount[];
  initialCollection?: string;
  initialFilters?: FilterState[];
}

const DataExplorerPageWrapper: React.FC = () => {
  const { accountId, databaseName, documentId } = useParams<{
    accountId: string;
    databaseName: string;
    documentId?: string;
  }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCollection, setActiveCollection] = useState<string | undefined>(
    (location.state as LocationState)?.initialCollection
  );

  // Used to keep sidebar populated during the async load so there's no visual flash
  const [sessionCache] = useState<{ accountName?: string; collections?: CollectionSummary[]; availableAccounts?: CosmosDBAccount[]; availableDbs?: DbInfo[] } | null>(() => {
    try {
      const saved = sessionStorage.getItem('qp_connection');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [pageData, setPageData] = useState<{
    resource: SelectedResource;
    dbInfo: DbInfo;
    accountName: string;
    availableDbs: DbInfo[];
    availableAccounts: CosmosDBAccount[];
    initialDocumentId?: string;
    initialFilters?: FilterState[];
  } | null>(null);

  // Reset active collection when DB/account changes so the new page starts fresh
  const prevConnectionKey = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!pageData) return;
    const key = `${pageData.resource.accountId}/${pageData.dbInfo.name}`;
    if (prevConnectionKey.current !== null && prevConnectionKey.current !== key) {
      setActiveCollection(undefined);
    }
    prevConnectionKey.current = key;
  }, [pageData]);

  useEffect(() => {
    const initializePageData = async () => {
      if (!accountId || !databaseName) {
        navigate('/query-generator');
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Decode URL parameters
        const decodedAccountId = decodeURIComponent(accountId);
        const decodedDatabaseName = decodeURIComponent(databaseName);
        const decodedDocumentId = documentId ? decodeURIComponent(documentId) : undefined;

        console.log('DataExplorerPageWrapper - URL params:', {
          accountId: decodedAccountId,
          databaseName: decodedDatabaseName,
          documentId: decodedDocumentId
        });

        // Validate decoded parameters
        if (!decodedAccountId.trim() || !decodedDatabaseName.trim()) {
          throw new Error('Invalid account ID or database name');
        }

        const resource: SelectedResource = {
          accountId: decodedAccountId,
          databaseName: decodedDatabaseName
        };

        // Fast path: sessionStorage already has a matching connection — skip API calls
        const sessionConn = (() => {
          try { return JSON.parse(sessionStorage.getItem('qp_connection') ?? 'null'); }
          catch { return null; }
        })();
        if (
          sessionConn?.accountId === decodedAccountId &&
          sessionConn?.databaseName === decodedDatabaseName &&
          sessionConn?.availableAccounts?.length &&
          sessionConn?.availableDbs?.length
        ) {
          const dbInfo = sessionConn.availableDbs.find((d: DbInfo) => d.name === decodedDatabaseName);
          if (dbInfo) {
            setPageData({
              resource,
              dbInfo,
              accountName: sessionConn.accountName,
              availableDbs: sessionConn.availableDbs,
              availableAccounts: sessionConn.availableAccounts,
              initialDocumentId: decodedDocumentId,
              initialFilters: state?.initialFilters,
            });
            return;
          }
        }

        // If we have state from navigation, use it
        if (state?.dbInfo && state?.accountName && state?.availableDbs && state?.availableAccounts) {
          sessionStorage.setItem('qp_connection', JSON.stringify({
            accountId: decodedAccountId,
            databaseName: decodedDatabaseName,
            accountName: state.accountName,
            collections: state.dbInfo.collections,
            availableAccounts: state.availableAccounts,
            availableDbs: state.availableDbs,
          }));
          setPageData({
            resource,
            dbInfo: state.dbInfo,
            accountName: state.accountName,
            availableDbs: state.availableDbs,
            availableAccounts: state.availableAccounts,
            initialDocumentId: decodedDocumentId,
            initialFilters: state.initialFilters,
          });
        } else {
          // Otherwise, fetch the data we need
          const [accounts, databases] = await Promise.all([
            getAzureCosmosAccounts(),
            getDatabasesForAccount(decodedAccountId)
          ]);

          const account = accounts.find(acc => acc.id === decodedAccountId);
          const database = databases.find(db => db.name === decodedDatabaseName);

          if (!account) {
            throw new Error(`Cosmos DB account '${decodedAccountId}' not found`);
          }

          if (!database) {
            throw new Error(`Database '${decodedDatabaseName}' not found in account '${account.name}'`);
          }

          sessionStorage.setItem('qp_connection', JSON.stringify({
            accountId: decodedAccountId,
            databaseName: decodedDatabaseName,
            accountName: account.name,
            collections: database.collections,
            availableAccounts: accounts,
            availableDbs: databases,
          }));
          setPageData({
            resource,
            dbInfo: database,
            accountName: account.name,
            availableDbs: databases,
            availableAccounts: accounts,
            initialDocumentId: decodedDocumentId
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data explorer');
        console.error('Error initializing data explorer:', err);
      } finally {
        setLoading(false);
      }
    };

    initializePageData();
  }, [accountId, databaseName, documentId, state, navigate]);

  const onNavigateBack = () => {
    navigate('/query-generator');
  };

  const handleSwitchDatabase = useCallback((db: DbInfo) => {
    if (!pageData) return;
    navigate(`/data-explorer/${encodeURIComponent(pageData.resource.accountId)}/${encodeURIComponent(db.name)}`, {
      state: {
        dbInfo: db,
        accountName: pageData.accountName,
        availableDbs: pageData.availableDbs,
        availableAccounts: pageData.availableAccounts,
      },
    });
  }, [pageData, navigate]);

  const handleSwitchAccount = useCallback(async (account: CosmosDBAccount) => {
    if (!pageData || account.id === pageData.resource.accountId) return;
    try {
      const databases = await getDatabasesForAccount(account.id);
      if (!databases.length) return;
      navigate(`/data-explorer/${encodeURIComponent(account.id)}/${encodeURIComponent(databases[0].name)}`, {
        state: {
          dbInfo: databases[0],
          accountName: account.name,
          availableDbs: databases,
          availableAccounts: pageData.availableAccounts,
        },
      });
    } catch (e) {
      console.error('Failed to switch account:', e);
    }
  }, [pageData, navigate]);

  if (loading) {
    const decodedAccountId = accountId ? decodeURIComponent(accountId) : undefined;
    const decodedDatabaseName = databaseName ? decodeURIComponent(databaseName) : undefined;
    return (
      <AppLayout
        accountId={decodedAccountId}
        databaseName={decodedDatabaseName}
        accountName={sessionCache?.accountName}
        collections={sessionCache?.collections}
        availableAccounts={sessionCache?.availableAccounts}
        availableDbs={sessionCache?.availableDbs}
      >
        <style>{`@keyframes qp-spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: 'var(--bg)' }}>
          <div style={{
            background: 'var(--panel)', borderRadius: 10, padding: '16px 24px',
            display: 'flex', alignItems: 'center', gap: 12,
            border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
              animation: 'qp-spin 0.7s linear infinite', flexShrink: 0,
            }} />
            <span style={{ fontSize: 13.5, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
              Loading database information...
            </span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 16, background: 'var(--bg)' }}>
          <div style={{ color: 'var(--status-err)', fontSize: 14, fontFamily: 'var(--font-body)' }}>Error: {error}</div>
          <button onClick={onNavigateBack} className="qa-btn primary" style={{ fontSize: 13 }}>
            Back to Query Generator
          </button>
        </div>
      </AppLayout>
    );
  }

  if (!pageData) {
    return null;
  }

  return (
    <AppLayout
      accountName={pageData.accountName}
      accountId={pageData.resource.accountId}
      databaseName={pageData.dbInfo.name}
      collectionName={activeCollection}
      collections={pageData.dbInfo.collections}
      activeCollection={activeCollection}
      onCollectionSelect={setActiveCollection}
      availableDbs={pageData.availableDbs}
      onSwitchDatabase={handleSwitchDatabase}
      availableAccounts={pageData.availableAccounts}
      onSwitchAccount={handleSwitchAccount}
    >
      <DataExplorerPage
        key={`${pageData.resource.accountId}/${pageData.dbInfo.name}`}
        resource={pageData.resource}
        dbInfo={pageData.dbInfo}
        accountName={pageData.accountName}
        availableDbs={pageData.availableDbs}
        availableAccounts={pageData.availableAccounts}
        initialDocumentId={pageData.initialDocumentId}
        initialFilters={pageData.initialFilters}
        onNavigateBack={onNavigateBack}
        onCollectionChange={setActiveCollection}
        sidebarSelectedCollection={activeCollection}
        embedded
      />
    </AppLayout>
  );
};

export default DataExplorerPageWrapper;
