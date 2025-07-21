
import React from 'react';
import { SelectedResource, DbInfo } from '../types';
import MongoIcon from '../components/icons/MongoIcon';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';

interface DataExplorerPageProps {
  connectedResource: SelectedResource;
  dbInfo: DbInfo;
  accountName: string;
  onNavigateBack: () => void;
}

const DataExplorerPage: React.FC<DataExplorerPageProps> = ({ connectedResource, dbInfo, accountName, onNavigateBack }) => {

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans">
      <div className="flex flex-col h-screen">
        
        {/* Header */}
        <header className="flex-shrink-0 bg-white dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <MongoIcon className="w-9 h-9 text-blue-500" />
                <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Data Explorer</h1>
                   <p className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                      {accountName} / <span className="font-bold">{dbInfo.name}</span>
                    </p>
                </div>
              </div>
              <button
                onClick={onNavigateBack}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Return to the query generator"
              >
                <ArrowLeftIcon className="w-4 h-4" />
                <span>Back to Query Generator</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-grow flex overflow-hidden">
          {/* Column 1: Collections */}
          <div className="w-1/4 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Collections</h2>
              {/* Placeholder for collection list */}
              <div className="space-y-2">
                 {dbInfo.collections.map(col => (
                    <div key={col.name} className="p-3 bg-white dark:bg-slate-700/50 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20">
                      {col.name}
                    </div>
                 ))}
              </div>
            </div>
          </div>

          {/* Column 2: Documents */}
          <div className="w-1/4 bg-white dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Documents</h2>
              {/* Placeholder for document list */}
              <div className="text-center text-slate-500 dark:text-slate-400 py-10">
                <p>Select a collection to view its documents.</p>
              </div>
            </div>
          </div>

          {/* Column 3: Document Editor */}
          <div className="w-2/4 bg-white dark:bg-slate-900 overflow-y-auto">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Editor</h2>
              {/* Placeholder for document editor */}
               <div className="text-center text-slate-500 dark:text-slate-400 py-10">
                <p>Select a document to view and edit it here.</p>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
};

export default DataExplorerPage;
