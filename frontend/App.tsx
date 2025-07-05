import React from 'react';
import { useIsAuthenticated } from "@azure/msal-react";
import LoginPage from './pages/LoginPage';
import QueryGeneratorPage from './pages/QueryGeneratorPage';
import { useAuth } from './contexts/AuthContext';
import { USE_MSAL_AUTH } from './app.config';

// Component for the real MSAL authentication flow
const MsalAppFlow: React.FC = () => {
  const isAuthenticated = useIsAuthenticated();
  return <>{isAuthenticated ? <QueryGeneratorPage /> : <LoginPage />}</>;
};

// Component for the local bypass authentication flow
const BypassAppFlow: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return <>{isAuthenticated ? <QueryGeneratorPage /> : <LoginPage />}</>;
};

// App acts as a router to select the authentication flow.
// This ensures hooks are called correctly within their respective contexts.
const App: React.FC = () => {
  return USE_MSAL_AUTH ? <MsalAppFlow /> : <BypassAppFlow />;
};

export default App;
