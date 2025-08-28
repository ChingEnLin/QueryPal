import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useIsAuthenticated } from "@azure/msal-react";
import { useAuth } from '../contexts/AuthContext';
import { USE_MSAL_AUTH } from '../app.config';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const MsalProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();
  
  if (!isAuthenticated) {
    // Save the current location to state so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

const BypassProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  
  if (!isAuthenticated) {
    // Save the current location to state so we can redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  return USE_MSAL_AUTH ? (
    <MsalProtectedRoute>{children}</MsalProtectedRoute>
  ) : (
    <BypassProtectedRoute>{children}</BypassProtectedRoute>
  );
};
