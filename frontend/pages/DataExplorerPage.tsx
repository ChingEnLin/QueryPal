


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { SelectedResource, DbInfo, BreadcrumbItem } from '../types';
import { getDocuments, getCollectionInfo, findDocumentById } from '../services/dbService';
import { extractSchemaTree, SchemaKeyNode } from '../utils/schemaUtils';
import MongoIcon from '../components/icons/MongoIcon';
import ArrowLeftIcon from '../components/icons/ArrowLeftIcon';
import SpinnerIcon from '../components/icons/SpinnerIcon';
import SearchIcon from '../components/icons/SearchIcon';
import XIcon from '../components/icons/XIcon';
import JsonDisplay from '../components/JsonDisplay';
import ChevronDownIcon from '../components/icons/ChevronDownIcon';
import ChevronRightIcon from '../components/icons/ChevronRightIcon';
import RefreshIcon from '../components/icons/RefreshIcon';
import ArrowUpIcon from '../components/icons/ArrowUpIcon';
import ArrowDownIcon from '../components/icons/ArrowDownIcon';


interface DataExplorerPageProps {
  connectedResource: SelectedResource;
  dbInfo: DbInfo;
  accountName: string;
  onNavigateBack: () => void;
}

/**
 * A recursive component that renders a tree of schema keys as indented <option> tags.
 */
const RenderOptions: React.FC<{ nodes: SchemaKeyNode[], level: number }> = ({ nodes, level }) => {
    // Using 2 non-breaking spaces per level for indentation
    const indent = '\u00A0\u00A0'.repeat(level);

    return (
        <>
            {nodes.map(node => (
                <React.Fragment key={node.path}>
                    <option value={node.path}>
                        {indent}{node.key}
                    </option>
                    {node.children && (
                        <RenderOptions nodes={node.children} level={level + 1} />
                    )}
                </React.Fragment>
            ))}
        </>
    );
};

const DataExplorerPage: React.FC<DataExplorerPageProps> = ({ connectedResource, dbInfo, accountName, onNavigateBack }) => {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Record<string, any>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocuments, setTotalDocuments] = useState(0);

  // State for pagination input
  const [pageInput, setPageInput] = useState(String(currentPage));

  // State for advanced filtering
  const [filterKey, setFilterKey] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [debouncedFilterValue, setDebouncedFilterValue] = useState(filterValue);
  const [schemaTree, setSchemaTree] = useState<SchemaKeyNode[]>([]);
  const [isFetchingSchema, setIsFetchingSchema] = useState(false);

  const [selectedDocument, setSelectedDocument] = useState<Record<string, any> | null>(null);
  
  // State for collection sorting
  const [collectionSortKey, setCollectionSortKey] = useState<'name' | 'count'>('name');
  const [collectionSortOrder, setCollectionSortOrder] = useState<'asc' | 'desc'>('asc');

  // --- State for Click-Through Linking ---
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  
  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilterValue(filterValue);
      setCurrentPage(1); // Reset to page 1 on new search
      setSelectedDocument(null); // Clear selection on new search
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [filterValue]);

  // Sync page input with current page
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);


  const fetchDocuments = useCallback(async () => {
    if (!selectedCollection || !connectedResource) {
      setDocuments([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const response = await getDocuments(
        selectedCollection,
        connectedResource,
        currentPage,
        20, // Page limit
        { key: filterKey, value: debouncedFilterValue }
      );
      setDocuments(response.documents);
      setTotalPages(response.totalPages);
      setTotalDocuments(response.totalDocuments);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("An unknown error occurred while fetching documents.");
      setDocuments([]);
      setTotalPages(1);
      setTotalDocuments(0);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCollection, connectedResource, currentPage, filterKey, debouncedFilterValue]);
  
  useEffect(() => {
      // Don't auto-fetch if we are in a breadcrumb trail, as the document is already loaded
      if (breadcrumbs.length > 0 && selectedDocument) return;
      fetchDocuments();
  }, [fetchDocuments, breadcrumbs.length, selectedDocument]);

  const fetchSchemaForCollection = useCallback(async (collectionName: string) => {
    if (!collectionName) return;
    setIsFetchingSchema(true);
    setSchemaTree([]);
    try {
      const info = await getCollectionInfo(collectionName, connectedResource);
      if (info.sampleDocument) {
        const tree = extractSchemaTree(info.sampleDocument);
        setSchemaTree(tree);
      }
    } catch(e) {
      console.error("Failed to fetch schema for filters:", e);
      // Fail gracefully, user can still use 'All Fields'
    } finally {
      setIsFetchingSchema(false);
    }
  }, [connectedResource]);
  
  const handleCollectionClick = useCallback(async (collectionName: string) => {
    setSelectedCollection(collectionName);
    setCurrentPage(1);
    setFilterValue('');
    setFilterKey('all');
    setSelectedDocument(null);
    setBreadcrumbs([]); // Reset breadcrumbs when manually changing collection
    await fetchSchemaForCollection(collectionName);
  }, [fetchSchemaForCollection]);

  const handleRefresh = useCallback(() => {
    if (!selectedCollection) return;

    // Give user immediate feedback by clearing old data/selection
    setSelectedDocument(null);
    setError(null);
    setBreadcrumbs([]); // Refreshing clears the navigation trail

    // Re-fetch both schema and documents for the current state
    fetchSchemaForCollection(selectedCollection);
    fetchDocuments();
  }, [selectedCollection, fetchSchemaForCollection, fetchDocuments]);
  
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    setSelectedDocument(null);
  }
  
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputSubmit = (e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
    if (e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') {
      return;
    }

    const newPageNum = parseInt(pageInput, 10);
    if (!isNaN(newPageNum) && newPageNum >= 1 && newPageNum <= totalPages) {
      handlePageChange(newPageNum);
    } else {
      // Revert to current page if input is invalid
      setPageInput(String(currentPage));
    }
  };


  const handleSortCollections = (key: 'name' | 'count') => {
    if (collectionSortKey === key) {
      setCollectionSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setCollectionSortKey(key);
      setCollectionSortOrder(key === 'name' ? 'asc' : 'desc');
    }
  };
  
  const sortedCollections = useMemo(() => {
    return [...dbInfo.collections].sort((a, b) => {
      if (collectionSortKey === 'name') {
        return a.name.localeCompare(b.name) * (collectionSortOrder === 'asc' ? 1 : -1);
      } else { // 'count'
        return (a.count - b.count) * (collectionSortOrder === 'asc' ? 1 : -1);
      }
    });
  }, [dbInfo.collections, collectionSortKey, collectionSortOrder]);

  const handleObjectIdClick = useCallback(async (objectId: string, keyContext?: string) => {
    if (!selectedDocument || !selectedCollection) return;
    setIsLoading(true);
    setError(null);

    const currentBreadcrumb: BreadcrumbItem = {
      collectionName: selectedCollection,
      document: selectedDocument
    };

    try {
      const collectionNames = dbInfo.collections.map(c => c.name);
      const result = await findDocumentById(objectId, connectedResource, collectionNames, keyContext);
      
      setBreadcrumbs(prev => [...prev, currentBreadcrumb]);
      setSelectedCollection(result.collectionName);
      setSelectedDocument(result.document);
      await fetchSchemaForCollection(result.collectionName);
    } catch(e) {
      if (e instanceof Error) setError(e.message);
      else setError("An unknown error occurred while finding the document.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDocument, selectedCollection, connectedResource, dbInfo.collections, fetchSchemaForCollection]);

  const handleBreadcrumbClick = useCallback(async (index: number) => {
    const targetState = breadcrumbs[index];
    const newBreadcrumbs = breadcrumbs.slice(0, index);

    setBreadcrumbs(newBreadcrumbs);
    setSelectedCollection(targetState.collectionName);
    setSelectedDocument(targetState.document);
    await fetchSchemaForCollection(targetState.collectionName);
  }, [breadcrumbs, fetchSchemaForCollection]);

  const renderSortArrow = (key: 'name' | 'count') => {
    if (collectionSortKey !== key) return null;
    return collectionSortOrder === 'asc' ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />;
  };

  const renderDocumentList = () => {
    if (isLoading && documents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
          <SpinnerIcon className="w-8 h-8" />
          <p className="mt-2">Loading documents...</p>
        </div>
      );
    }
    
    if (error && !isLoading) {
        return (
            <div className="p-4 text-red-600 bg-red-50 border border-red-200 text-sm rounded-md dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300">
                {error}
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

    if (documents.length === 0 && !isLoading) {
      return (
        <div className="text-center text-slate-500 dark:text-slate-400 py-10">
          <p>No documents found.</p>
          {debouncedFilterValue && <p className="text-xs">Try a different filter or value.</p>}
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <div className={`flex-grow overflow-y-auto ${isLoading ? 'opacity-50' : ''}`}>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {documents.map((doc, i) => {
                const docId = doc._id?.$oid || doc._id || `doc-index-${i}`;
                const isSelected = selectedDocument && (selectedDocument._id?.$oid || selectedDocument._id) === (doc._id?.$oid || doc._id);
                return (
                    <li key={docId}>
                        <button
                          onClick={() => setSelectedDocument(doc)}
                          className={`w-full text-left p-3 text-sm transition-colors ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                        >
                            <p className="font-mono text-slate-800 dark:text-slate-200 truncate" title={String(doc._id?.$oid || doc._id)}>{String(doc._id?.$oid || doc._id)}</p>
                        </button>
                    </li>
                );
            })}
          </ul>
        </div>
        {/* Pagination Controls */}
        <div className="flex-shrink-0 p-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1 || isLoading} className="px-3 py-1 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Previous
            </button>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>Page</span>
                <input
                    type="text"
                    value={pageInput}
                    onChange={handlePageInputChange}
                    onKeyDown={handlePageInputSubmit}
                    onBlur={handlePageInputSubmit}
                    disabled={isLoading || totalPages <= 1}
                    className="w-12 text-center bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-slate-100 disabled:opacity-50"
                    aria-label="Current page"
                />
                <span>of {totalPages}</span>
            </div>
             <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages || isLoading} className="px-3 py-1 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Next
            </button>
        </div>
      </div>
    );
  };

  const renderEditorPanel = () => {
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                <SpinnerIcon className="w-8 h-8" />
            </div>
        )
    }
    if (error && selectedCollection) {
        return (
            <div className="p-4 text-red-600 bg-red-50 border border-red-200 text-sm rounded-md dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300">
                {error}
            </div>
        );
    }
    if (!selectedDocument) {
      return (
        <div className="text-center text-slate-500 dark:text-slate-400 py-10">
          <p>Select a document to view it here.</p>
        </div>
      );
    }
    
    return (
      <div className="animate-fade-in-fast space-y-4">
        <JsonDisplay data={selectedDocument} onObjectIdClick={handleObjectIdClick}/>
      </div>
    );
  }

  const getDocId = (doc: Record<string, any>): string => {
    const id = doc?._id?.$oid || doc?._id;
    return String(id ?? 'N/A');
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
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Collections</h2>
                <div className="flex items-center gap-1 p-0.5 bg-slate-200 dark:bg-slate-700 rounded-md">
                    <button 
                        onClick={() => handleSortCollections('name')}
                        className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded transition-colors ${collectionSortKey === 'name' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                        title={`Sort by name (${collectionSortKey === 'name' && collectionSortOrder === 'asc' ? 'descending' : 'ascending'})`}
                    >
                        Name {renderSortArrow('name')}
                    </button>
                    <button 
                        onClick={() => handleSortCollections('count')}
                        className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded transition-colors ${collectionSortKey === 'count' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-300 shadow' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                        title={`Sort by count (${collectionSortKey === 'count' && collectionSortOrder === 'asc' ? 'descending' : 'ascending'})`}
                    >
                        Count {renderSortArrow('count')}
                    </button>
                </div>
              </div>
              <div className="space-y-2">
                 {sortedCollections.map(col => (
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
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                        Documents {totalDocuments > 0 && `(${totalDocuments.toLocaleString()})`}
                    </h2>
                    <button
                        onClick={handleRefresh}
                        disabled={!selectedCollection || isLoading || isFetchingSchema}
                        className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Refresh documents and schema"
                    >
                        <RefreshIcon className={`w-4 h-4 ${(isLoading || isFetchingSchema) ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                     <select
                      value={filterKey}
                      onChange={(e) => setFilterKey(e.target.value)}
                      disabled={!selectedCollection || isFetchingSchema}
                      className="w-full text-sm appearance-none cursor-pointer p-2 pr-8 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
                      title="Select a field to filter by"
                    >
                      <option value="all">All Fields</option>
                      <RenderOptions nodes={schemaTree} level={0} />
                    </select>
                    <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  </div>
                  <div className="relative">
                    <input
                        type="text"
                        placeholder={isFetchingSchema ? 'Loading schema...' : 'Filter value...'}
                        value={filterValue}
                        onChange={(e) => setFilterValue(e.target.value)}
                        disabled={!selectedCollection || isFetchingSchema}
                        className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
                    />
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </div>
                </div>
            </div>
            <div className="flex-grow overflow-hidden">
             {renderDocumentList()}
            </div>
          </div>

          {/* Column 3: Document Editor */}
          <div className="w-2/4 xl:w-3/5 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
            <div className="p-4 space-y-4">
              <header className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Editor</h2>
                {selectedDocument && <button onClick={() => { setSelectedDocument(null); setBreadcrumbs([]); }} className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Close document view"><XIcon className="w-4 h-4"/></button>}
              </header>

              {/* Breadcrumbs */}
              {breadcrumbs.length > 0 && selectedDocument && (
                <div className="flex items-center flex-wrap gap-1 text-sm text-slate-500 dark:text-slate-400 p-2 bg-slate-200 dark:bg-slate-800 rounded-md">
                    {breadcrumbs.map((crumb, i) => (
                        <React.Fragment key={`${i}-${getDocId(crumb.document)}`}>
                            <button onClick={() => handleBreadcrumbClick(i)} className="hover:underline hover:text-blue-500 dark:hover:text-blue-400 truncate max-w-[20ch]">
                                <span className="font-semibold">{crumb.collectionName}</span>
                                <span className="font-mono"> / {getDocId(crumb.document)}</span>
                            </button>
                            <ChevronRightIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                        </React.Fragment>
                    ))}
                    <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[20ch]">
                        {selectedCollection} / <span className="font-mono">{getDocId(selectedDocument)}</span>
                    </span>
                </div>
              )}
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