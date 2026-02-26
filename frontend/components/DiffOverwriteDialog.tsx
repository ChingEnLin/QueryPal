import React from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { useTheme } from '../contexts/ThemeContext';
import { WarningIcon } from './icons/material-icons-imports';

interface DiffOverwriteDialogProps {
    open: boolean;
    oldValue: string; // The user's current edited value
    newValue: string; // The newly fetched data from server
    onClose: () => void;
    onOverwrite: () => void;
}

const DiffOverwriteDialog: React.FC<DiffOverwriteDialogProps> = ({ open, oldValue, newValue, onClose, onOverwrite }) => {
    const { theme } = useTheme();

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 dark:bg-black/70 backdrop-blur-sm animate-fade-in-fast">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl max-w-5xl w-[90vw] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh]">
                <header className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/20 flex flex-col gap-1 flex-shrink-0">
                    <h2 className="text-xl font-bold text-amber-600 dark:text-amber-500 flex items-center gap-2">
                        <WarningIcon className="w-6 h-6" /> Refresh Will Overwrite Your Edits
                    </h2>
                    <p className="text-sm text-slate-700 dark:text-slate-300 ml-8">
                        The document on the server is different from what you are currently editing.
                        If you refresh, your current edits will be overwritten with the version from the server.
                    </p>
                </header>

                <div className="flex-1 overflow-auto p-4 bg-slate-50 dark:bg-slate-900">
                    <ReactDiffViewer
                        oldValue={oldValue}
                        newValue={newValue}
                        splitView={true}
                        useDarkTheme={theme === 'dark'}
                        leftTitle="Your Edits"
                        rightTitle="Server Document"
                        extraLinesSurroundingDiff={3}
                        styles={{
                            variables: {
                                light: { diffViewerBackground: '#fff', addedBackground: '#e6ffed', removedBackground: '#ffeef0' },
                                dark: { diffViewerBackground: '#1e293b', addedBackground: '#044B53', removedBackground: '#632F34', wordAddedBackground: '#055d67', wordRemovedBackground: '#7d3840' }
                            },
                            line: {
                                fontSize: '13px',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                            }
                        }}
                    />
                </div>

                <footer className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 flex-shrink-0 bg-white dark:bg-slate-800">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium"
                    >
                        Cancel Refresh
                    </button>
                    <button
                        onClick={onOverwrite}
                        className="px-5 py-2.5 rounded-md border border-amber-500 bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors flex items-center gap-2"
                    >
                        <WarningIcon className="w-5 h-5 text-amber-100" /> Overwrite My Edits
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default DiffOverwriteDialog;
