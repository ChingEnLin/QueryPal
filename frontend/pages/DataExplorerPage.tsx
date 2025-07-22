
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SelectedResource, DbInfo, BreadcrumbItem, CosmosDBAccount } from '../types';
import { getDocuments, getCollectionInfo, findDocumentById, getDatabasesForAccount, clearDocumentsCache } from '../services/dbService';
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
import { useTheme } from '../contexts/ThemeContext';
import SunIcon from '../components/icons/SunIcon';
import MoonIcon from '../components/icons/MoonIcon';
import CheckIcon from '../components/icons/CheckIcon';


/**
 * Attempts to convert a string filter value into a more specific type (boolean, number).
 * This allows for precise filtering on non-string fields.
 * @param value The raw string value from the filter input.
 * @returns The coerced value (boolean, number) or the original string.
 */
const getCoercedFilterValue = (value: string): any => {
    const trimmedValue = value.trim();

    // Don't convert empty string to 0
    if (trimmedValue === '') {
        return value;
    }

    if (trimmedValue.toLowerCase() === 'true') {
        return true;
    }
    if (trimmedValue.toLowerCase() === 'false') {
        return false;
    }
    
    // Check if it's a valid number representation.
    // isFinite is crucial to reject partially-valid numbers like "1.2.3" or "42px".
    if (!isNaN(Number(trimmedValue)) && isFinite(Number(trimmedValue))) {
        return Number(trimmedValue);
    }

    return value; // Return original string if no conversion was possible.
};


interface DataExplorerPageProps {
  initialResource: SelectedResource;
  initialDbInfo: DbInfo;
  accountName: string; // Keep this for the initial display before full state is ready
  availableDbs: DbInfo[];
  availableAccounts: CosmosDBAccount[];
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

const DataExplorerPage: React.FC<DataExplorerPageProps> = ({ initialResource, initialDbInfo, accountName, availableDbs, availableAccounts, onNavigateBack }) => {
  // --- Account & DB State ---
  const [currentAccount, setCurrentAccount] = useState<CosmosDBAccount>(() => availableAccounts.find(a => a.id === initialResource.accountId)!);
  const [currentDb, setCurrentDb] = useState<DbInfo | null>(initialDbInfo);
  const [currentResource, setCurrentResource] = useState<SelectedResource>(initialResource);
  const [currentAccountDbs, setCurrentAccountDbs] = useState<DbInfo[]>(availableDbs);
  const [isLoadingDbsForAccount, setIsLoadingDbsForAccount] = useState(false);
  
  // --- UI State for Switchers ---
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);
  const [isDbSwitcherOpen, setIsDbSwitcherOpen] = useState(false);
  const accountSwitcherRef = useRef<HTMLDivElement>(null);
  const dbSwitcherRef = useRef<HTMLDivElement>(null);

  // --- Collection & Document State ---
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Record<string, any>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [pageInput, setPageInput] = useState(String(currentPage));

  // --- Filtering State ---
  const [filterKey, setFilterKey] = useState('all');
  const [filterValue, setFilterValue] = useState('');
  const [debouncedFilterValue, setDebouncedFilterValue] = useState(filterValue);
  const [schemaTree, setSchemaTree] = useState<SchemaKeyNode[]>([]);
  const [isFetchingSchema, setIsFetchingSchema] = useState(false);

  // --- Editor State ---
  const [selectedDocument, setSelectedDocument] = useState<Record<string, any> | null>(null);
  
  // --- Sorting State ---
  const [collectionSortKey, setCollectionSortKey] = useState<'name' | 'count'>('name');
  const [collectionSortOrder, setCollectionSortOrder] = useState<'asc' | 'desc'>('asc');

  // --- Navigation State ---
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // --- Theme State ---
  const { theme, toggleTheme } = useTheme();

  // --- Cache State ---
  const [cacheClearStatus, setCacheClearStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // --- Helper to reset state ---
  const resetExplorerState = useCallback(() => {
    setSelectedCollection(null);
    setDocuments([]);
    setIsLoading(false);
    setError(null);
    setCurrentPage(1);
    setTotalPages(1);
    setTotalDocuments(0);
    setPageInput('1');
    setFilterKey('all');
    setFilterValue('');
    setDebouncedFilterValue('');
    setSchemaTree([]);
    setIsFetchingSchema(false);
    setSelectedDocument(null);
    setBreadcrumbs([]);
  }, []);
  
  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilterValue(filterValue);
      setCurrentPage(1); // Reset to page 1 on new search
      setSelectedDocument(null); // Clear selection on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [filterValue]);

  // Sync page input with current page
  useEffect(() => setPageInput(String(currentPage)), [currentPage]);
  
  // Handle clicks outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dbSwitcherRef.current && !dbSwitcherRef.current.contains(event.target as Node)) setIsDbSwitcherOpen(false);
      if (accountSwitcherRef.current && !accountSwitcherRef.current.contains(event.target as Node)) setIsAccountSwitcherOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchDocuments = useCallback(async () => {
    if (!selectedCollection || !currentResource) {
      setDocuments([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const processedValue = getCoercedFilterValue(debouncedFilterValue);
      const response = await getDocuments(selectedCollection, currentResource, currentPage, 20, { key: filterKey, value: processedValue });
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
  }, [selectedCollection, currentResource, currentPage, filterKey, debouncedFilterValue]);
  
  useEffect(() => {
      if (breadcrumbs.length > 0 && selectedDocument) return;
      fetchDocuments();
  }, [fetchDocuments, breadcrumbs.length, selectedDocument]);

  const fetchSchemaForCollection = useCallback(async (collectionName: string) => {
    if (!collectionName || !currentResource) return;
    setIsFetchingSchema(true);
    setSchemaTree([]);
    try {
      const info = await getCollectionInfo(collectionName, currentResource);
      if (info.sampleDocument) {
        setSchemaTree(extractSchemaTree(info.sampleDocument));
      }
    } catch(e) {
      console.error("Failed to fetch schema for filters:", e);
    } finally {
      setIsFetchingSchema(false);
    }
  }, [currentResource]);

  const handleAccountSwitch = useCallback(async (newAccount: CosmosDBAccount) => {
    if (newAccount.id === currentAccount.id) return;
  
    setIsAccountSwitcherOpen(false);
    setIsLoadingDbsForAccount(true);
    setError(null);
    
    resetExplorerState();
    
    setCurrentAccount(newAccount);
    setCurrentAccountDbs([]);
    setCurrentDb(null);
    
    try {
      const dbs = await getDatabasesForAccount(newAccount.id);
      setCurrentAccountDbs(dbs);
  
      if (dbs.length > 0) {
        const firstDb = dbs[0];
        setCurrentDb(firstDb);
        setCurrentResource({ accountId: newAccount.id, databaseName: firstDb.name });
      } else {
        setCurrentResource({ accountId: newAccount.id, databaseName: '' });
      }
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("An unknown error occurred while fetching databases for the account.");
    } finally {
      setIsLoadingDbsForAccount(false);
    }
  }, [currentAccount, resetExplorerState]);

  const handleDbSwitch = useCallback((newDb: DbInfo) => {
    if (newDb.name === currentDb?.name) return;
  
    setIsDbSwitcherOpen(false);
    setCurrentDb(newDb);
    setCurrentResource(prev => ({ ...prev, databaseName: newDb.name }));
    
    resetExplorerState();
  }, [currentDb, resetExplorerState]);
  
  const handleCollectionClick = useCallback(async (collectionName: string) => {
    if (selectedCollection === collectionName) return;
    setSelectedCollection(collectionName);
    setCurrentPage(1);
    setFilterValue('');
    setFilterKey('all');
    setSelectedDocument(null);
    setBreadcrumbs([]);
    await fetchSchemaForCollection(collectionName);
  }, [fetchSchemaForCollection, selectedCollection]);

  const handleRefresh = useCallback(() => {
    if (!selectedCollection) return;
    setSelectedDocument(null);
    setError(null);
    setBreadcrumbs([]);
    fetchSchemaForCollection(selectedCollection);
    fetchDocuments();
  }, [selectedCollection, fetchSchemaForCollection, fetchDocuments]);
  
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
    setSelectedDocument(null);
  }
  
  const handlePageInputSubmit = (e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>) => {
    if (e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') return;
    const newPageNum = parseInt(pageInput, 10);
    if (!isNaN(newPageNum) && newPageNum >= 1 && newPageNum <= totalPages) {
      handlePageChange(newPageNum);
    } else {
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
    if (!currentDb) return [];
    return [...currentDb.collections].sort((a, b) => {
      if (collectionSortKey === 'name') {
        return a.name.localeCompare(b.name) * (collectionSortOrder === 'asc' ? 1 : -1);
      } else {
        return (a.count - b.count) * (collectionSortOrder === 'asc' ? 1 : -1);
      }
    });
  }, [currentDb, collectionSortKey, collectionSortOrder]);

  const handleObjectIdClick = useCallback(async (objectId: string, keyContext?: string) => {
    if (!selectedDocument || !selectedCollection || !currentDb) return;
    setIsLoading(true);
    setError(null);

    const currentBreadcrumb: BreadcrumbItem = { collectionName: selectedCollection, document: selectedDocument };

    try {
      const collectionNames = currentDb.collections.map(c => c.name);
      const result = await findDocumentById(objectId, currentResource, collectionNames, keyContext);
      
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
  }, [selectedDocument, selectedCollection, currentResource, currentDb, fetchSchemaForCollection]);

  const handleBreadcrumbClick = useCallback(async (index: number) => {
    const targetState = breadcrumbs[index];
    const newBreadcrumbs = breadcrumbs.slice(0, index);

    setBreadcrumbs(newBreadcrumbs);
    setSelectedCollection(targetState.collectionName);
    setSelectedDocument(targetState.document);
    await fetchSchemaForCollection(targetState.collectionName);
  }, [breadcrumbs, fetchSchemaForCollection]);

  const handleClearDocCache = useCallback(async () => {
    setCacheClearStatus('loading');
    setError(null);
    try {
        await clearDocumentsCache();
        setCacheClearStatus('success');
    } catch (e) {
        setCacheClearStatus('error');
        if (e instanceof Error) setError(e.message);
        else setError("An unknown error occurred while clearing the document cache.");
    } finally {
        setTimeout(() => setCacheClearStatus('idle'), 3000);
    }
  }, []);

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
                    onChange={(e) => setPageInput(e.target.value)}
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
    if (isLoading && !selectedDocument) {
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
      <div className={`space-y-4 ${isLoading ? 'opacity-50' : 'animate-fade-in-fast'}`}>
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
                  <div className="flex items-center gap-2 font-mono text-xs text-blue-600 dark:text-blue-400">
                      <div className="relative" ref={accountSwitcherRef}>
                        <button 
                          onClick={() => setIsAccountSwitcherOpen(!isAccountSwitcherOpen)}
                          disabled={availableAccounts.length <= 1}
                          className="flex items-center gap-1 font-bold px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50 disabled:cursor-default disabled:hover:bg-transparent"
                          title="Switch account"
                        >
                            {currentAccount.name}
                            {availableAccounts.length > 1 && <ChevronDownIcon className={`w-3 h-3 transition-transform ${isAccountSwitcherOpen ? 'rotate-180' : ''}`} />}
                        </button>
                        {isAccountSwitcherOpen && (
                           <div className="absolute top-full mt-2 w-60 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 animate-fade-in-fast">
                                <div className="p-2">
                                    {availableAccounts.map(acc => (
                                        <button 
                                            key={acc.id}
                                            onClick={() => handleAccountSwitch(acc)}
                                            className={`w-full text-left px-3 py-2 text-sm rounded-md ${acc.id === currentAccount.id ? 'font-bold bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                        >
                                            {acc.name}
                                        </button>
                                    ))}
                                </div>
                           </div>
                        )}
                      </div>
                      <span>/</span>
                      <div className="relative" ref={dbSwitcherRef}>
                        <button 
                          onClick={() => setIsDbSwitcherOpen(!isDbSwitcherOpen)}
                          disabled={currentAccountDbs.length <= 1 || isLoadingDbsForAccount}
                          className="flex items-center gap-1 font-bold px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50 disabled:cursor-default disabled:hover:bg-transparent"
                          title="Switch database"
                        >
                            {isLoadingDbsForAccount ? 'Loading...' : (currentDb?.name || 'Select Database')}
                            {!isLoadingDbsForAccount && currentAccountDbs.length > 1 && <ChevronDownIcon className={`w-3 h-3 transition-transform ${isDbSwitcherOpen ? 'rotate-180' : ''}`} />}
                        </button>
                        {isDbSwitcherOpen && (
                           <div className="absolute top-full mt-2 w-60 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 animate-fade-in-fast">
                                <div className="p-2">
                                    {currentAccountDbs.map(db => (
                                        <button 
                                            key={db.name}
                                            onClick={() => handleDbSwitch(db)}
                                            className={`w-full text-left px-3 py-2 text-sm rounded-md ${db.name === currentDb?.name ? 'font-bold bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                        >
                                            {db.name}
                                        </button>
                                    ))}
                                </div>
                           </div>
                        )}
                      </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                    onClick={toggleTheme}
                    className="h-9 w-9 flex items-center justify-center border border-slate-300 dark:border-slate-600 rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    aria-label="Toggle theme"
                    title="Toggle light/dark mode"
                >
                    {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                </button>
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
                 {isLoadingDbsForAccount ? (
                    <div className="text-center p-4 text-slate-500 dark:text-slate-400">Loading collections...</div>
                 ) : sortedCollections.length > 0 ? (
                    sortedCollections.map(col => (
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
                    ))
                 ) : (
                    <div className="text-center p-4 text-slate-500 dark:text-slate-400">No collections found.</div>
                 )}
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
                 <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Editor</h2>
                   <button
                        onClick={handleClearDocCache}
                        disabled={cacheClearStatus !== 'idle'}
                        className="flex items-center gap-2 px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-xs font-medium rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Clear the server cache for linked document lookups"
                    >
                        {cacheClearStatus === 'loading' && <><SpinnerIcon className="w-4 h-4" /><span>Clearing...</span></>}
                        {cacheClearStatus === 'success' && <><CheckIcon className="w-4 h-4 text-green-500" /><span>Cleared!</span></>}
                        {cacheClearStatus === 'error' && <><XIcon className="w-4 h-4 text-red-500" /><span>Error</span></>}
                        {cacheClearStatus === 'idle' && <>Clear Cache</>}
                    </button>
                </div>
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
