import React, { useCallback, useState } from 'react';
import AppLayout from '../components/AppLayout';
import AnalyticsPage from './AnalyticsPage';
import { CollectionSummary, DbInfo, CosmosDBAccount } from '../types';
import { getDatabasesForAccount } from '../services/dbService';

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

const AnalyticsPageWrapper: React.FC = () => {
  const [conn, setConn] = useState<SessionConnection | null>(() => readSessionConnection());

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
    }
  }, [conn]);

  return (
    <AppLayout
      accountId={conn?.accountId}
      accountName={conn?.accountName}
      databaseName={conn?.databaseName}
      collections={conn?.collections}
      availableAccounts={conn?.availableAccounts}
      availableDbs={conn?.availableDbs}
      onSwitchDatabase={handleSwitchDatabase}
      onSwitchAccount={handleSwitchAccount}
    >
      <AnalyticsPage
        accountId={conn?.accountId}
        databaseName={conn?.databaseName}
        collections={conn?.collections}
      />
    </AppLayout>
  );
};

export default AnalyticsPageWrapper;
