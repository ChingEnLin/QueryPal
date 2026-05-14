import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HubPage from './pages/HubPage';
import QueryGeneratorPageWrapper from './pages/QueryGeneratorPageWrapper';
import DataExplorerPageWrapper from './pages/DataExplorerPageWrapper';
import AnalyticsPageWrapper from './pages/AnalyticsPageWrapper';
import NotFoundPage from './pages/NotFoundPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import AuditPage from './pages/AuditPage';

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/hub" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/hub",
    element: (
      <ProtectedRoute>
        <HubPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/audit",
    element: (
      <ProtectedRoute>
        <AuditPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/analytics",
    element: (
      <ProtectedRoute>
        <AnalyticsPageWrapper />
      </ProtectedRoute>
    ),
  },
  {
    path: "/query-generator",
    element: (
      <ProtectedRoute>
        <QueryGeneratorPageWrapper />
      </ProtectedRoute>
    ),
  },
  {
    path: "/data-explorer/:accountId/:databaseName",
    element: (
      <ProtectedRoute>
        <DataExplorerPageWrapper />
      </ProtectedRoute>
    ),
  },
  {
    path: "/data-explorer/:accountId/:databaseName/document/:documentId",
    element: (
      <ProtectedRoute>
        <DataExplorerPageWrapper />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
