
import React from 'react';
import { createPortal } from 'react-dom';
import XIcon from './icons/XIcon';
import KeyboardIcon from './icons/KeyboardIcon';

interface ShortcutCheatsheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="px-2 py-1.5 text-xs font-semibold text-slate-700 bg-slate-200 border border-slate-300 rounded-md dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600">
        {children}
    </kbd>
);

const ShortcutItem: React.FC<{ keys: string[]; description: string }> = ({ keys, description }) => (
    <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
        <span className="text-sm text-slate-800 dark:text-slate-200">{description}</span>
        <div className="flex items-center gap-1">
            {keys.map((key, index) => (
                <React.Fragment key={key}>
                    <Kbd>{key}</Kbd>
                    {index < keys.length - 1 && <span className="text-slate-400">+</span>}
                </React.Fragment>
            ))}
        </div>
    </div>
);

const ShortcutCheatsheet: React.FC<ShortcutCheatsheetProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const commandKey = isMac ? '⌘' : 'Ctrl';

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4 animate-fade-in-fast">
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg transform transition-all animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <header className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 id="dialog-title" className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <KeyboardIcon className="w-6 h-6" />
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close dialog"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </header>

        <main className="p-4 sm:p-6 space-y-3">
            <ShortcutItem keys={[commandKey, 'Enter']} description="Run Query (in editor)" />
            <ShortcutItem keys={[commandKey, 'G']} description="Generate Query (in prompt)" />
            <ShortcutItem keys={[commandKey, 'S']} description="Save Current Query" />
            <ShortcutItem keys={[commandKey, '/']} description="Show This Cheatsheet" />
            <ShortcutItem keys={['Esc']} description="Close Dialog or Panel" />
        </main>
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

export default ShortcutCheatsheet;
