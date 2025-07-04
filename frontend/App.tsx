
import React from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import QueryGeneratorPage from './pages/QueryGeneratorPage';

const App: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <>
      {isAuthenticated ? <QueryGeneratorPage /> : <LoginPage />}
    </>
  );
};

export default App;
