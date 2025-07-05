import React from 'react';
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";
import MongoIcon from '../components/icons/MongoIcon';
import MicrosoftIcon from '../components/icons/MicrosoftIcon';
import { USE_MSAL_AUTH } from '../app.config';
import { useAuth } from '../contexts/AuthContext';
import UserIcon from '../components/icons/UserIcon';

// --- UI Component (Shared) ---
interface LoginUIProps {
    onLogin: () => void;
    buttonText: string;
    ButtonIcon: React.FC<React.SVGProps<SVGSVGElement>>;
}

const LoginUI: React.FC<LoginUIProps> = ({ onLogin, buttonText, ButtonIcon }) => (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 text-slate-800">
        <div className="max-w-md w-full mx-auto bg-white rounded-xl shadow-md p-8 text-center">
            <header className="flex flex-col items-center justify-center space-y-4 mb-8">
                <MongoIcon className="w-16 h-16 text-blue-500" />
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">QueryPal</h1>
                    <p className="text-slate-500 mt-2">Your AI-Powered Database Assistant</p>
                </div>
            </header>

            <main className="space-y-6">
                <button
                    onClick={onLogin}
                    className="w-full flex justify-center items-center gap-3 px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-violet-600 hover:bg-violet-700 disabled:bg-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.99]"
                >
                    <ButtonIcon className="w-6 h-6" />
                    {buttonText}
                </button>
                <p className="text-xs text-slate-500">
                    {USE_MSAL_AUTH 
                        ? "You will be redirected to the Microsoft login page for authentication."
                        : "Using developer sign-in. No credentials required."
                    }
                </p>
            </main>
        </div>
        <footer className="text-center mt-8 text-slate-500 text-sm">
            <p>Powered by Google Gemini. For demonstration purposes only.</p>
        </footer>
    </div>
);


// --- Container Components ---

const MsalLoginPage: React.FC = () => {
    const { instance } = useMsal();
    const handleLogin = () => {
        instance.loginRedirect(loginRequest).catch(e => {
            console.error(e);
        });
    }
    return <LoginUI onLogin={handleLogin} buttonText="Sign In with Microsoft Entra ID" ButtonIcon={MicrosoftIcon} />;
};

const BypassLoginPage: React.FC = () => {
    const { login } = useAuth();
    return <LoginUI onLogin={login} buttonText="Sign In as Developer" ButtonIcon={UserIcon} />;
}

// --- Main Exported Component (Router) ---

const LoginPage: React.FC = () => {
    return USE_MSAL_AUTH ? <MsalLoginPage /> : <BypassLoginPage />;
};

export default LoginPage;
