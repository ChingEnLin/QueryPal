
import React, { useState } from 'react';
import CheckIcon from './icons/CheckIcon';
import ClipboardIcon from './icons/ClipboardIcon';

interface JsonDisplayProps {
  data: any;
}

const JsonDisplay: React.FC<JsonDisplayProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
        console.error("Failed to copy JSON:", err);
    });
  };

  return (
    <div className="bg-slate-100 rounded-md relative group ring-1 ring-slate-200">
      <pre className="text-sm text-slate-800 p-4 overflow-x-auto">
        <code>{jsonString}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-slate-200/80 rounded-md text-slate-500 hover:bg-slate-300 hover:text-slate-800 transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Copy JSON result"
      >
        {copied ? <CheckIcon className="w-4 h-4 text-blue-500" /> : <ClipboardIcon className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default JsonDisplay;