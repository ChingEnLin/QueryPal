import React from 'react';
import { useNavigate } from 'react-router-dom';
import MongoIcon from '../components/icons/MongoIcon';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center p-4 text-slate-800 dark:text-slate-200">
      <div className="max-w-md w-full mx-auto bg-white dark:bg-slate-800/50 dark:ring-1 dark:ring-slate-700 rounded-xl shadow-lg dark:shadow-black/20 p-6 sm:p-8 text-center">
        <header className="flex flex-col items-center justify-center space-y-4 mb-8">
          <MongoIcon className="w-16 h-16 text-blue-500" />
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">QueryPal</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Page Not Found</p>
          </div>
        </header>

        <main className="space-y-6">
          <div className="text-6xl mb-4">404</div>
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => navigate('/query-generator')}
              className="w-full px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-all duration-200"
            >
              Go to Query Generator
            </button>
            
            <button
              onClick={() => navigate('/login')}
              className="w-full px-6 py-3 border border-slate-300 dark:border-slate-600 text-base font-medium rounded-md text-slate-700 dark:text-slate-200 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-all duration-200"
            >
              Back to Login
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default NotFoundPage;
