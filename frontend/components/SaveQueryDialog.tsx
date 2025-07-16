
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SavedQuery } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import XIcon from './icons/XIcon';

interface SaveQueryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Pick<SavedQuery, 'name' | 'prompt' | 'code'> | SavedQuery) => void;
  isSaving: boolean;
  initialData: Partial<SavedQuery> & {
    prompt: string;
    code: string;
  };
}

const SaveQueryDialog: React.FC<SaveQueryDialogProps> = ({ isOpen, onClose, onSave, isSaving, initialData }) => {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  
  const isEditMode = !!initialData.id;

  useEffect(() => {
    if (isOpen) {
      setName(initialData.name || '');
      setPrompt(initialData.prompt || '');
      setCode(initialData.code || '');
      setError('');
    }
  }, [isOpen, initialData]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Query name is required.');
      return;
    }
    const saveData = isEditMode
      ? { ...(initialData as SavedQuery), name, prompt, code }
      : { name, prompt, code };
      
    onSave(saveData);
  };
  
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 animate-fade-in-fast">
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl transform transition-all animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <form onSubmit={handleSave}>
          <header className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
            <h2 id="dialog-title" className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {isEditMode ? 'Edit Saved Query' : 'Save Query'}
            </h2>
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

          <main className="p-4 sm:p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label htmlFor="query-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Query Name
              </label>
              <input
                id="query-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Active Canadian Users"
                required
              />
              {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
            </div>
            <div>
              <label htmlFor="query-prompt" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Natural Language Prompt
              </label>
              <textarea
                id="query-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                className="w-full p-2 bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              />
            </div>
            <div>
              <label htmlFor="query-code" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Query Code
              </label>
              <textarea
                id="query-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={6}
                className="w-full p-3 bg-slate-900 dark:bg-black/40 border border-slate-600 dark:border-slate-700 rounded-lg text-cyan-300 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                spellCheck="false"
              />
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
              title={isEditMode ? 'Save changes' : 'Save the new query'}
            >
              {isSaving ? <SpinnerIcon className="w-5 h-5"/> : 'Save'}
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

export default SaveQueryDialog;
