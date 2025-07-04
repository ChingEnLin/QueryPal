
import React, { useState } from 'react';
import ClipboardIcon from './icons/ClipboardIcon';
import CheckIcon from './icons/CheckIcon';
import PlayIcon from './icons/PlayIcon';

interface QueryDisplayProps {
  intentSummary: string;
  confirmationPrompt: string;
  code: string;
  onCodeChange: (newCode: string) => void;
  onRunQuery: () => void;
  isExecuting: boolean;
}

const QueryDisplay: React.FC<QueryDisplayProps> = ({ intentSummary, confirmationPrompt, code, onCodeChange, onRunQuery, isExecuting }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
        console.error("Failed to copy text:", err);
    });
  };

  return (
    <div className="bg-white rounded-lg p-6 space-y-6 animate-fade-in border border-slate-200">
      <div>
        <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Intent</h3>
        <p className="text-slate-600 mt-2">{intentSummary}</p>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Generated & Editable Code</h3>
            <button
                onClick={onRunQuery}
                disabled={isExecuting}
                className="flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500 transition-colors"
            >
                <PlayIcon className="w-4 h-4" />
                {isExecuting ? 'Running...' : 'Run Query'}
            </button>
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
      </div>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
        <h3 className="text-sm font-semibold text-yellow-800 uppercase tracking-wider">Confirmation</h3>
        <p className="text-yellow-700 mt-2">{confirmationPrompt}</p>
      </div>
    </div>
  );
};

export default QueryDisplay;