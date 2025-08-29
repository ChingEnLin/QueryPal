
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "../authConfig";
import MongoIcon from '../components/icons/MongoIcon';
import { USE_MSAL_AUTH } from '../app.config';
import { useAuth } from '../contexts/AuthContext';
import { UserIcon, MicrosoftIcon } from '../components/icons/material-icons-imports';

// --- UI Component (Shared) ---
interface LoginUIProps {
    onLogin: () => void;
    buttonText: string;
    ButtonIcon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const LoginUI: React.FC<LoginUIProps> = ({ onLogin, buttonText, ButtonIcon }) => (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center p-4 text-slate-800 dark:text-slate-200">
        <div className="max-w-md w-full mx-auto bg-white dark:bg-slate-800/50 dark:ring-1 dark:ring-slate-700 rounded-xl shadow-lg dark:shadow-black/20 p-6 sm:p-8 text-center">
            <header className="flex flex-col items-center justify-center space-y-4 mb-8">
                <MongoIcon className="w-16 h-16 text-blue-500" />
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">QueryPal</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Your AI-Powered Database Assistant</p>
                </div>
            </header>

            <main className="space-y-6">
                <button
                    onClick={onLogin}
                    className="w-full flex justify-center items-center gap-3 px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-violet-600 hover:bg-violet-700 disabled:bg-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.99]"
                    title={buttonText}
                >
                    <ButtonIcon className="w-6 h-6" />
                    {buttonText}
                </button>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    {USE_MSAL_AUTH 
                        ? "You will be redirected to the Microsoft login page for authentication."
                        : "Using developer sign-in. No credentials required."
                    }
                </p>
            </main>
        </div>
                <footer className="text-center mt-8 text-slate-500 dark:text-slate-400 text-sm">
            <p>Powered by Microsoft Azure and Google Gemini. For internal use only.</p>
            <p className="text-xs max-w-md mx-auto">
                AI features use the Google Gemini API. Your data is not used to train their models. See the <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-200">Terms of Service</a>.
            </p>
        </footer>
    </div>
);


// --- Container Components ---

const MsalLoginPage: React.FC = () => {
    const { instance, accounts } = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        console.log('MSAL Login Page - isAuthenticated:', isAuthenticated, 'accounts:', accounts);
        if (isAuthenticated && accounts.length > 0) {
            // Check if there's a saved location to redirect to
            const from = location.state?.from?.pathname || '/query-generator';
            const search = location.state?.from?.search || '';
            const hash = location.state?.from?.hash || '';
            const redirectPath = from + search + hash;
            
            console.log('User is authenticated, navigating to:', redirectPath);
            navigate(redirectPath, { replace: true });
        }
    }, [isAuthenticated, accounts, navigate, location.state]);

    const handleLogin = () => {
        console.log('Starting MSAL login redirect');
        instance.loginRedirect(loginRequest).catch(e => {
            console.error('MSAL login error:', e);
        });
    }

    // Show loading state if we're in the middle of processing authentication
    if (isAuthenticated && accounts.length > 0) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center items-center p-4 text-slate-800 dark:text-slate-200">
                <div>Redirecting to Query Generator...</div>
            </div>
        );
    }

    return <LoginUI onLogin={handleLogin} buttonText="Sign In with Microsoft Entra ID" ButtonIcon={MicrosoftIcon} />;
};

const BypassLoginPage: React.FC = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogin = () => {
        login();
        // Navigate using React Router instead of window.location
        setTimeout(() => {
            // Check if there's a saved location to redirect to
            const from = location.state?.from?.pathname || '/query-generator';
            const search = location.state?.from?.search || '';
            const hash = location.state?.from?.hash || '';
            const redirectPath = from + search + hash;
            
            navigate(redirectPath, { replace: true });
        }, 100);
    };

    return <LoginUI onLogin={handleLogin} buttonText="Sign In as Developer" ButtonIcon={UserIcon} />;
}

// --- Main Exported Component (Router) ---

const LoginPage: React.FC = () => {
    return USE_MSAL_AUTH ? <MsalLoginPage /> : <BypassLoginPage />;
};

export default LoginPage;
