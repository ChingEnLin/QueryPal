import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './authConfig';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { USE_MSAL_AUTH } from './app.config';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Initialize MSAL and handle redirect response
if (USE_MSAL_AUTH) {
  msalInstance.initialize().then(() => {
    // Handle redirect promise to capture the result of the authentication flow
    return msalInstance.handleRedirectPromise();
  }).then((response) => {
    // If the response is non-null, the user was redirected back from Azure AD
    if (response) {
      console.log('Authentication successful:', response);
    }
    
    // Render the app after MSAL initialization is complete
    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <MsalProvider instance={msalInstance}>
            <NotificationsProvider>
              <App />
            </NotificationsProvider>
          </MsalProvider>
        </ThemeProvider>
      </React.StrictMode>
    );
  }).catch((error) => {
    console.error('MSAL initialization error:', error);
    
    // Still render the app even if there's an error
    root.render(
      <React.StrictMode>
        <ThemeProvider>
          <MsalProvider instance={msalInstance}>
            <NotificationsProvider>
              <App />
            </NotificationsProvider>
          </MsalProvider>
        </ThemeProvider>
      </React.StrictMode>
    );
  });
} else {
  // For bypass authentication, render normally
  root.render(
    <React.StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </React.StrictMode>
  );
}