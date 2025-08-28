import { createBrowserRouter, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import QueryGeneratorPageWrapper from './pages/QueryGeneratorPageWrapper';
import DataExplorerPageWrapper from './pages/DataExplorerPageWrapper';
import NotFoundPage from './pages/NotFoundPage';
import { ProtectedRoute } from './components/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/query-generator" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
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
    path: "*",
    element: <NotFoundPage />,
  },
]);
