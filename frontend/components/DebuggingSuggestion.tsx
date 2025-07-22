
import React, { useState } from 'react';
import { AiSparkleIcon, ClipboardIcon, CheckIcon } from './icons/material-icons-imports';

interface DebuggingSuggestionProps {
  suggestion: string;
}

const DebuggingSuggestion: React.FC<DebuggingSuggestionProps> = ({ suggestion }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(suggestion).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
        console.error("Failed to copy suggestion:", err);
    });
  };

  const formatSuggestion = (text: string): string => {
    return text
      .replace(/</g, "&lt;") // Escape HTML tags
      .replace(/>/g, "&gt;")
      .split('\n')
      .map(line => {
        // Simple code block detection for single-backticked text
        line = line.replace(/`([^`]+)`/g, '<code class="text-xs bg-slate-200 dark:bg-slate-700/80 p-1 rounded-sm font-mono text-cyan-700 dark:text-cyan-300">$1</code>');
        // Bold text for **text**
        line = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
        // Return line wrapped in a paragraph tag if it's not empty
        return line.trim() === '' ? '<br />' : `<p>${line}</p>`;
      })
      .join('');
  };
  
  return (
    <div className="relative bg-blue-50 dark:bg-slate-800/60 border border-blue-200 dark:border-blue-500/30 rounded-lg p-6 animate-fade-in shadow-lg shadow-blue-500/10">
      <div className="absolute -top-3 -left-3 bg-white dark:bg-slate-800 p-1.5 rounded-full ring-4 ring-blue-50 dark:ring-slate-800/60">
          <AiSparkleIcon className="w-8 h-8 text-blue-500" />
      </div>
      <div className="flex justify-between items-start mb-3">
        <h4 className="text-lg font-bold text-blue-800 dark:text-blue-300 pl-8">AI Debugging Assistant</h4>
        <button
          onClick={handleCopy}
          className="p-2 bg-slate-200/50 dark:bg-slate-700/50 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
          aria-label="Copy suggestion"
          title={copied ? 'Copied!' : 'Copy suggestion'}
        >
          {copied ? <CheckIcon className="w-4 h-4 text-blue-500" /> : <ClipboardIcon className="w-4 h-4" />}
        </button>
      </div>
      
      <div 
        className="text-sm prose-p:mb-2 prose-p:last-of-type:mb-0 max-w-none space-y-2 text-slate-700 dark:text-slate-300"
        dangerouslySetInnerHTML={{ __html: formatSuggestion(suggestion) }}
      />
    </div>
  );
};

export default DebuggingSuggestion;
