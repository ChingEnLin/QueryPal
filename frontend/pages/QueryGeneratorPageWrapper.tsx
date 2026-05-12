import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMsal } from "@azure/msal-react";
import { useAuth } from '../contexts/AuthContext';
import { USE_MSAL_AUTH } from '../app.config';
import QueryGeneratorPage from './QueryGeneratorPage';
import AppLayout from '../components/AppLayout';
import { SelectedResource, DbInfo, CosmosDBAccount } from '../types';

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

  const name = accounts[0]?.name;
  const email = accounts[0]?.username;
  const onLogout = () => instance.logoutRedirect({ postLogoutRedirectUri: "/" });

  const onNavigateToExplorer = (connection: {
    resource: SelectedResource;
    dbInfo: DbInfo;
    accountName: string;
    availableDbs: DbInfo[];
    availableAccounts: CosmosDBAccount[]
  }) => {
    navigate(`/data-explorer/${encodeURIComponent(connection.resource.accountId)}/${encodeURIComponent(connection.resource.databaseName)}`, {
      state: {
        dbInfo: connection.dbInfo,
        accountName: connection.accountName,
        availableDbs: connection.availableDbs,
        availableAccounts: connection.availableAccounts
      }
    });
  };

  return (
    <AppLayout>
      <QueryGeneratorPage
        name={name}
        email={email}
        onLogout={onLogout}
        onNavigateToExplorer={onNavigateToExplorer}
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

  const name = user?.name;
  const email = user?.email;

  const onNavigateToExplorer = (connection: {
    resource: SelectedResource;
    dbInfo: DbInfo;
    accountName: string;
    availableDbs: DbInfo[];
    availableAccounts: CosmosDBAccount[]
  }) => {
    navigate(`/data-explorer/${encodeURIComponent(connection.resource.accountId)}/${encodeURIComponent(connection.resource.databaseName)}`, {
      state: {
        dbInfo: connection.dbInfo,
        accountName: connection.accountName,
        availableDbs: connection.availableDbs,
        availableAccounts: connection.availableAccounts
      }
    });
  };

  return (
    <AppLayout>
      <QueryGeneratorPage
        name={name}
        email={email}
        onLogout={logout}
        onNavigateToExplorer={onNavigateToExplorer}
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
