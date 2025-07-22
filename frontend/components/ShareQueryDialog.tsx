import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SavedQuery } from '../types';
import { SpinnerIcon, XIcon, PlusCircleIcon, TrashIcon } from './icons/material-icons-imports';

interface ShareQueryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedQuery: SavedQuery) => void;
  query: SavedQuery;
}

const ShareQueryDialog: React.FC<ShareQueryDialogProps> = ({ isOpen, onClose, onSave, query }) => {
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSharedWith(query.sharedWith || []);
      setNewEmail('');
      setError('');
    }
  }, [isOpen, query]);

  const handleAddEmail = () => {
    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail) return;

    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
        setError('Please enter a valid email address.');
        return;
    }
    if (sharedWith.includes(trimmedEmail)) {
        setError('This email has already been added.');
        return;
    }
    if (trimmedEmail === query.ownerEmail) {
        setError('You cannot share a query with its owner.');
        return;
    }

    setSharedWith([...sharedWith, trimmedEmail]);
    setNewEmail('');
    setError('');
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setSharedWith(sharedWith.filter(email => email !== emailToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const updatedQuery = { ...query, sharedWith };
    await onSave(updatedQuery);
    setIsSaving(false);
  };
  
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 animate-fade-in-fast">
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg transform transition-all animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <form onSubmit={handleSave}>
          <header className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
            <div>
                <h2 id="dialog-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Share Query
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm truncate" title={query.name}>
                    {query.name}
                </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Close dialog"
              title="Close dialog"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </header>

          <main className="p-4 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label htmlFor="share-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Add people by email
              </label>
              <div className="flex items-center gap-2">
                <input
                    id="share-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                        setNewEmail(e.target.value);
                        setError(''); // Clear error on type
                    }}
                    className="flex-grow p-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., colleague@example.com"
                />
                <button 
                    type="button"
                    onClick={handleAddEmail}
                    className="p-2 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    title="Add email"
                >
                    <PlusCircleIcon className="w-6 h-6"/>
                </button>
              </div>
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>

            <div className="space-y-2">
                 <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">People with access</h3>
                 <div className="space-y-2">
                    <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-700/50 p-2 rounded-lg">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{query.ownerEmail}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Owner</span>
                    </div>
                    {sharedWith.map(email => (
                         <div key={email} className="flex items-center justify-between bg-slate-100 dark:bg-slate-700/50 p-2 rounded-lg animate-fade-in">
                            <span className="text-sm text-slate-600 dark:text-slate-300">{email}</span>
                            <button
                                type="button"
                                onClick={() => handleRemoveEmail(email)}
                                className="p-1 rounded-full text-slate-500 hover:bg-red-200 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400"
                                title="Remove access"
                            >
                                <TrashIcon className="w-4 h-4"/>
                            </button>
                        </div>
                    ))}
                    {sharedWith.length === 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">Not shared with anyone yet.</p>
                    )}
                 </div>
            </div>

          </main>

          <footer className="flex justify-end items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
              title="Discard changes and close"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="w-28 flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
              title="Save sharing settings"
            >
              {isSaving ? <SpinnerIcon className="w-5 h-5"/> : 'Done'}
            </button>
          </footer>
        </form>
      </div>
       <style>{`
          @keyframes scale-in {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
          }
          .animate-scale-in {
              animation: scale-in 0.2s ease-out forwards;
          }
      `}</style>
    </div>,
    document.body
  );
};

export default ShareQueryDialog;
