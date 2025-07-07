
import React, { useState, useMemo } from 'react';
import JsonDisplay from './JsonDisplay';
import Loader from './Loader';
import Table from './Table';
import JsonIcon from './icons/JsonIcon';
import TableIcon from './icons/TableIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';


interface QueryResultProps {
  isExecuting: boolean;
  executionError: string | null;
  executionResult: any | null;
}

// Helper to check if data can be displayed as a table
const isTableCompatible = (data: any): data is Record<string, any>[] => {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null;
};


const QueryResult: React.FC<QueryResultProps> = ({ isExecuting, executionError, executionResult }) => {
  const [viewMode, setViewMode] = useState<'json' | 'table'>('json');
  const [isJsonCollapsed, setIsJsonCollapsed] = useState(false);

  // Determine if the table view should be an option
  const canBeTable = useMemo(() => isTableCompatible(executionResult), [executionResult]);
  
  // Reset view if result changes
  React.useEffect(() => {
    setViewMode('json');
    setIsJsonCollapsed(false);
  }, [executionResult]);

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
            <span className="text-slate-600 text-lg">Running query...</span>
        </div>
    );
  }

  if (executionError) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg animate-fade-in" role="alert">
        <strong className="font-bold">Execution Error: </strong>
        <span className="block sm:inline">{executionError}</span>
      </div>
    );
  }
  
  if (executionResult) {
      return (
        <div className="space-y-4 animate-fade-in">
             <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider">Query Result</h3>
            
            {/* View Mode Toolbar */}
            <div className="flex items-center justify-between bg-slate-100 p-2 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setViewMode('json')}
                        disabled={viewMode === 'json'}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${viewMode === 'json' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'}`}
                    >
                        <JsonIcon className="w-4 h-4" />
                        JSON
                    </button>
                    <button 
                        onClick={() => setViewMode('table')}
                        disabled={!canBeTable || viewMode === 'table'}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${viewMode === 'table' ? 'bg-blue-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed'}`}
                    >
                        <TableIcon className="w-4 h-4" />
                        Table
                    </button>
                </div>
                {viewMode === 'json' && (
                     <button
                        onClick={() => setIsJsonCollapsed(!isJsonCollapsed)}
                        className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 p-1 rounded-md"
                     >
                        <span>{isJsonCollapsed ? 'Expand' : 'Collapse'}</span>
                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${!isJsonCollapsed && 'rotate-180'}`} />
                    </button>
                )}
            </div>

            {/* Content Display */}
            <div className="transition-all">
                {viewMode === 'json' && !isJsonCollapsed && <JsonDisplay data={executionResult} />}
                {viewMode === 'table' && canBeTable && <Table data={executionResult} />}
            </div>
        </div>
      );
  }

  return null;
};

export default QueryResult;
