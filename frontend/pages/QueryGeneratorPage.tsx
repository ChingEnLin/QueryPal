
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { generateMongoQuery, debugMongoQuery, analyzeQueryResult } from '../services/geminiService';
import { getAzureCosmosAccounts, getDatabasesForAccount, runMongoQuery, getCollectionInfo, clearSystemCache } from '../services/dbService';
import { generateIpynbContent, downloadFile } from '../services/notebookService';
import { QueryResultData, DbInfo, CollectionInfo, CosmosDBAccount, SelectedResource, DebuggingResult, AnalysisResult, NotebookStep } from '../types';
import { mockECommerceDbInfo, mockCollectionInfoMap, mockFindUsersQuery, mockUserFindResult } from '../services/mockData';
import QueryDisplay from '../components/QueryDisplay';
import QueryResult from '../components/QueryResult';
import Loader from '../components/Loader';
import MongoIcon from '../components/icons/MongoIcon';
import DatabaseIcon from '../components/icons/DatabaseIcon';
import ServerIcon from '../components/icons/ServerIcon';
import CollectionActionPanel from '../components/CollectionActionPanel';
import RefreshIcon from '../components/icons/RefreshIcon';
import SpinnerIcon from '../components/icons/SpinnerIcon';
import CheckIcon from '../components/icons/CheckIcon';
import HelpIcon from '../components/icons/HelpIcon';
import Tutorial from '../components/Tutorial';
import { useTheme } from '../contexts/ThemeContext';
import SunIcon from '../components/icons/SunIcon';
import MoonIcon from '../components/icons/MoonIcon';
import PinIcon from '../components/icons/PinIcon';
import XIcon from '../components/icons/XIcon';
import JsonDisplay from '../components/JsonDisplay';
import NotebookIcon from '../components/icons/NotebookIcon';
import DownloadIcon from '../components/icons/DownloadIcon';
import TrashIcon from '../components/icons/TrashIcon';


// --- Header Component ---
interface HeaderUIProps {
  name?: string;
  onLogout: () => void;
  onClearCache: () => void;
  isClearingCache: boolean;
  cacheClearStatus: 'idle' | 'success' | 'error';
  onStartTutorial: () => void;
}

const HeaderUI: React.FC<HeaderUIProps> = ({ name, onLogout, onClearCache, isClearingCache, cacheClearStatus, onStartTutorial }) => {
  const { theme, toggleTheme } = useTheme();

  const getCacheButtonContent = () => {
    if (isClearingCache) {
      return <><SpinnerIcon className="w-4 h-4" /> Clearing...</>;
    }
    if (cacheClearStatus === 'success') {
      return <><CheckIcon className="w-4 h-4" /> Cache Cleared!</>;
    }
    if (cacheClearStatus === 'error') {
      return <>Error Clearing</>;
    }
    return <><RefreshIcon className="w-4 h-4" /> Clear Cache</>;
  };

  const getCacheButtonClasses = () => {
    let baseClasses = "flex items-center justify-center gap-2 px-3 py-1.5 border text-xs font-medium rounded-md transition-all duration-300 disabled:cursor-not-allowed";
    if (cacheClearStatus === 'success') {
      return `${baseClasses} bg-green-100 border-green-300 text-green-700 dark:bg-green-900/50 dark:border-green-700 dark:text-green-300`;
    }
    if (cacheClearStatus === 'error') {
      return `${baseClasses} bg-red-100 border-red-300 text-red-700 dark:bg-red-900/50 dark:border-red-700 dark:text-red-300`;
    }
    return `${baseClasses} bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50`;
  };

  return (
    <header className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
            <MongoIcon className="w-12 h-12 text-blue-500" />
            <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">QueryPal</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">Your AI-powered database assistant.</p>
            </div>
        </div>
        <div className="flex items-center gap-2">
          {name && <span className="text-slate-600 dark:text-slate-300 text-sm hidden md:block">Welcome, {name}</span>}
          <div id="tutorial-header-actions" className="flex items-center gap-2">
            <button
                onClick={onClearCache}
                disabled={isClearingCache || cacheClearStatus !== 'idle'}
                className={getCacheButtonClasses()}
            >
                {getCacheButtonContent()}
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <MoonIcon className="w-4 h-4" /> : <SunIcon className="w-4 h-4" />}
            </button>
            <button
                onClick={onStartTutorial}
                className="p-2 border border-slate-300 dark:border-slate-600 rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                aria-label="Start tutorial"
            >
                <HelpIcon className="w-4 h-4" />
            </button>
            <button
                onClick={onLogout}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
            >
                Sign Out
            </button>
          </div>
        </div>
    </header>
  );
};


// --- Notebook Panel Component ---
const NotebookStepCard: React.FC<{ step: NotebookStep, index: number }> = ({ step, index }) => (
    <div className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 space-y-3">
        <h4 className="font-bold text-slate-200">Step {index + 1}</h4>
        {step.contextSource && (
            <div className="text-xs text-blue-300 bg-blue-900/50 border border-blue-500/30 px-2 py-1 rounded-md">
                <strong>Context Used:</strong> Output from <em>{step.contextSource}</em>
            </div>
        )}
        <blockquote className="border-l-4 border-blue-400 pl-3 text-sm italic text-slate-400">
            {step.prompt}
        </blockquote>
        <div>
            <p className="text-xs font-semibold uppercase text-slate-500 mb-1">Query</p>
            <pre className="bg-black/50 p-2 rounded-md text-xs font-mono text-cyan-300 overflow-x-auto">
                <code>{step.query}</code>
            </pre>
        </div>
    </div>
);

interface NotebookPanelProps {
    steps: NotebookStep[];
    onClose: () => void;
    onExport: () => void;
    onClear: () => void;
}

const NotebookPanel: React.FC<NotebookPanelProps> = ({ steps, onClose, onExport, onClear }) => (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black bg-opacity-60 z-40 animate-fade-in-fast"
        aria-hidden="true"
      ></div>
      <aside id="tutorial-notebook-panel" className="fixed top-0 right-0 h-full w-full md:w-[400px] bg-slate-900 shadow-2xl z-50 flex flex-col animate-slide-in-drawer">
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-white flex items-center gap-3">
            <NotebookIcon className="w-5 h-5 text-blue-400" />
            Query Notebook
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            aria-label="Close notebook panel"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-shrink-0 p-4 border-b border-slate-700 flex items-center justify-between gap-2">
            <button onClick={onClear} disabled={steps.length === 0} className="flex items-center gap-2 px-3 py-1.5 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><TrashIcon className="w-4 h-4"/>Clear</button>
            <button onClick={onExport} disabled={steps.length === 0} className="flex items-center gap-2 px-4 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><DownloadIcon className="w-4 h-4"/>Export .ipynb</button>
        </div>
        <div className="flex-grow overflow-auto p-4 space-y-4">
          {steps.length > 0 ? (
            steps.map((step, index) => <NotebookStepCard key={step.id} step={step} index={index} />)
          ) : (
            <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center">
                <p className="font-semibold">No steps recorded yet.</p>
                <p className="text-sm">Successfully run a query to add it to the notebook.</p>
            </div>
          )}
        </div>
      </aside>
    </>
);

export interface QueryGeneratorPageProps {
  name?: string;
  onLogout: () => void;
}

// --- Main Page Component ---
const QueryGeneratorPage: React.FC<QueryGeneratorPageProps> = ({ name, onLogout }) => {
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for DB resources & connection
  const [azureAccounts, setAzureAccounts] = useState<CosmosDBAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountDatabases, setAccountDatabases] = useState<DbInfo[]>([]);
  const [isLoadingDatabases, setIsLoadingDatabases] = useState<boolean>(false);
  const [connectedResource, setConnectedResource] = useState<SelectedResource | null>(null);
  const [connectedDbInfo, setConnectedDbInfo] = useState<DbInfo | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);

  // State for AI query generation
  const [queryResult, setQueryResult] = useState<QueryResultData | null>(null);
  const [querySourceCollection, setQuerySourceCollection] = useState<string | null>(null);
  const [editableCode, setEditableCode] = useState<string>('');
  const [codeHistory, setCodeHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [lastSuccessfulPrompt, setLastSuccessfulPrompt] = useState<string>('');

  // State for query execution
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  
  // State for intermediate context (multi-step queries)
  const [intermediateContext, setIntermediateContext] = useState<{ data: any; source: string; } | null>(null);
  const [currentQueryContextSource, setCurrentQueryContextSource] = useState<string | null>(null);
  const [isContextViewerOpen, setIsContextViewerOpen] = useState(false);


  // State for query debugging
  const [isDebugging, setIsDebugging] = useState<boolean>(false);
  const [debuggingResult, setDebuggingResult] = useState<DebuggingResult | null>(null);
  const [debugError, setDebugError] = useState<string | null>(null);

  // State for result analysis
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // State for collection details
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionInfo, setCollectionInfo] = useState<CollectionInfo | null>(null);
  const [isFetchingCollectionInfo, setIsFetchingCollectionInfo] = useState<boolean>(false);
  const [collectionInfoError, setCollectionInfoError] = useState<string | null>(null);
  
  // State for cache clearing
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [cacheClearStatus, setCacheClearStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // State for tutorial
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);

  // State for notebook panel
  const [notebookSteps, setNotebookSteps] = useState<NotebookStep[]>([]);
  const [isNotebookPanelOpen, setIsNotebookPanelOpen] = useState<boolean>(false);

  const connectedAccountName = useMemo(() => {
    if (!connectedResource) return '';
    return azureAccounts.find(acc => acc.id === connectedResource.accountId)?.name ?? 'Unknown Account';
  }, [connectedResource, azureAccounts]);
  
  const fetchAccounts = useCallback(async () => {
      setIsLoadingAccounts(true);
      setDbError(null);
      try {
        const accounts = await getAzureCosmosAccounts();
        setAzureAccounts(accounts);
      } catch (e) {
        setDbError("Could not load Azure accounts from server. Ensure the backend is running and you have permissions.");
      } finally {
        setIsLoadingAccounts(false);
      }
    }, []);

  useEffect(() => {
    fetchAccounts();
    // Check if the user has seen the tutorial before
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setIsTutorialActive(true);
    }
  }, [fetchAccounts]);
  
  const handleClearCache = useCallback(async () => {
      setIsClearingCache(true);
      setCacheClearStatus('idle');
      setDbError(null); // Clear old DB errors
      try {
          await clearSystemCache();
          setCacheClearStatus('success');
          // Refresh accounts list after clearing cache
          await fetchAccounts();
      } catch (e) {
          if (e instanceof Error) setDbError(e.message);
          else setDbError("An unknown error occurred while clearing the cache.");
      } finally {
          setIsClearingCache(false);
          // Reset the button state after 3 seconds
          setTimeout(() => setCacheClearStatus('idle'), 3000);
      }
  }, [fetchAccounts]);

  const clearQueryState = useCallback(() => {
    setQueryResult(null);
    setError(null);
    setEditableCode('');
    setExecutionResult(null);
    setExecutionError(null);
    setDebuggingResult(null);
    setDebugError(null);
    setCodeHistory([]);
    setHistoryIndex(-1);
    setIntermediateContext(null);
    setQuerySourceCollection(null);
    setAnalysisResult(null);
    setAnalysisError(null);
    setCurrentQueryContextSource(null);
  }, []);
  
  const handleDisconnect = useCallback(() => {
    setConnectedDbInfo(null);
    setConnectedResource(null);
    clearQueryState();
    setUserInput('');
    setSelectedCollection(null);
    setCollectionInfo(null);
  }, [clearQueryState]);
  
  const handleSelectAccount = useCallback(async (accountId: string) => {
    if (selectedAccountId === accountId) {
        // Deselect if clicking the same account again
        setSelectedAccountId(null);
        setAccountDatabases([]);
        return;
    }

    setSelectedAccountId(accountId);
    setIsLoadingDatabases(true);
    setDbError(null);
    setAccountDatabases([]);

    const account = azureAccounts.find(acc => acc.id === accountId);
    if (!account) {
        setDbError("An error occurred: Could not find the selected account details.");
        setIsLoadingDatabases(false);
        return;
    }
    
    // If an old database was connected from another account, disconnect it
    if(connectedResource?.accountId !== account.id) {
        handleDisconnect();
    }
    
    try {
        const dbs = await getDatabasesForAccount(account.id);
        setAccountDatabases(dbs);
    } catch(e) {
        if(e instanceof Error) setDbError(e.message);
        else setDbError("Could not load databases for this account.");
    } finally {
        setIsLoadingDatabases(false);
    }
  }, [selectedAccountId, connectedResource, azureAccounts, handleDisconnect]);

  const handleConnectDatabase = useCallback((dbInfo: DbInfo) => {
    const account = azureAccounts.find(acc => acc.id === selectedAccountId);
    if (!account) return;

    setConnectedResource({
        accountId: account.id,
        databaseName: dbInfo.name,
    });
    setConnectedDbInfo(dbInfo);
    clearQueryState();
  }, [selectedAccountId, azureAccounts, clearQueryState]);

  const handleGenerateQuery = useCallback(async (prompt: string, collectionCtx?: CollectionInfo) => {
    if (!prompt.trim()) {
      setError("Please enter a command in plain English.");
      return;
    }

    setIsLoading(true);
    // Keep execution results on screen until the next query is executed, but clear old errors/code.
    setError(null);
    setExecutionError(null);
    setDebuggingResult(null);
    setDebugError(null);
    setAnalysisResult(null);
    setAnalysisError(null);


    try {
      const result = await generateMongoQuery(prompt, connectedDbInfo ?? undefined, collectionCtx, intermediateContext?.data);
      setQueryResult(result);
      setIntermediateContext(null); // Clear context after use

      // Add to history
      const newHistory = [...codeHistory.slice(0, historyIndex + 1), result.generated_code];
      const newIndex = newHistory.length - 1;
      setCodeHistory(newHistory);
      setHistoryIndex(newIndex);
      setEditableCode(newHistory[newIndex]);

    } catch (e) {
      setQueryResult(null); // Clear old results on error
      if (e instanceof Error) setError(e.message);
      else setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [connectedDbInfo, codeHistory, historyIndex, intermediateContext]);
  
  const handleGenerateQueryClick = () => {
    if (intermediateContext) {
        setCurrentQueryContextSource(intermediateContext.source);
    } else {
        setCurrentQueryContextSource(null);
    }
    setQuerySourceCollection(selectedCollection);
    setLastSuccessfulPrompt(userInput);
    // If a collection is selected, pass its info as context.
    // Otherwise, this will be undefined, and the query will be against the whole DB.
    handleGenerateQuery(userInput, collectionInfo ?? undefined);
  };

  const handleRunQuery = useCallback(async () => {
    if (!editableCode.trim() || !connectedDbInfo || !connectedResource) {
      setExecutionError("Cannot run a query without a database connection.");
      return;
    }
    setIsExecuting(true);
    setExecutionError(null);
    setExecutionResult(null);
    setDebuggingResult(null);
    setDebugError(null);
    setAnalysisResult(null);
    setAnalysisError(null);

    try {
      const result = await runMongoQuery(selectedAccountId, editableCode, connectedResource);
      setExecutionResult(result);

      // --- Add step to notebook ---
      const resultSample = Array.isArray(result) ? result.slice(0, 5) : result;
      const newStep: NotebookStep = {
        id: new Date().toISOString() + Math.random(),
        prompt: lastSuccessfulPrompt || 'Query executed without a new prompt.',
        query: editableCode,
        resultSample: resultSample,
        contextSource: currentQueryContextSource,
      };
      setNotebookSteps(prev => [...prev, newStep]);
      setCurrentQueryContextSource(null); // Reset after use

    } catch (e) {
      if (e instanceof Error) setExecutionError(e.message);
      else setExecutionError("An unknown error occurred while running the query.");
    } finally {
      setIsExecuting(false);
    }
  }, [editableCode, connectedDbInfo, connectedResource, selectedAccountId, lastSuccessfulPrompt, currentQueryContextSource]);

  const handleDebugQuery = useCallback(async () => {
    if (!editableCode || !executionError) return;

    setIsDebugging(true);
    setDebugError(null);
    setDebuggingResult(null);

    try {
        const result = await debugMongoQuery(editableCode, executionError);
        setDebuggingResult(result);
    } catch (e) {
        if (e instanceof Error) setDebugError(e.message);
        else setDebugError("An unexpected error occurred while debugging.");
    } finally {
        setIsDebugging(false);
    }
  }, [editableCode, executionError]);

  const handleAnalyzeQuery = useCallback(async (dataToAnalyze: any) => {
    if (!dataToAnalyze) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
        const result = await analyzeQueryResult(dataToAnalyze);
        setAnalysisResult(result);
    } catch (e) {
        if (e instanceof Error) setAnalysisError(e.message);
        else setAnalysisError("An unexpected error occurred during AI analysis.");
    } finally {
        setIsAnalyzing(false);
    }
  }, []);

  const handleCollectionClick = useCallback(async (collectionName: string) => {
    if (!connectedResource) return;
    if (selectedCollection === collectionName) {
        setSelectedCollection(null);
        setCollectionInfo(null);
        return;
    }
    setSelectedCollection(collectionName);
    setIsFetchingCollectionInfo(true);
    setCollectionInfoError(null);
    setCollectionInfo(null);
    try {
        const info = await getCollectionInfo(collectionName, connectedResource);
        setCollectionInfo(info);
    } catch (e) {
        if (e instanceof Error) setCollectionInfoError(e.message);
        else setCollectionInfoError("Failed to fetch collection details.");
    } finally {
        setIsFetchingCollectionInfo(false);
    }
  }, [selectedCollection, connectedResource]);

  const handleNavigateHistory = useCallback((direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? historyIndex - 1 : historyIndex + 1;
    if (newIndex >= 0 && newIndex < codeHistory.length) {
      setHistoryIndex(newIndex);
      setEditableCode(codeHistory[newIndex]);
    }
  }, [historyIndex, codeHistory]);
  
  const handleSetIntermediateContext = useCallback((data: any, source: string) => {
      setIntermediateContext({ data, source });
  }, []);

  // --- Notebook Handlers ---
  const handleExportNotebook = useCallback(() => {
    if (notebookSteps.length === 0) return;
    const dbName = connectedDbInfo?.name;
    const content = generateIpynbContent(notebookSteps, dbName);
    downloadFile(content, 'querypal-notebook.ipynb', 'application/json');
  }, [notebookSteps, connectedDbInfo]);

  const handleClearNotebook = () => {
      setNotebookSteps([]);
  };

  // --- Tutorial Demo Mode Logic ---
  const isDemoModeForCollectionStep = isTutorialActive && tutorialStepIndex === 2;
  const isDemoModeForDebugStep = isTutorialActive && tutorialStepIndex === 4;
  const isDemoModeForRunStep = isTutorialActive && tutorialStepIndex === 5;
  const isDemoModeForResultsStep = isTutorialActive && tutorialStepIndex >= 6 && tutorialStepIndex <= 8;
  const isDemoModeForContextActiveStep = isTutorialActive && tutorialStepIndex === 9;
  const isDemoModeForNotebookButtonStep = isTutorialActive && tutorialStepIndex === 10;
  const isDemoModeForNotebookPanelStep = isTutorialActive && tutorialStepIndex === 11;
  
  const demoActive = isDemoModeForCollectionStep || isDemoModeForResultsStep || isDemoModeForContextActiveStep || isDemoModeForDebugStep || isDemoModeForNotebookButtonStep || isDemoModeForNotebookPanelStep || isDemoModeForRunStep;

  const isConnectedForRender = (connectedDbInfo && connectedResource) || demoActive;
  const dbInfoForRender = demoActive ? mockECommerceDbInfo : connectedDbInfo;
  const accountNameForRender = demoActive ? 'prod-ecommerce-db' : connectedAccountName;

  const selectedCollectionForRender = isDemoModeForCollectionStep ? 'users' : selectedCollection;
  const collectionInfoForRender = isDemoModeForCollectionStep ? mockCollectionInfoMap.get('users')! : collectionInfo;
  const showCollectionPanel = isDemoModeForCollectionStep || isFetchingCollectionInfo || (collectionInfo && selectedCollection === collectionInfo.name) || collectionInfoError;
  const isQuerySectionDisabled = !isConnectedForRender;
  
  const generateButtonText = useMemo(() => {
    if (isLoading) return 'Generating...';
    if (selectedCollection) {
        return `Generate Query for ${selectedCollection} collection`;
    }
    return 'Generate Query';
  }, [isLoading, selectedCollection]);

  // --- Demo Mode Context Banner ---
  const showContextBanner = intermediateContext || isDemoModeForContextActiveStep;
  const contextForRender = isDemoModeForContextActiveStep ? { data: mockUserFindResult.slice(0, 3), source: "'users' collection" } : intermediateContext;

  const contextViewerDrawer = isContextViewerOpen && contextForRender ? createPortal(
    <>
      <div
        onClick={() => setIsContextViewerOpen(false)}
        className="fixed inset-0 bg-black bg-opacity-60 z-40 animate-fade-in-fast"
        aria-hidden="true"
      ></div>
      <aside className="fixed top-0 right-0 h-full w-full md:w-3/4 lg:w-2/3 bg-slate-900 shadow-2xl z-50 flex flex-col animate-slide-in-drawer">
        <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
          <h3 className="text-lg font-semibold text-white flex items-center gap-3">
            <PinIcon className="w-5 h-5 text-blue-400" />
            Active Query Context
          </h3>
          <button
            onClick={() => setIsContextViewerOpen(false)}
            className="p-1.5 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
            aria-label="Close context viewer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-grow overflow-auto p-4">
          <JsonDisplay data={contextForRender.data} />
        </div>
      </aside>
    </>,
    document.body
  ) : null;
  
  // --- Demo Mode Notebook Panel ---
  const showNotebookPanel = isNotebookPanelOpen || isDemoModeForNotebookPanelStep;
  const demoNotebookSteps: NotebookStep[] = [
      { id: 'demo-1', prompt: 'Find all users from Canada', query: "db['users'].find({'country': 'Canada'})", resultSample: mockUserFindResult.slice(0, 1) },
      { id: 'demo-2', prompt: 'From those users, find the ones named Alice', query: "db['users'].find({'name': 'Alice'})", resultSample: mockUserFindResult.slice(0, 1), contextSource: "'users' collection" },
  ];

  const notebookPanelDrawer = showNotebookPanel ? createPortal(
    <NotebookPanel
      steps={notebookSteps.length > 0 ? notebookSteps : (isDemoModeForNotebookPanelStep ? demoNotebookSteps : [])}
      onClose={() => setIsNotebookPanelOpen(false)}
      onExport={handleExportNotebook}
      onClear={handleClearNotebook}
    />,
    document.body
  ) : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        
        <HeaderUI 
            name={name}
            onLogout={onLogout}
            onClearCache={handleClearCache}
            isClearingCache={isClearingCache}
            cacheClearStatus={cacheClearStatus}
            onStartTutorial={() => setIsTutorialActive(true)}
        />

        <main className="space-y-8">
          {/* Connection Manager */}
          <div id="tutorial-account-section" className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6">
            {isConnectedForRender && dbInfoForRender ? (
              <div className="animate-fade-in">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Database Information</h2>
                    <p className="text-blue-600 dark:text-blue-400 font-mono text-sm">
                      Connected to: {accountNameForRender} / <span className="font-bold">{dbInfoForRender.name}</span>
                    </p>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                    <p className="text-slate-500 dark:text-slate-400">Total Documents</p>
                    <p className="text-slate-900 dark:text-slate-100 font-semibold text-lg">{dbInfoForRender.totalDocuments.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg">
                    <p className="text-slate-500 dark:text-slate-400">Database Size</p>
                    <p className="text-slate-900 dark:text-slate-100 font-semibold text-lg">{dbInfoForRender.size ?? 'N/A'}</p>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-700/50 p-3 rounded-lg col-span-1 md:col-span-3">
                     <p className="text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-2 font-medium"><ServerIcon className="w-4 h-4" /> Collections</p>
                     <div className="flex flex-wrap gap-2">
                       {dbInfoForRender.collections.map(col => (
                         <button 
                            key={col.name} 
                            onClick={() => handleCollectionClick(col.name)}
                            className={`text-xs font-mono px-3 py-1 rounded-full transition-all duration-200 ${selectedCollectionForRender === col.name ? 'bg-blue-500 text-white font-bold ring-2 ring-blue-300 dark:bg-blue-600 dark:ring-blue-500' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                        >
                            {col.name}
                         </button>
                       ))}
                     </div>
                  </div>
                </div>
                 {/* Collection Action Panel */}
                 {showCollectionPanel && (
                    <div id="tutorial-collection-panel" className="mt-4">
                        {isFetchingCollectionInfo && !isDemoModeForCollectionStep && <div className="text-center p-4 text-slate-500 dark:text-slate-400">Fetching collection details...</div>}
                        {collectionInfoError && !isDemoModeForCollectionStep && <p className="text-red-600 dark:text-red-400 text-sm mt-2">{collectionInfoError}</p>}
                        {collectionInfoForRender && selectedCollectionForRender === collectionInfoForRender.name && (
                            <CollectionActionPanel
                                info={collectionInfoForRender}
                                onClose={() => { setSelectedCollection(null); setCollectionInfo(null); }}
                            />
                        )}
                    </div>
                 )}
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><DatabaseIcon className="w-6 h-6 text-blue-500"/> Select a Database to Connect</h2>
                 {dbError && !isLoadingAccounts && !isLoadingDatabases && (
                     <p className="text-red-600 bg-red-50 border border-red-200 text-sm mt-4 p-3 rounded-md dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300">{dbError}</p>
                 )}
                {isLoadingAccounts ? (
                    <div className="text-center p-8 text-slate-500 dark:text-slate-400">Loading your Azure accounts...</div>
                ) : !dbError && azureAccounts.length === 0 ? (
                    <div className="text-center p-8 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg mt-4">
                        No accessible Cosmos DB accounts found.
                        <br/>
                        <span className="text-xs">Ensure your account has Reader permissions on the resources.</span>
                    </div>
                ) : (
                    <div className="mt-4 space-y-4">
                        {azureAccounts.map(account => (
                            <div key={account.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border dark:border-slate-700">
                               <button 
                                    onClick={() => handleSelectAccount(account.id)}
                                    disabled={isLoadingDatabases}
                                    className="w-full text-left font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <ServerIcon className="w-5 h-5 text-slate-500" />
                                    {account.name}
                               </button>
                               {selectedAccountId === account.id && (
                                   <div className="mt-3 pl-7 animate-fade-in">
                                        {isLoadingDatabases ? (
                                             <div className="text-sm text-slate-500 dark:text-slate-400 py-2">Loading databases...</div>
                                        ): dbError ? (
                                             <p className="text-red-600 dark:text-red-400 text-sm">{dbError}</p>
                                        ) : accountDatabases.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {accountDatabases.map(db => (
                                                    <button
                                                        key={db.name}
                                                        onClick={() => handleConnectDatabase(db)}
                                                        className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-800 focus:ring-blue-500 transition-colors"
                                                    >
                                                        {db.name}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-500 dark:text-slate-400">No databases found in this account.</p>
                                        )}
                                   </div>
                               )}
                            </div>
                        ))}
                    </div>
                )}
              </div>
            )}
          </div>

          {/* Query Generator */}
          <div id="tutorial-prompt-section" className={`bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 transition-opacity duration-500 ${isQuerySectionDisabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
            {showContextBanner && contextForRender && (
                <div id="tutorial-context-banner" className="relative bg-blue-50 dark:bg-slate-800/60 border border-blue-200 dark:border-blue-500/30 rounded-lg p-4 mb-6 animate-fade-in">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                             <PinIcon className="w-6 h-6 text-blue-500 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold text-blue-800 dark:text-blue-300">Query Context Active</h4>
                                <p className="text-sm text-blue-700 dark:text-blue-200/80">
                                    Using results from <strong className="font-mono">{contextForRender.source}</strong> ({Array.isArray(contextForRender.data) ? contextForRender.data.length : 1} items) as context for the next query.
                                </p>
                                <button onClick={() => setIsContextViewerOpen(true)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold mt-1">View Data</button>
                            </div>
                        </div>
                        <button onClick={() => setIntermediateContext(null)} className="p-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-200/50 dark:hover:bg-blue-900/40">
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
            
            <div className="space-y-4">
              <label htmlFor="userInput" className="block text-lg font-medium text-slate-700 dark:text-slate-300">
                Enter your command:
              </label>
              <textarea
                id="userInput"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={isQuerySectionDisabled ? "Connect to a database to begin..." : (selectedCollection ? `Querying '${selectedCollection}'... e.g., 'Find all users from Canada'` : "e.g., 'Find all users from Canada and sort them by name'")}
                className="w-full h-28 p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 placeholder-slate-400 dark:placeholder-slate-500 resize-none"
                disabled={isLoading || isQuerySectionDisabled}
              />
              <button
                onClick={handleGenerateQueryClick}
                disabled={isLoading || !userInput.trim() || isQuerySectionDisabled}
                className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.99]"
              >
                {generateButtonText}
              </button>
            </div>

            <div id="tutorial-results-area" className="mt-8">
               <div className={`flex justify-between items-center mb-4 ${isQuerySectionDisabled ? 'hidden' : ''}`}>
                    <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">
                        Query Output
                    </h3>
                    <button
                        id="tutorial-notebook-button"
                        onClick={() => setIsNotebookPanelOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-blue-500 transition-colors"
                        title="View your session as a reproducible Jupyter Notebook"
                    >
                        <NotebookIcon className="w-5 h-5" />
                        <span>View Notebook</span>
                    </button>
                </div>

              {isLoading && !isDemoModeForDebugStep && !isDemoModeForResultsStep && !isDemoModeForRunStep && <Loader />}
              
              {error && !isDemoModeForDebugStep && !isDemoModeForResultsStep && !isDemoModeForRunStep && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg animate-fade-in dark:bg-red-900/50 dark:border-red-500/50 dark:text-red-300" role="alert">
                      <strong className="font-bold">Error: </strong>
                      <span className="block sm:inline">{error}</span>
                  </div>
              )}

              {/* Tutorial Demo for Run & Edit Step */}
              {isDemoModeForRunStep && (
                <div className="space-y-8 animate-fade-in">
                  <QueryDisplay
                    code={mockFindUsersQuery.generated_code}
                    onCodeChange={() => {}}
                    onRunQuery={() => {}}
                    isExecuting={false}
                    historyCount={1}
                    historyIndex={0}
                    onNavigateHistory={() => {}}
                  />
                </div>
              )}

              {/* Tutorial Demo for Results View */}
              {(isDemoModeForResultsStep || isDemoModeForContextActiveStep) && (
                <div className="space-y-8 animate-fade-in">
                  <QueryDisplay
                    code={mockFindUsersQuery.generated_code}
                    onCodeChange={() => {}}
                    onRunQuery={() => {}}
                    isExecuting={false}
                    historyCount={1}
                    historyIndex={0}
                    onNavigateHistory={() => {}}
                  />
                  <QueryResult
                    isExecuting={false}
                    executionError={null}
                    executionResult={mockUserFindResult}
                    onDebug={() => {}}
                    isDebugging={false}
                    debuggingResult={null}
                    debugError={null}
                    sourceCollection={'users'}
                    onSetIntermediateContext={() => {}}
                    intermediateContext={null}
                    onAnalyze={() => {}}
                    isAnalyzing={false}
                    analysisResult={null}
                    analysisError={null}
                    isTutorialActive={isTutorialActive}
                    tutorialStepIndex={tutorialStepIndex}
                  />
                </div>
              )}
              
              {/* Tutorial Demo for Debug View */}
              {isDemoModeForDebugStep && (
                <div className="space-y-8 animate-fade-in">
                  <QueryDisplay
                    code={"db['users'].find({}).sor([('name', 1)])"}
                    onCodeChange={() => {}}
                    onRunQuery={() => {}}
                    isExecuting={false}
                    historyCount={1}
                    historyIndex={0}
                    onNavigateHistory={() => {}}
                  />
                  <QueryResult
                    isExecuting={false}
                    executionError={"MongoDB query error: unknown operator: $sor (MongoServerError)"}
                    executionResult={null}
                    onDebug={() => {}}
                    isDebugging={false}
                    debuggingResult={null}
                    debugError={null}
                    sourceCollection={'users'}
                    onSetIntermediateContext={() => {}}
                    intermediateContext={null}
                    onAnalyze={() => {}}
                    isAnalyzing={false}
                    analysisResult={null}
                    analysisError={null}
                    isTutorialActive={isTutorialActive}
                    tutorialStepIndex={tutorialStepIndex}
                  />
                </div>
              )}

              {/* Real results */}
              {(!isLoading && !error && queryResult && !isDemoModeForResultsStep && !isDemoModeForDebugStep && !isDemoModeForContextActiveStep && !isDemoModeForRunStep) && (
                <div className="space-y-8">
                    <QueryDisplay
                        code={editableCode}
                        onCodeChange={setEditableCode}
                        onRunQuery={handleRunQuery}
                        isExecuting={isExecuting}
                        historyCount={codeHistory.length}
                        historyIndex={historyIndex}
                        onNavigateHistory={handleNavigateHistory}
                    />
                    <QueryResult
                        isExecuting={isExecuting}
                        executionError={executionError}
                        executionResult={executionResult}
                        onDebug={handleDebugQuery}
                        isDebugging={isDebugging}
                        debuggingResult={debuggingResult}
                        debugError={debugError}
                        sourceCollection={querySourceCollection}
                        onSetIntermediateContext={handleSetIntermediateContext}
                        intermediateContext={intermediateContext}
                        onAnalyze={handleAnalyzeQuery}
                        isAnalyzing={isAnalyzing}
                        analysisResult={analysisResult}
                        analysisError={analysisError}
                    />
                </div>
              )}
              
              {/* Placeholder */}
              {(!isLoading && !error && !queryResult && !isDemoModeForResultsStep && !isDemoModeForDebugStep && !isDemoModeForContextActiveStep && !isDemoModeForRunStep) && (
                <div className="text-center text-slate-500 dark:text-slate-400 py-10 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                  <p>{isQuerySectionDisabled ? 'Connect to a database to generate queries.' : 'Your generated query will appear here.'}</p>
                </div>
              )}
            </div>
          </div>
        </main>
        
        <footer className="text-center mt-8 text-slate-500 dark:text-slate-400 text-sm space-y-1">
          <p>Powered by Microsoft Azure and Google Gemini. For internal use only.</p>
          <p className="text-xs">
            AI features use the Google Gemini API. Your data is not used to train their models. See the <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-700 dark:hover:text-slate-200">Terms of Service</a>.
          </p>
        </footer>
      </div>
      
      <Tutorial
        isActive={isTutorialActive}
        onStepChange={setTutorialStepIndex}
        onClose={() => {
            setIsTutorialActive(false);
            localStorage.setItem('hasSeenTutorial', 'true');
        }}
       />

      {contextViewerDrawer}
      {notebookPanelDrawer}

       <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in {
            animation: fade-in 0.5s ease-out forwards;
          }
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
};

export default QueryGeneratorPage;