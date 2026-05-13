import React from 'react';
import AppSidebar from './AppSidebar';
import AppTopBar from './AppTopBar';
import { CollectionSummary, DbInfo, CosmosDBAccount } from '../types';

interface AppLayoutProps {
  children: React.ReactNode;
  accountName?: string;
  accountId?: string;
  databaseName?: string;
  collectionName?: string;
  collections?: CollectionSummary[];
  activeCollection?: string;
  onCollectionSelect?: (name: string) => void;
  onNewQuery?: () => void;
  availableDbs?: DbInfo[];
  onSwitchDatabase?: (db: DbInfo) => void;
  availableAccounts?: CosmosDBAccount[];
  onSwitchAccount?: (account: CosmosDBAccount) => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  accountName,
  accountId,
  databaseName,
  collectionName,
  collections,
  activeCollection,
  onCollectionSelect,
  onNewQuery,
  availableDbs,
  onSwitchDatabase,
  availableAccounts,
  onSwitchAccount,
}) => {
  return (
    <div className="qp-app">
      <AppSidebar
        accountName={accountName}
        accountId={accountId}
        databaseName={databaseName}
        collections={collections}
        activeCollection={activeCollection}
        onCollectionSelect={onCollectionSelect}
        availableDbs={availableDbs}
        onSwitchDatabase={onSwitchDatabase}
        availableAccounts={availableAccounts}
        onSwitchAccount={onSwitchAccount}
      />
      <div className="qp-main">
        <AppTopBar
          accountName={accountName}
          databaseName={databaseName}
          collectionName={collectionName}
          onNewQuery={onNewQuery}
        />
        <main className="qp-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
