
import React from 'react';
import JsonDisplay from './JsonDisplay';
import Loader from './Loader';

interface QueryResultProps {
  isExecuting: boolean;
  executionError: string | null;
  executionResult: any | null;
}

const QueryResult: React.FC<QueryResultProps> = ({ isExecuting, executionError, executionResult }) => {
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
             <JsonDisplay data={executionResult} />
        </div>
      );
  }

  return null;
};

export default QueryResult;