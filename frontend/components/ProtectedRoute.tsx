import React from 'react';
import { Navigate } from 'react-router-dom';
import { useIsAuthenticated } from "@azure/msal-react";
import { useAuth } from '../contexts/AuthContext';
import { USE_MSAL_AUTH } from '../app.config';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const MsalProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const isAuthenticated = useIsAuthenticated();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

const BypassProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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
