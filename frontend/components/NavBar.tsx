import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUnifiedAuth } from '../hooks/useUnifiedAuth';
import { useTheme } from '../contexts/ThemeContext';
import MongoIcon from './icons/MongoIcon';
import {
    SunIcon,
    MoonIcon,
    SignOutIcon,

    DatabaseIcon,
    BookmarkIcon
} from './icons/material-icons-imports';

// Simple types for the NavBar
interface NavBarProps {
    // Add props if needed in feature
}

const NavBar: React.FC<NavBarProps> = () => {
    const { user, logout } = useUnifiedAuth();
    const { theme, toggleTheme } = useTheme();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
            <div className="flex items-center space-x-4">
                <Link to="/query-generator" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                    <MongoIcon className="w-10 h-10 text-blue-500" />
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">QueryPal</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-xs">Audit & Analytics</p>
                    </div>
                </Link>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
                <Link
                    to="/query-generator"
                    className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-colors ${isActive('/query-generator') ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                    <DatabaseIcon className="w-4 h-4" />
                    Query Gen
                </Link>

                <Link
                    to="/audit"
                    className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-colors ${isActive('/audit') ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                    <BookmarkIcon className="w-4 h-4" />
                    Audit Log
                </Link>

                <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1"></div>

                <button
                    onClick={toggleTheme}
                    className="p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Toggle theme"
                >
                    {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                </button>

                <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-700">
                    <div className="text-sm text-slate-600 dark:text-slate-300 hidden md:block">
                        {user?.name || user?.email}
                    </div>
                    <button
                        onClick={logout}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                        title="Sign Out"
                    >
                        <SignOutIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </nav>
    );
};

export default NavBar;
