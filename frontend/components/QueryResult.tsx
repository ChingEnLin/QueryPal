
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import JsonDisplay from './JsonDisplay';
import Table from './Table';
import JsonIcon from './icons/JsonIcon';
import TableIcon from './icons/TableIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import GraphIcon from './icons/GraphIcon';
import JsonCrackViewer from './JsonCrackViewer';
import XIcon from './icons/XIcon';
import WriteSummaryDisplay from './WriteSummaryDisplay';
import InfoIcon from './icons/InfoIcon';
import AiSparkleIcon from './icons/AiSparkleIcon';
import DebuggingSuggestion from './DebuggingSuggestion';
import SpinnerIcon from './icons/SpinnerIcon';
import PinIcon from './icons/PinIcon';
import DownloadIcon from './icons/DownloadIcon';

interface QueryResultProps {
  isExecuting: boolean;
  executionError: string | null;
  executionResult: any | null;
  // Props for debugging
  onDebug: () => void;
  isDebugging: boolean;
  debuggingResult: { suggestion: string } | null;
  debugError: string | null;
  // Props for multi-step context queries
  sourceCollection: string | null;
  onSetIntermediateContext: (data: any, source: string) => void;
  intermediateContext: { data: any; source: string; } | null;
}

// Helper to check if data can be displayed as a table
const isTableCompatible = (data: any): data is Record<string, any>[] => {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null;
};

// Helper to check if data can be used as query context (any non-empty array)
const isContextCompatible = (data: any): boolean => {
  return Array.isArray(data) && data.length > 0;
};

// Helper to detect if the result is a summary of a write operation
const isWriteSummary = (data: any): boolean => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }
  const keys = Object.keys(data);
  const writeSummaryKeys = [
    'acknowledged',
    'matchedCount', 'matched_count',
    'modifiedCount', 'modified_count',
    'upsertedId', 'upserted_id',
    'upsertedCount', 'upserted_count',
    'deletedCount', 'deleted_count',
    'insertedId', 'inserted_id',
    'insertedCount',
    'insertedIds',
  ];

  // If at least one of these keys is present, we'll consider it a write summary.
  return keys.some(key => writeSummaryKeys.includes(key));
};


const QueryResult: React.FC<QueryResultProps> = ({ 
    isExecuting, executionError, executionResult, 
    onDebug, isDebugging, debuggingResult, debugError,
    sourceCollection, onSetIntermediateContext, intermediateContext
}) => {
  const [viewMode, setViewMode] = useState<'json' | 'table' | 'summary'>('json');
  const [isJsonCollapsed, setIsJsonCollapsed] = useState(false);
  const [isGraphVisible, setIsGraphVisible] = useState(false);

  // Memoize checks on the execution result
  const isWriteOpSummary = useMemo(() => isWriteSummary(executionResult), [executionResult]);
  const canBeTable = useMemo(() => isTableCompatible(executionResult), [executionResult]);
  const canBeContext = useMemo(() => isContextCompatible(executionResult), [executionResult]);
  
  const isCurrentResultInContext = useMemo(() => {
    // Check for strict equality. This works because we are setting the state with the exact same object reference.
    return intermediateContext?.data === executionResult;
  }, [intermediateContext, executionResult]);
  
  // Reset view if result changes, defaulting to the appropriate view
  useEffect(() => {
    if (isWriteOpSummary) {
      setViewMode('summary');
    } else {
      setViewMode('json');
    }
    setIsJsonCollapsed(false);
    setIsGraphVisible(false); // also hide graph on new results
  }, [executionResult, isWriteOpSummary]);

  const handleSetContextClick = () => {
    if (sourceCollection && executionResult) {
      onSetIntermediateContext(executionResult, sourceCollection);
    }
  };

  const handleDownloadCSV = () => {
    if (!isTableCompatible(executionResult)) return;

    // Get all unique headers from all rows to handle inconsistent objects
    const headerSet = new Set<string>();
    executionResult.forEach(row => {
        if (typeof row === 'object' && row !== null) {
            Object.keys(row).forEach(key => headerSet.add(key));
        }
    });
    const headers = Array.from(headerSet);

    const escapeCsvCell = (cell: any): string => {
        if (cell === null || cell === undefined) {
            return '';
        }
        // Stringify objects/arrays so they appear in the cell
        const str = (typeof cell === 'object') ? JSON.stringify(cell) : String(cell);
        
        // If the string contains a comma, a double quote, or a newline, enclose it in double quotes.
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            // Escape existing double quotes by doubling them
            const escapedStr = str.replace(/"/g, '""');
            return `"${escapedStr}"`;
        }
        return str;
    };
    
    // Header row
    const csvRows = [headers.join(',')];
    
    // Data rows
    for (const row of executionResult) {
        const values = headers.map(header => escapeCsvCell(row[header]));
        csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    // Add BOM for Excel compatibility with UTF-8 characters
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    link.href = URL.createObjectURL(blob);
    link.download = `query_result_${new Date().toISOString().split('T')[0]}.csv`;
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up the DOM and memory
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  if (isExecuting) {
    return (
        <div className="flex justify-center items-center p-8">
            <svg
                className="animate-spin -ml-1 mr-3 h-8 w-8 text-blue-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                >
                <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                ></circle>
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
            </svg>
            <span className="text-slate-600 dark:text-slate-400 text-lg">Running query...</span>
        </div>
    );
  }

  if (executionError) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/50 dark:border-red-500/50 dark:text-red-300 px-4 py-3 rounded-lg" role="alert">
          <strong className="font-bold">Execution Error: </strong>
          <span className="block sm:inline">{executionError}</span>
        </div>

        <div className="flex flex-col items-start gap-4">
            <button
                onClick={onDebug}
                disabled={isDebugging}
                className="flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 disabled:from-slate-400 disabled:to-slate-500 disabled:bg-gradient-to-r disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-violet-500 transition-all duration-200 transform hover:scale-[1.03] active:scale-[1]"
            >
                <AiSparkleIcon className="w-5 h-5" />
                {isDebugging ? 'Debugging with AI...' : 'Debug with AI'}
            </button>

            {isDebugging && (
                <div className="text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <SpinnerIcon className="h-5 w-5 text-blue-500" />
                    <span>The AI is analyzing your query...</span>
                </div>
            )}

            {debugError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg w-full" role="alert">
                    <strong className="font-bold">Debugging Error: </strong>
                    <span className="block sm:inline">{debugError}</span>
                </div>
            )}

            {debuggingResult && (
                <div className="w-full">
                    <DebuggingSuggestion suggestion={debuggingResult.suggestion} />
                </div>
            )}
        </div>
      </div>
    );
  }
  
  if (executionResult) {
      // Create the drawer using a portal to break out of any transformed parent containers.
      const drawer = isGraphVisible ? createPortal(
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsGraphVisible(false)}
            className="fixed inset-0 bg-black bg-opacity-60 z-40 animate-fade-in-fast"
            aria-hidden="true"
          ></div>
          
          {/* Drawer Panel */}
          <aside className="fixed top-0 right-0 h-full w-full md:w-3/4 lg:w-2/3 bg-slate-900 shadow-2xl z-50 flex flex-col animate-slide-in-drawer">
            <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
              <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                <GraphIcon className="w-5 h-5 text-blue-400" />
                Interactive Graph View
              </h3>
              <button
                onClick={() => setIsGraphVisible(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                aria-label="Close graph view"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </header>
            <div className="flex-grow overflow-hidden p-1">
              <JsonCrackViewer data={executionResult} />
            </div>
          </aside>
        </>,
        document.body
      ) : null;

      return (
        <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Query Result</h3>
            
            {/* View Mode Toolbar */}
            <div id="tutorial-view-switcher" className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                {/* View Mode Button Group */}
                <div className="flex items-center gap-1 flex-wrap">
                    {isWriteOpSummary && (
                       <button 
                        onClick={() => setViewMode('summary')}
                        disabled={viewMode === 'summary'}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'summary' ? 'bg-blue-500 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                      >
                          <InfoIcon className="w-4 h-4" />
                          Summary
                      </button>
                    )}
                    <button 
                        onClick={() => setViewMode('json')}
                        disabled={viewMode === 'json'}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'json' ? 'bg-blue-500 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                    >
                        <JsonIcon className="w-4 h-4" />
                        JSON
                    </button>
                    <button 
                        onClick={() => setViewMode('table')}
                        disabled={!canBeTable || viewMode === 'table'}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-blue-500 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                    >
                        <TableIcon className="w-4 h-4" />
                        Table
                    </button>
                    <button
                        onClick={() => setIsGraphVisible(true)}
                        className={'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}
                    >
                        <GraphIcon className="w-4 h-4" />
                        Graph
                    </button>
                </div>

                {/* Actions Group */}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <button
                        onClick={handleSetContextClick}
                        disabled={!canBeContext || isCurrentResultInContext}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${isCurrentResultInContext ? 'border-blue-500 bg-blue-500 text-white shadow' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title="Use this result as context for the next query"
                    >
                        <PinIcon className="w-4 h-4" />
                        <span>{isCurrentResultInContext ? 'Context Set' : 'Use as Context'}</span>
                    </button>
                    
                    <button
                        onClick={handleDownloadCSV}
                        disabled={!canBeTable}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Download table data as CSV"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        <span>Download CSV</span>
                    </button>

                    {viewMode === 'json' && (
                         <button
                            onClick={() => setIsJsonCollapsed(!isJsonCollapsed)}
                            className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"
                         >
                            <span>{isJsonCollapsed ? 'Expand' : 'Collapse'}</span>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${!isJsonCollapsed && 'rotate-180'}`} />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Display */}
            <div>
                {viewMode === 'summary' && <WriteSummaryDisplay data={executionResult} />}
                {viewMode === 'json' && !isJsonCollapsed && <JsonDisplay data={executionResult} />}
                {viewMode === 'table' && canBeTable && <Table data={executionResult} />}
            </div>

            {/* The portal will render the drawer into document.body */}
            {drawer}

            <style>{`
              @keyframes fade-in-fast { 
                from { opacity: 0; } 
                to { opacity: 1; } 
              }
              .animate-fade-in-fast { 
                animation: fade-in-fast 0.3s ease-out forwards; 
              }
              @keyframes slide-in-drawer { 
                from { transform: translateX(100%); } 
                to { transform: translateX(0); } 
              }
              .animate-slide-in-drawer { 
                animation: slide-in-drawer 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              }
            `}</style>
        </div>
      );
  }

  return null;
};

export default QueryResult;
