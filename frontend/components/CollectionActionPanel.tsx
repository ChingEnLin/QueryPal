import React, { useState, useMemo } from 'react';
import { CollectionInfo } from '../types';
import XIcon from './icons/XIcon';
import InfoIcon from './icons/InfoIcon';
import IndexIcon from './icons/IndexIcon';
import FileJsonIcon from './icons/FileJsonIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import CheckIcon from './icons/CheckIcon';

// --- Schema Inference and Display Logic ---

// 1. Schema Inference Helpers
const inferType = (value: any): any => {
    if (value === null) return '<Null>';
    if (Array.isArray(value)) {
        // Future improvement: infer type of array elements, e.g., '<Array<String>>'
        return '<Array>';
    }

    const type = typeof value;
    if (type === 'object') {
        // EJSON / BSON Extended JSON format detection
        if (value.$oid && typeof value.$oid === 'string' && Object.keys(value).length === 1) return 'ObjectId';
        if (value.$date && Object.keys(value).length === 1) return 'Date';
        
        // It's a regular document object, so we recurse to generate its schema
        return generateSchemaFromObject(value);
    }
    
    switch(type) {
        case 'string': return '<String>';
        case 'number': return '<Number>';
        case 'boolean': return '<Boolean>';
        default: return '<Unknown>';
    }
};

const generateSchemaFromObject = (doc: Record<string, any>): Record<string, any> => {
    // This function should only be called with objects that are not special EJSON types.
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
        return inferType(doc); // Safety net
    }

    const schema: Record<string, any> = {};
    for (const key in doc) {
        if (Object.prototype.hasOwnProperty.call(doc, key)) {
            schema[key] = inferType(doc[key]);
        }
    }
    return schema;
};


// 2. SchemaDisplay Component and Helpers
const formatValue = (value: any, indent: number): string => {
  if (typeof value === 'object' && value !== null) {
    return formatSchema(value, indent);
  }
  // This will now render the inferred type string, e.g., 'ObjectId', '<String>'
  return String(value);
};

const formatSchema = (schema: Record<string, any>, indent: number = 0): string => {
  const indentation = ' '.repeat(indent + 2);
  const closingIndentation = ' '.repeat(indent);
  let str = '{\n';
  const keys = Object.keys(schema);
  keys.forEach((key, index) => {
    const value = schema[key];
    str += `${indentation}'${key}': ${formatValue(value, indent + 2)}`;
    if (index < keys.length - 1) {
      str += ',';
    }
    str += '\n';
  });
  str += `${closingIndentation}}`;
  return str;
};

interface SchemaDisplayProps {
  schema: Record<string, any>;
}

const SchemaDisplay: React.FC<SchemaDisplayProps> = ({ schema }) => {
  const [copied, setCopied] = useState(false);
  
  const schemaString = useMemo(() => formatSchema(schema), [schema]);

  const handleCopy = () => {
    navigator.clipboard.writeText(schemaString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
        console.error("Failed to copy schema:", err);
    });
  };

  return (
    <div className="bg-slate-100 rounded-md relative group ring-1 ring-slate-200">
      <pre className="text-sm text-slate-800 p-4 overflow-x-auto">
        <code>{schemaString}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-slate-200/80 rounded-md text-slate-500 hover:bg-slate-300 hover:text-slate-800 transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Copy schema"
      >
        {copied ? <CheckIcon className="w-4 h-4 text-blue-500" /> : <ClipboardIcon className="w-4 h-4" />}
      </button>
    </div>
  );
};


// --- Main CollectionActionPanel Component ---

interface CollectionActionPanelProps {
  info: CollectionInfo;
  onGenerate: (prompt: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

const CollectionActionPanel: React.FC<CollectionActionPanelProps> = ({ info, onGenerate, onClose, isLoading }) => {
  const [prompt, setPrompt] = useState('');
  
  const schema = useMemo(() => {
    if (!info.sampleDocument) return {};
    // Start the schema generation from the root sample document
    return generateSchemaFromObject(info.sampleDocument);
  }, [info.sampleDocument]);

  const handleGenerateClick = () => {
    if (!prompt.trim()) return;
    onGenerate(prompt);
  };

  return (
    <div className="bg-slate-100 rounded-lg p-4 mt-4 border border-slate-200 animate-fade-in space-y-6">
      <header className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-blue-600">
          Actions for: <span className="font-mono bg-blue-100 text-blue-800 px-2 py-1 rounded">{info.name}</span>
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
          aria-label="Close panel"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="bg-white p-3 rounded-lg flex items-center gap-3 border border-slate-200">
            <InfoIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div>
                <p className="text-slate-500">Documents</p>
                <p className="text-slate-800 font-semibold">{info.documentCount.toLocaleString()}</p>
            </div>
        </div>
         <div className="bg-white p-3 rounded-lg flex items-center gap-3 border border-slate-200">
            <InfoIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div>
                <p className="text-slate-500">Avg. Doc Size</p>
                <p className="text-slate-800 font-semibold">{info.averageDocumentSize}</p>
            </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-slate-600 flex items-center gap-2 font-semibold"><IndexIcon className="w-5 h-5" /> Indexes</p>
        <div className="flex flex-wrap gap-2">
            {info.indexes.map(idx => (
                <span key={idx} className="bg-purple-100 text-purple-800 text-xs font-mono px-2 py-1 rounded-full">{idx}</span>
            ))}
        </div>
      </div>
      
       <div className="space-y-2">
        <p className="text-slate-600 flex items-center gap-2 font-semibold"><FileJsonIcon className="w-5 h-5" /> Inferred Schema (from a sample document)</p>
        <SchemaDisplay schema={schema} />
      </div>

      <div className="space-y-3">
        <label htmlFor={`collection-prompt-${info.name}`} className="block text-md font-medium text-slate-700">
          Perform an action on this collection:
        </label>
        <textarea
          id={`collection-prompt-${info.name}`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={`e.g., 'Find all users with an "inactive" status'`}
          className="w-full h-20 p-3 bg-white border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder-slate-400 resize-y"
          disabled={isLoading}
        />
        <button
          onClick={handleGenerateClick}
          disabled={isLoading || !prompt.trim()}
          className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-100 focus:ring-blue-500 transition-colors"
        >
          {isLoading ? 'Generating...' : 'Generate Query for Collection'}
        </button>
      </div>

    </div>
  );
};

export default CollectionActionPanel;