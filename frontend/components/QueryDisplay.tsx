
import React, { useState, useMemo, useEffect } from 'react';
import ClipboardIcon from './icons/ClipboardIcon';
import CheckIcon from './icons/CheckIcon';
import PlayIcon from './icons/PlayIcon';

interface QueryDisplayProps {
  code: string;
  onCodeChange: (newCode: string) => void;
  onRunQuery: () => void;
  isExecuting: boolean;
}

// This regex is more reliable for detecting MongoDB write methods.
const WRITE_OPERATION_REGEX = /\.(insert_one|insert_many|update_one|update_many|replace_one|delete_one|delete_many|bulk_write|drop|drop_index|drop_indexes|create_index|create_indexes|rename_collection)\s*\(/i;


const QueryDisplay: React.FC<QueryDisplayProps> = ({ code, onCodeChange, onRunQuery, isExecuting }) => {
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

  return (
    <div className="bg-white rounded-lg p-6 space-y-4 animate-fade-in border border-slate-200">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Generated & Editable Code</h3>
            <div className="flex items-center gap-3">
                 {isWriteOperation ? (
                     <div className="text-xs text-red-800 bg-red-100 border border-red-200 px-2 py-1 rounded-md">
                        <strong>Warning:</strong> Write operation detected.
                     </div>
                 ) : (
                    <div className="text-xs text-yellow-800 bg-yellow-100 border border-yellow-200 px-2 py-1 rounded-md">
                        <strong>Warning:</strong> Review code before execution.
                    </div>
                 )}
                <button
                    onClick={onRunQuery}
                    disabled={isRunButtonDisabled}
                    className="flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500 transition-colors"
                >
                    <PlayIcon className="w-4 h-4" />
                    {isExecuting ? 'Running...' : 'Run Query'}
                </button>
            </div>
        </div>
        
        <div className="bg-slate-800 rounded-md relative group">
          <textarea
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            className="w-full h-48 bg-transparent text-cyan-300 p-4 font-mono text-sm overflow-x-auto resize-y border-2 border-slate-600 focus:border-blue-500 focus:ring-blue-500 rounded-md transition-colors"
            spellCheck="false"
          />
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-2 bg-slate-600/80 rounded-md text-slate-300 hover:bg-slate-500 hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Copy code"
          >
            {copied ? <CheckIcon className="w-4 h-4 text-blue-400" /> : <ClipboardIcon className="w-4 h-4" />}
          </button>
        </div>

        {isWriteOperation && (
            <div className="flex items-center justify-end gap-3 p-2 bg-red-50/50 rounded-md border border-red-200/60 mt-2">
                <label htmlFor="allow-write-toggle" className="text-sm font-medium text-red-700">
                  Acknowledge & Allow Write Operation
                </label>
                <div 
                    onClick={() => setAllowWrite(!allowWrite)}
                    id="allow-write-toggle"
                    role="switch"
                    aria-checked={allowWrite}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 cursor-pointer transition-colors duration-200 ease-in-out ${allowWrite ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                    <span
                        className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${allowWrite ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default QueryDisplay;
