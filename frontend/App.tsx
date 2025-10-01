
import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { useTokenRenewal } from './hooks/useTokenRenewal';

const App: React.FC = () => {
  // Initialize token renewal service
  useTokenRenewal();
  
  return <RouterProvider router={router} />;
};

export default App;