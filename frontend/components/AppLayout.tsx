import React from 'react';
import AppSidebar from './AppSidebar';
import AppTopBar from './AppTopBar';
import { CollectionSummary } from '../types';

interface AppLayoutProps {
  children: React.ReactNode;
  accountName?: string;
  databaseName?: string;
  collectionName?: string;
  collections?: CollectionSummary[];
  activeCollection?: string;
  onCollectionSelect?: (name: string) => void;
  onNewQuery?: () => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  accountName,
  databaseName,
  collectionName,
  collections,
  activeCollection,
  onCollectionSelect,
  onNewQuery,
}) => {
  return (
    <div className="qp-app">
      <AppSidebar
        accountName={accountName}
        databaseName={databaseName}
        collections={collections}
        activeCollection={activeCollection}
        onCollectionSelect={onCollectionSelect}
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
