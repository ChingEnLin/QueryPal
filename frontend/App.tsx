
import React, { useState } from 'react';
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import LoginPage from './pages/LoginPage';
import QueryGeneratorPage from './pages/QueryGeneratorPage';
import DataExplorerPage from './pages/DataExplorerPage'; // Import the new page
import { useAuth } from './contexts/AuthContext';
import { USE_MSAL_AUTH } from './app.config';
import { SelectedResource, DbInfo, CosmosDBAccount } from './types';

type PageView = 'queryGenerator' | 'dataExplorer';

// Component for the real MSAL authentication flow
const MsalAppFlow: React.FC = () => {
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts } = useMsal();
  
  const name = accounts[0]?.name;
  const email = accounts[0]?.username;
  const onLogout = () => instance.logoutRedirect({ postLogoutRedirectUri: "/" });

  const [page, setPage] = useState<PageView>('queryGenerator');
  const [connection, setConnection] = useState<{ resource: SelectedResource; dbInfo: DbInfo; accountName: string; availableDbs: DbInfo[]; availableAccounts: CosmosDBAccount[] } | null>(null);

  if (!isAuthenticated) return <LoginPage />;

  if (page === 'dataExplorer' && connection) {
    return <DataExplorerPage 
              initialResource={connection.resource}
              initialDbInfo={connection.dbInfo}
              accountName={connection.accountName}
              availableDbs={connection.availableDbs}
              availableAccounts={connection.availableAccounts}
              onNavigateBack={() => setPage('queryGenerator')}
           />;
  }

  return <QueryGeneratorPage 
          name={name} 
          email={email} 
          onLogout={onLogout} 
          onNavigateToExplorer={(conn) => {
            setConnection(conn);
            setPage('dataExplorer');
          }}
         />;
};

// Component for the local bypass authentication flow
const BypassAppFlow: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const name = user?.name;
  const email = user?.email;

  const [page, setPage] = useState<PageView>('queryGenerator');
  const [connection, setConnection] = useState<{ resource: SelectedResource; dbInfo: DbInfo; accountName: string; availableDbs: DbInfo[]; availableAccounts: CosmosDBAccount[] } | null>(null);
  
  if (!isAuthenticated) return <LoginPage />;

  if (page === 'dataExplorer' && connection) {
    return <DataExplorerPage 
              initialResource={connection.resource}
              initialDbInfo={connection.dbInfo}
              accountName={connection.accountName}
              availableDbs={connection.availableDbs}
              availableAccounts={connection.availableAccounts}
              onNavigateBack={() => setPage('queryGenerator')}
           />;
  }

  return <QueryGeneratorPage 
          name={name} 
          email={email} 
          onLogout={logout} 
          onNavigateToExplorer={(conn) => {
            setConnection(conn);
            setPage('dataExplorer');
          }}
        />;
};

// App acts as a router to select the authentication flow.
// This ensures hooks are called correctly within their respective contexts.
const App: React.FC = () => {
  return USE_MSAL_AUTH ? <MsalAppFlow /> : <BypassAppFlow />;
};

export default App;