import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMsal } from "@azure/msal-react";
import { useAuth } from '../contexts/AuthContext';
import { USE_MSAL_AUTH } from '../app.config';
import QueryGeneratorPage from './QueryGeneratorPage';
import AppLayout from '../components/AppLayout';
import { SelectedResource, DbInfo, CosmosDBAccount, CollectionSummary } from '../types';

type ConnectionState = { accountId: string; databaseName: string; accountName?: string; collections?: CollectionSummary[]; availableAccounts?: CosmosDBAccount[]; availableDbs?: DbInfo[] };

const readSessionConnection = (): ConnectionState | null => {
  try {
    const saved = sessionStorage.getItem('qp_connection');
    return saved ? JSON.parse(saved) : null;
  } catch { return null; }
};

interface HubNavState {
  preselectedAccountId?: string;
  preselectedAccountName?: string;
}

// Component for the real MSAL authentication flow
const MsalQueryGeneratorPageWrapper: React.FC = () => {
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();
  const location = useLocation();
  const hubState = (location.state as HubNavState) ?? {};
  const [connection, setConnection] = React.useState<ConnectionState | null>(() =>
    hubState.preselectedAccountId ? null : readSessionConnection()
  );

  const name = accounts[0]?.name;
  const email = accounts[0]?.username;
  const onLogout = () => instance.logoutRedirect({ postLogoutRedirectUri: "/" });

  const onNavigateToExplorer = (conn: {
    resource: SelectedResource;
    dbInfo: DbInfo;
    accountName: string;
    availableDbs: DbInfo[];
    availableAccounts: CosmosDBAccount[]
  }) => {
    navigate(`/data-explorer/${encodeURIComponent(conn.resource.accountId)}/${encodeURIComponent(conn.resource.databaseName)}`, {
      state: {
        dbInfo: conn.dbInfo,
        accountName: conn.accountName,
        availableDbs: conn.availableDbs,
        availableAccounts: conn.availableAccounts
      }
    });
  };

  return (
    <AppLayout
      accountId={connection?.accountId}
      databaseName={connection?.databaseName}
      accountName={connection?.accountName}
      collections={connection?.collections}
      availableAccounts={connection?.availableAccounts}
      availableDbs={connection?.availableDbs}
      onSwitchAccount={(acc) => navigate('/query-generator', { state: { preselectedAccountId: acc.id } })}
      onSwitchDatabase={(db) => connection && navigate(`/data-explorer/${encodeURIComponent(connection.accountId)}/${encodeURIComponent(db.name)}`)}
    >
      <QueryGeneratorPage
        name={name}
        email={email}
        onLogout={onLogout}
        onNavigateToExplorer={onNavigateToExplorer}
        onConnectionChange={(accountId, databaseName, accountName, collections, availableAccounts, availableDbs) =>
          setConnection(accountId && databaseName ? { accountId, databaseName, accountName: accountName ?? undefined, collections, availableAccounts, availableDbs } : null)
        }
        preselectedAccountId={hubState.preselectedAccountId}
        embedded
      />
    </AppLayout>
  );
};

// Component for the local bypass authentication flow
const BypassQueryGeneratorPageWrapper: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hubState = (location.state as HubNavState) ?? {};
  const [connection, setConnection] = React.useState<ConnectionState | null>(() =>
    hubState.preselectedAccountId ? null : readSessionConnection()
  );

  const name = user?.name;
  const email = user?.email;

  const onNavigateToExplorer = (conn: {
    resource: SelectedResource;
    dbInfo: DbInfo;
    accountName: string;
    availableDbs: DbInfo[];
    availableAccounts: CosmosDBAccount[]
  }) => {
    navigate(`/data-explorer/${encodeURIComponent(conn.resource.accountId)}/${encodeURIComponent(conn.resource.databaseName)}`, {
      state: {
        dbInfo: conn.dbInfo,
        accountName: conn.accountName,
        availableDbs: conn.availableDbs,
        availableAccounts: conn.availableAccounts
      }
    });
  };

  return (
    <AppLayout
      accountId={connection?.accountId}
      databaseName={connection?.databaseName}
      accountName={connection?.accountName}
      collections={connection?.collections}
      availableAccounts={connection?.availableAccounts}
      availableDbs={connection?.availableDbs}
      onSwitchAccount={(acc) => navigate('/query-generator', { state: { preselectedAccountId: acc.id } })}
      onSwitchDatabase={(db) => connection && navigate(`/data-explorer/${encodeURIComponent(connection.accountId)}/${encodeURIComponent(db.name)}`)}
    >
      <QueryGeneratorPage
        name={name}
        email={email}
        onLogout={logout}
        onNavigateToExplorer={onNavigateToExplorer}
        onConnectionChange={(accountId, databaseName, accountName, collections, availableAccounts, availableDbs) =>
          setConnection(accountId && databaseName ? { accountId, databaseName, accountName: accountName ?? undefined, collections, availableAccounts, availableDbs } : null)
        }
        preselectedAccountId={hubState.preselectedAccountId}
        embedded
      />
    </AppLayout>
  );
};

// Wrapper that selects the authentication flow
const QueryGeneratorPageWrapper: React.FC = () => {
  return USE_MSAL_AUTH ? <MsalQueryGeneratorPageWrapper /> : <BypassQueryGeneratorPageWrapper />;
};

export default QueryGeneratorPageWrapper;
