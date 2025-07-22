
import React, { useState, useMemo } from 'react';
import { SavedQuery } from '../types';
import { XIcon, SpinnerIcon, EditIcon, BookmarkIcon, TrashIcon, ShareIcon } from './icons/material-icons-imports';

interface SavedQueriesPanelProps {
    onClose: () => void;
    queries: SavedQuery[];
    onLoad: (query: SavedQuery) => void;
    onEdit: (query: SavedQuery) => void;
    onDelete: (queryId: string) => void;
    onShare: (query: SavedQuery) => void;
    isLoading: boolean;
    currentUserEmail?: string | null;
}

const SavedQueryCard: React.FC<{
    query: SavedQuery;
    onLoad: (query: SavedQuery) => void;
    onEdit: (query: SavedQuery) => void;
    onDelete: (queryId: string) => void;
    onShare: (query: SavedQuery) => void;
    isOwned: boolean;
}> = ({ query, onLoad, onEdit, onDelete, onShare, isOwned }) => {
    
    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete "${query.name}"? This action cannot be undone.`)) {
            onDelete(query.id);
        }
    };

    const timeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return "just now";
    };

    return (
        <div className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 space-y-3 group transition-all hover:border-slate-600 hover:bg-slate-800">
            <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-slate-200 break-words">{query.name}</h4>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isOwned && (
                        <button onClick={() => onShare(query)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-600 hover:text-white" aria-label="Share query" title="Share and manage access">
                            <ShareIcon className="w-4 h-4" />
                        </button>
                    )}
                    <button onClick={() => onEdit(query)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-600 hover:text-white" aria-label="Edit query" title="Edit query name, prompt, or code">
                        <EditIcon className="w-4 h-4" />
                    </button>
                    {isOwned && (
                        <button onClick={handleDelete} className="p-1.5 rounded-full text-slate-400 hover:bg-red-900/50 hover:text-red-400" aria-label="Delete query" title="Permanently delete this query">
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <blockquote className="border-l-4 border-blue-400 pl-3 text-sm italic text-slate-400 max-h-20 overflow-y-auto">
                {query.prompt}
            </blockquote>

             {!isOwned && (
                <div className="text-xs text-slate-400">
                    Shared by <strong className="text-slate-300">{query.ownerEmail}</strong> &middot; Edited {timeAgo(query.updatedAt)} by {query.lastModifiedBy.split('@')[0]}
                </div>
            )}
            
            <button
                onClick={() => onLoad(query)}
                className="w-full px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-blue-500 transition-colors"
                title="Load this query and prompt into the main editor"
            >
                Load Query
            </button>
        </div>
    );
};

const SavedQueriesPanel: React.FC<SavedQueriesPanelProps> = ({ onClose, queries, onLoad, onEdit, onDelete, onShare, isLoading, currentUserEmail }) => {
    const [activeTab, setActiveTab] = useState<'my_queries' | 'shared_with_me'>('my_queries');

    const { myQueries, sharedWithMe } = useMemo(() => {
        if (!currentUserEmail) return { myQueries: [], sharedWithMe: [] };
        const myq: SavedQuery[] = [];
        const swm: SavedQuery[] = [];
        queries.forEach(q => {
            if (q.ownerEmail === currentUserEmail) {
                myq.push(q);
            } else if (q.sharedWith.includes(currentUserEmail)) {
                swm.push(q);
            }
        });
        return { myQueries: myq, sharedWithMe: swm };
    }, [queries, currentUserEmail]);

    const queriesToDisplay = activeTab === 'my_queries' ? myQueries : sharedWithMe;

    const renderContent = () => {
        if (isLoading) {
             return (
                <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center">
                    <SpinnerIcon className="w-8 h-8 text-blue-500"/>
                    <p className="mt-4 font-semibold">Loading your queries...</p>
                </div>
            );
        }
        if (queriesToDisplay.length > 0) {
            return queriesToDisplay.map((query) => (
              <SavedQueryCard 
                key={query.id} 
                query={query}
                onLoad={onLoad}
                onEdit={onEdit}
                onDelete={onDelete}
                onShare={onShare}
                isOwned={activeTab === 'my_queries'}
              />
            ));
        }
        if (activeTab === 'my_queries') {
            return (
                <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center p-4">
                    <p className="font-semibold">No queries saved yet.</p>
                    <p className="text-sm">Click the "Save" button on a generated query to add it here.</p>
                </div>
            );
        }
        return (
            <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center p-4">
                <p className="font-semibold">No queries shared with you.</p>
                <p className="text-sm">When a colleague shares a query with you, it will appear here.</p>
            </div>
        );
    };

    return (
        <>
            <div
                onClick={onClose}
                className="fixed inset-0 bg-black bg-opacity-60 z-40 animate-fade-in-fast"
                aria-hidden="true"
            ></div>
            <aside 
                id="tutorial-saved-queries-panel"
                className="fixed top-0 right-0 h-full w-full md:w-[450px] bg-slate-900 shadow-2xl z-50 flex flex-col animate-slide-in-drawer"
            >
                <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                        <BookmarkIcon className="w-5 h-5 text-blue-400" />
                        Saved Queries
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                        aria-label="Close saved queries panel"
                        title="Close saved queries"
                    >
                        <XIcon className="w-5 h-5" />
                    </button>
                </header>

                <div className="flex-shrink-0 p-2 border-b border-slate-700">
                    <div className="flex items-center gap-2 p-1 bg-slate-800 rounded-lg">
                        <button
                            onClick={() => setActiveTab('my_queries')}
                            className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'my_queries' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                            My Queries
                        </button>
                        <button
                            onClick={() => setActiveTab('shared_with_me')}
                            className={`flex-1 px-3 py-1.5 text-sm font-semibold rounded-md transition-colors ${activeTab === 'shared_with_me' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700'}`}
                        >
                            Shared With Me
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-auto p-4 space-y-4">
                    {renderContent()}
                </div>
            </aside>
        </>
    );
};

export default SavedQueriesPanel;
