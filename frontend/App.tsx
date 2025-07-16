
import React from 'react';
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import LoginPage from './pages/LoginPage';
import QueryGeneratorPage from './pages/QueryGeneratorPage';
import { useAuth } from './contexts/AuthContext';
import { USE_MSAL_AUTH } from './app.config';

// Component for the real MSAL authentication flow
const MsalAppFlow: React.FC = () => {
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts } = useMsal();
  
  const name = accounts[0]?.name;
  const email = accounts[0]?.username; // The username claim is typically the user's email/UPN
  const onLogout = () => instance.logoutRedirect({ postLogoutRedirectUri: "/" });

  return (
    <>
      {isAuthenticated ? (
        <QueryGeneratorPage name={name} email={email} onLogout={onLogout} />
      ) : (
        <LoginPage />
      )}
    </>
  );
};

// Component for the local bypass authentication flow
const BypassAppFlow: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const name = user?.name;
  const email = user?.email;
  
  return (
    <>
      {isAuthenticated ? (
        <QueryGeneratorPage name={name} email={email} onLogout={logout} />
      ) : (
        <LoginPage />
      )}
    </>
  );
};

// App acts as a router to select the authentication flow.
// This ensures hooks are called correctly within their respective contexts.
const App: React.FC = () => {
  return USE_MSAL_AUTH ? <MsalAppFlow /> : <BypassAppFlow />;
};

export default App;
