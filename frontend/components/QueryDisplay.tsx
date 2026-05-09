
import React, { useState, useMemo, useEffect } from 'react';
import { 
  CheckIcon,
  ClipboardIcon,
  PlayIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  BookmarkIcon,
 } from './icons/material-icons-imports';

interface QueryDisplayProps {
  code: string;
  onCodeChange: (newCode: string) => void;
  onRunQuery: () => void;
  onSaveQuery: () => void;
  isExecuting: boolean;
  historyCount: number;
  historyIndex: number;
  onNavigateHistory: (direction: 'prev' | 'next') => void;
}

// This regex is more reliable for detecting MongoDB write methods.
const WRITE_OPERATION_REGEX = /\.(insert_one|insert_many|update_one|update_many|replace_one|delete_one|delete_many|bulk_write|drop|drop_index|drop_indexes|create_index|create_indexes|rename_collection)\s*\(/i;


const QueryDisplay: React.FC<QueryDisplayProps> = ({ code, onCodeChange, onRunQuery, onSaveQuery, isExecuting, historyCount, historyIndex, onNavigateHistory }) => {
  const [copied, setCopied] = useState(false);
  const [allowWrite, setAllowWrite] = useState(false);

  const isWriteOperation = useMemo(() => {
    return WRITE_OPERATION_REGEX.test(code);
  }, [code]);

  // Reset the toggle if the code changes to a new write operation
  useEffect(() => {
    if (isWriteOperation) {
      setAllowWrite(false);
    }
  }, [code, isWriteOperation]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
        console.error("Failed to copy text:", err);
    });
  };

  const isRunButtonDisabled = isExecuting || (isWriteOperation && !allowWrite);

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Run query on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isRunButtonDisabled) {
        onRunQuery();
        setAllowWrite(false);
      }
    }
  };

  return (
    <div id="query-display-panel" className="bg-white dark:bg-slate-800 rounded-lg p-6 space-y-4 animate-fade-in border border-slate-200 dark:border-slate-700">
      <div className="space-y-4">
        {/* New Two-Row Header Layout */}
        <div className="flex flex-col gap-3">
          {/* Top Row: Title and primary actions */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Generated & Editable Code
            </h3>
            <div className="flex items-center gap-3 flex-shrink-0">
               <button
                    id="tutorial-save-button"
                    onClick={onSaveQuery}
                    disabled={!code}
                    className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Save query"
                >
                    <BookmarkIcon className="w-4 h-4" />
                    <span>Save</span>
                </button>
                <button
                    onClick={() => {
                      onRunQuery();
                      setAllowWrite(false);
                    }}
                    disabled={isRunButtonDisabled}
                    className="flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-blue-500 transition-colors"
                    title="Run the code against the connected database (⌘ + Enter)"
                >
                    <PlayIcon className="w-4 h-4" />
                    {isExecuting ? 'Running...' : 'Run Query'}
                </button>
            </div>
          </div>

          {/* Bottom Row: History and warnings */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 min-h-[2rem]">
            {/* Left side: History Navigator */}
            <div className="w-full sm:w-auto flex justify-start">
              {historyCount > 1 && (
                <div className="flex items-center gap-2 text-slate-500 bg-slate-100 dark:bg-slate-700 dark:text-slate-400 px-2 py-1 rounded-full">
                  <button
                    onClick={() => onNavigateHistory('prev')}
                    disabled={historyIndex <= 0}
                    className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous query version"
                    title="Previous query version"
                  >
                    <ArrowLeftIcon className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-medium tabular-nums">Version {historyIndex + 1} of {historyCount}</span>
                  <button
                    onClick={() => onNavigateHistory('next')}
                    disabled={historyIndex >= historyCount - 1}
                    className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next query version"
                    title="Next query version"
                  >
                    <ArrowRightIcon className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            
            {/* Right side: Warnings */}
            <div className="w-full sm:w-auto flex justify-end">
              {isWriteOperation ? (
                  <div className="text-xs text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-500/30 px-2 py-1 rounded-md">
                    <strong>Warning:</strong> Write operation detected.
                  </div>
              ) : (
                <div className="text-xs text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-500/30 px-2 py-1 rounded-md">
                    <strong>Warning:</strong> Review code before execution.
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-slate-800 dark:bg-black/30 rounded-md relative group">
          <textarea
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            onKeyDown={handleEditorKeyDown}
            className="w-full h-48 bg-transparent text-cyan-300 p-4 font-mono text-sm overflow-x-auto resize-y border-2 border-slate-600 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500 rounded-md transition-colors"
            spellCheck="false"
          />
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-2 bg-slate-600/80 dark:bg-slate-700/80 rounded-md text-slate-300 hover:bg-slate-500 dark:hover:bg-slate-600 hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Copy code"
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? <CheckIcon className="w-4 h-4 text-blue-400" /> : <ClipboardIcon className="w-4 h-4" />}
          </button>
        </div>

        {isWriteOperation && (
            <div className="flex items-center justify-end gap-3 p-2 bg-red-50/50 dark:bg-red-900/20 rounded-md border border-red-200/60 dark:border-red-500/30 mt-2">
                <label htmlFor="allow-write-toggle" className="text-sm font-medium text-red-700 dark:text-red-300">
                  Acknowledge & Allow Write Operation
                </label>
                <div 
                    onClick={() => setAllowWrite(!allowWrite)}
                    id="allow-write-toggle"
                    role="switch"
                    aria-checked={allowWrite}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 cursor-pointer transition-colors duration-200 ease-in-out ${allowWrite ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                    title="Toggle to enable or disable execution of write operations"
                >
                    <span
                        className={`inline-block w-4 h-4 transform bg-white dark:bg-slate-300 rounded-full transition-transform duration-200 ease-in-out ${allowWrite ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default QueryDisplay;
