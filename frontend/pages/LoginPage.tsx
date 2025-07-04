import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import MongoIcon from '../components/icons/MongoIcon';

const LoginPage: React.FC = () => {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 text-slate-800">
      <div className="max-w-md w-full mx-auto bg-white rounded-xl shadow-md p-8 text-center">
        <header className="flex flex-col items-center justify-center space-y-4 mb-8">
          <MongoIcon className="w-16 h-16 text-blue-500" />
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">QueryPal</h1>
            <p className="text-slate-500 mt-2">Your AI-Powered Database Assistant</p>
          </div>
        </header>

        <main className="space-y-6">
          <button
            onClick={login}
            className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.99]"
          >
            Sign In
          </button>
           <p className="text-xs text-slate-500">
            (Authentication is currently bypassed for development. Click "Sign In" to proceed.)
          </p>
        </main>
      </div>
      <footer className="text-center mt-8 text-slate-500 text-sm">
          <p>Powered by Google Gemini. For demonstration purposes only.</p>
      </footer>
    </div>
  );
};

export default LoginPage;