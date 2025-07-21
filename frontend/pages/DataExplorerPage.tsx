

import React, { useState, useEffect, useCallback } from 'react';
import { SelectedResource, DbInfo } from '../types';
import { getDocuments } from '../services/dbService';
import MongoIcon from '../components/icons/MongoIcon';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';
import SpinnerIcon from '../components/icons/SpinnerIcon';
import SearchIcon from '../components/icons/SearchIcon';
import XIcon from '../components/icons/XIcon';
import JsonDisplay from '../components/JsonDisplay';


interface DataExplorerPageProps {
  connectedResource: SelectedResource;
  dbInfo: DbInfo;
  accountName: string;
  onNavigateBack: () => void;
}

const DataExplorerPage: React.FC<DataExplorerPageProps> = ({ connectedResource, dbInfo, accountName, onNavigateBack }) => {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Record<string, any>[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocuments, setTotalDocuments] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  const [selectedDocument, setSelectedDocument] = useState<Record<string, any> | null>(null);
  
  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1); // Reset to page 1 on new search
      setSelectedDocument(null); // Clear selection on new search
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);


  const fetchDocuments = useCallback(async () => {
    if (!selectedCollection || !connectedResource) {
      setDocuments([]);
      return;
    }

    setIsLoadingDocuments(true);
    setDocumentsError(null);
    try {
      const response = await getDocuments(
        selectedCollection,
        connectedResource,
        currentPage,
        20, // Page limit
        debouncedSearchTerm
      );
      setDocuments(response.documents);
      setTotalPages(response.totalPages);
      setTotalDocuments(response.totalDocuments);
    } catch (e) {
      if (e instanceof Error) setDocumentsError(e.message);
      else setDocumentsError("An unknown error occurred while fetching documents.");
      setDocuments([]);
      setTotalPages(1);
      setTotalDocuments(0);
    } finally {
      setIsLoadingDocuments(false);
    }
  }, [selectedCollection, connectedResource, currentPage, debouncedSearchTerm]);
  
  useEffect(() => {
      fetchDocuments();
  }, [fetchDocuments]);

  const handleCollectionClick = (collectionName: string) => {
    setSelectedCollection(collectionName);
    setCurrentPage(1);
    setSearchTerm('');
    setSelectedDocument(null);
  };
  
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setCurrentPage(newPage);
    setSelectedDocument(null);
  }

  const renderDocumentList = () => {
    if (isLoadingDocuments) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
          <SpinnerIcon className="w-8 h-8" />
          <p className="mt-2">Loading documents...</p>
        </div>
      );
    }
    
    if (documentsError) {
        return (
            <div className="p-4 text-red-600 bg-red-50 border border-red-200 text-sm rounded-md dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300">
                {documentsError}
            </div>
        );
    }

    if (!selectedCollection) {
      return (
        <div className="text-center text-slate-500 dark:text-slate-400 py-10">
          <p>Select a collection to view its documents.</p>
        </div>
      );
    }

    if (documents.length === 0) {
      return (
        <div className="text-center text-slate-500 dark:text-slate-400 py-10">
          <p>No documents found.</p>
          {debouncedSearchTerm && <p className="text-xs">Try clearing the search term.</p>}
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <div className="flex-grow overflow-y-auto">
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {documents.map((doc) => {
                const docId = doc._id?.$oid || doc._id || JSON.stringify(doc);
                const isSelected = selectedDocument && (selectedDocument._id?.$oid || selectedDocument._id) === (doc._id?.$oid || doc._id);
                return (
                    <li key={docId}>
                        <button
                          onClick={() => setSelectedDocument(doc)}
                          className={`w-full text-left p-3 text-sm transition-colors ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                        >
                            <p className="font-mono text-slate-800 dark:text-slate-200 truncate" title={docId}>{docId}</p>
                        </button>
                    </li>
                );
            })}
          </ul>
        </div>
        {/* Pagination Controls */}
        <div className="flex-shrink-0 p-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1} className="px-3 py-1 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Previous
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {currentPage} of {totalPages}
            </span>
             <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="px-3 py-1 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Next
            </button>
        </div>
      </div>
    );
  };

  const renderEditorPanel = () => {
    if (!selectedDocument) {
      return (
        <div className="text-center text-slate-500 dark:text-slate-400 py-10">
          <p>Select a document to view and edit it here.</p>
        </div>
      );
    }
    const docId = selectedDocument._id?.$oid || selectedDocument._id || 'N/A';
    return (
      <div className="animate-fade-in-fast space-y-4">
        <header className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider truncate">
              Document: <span className="font-mono ml-1">{docId}</span>
            </h3>
            <button 
                onClick={() => setSelectedDocument(null)} 
                className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                title="Close document view"
            >
                <XIcon className="w-4 h-4"/>
            </button>
        </header>
        <JsonDisplay data={selectedDocument} />
      </div>
    );
  }

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
          <div className="w-1/4 xl:w-1/5 bg-slate-100 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Collections</h2>
              <div className="space-y-2">
                 {dbInfo.collections.map(col => (
                    <button 
                        key={col.name}
                        onClick={() => handleCollectionClick(col.name)}
                        className={`w-full text-left p-3 rounded-md text-sm font-medium transition-colors ${selectedCollection === col.name ? 'bg-blue-500 text-white shadow-md' : 'bg-white dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'}`}
                     >
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{col.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${selectedCollection === col.name ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-600'}`}>{col.count.toLocaleString()}</span>
                      </div>
                    </button>
                 ))}
              </div>
            </div>
          </div>

          {/* Column 2: Documents */}
          <div className="w-1/4 xl:w-1/5 bg-white dark:bg-slate-800/50 border-r border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
               <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">
                 Documents {totalDocuments > 0 && `(${totalDocuments.toLocaleString()})`}
                </h2>
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search documents..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={!selectedCollection}
                        className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
                    />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                </div>
            </div>
            <div className="flex-grow overflow-hidden">
             {renderDocumentList()}
            </div>
          </div>

          {/* Column 3: Document Editor */}
          <div className="w-2/4 xl:w-3/5 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Editor</h2>
               {renderEditorPanel()}
            </div>
          </div>
        </main>
      </div>
      <style>{`
          @keyframes fade-in-fast { 
            from { opacity: 0; } 
            to { opacity: 1; } 
          }
          .animate-fade-in-fast { 
            animation: fade-in-fast 0.3s ease-out forwards; 
          }
      `}</style>
    </div>
  );
};

export default DataExplorerPage;
