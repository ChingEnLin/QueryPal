import React from 'react';
import AppLayout from '../components/AppLayout';
import AnalyticsPage from './AnalyticsPage';
import { CollectionSummary, DbInfo, CosmosDBAccount } from '../types';

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

const AnalyticsPageWrapper: React.FC = () => {
  const conn = readSessionConnection();

  return (
    <AppLayout
      accountId={conn?.accountId}
      accountName={conn?.accountName}
      databaseName={conn?.databaseName}
      collections={conn?.collections}
      availableAccounts={conn?.availableAccounts}
      availableDbs={conn?.availableDbs}
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
