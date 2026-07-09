import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HubPage from './pages/HubPage';
import QueryGeneratorPageWrapper from './pages/QueryGeneratorPageWrapper';
import DataExplorerPageWrapper from './pages/DataExplorerPageWrapper';
import PostgresWorkspacePage from './pages/PostgresWorkspacePage';
import PostgresDataExplorerPage from './pages/PostgresDataExplorerPage';
import AnalyticsPageWrapper from './pages/AnalyticsPageWrapper';
import NotFoundPage from './pages/NotFoundPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import AuditPage from './pages/AuditPage';
import AdminPage from './pages/AdminPage';

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
    path: "/data-explorer/:accountId",
    element: (
      <ProtectedRoute>
        <DataExplorerPageWrapper />
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
    path: "/postgres/:serverId",
    element: (
      <ProtectedRoute>
        <PostgresWorkspacePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/postgres/:serverId/:database",
    element: (
      <ProtectedRoute>
        <PostgresWorkspacePage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/postgres-explorer/:serverId",
    element: (
      <ProtectedRoute>
        <PostgresDataExplorerPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/postgres-explorer/:serverId/:database",
    element: (
      <ProtectedRoute>
        <PostgresDataExplorerPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin",
    element: (
      <ProtectedRoute>
        <AdminPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
