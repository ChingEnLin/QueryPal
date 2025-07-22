
import React, { useState, useEffect } from 'react';
import { CollectionInfo } from '../types';
import { XIcon, InfoIcon, ChevronDownIcon, IndexIcon, FileJsonIcon } from './icons/material-icons-imports';

// --- New Schema Viewer Components ---

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
}

/**
 * A recursive React component that renders a document schema into an HTML tree.
 */
export const SchemaRenderer: React.FC<SchemaRendererProps> = ({ data, indent = 0 }) => {
  const padStyle = { paddingLeft: `${indent * 24}px` };

  return (
    <div className="space-y-1">
      {Object.entries(data).map(([key, value]) => {
        const type = getType(value);

        const renderField = (
            <div className="flex items-center gap-2">
              <strong className="text-slate-600 dark:text-slate-300 font-medium">{key}</strong>:
              <code className="text-purple-800 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/50 font-semibold px-2 py-0.5 rounded-md text-xs">{type}</code>
            </div>
        );

        if ((type === 'Object' || type.startsWith('Array<Object>')) && value && (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0)) {
           const nestedData = Array.isArray(value) ? value[0] : value;
           return (
            <div key={key} style={padStyle}>
              {renderField}
              <SchemaRenderer data={nestedData} indent={indent + 1} />
            </div>
          );
        }

        return (
          <div key={key} style={padStyle}>
            {renderField}
          </div>
        );
      })}
    </div>
  );
};


// --- Main CollectionActionPanel Component ---

interface CollectionActionPanelProps {
  info: CollectionInfo;
  onClose: () => void;
}

const CollectionActionPanel: React.FC<CollectionActionPanelProps> = ({ info, onClose }) => {
  const [isSchemaOpen, setIsSchemaOpen] = useState(true);

  useEffect(() => {
    // Whenever a new collection is selected, default the schema view to open.
    setIsSchemaOpen(true);
  }, [info.name]);
  
  const sampleDocument = info.sampleDocument || {};

  return (
    <div className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-4 mt-4 border border-slate-200 dark:border-slate-700 animate-fade-in space-y-6">
      <header className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400">
          Collection Details: <span className="font-mono bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-1 rounded">{info.name}</span>
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          aria-label="Close panel"
          title="Close collection details"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="bg-white dark:bg-slate-700/50 p-3 rounded-lg flex items-center gap-3 border border-slate-200 dark:border-slate-600">
            <InfoIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div>
                <p className="text-slate-500 dark:text-slate-400">Documents</p>
                <p className="text-slate-800 dark:text-slate-200 font-semibold">{info.documentCount.toLocaleString()}</p>
            </div>
        </div>
         <div className="bg-white dark:bg-slate-700/50 p-3 rounded-lg flex items-center gap-3 border border-slate-200 dark:border-slate-600">
            <InfoIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div>
                <p className="text-slate-500 dark:text-slate-400">Avg. Doc Size</p>
                <p className="text-slate-800 dark:text-slate-200 font-semibold">{info.averageDocumentSize}</p>
            </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-slate-600 dark:text-slate-300 flex items-center gap-2 font-semibold"><IndexIcon className="w-5 h-5" /> Indexes</p>
        <div className="flex flex-wrap gap-2">
            {info.indexes.map(idx => (
                <span key={idx} className="bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 text-xs font-mono px-2 py-1 rounded-full">{idx}</span>
            ))}
        </div>
      </div>
      
       <div className="space-y-2">
        <button
          onClick={() => setIsSchemaOpen(!isSchemaOpen)}
          className="w-full flex items-center gap-2 text-left text-slate-600 dark:text-slate-300 font-semibold p-1 -ml-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          aria-expanded={isSchemaOpen}
          aria-controls={`schema-content-${info.name}`}
          title={isSchemaOpen ? 'Collapse schema view' : 'Expand schema view'}
        >
          <FileJsonIcon className="w-5 h-5" />
          <span>Inferred Schema (from sample)</span>
          <ChevronDownIcon className={`w-5 h-5 ml-auto transition-transform duration-300 ${isSchemaOpen ? 'rotate-180' : 'rotate-0'}`} />
        </button>

        {isSchemaOpen && (
          <div
            id={`schema-content-${info.name}`}
            className="bg-white dark:bg-slate-700/50 p-4 rounded-md text-sm ring-1 ring-slate-200 dark:ring-slate-600 overflow-x-auto animate-fade-in-short"
          >
            {Object.keys(sampleDocument).length > 0 ? (
              <SchemaRenderer data={sampleDocument} />
            ) : (
              <p className="font-sans text-slate-500 dark:text-slate-400">No sample document available to infer a schema.</p>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in-short {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-short {
          animation: fade-in-short 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default CollectionActionPanel;
