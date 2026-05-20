import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import AppSidebar from './AppSidebar';
import AppTopBar from './AppTopBar';
import CommandPalette from './CommandPalette';
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
  collectionSeverity?: Record<string, 'critical' | 'warning' | 'info' | 'clean'>;
  collectionFindings?: Record<string, number>;
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
  collectionSeverity,
  collectionFindings,
  onNewQuery,
  availableDbs,
  onSwitchDatabase,
  availableAccounts,
  onSwitchAccount,
}) => {
  const navigate = useNavigate();
  const { toggleTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const explorerHref = accountId && databaseName
    ? `/data-explorer/${encodeURIComponent(accountId)}/${encodeURIComponent(databaseName)}`
    : null;

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      if (e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
        return;
      }

      if (e.shiftKey) {
        switch (e.key) {
          case '1': e.preventDefault(); setPaletteOpen(false); navigate('/query-generator'); return;
          case '2': e.preventDefault(); setPaletteOpen(false); if (explorerHref) navigate(explorerHref); return;
          case '3': e.preventDefault(); setPaletteOpen(false); navigate('/analytics'); return;
          case '4': e.preventDefault(); setPaletteOpen(false); navigate('/audit'); return;
          case 'S': case 's': e.preventDefault(); setPaletteOpen(false); navigate('/query-generator?panel=saved'); return;
        }
      } else {
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          setPaletteOpen(false);
          onNewQuery?.();
          return;
        }
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [navigate, explorerHref, onNewQuery, toggleTheme]);

  return (
    <div className="qp-app">
      <AppSidebar
        accountName={accountName}
        accountId={accountId}
        databaseName={databaseName}
        collections={collections}
        activeCollection={activeCollection}
        onCollectionSelect={onCollectionSelect}
        collectionSeverity={collectionSeverity}
        collectionFindings={collectionFindings}
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
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main className="qp-content">
          {children}
        </main>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        accountId={accountId}
        databaseName={databaseName}
        collections={collections}
        availableDbs={availableDbs}
        availableAccounts={availableAccounts}
        onSwitchDatabase={onSwitchDatabase}
        onSwitchAccount={onSwitchAccount}
        onCollectionSelect={onCollectionSelect}
        onNewQuery={onNewQuery}
      />
    </div>
  );
};

export default AppLayout;
