import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './authConfig';
import { AuthProvider } from './contexts/AuthContext';
import { USE_MSAL_AUTH } from './app.config';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {USE_MSAL_AUTH ? (
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    ) : (
      <AuthProvider>
        <App />
      </AuthProvider>
    )}
  </React.StrictMode>
);
