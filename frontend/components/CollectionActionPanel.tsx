import React, { useState } from 'react';
import { CollectionInfo } from '../types';
import XIcon from './icons/XIcon';
import InfoIcon from './icons/InfoIcon';
import IndexIcon from './icons/IndexIcon';
import FileJsonIcon from './icons/FileJsonIcon';

// --- New Schema Viewer Components ---

/**
 * Creates a signature for an object based on its keys to detect duplicates.
 * @param obj The object to create a signature for.
 * @returns A string representing the object's structure.
 */
const getObjectSignature = (obj: any): string => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
  const keys = Object.keys(obj).sort();
  return keys.join('|');
};

/**
 * Infers the displayable type of a given value, detecting BSON types.
 * @param value The value to infer the type from.
 * @returns A string representing the type.
 */
const getType = (value: any): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length > 0) {
      // Show the type of elements within the array
      return `Array<${getType(value[0])}>`;
    }
    return 'Array<any>';
  }
  if (value && typeof value === 'object') {
    if (value.$oid && Object.keys(value).length === 1) return 'ObjectId';
    if (value.$date && Object.keys(value).length === 1) return 'Date';
    return 'Object';
  }
  const type = typeof value;
  // Capitalize the first letter for display (e.g., 'string' -> 'String')
  return type.charAt(0).toUpperCase() + type.slice(1);
};

interface SchemaRendererProps {
  data: Record<string, any>;
  indent?: number;
  seen?: Set<string>;
}

/**
 * A recursive React component that renders a document schema into an HTML tree.
 */
const SchemaRenderer: React.FC<SchemaRendererProps> = ({ data, indent = 0, seen = new Set() }) => {
  const padStyle = { paddingLeft: `${indent * 24}px` };

  return (
    <div>
      {Object.entries(data).map(([key, value]) => {
        const type = getType(value);
        
        // Case 1: Value is a nested object.
        if (type === 'Object') {
          const sig = getObjectSignature(value);
          const isSeen = seen.has(sig);
          if (!isSeen) {
            seen.add(sig);
          }
          
          return (
            <div key={key}>
              <div style={padStyle}>
                <strong>{key}</strong>: <span>Object</span>
              </div>
              {!isSeen ? (
                <SchemaRenderer data={value} indent={indent + 1} seen={new Set(seen)} />
              ) : (
                <div style={{ paddingLeft: `${(indent + 1) * 24}px` }}>
                  <em>... (structure repeated)</em>
                </div>
              )}
            </div>
          );
        }

        // Case 2: Value is an array.
        if (type.startsWith('Array<')) {
          const firstElement = value[0];
          const firstElementType = getType(firstElement);
          const isObjectArray = firstElementType === 'Object';
          const sig = isObjectArray ? getObjectSignature(firstElement) : '';
          const isSeen = isObjectArray && seen.has(sig);
          if (isObjectArray && !isSeen) {
            seen.add(sig);
          }

          return (
            <div key={key}>
              <div style={padStyle}>
                <strong>{key}</strong>: <span>{type}</span>
              </div>
              {isObjectArray && !isSeen && firstElement && (
                 <SchemaRenderer data={firstElement} indent={indent + 1} seen={new Set(seen)} />
              )}
              {isObjectArray && isSeen && (
                 <div style={{ paddingLeft: `${(indent + 1) * 24}px` }}>
                   <em>... (structure repeated)</em>
                 </div>
              )}
            </div>
          );
        }

        // Case 3: Value is a primitive type (String, Number, ObjectId, etc.).
        return (
          <div key={key} style={padStyle}>
            <strong>{key}</strong>: <code>{type}</code>
          </div>
        );
      })}
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
  
  const handleGenerateClick = () => {
    if (!prompt.trim()) return;
    onGenerate(prompt);
  };

  const sampleDocument = info.sampleDocument || {};

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
        <p className="text-slate-600 flex items-center gap-2 font-semibold"><FileJsonIcon className="w-5 h-5" /> Inferred Schema (from sample)</p>
        <div className="bg-white p-4 rounded-md text-sm text-slate-800 ring-1 ring-slate-200 overflow-x-auto">
            {Object.keys(sampleDocument).length > 0 ? (
                <div className="font-mono schema-tree">
                    <SchemaRenderer data={sampleDocument} />
                </div>
            ) : (
                <p className="font-sans text-slate-500">No sample document available to infer a schema.</p>
            )}
        </div>
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
      <style>{`
        .schema-tree code {
            color: #0b5394;
            font-weight: bold;
            background-color: #eef6ff;
            padding: 2px 4px;
            border-radius: 4px;
        }
        .schema-tree em {
            color: #999;
            font-style: italic;
        }
        .schema-tree strong {
            color: #3e3e3e;
        }
      `}</style>
    </div>
  );
};

export default CollectionActionPanel;
