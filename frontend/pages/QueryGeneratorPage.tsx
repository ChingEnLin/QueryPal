import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateMongoQuery, debugMongoQuery, analyzeQueryResult, inferSchemaRelationships, evaluateWriteResult } from '../services/geminiService';
import { getAzureCosmosAccounts, getDatabasesForAccount, runMongoQuery, getCollectionInfo, clearSystemCache } from '../services/dbService';
import { getSavedQueries, saveQuery, updateSavedQuery, deleteSavedQuery } from '../services/userDataService';
import { generateIpynbContent, downloadFile } from '../services/notebookService';
import { QueryResultData, DbInfo, CollectionInfo, CosmosDBAccount, SelectedResource, DebuggingResult, AnalysisResult, NotebookStep, SavedQuery, SchemaRelationshipsResponse } from '../types';
import { mockECommerceDbInfo, mockCollectionInfoMap, mockFindUsersQuery, mockUserFindResult, mockSavedQueries } from '../services/mockData';
import { getAuthErrorMessage, isAuthenticationExpiredError } from '../utils/authErrorHandler';
import QueryDisplay from '../components/QueryDisplay';
import QueryResult from '../components/QueryResult';
import Loader from '../components/Loader';
import Tutorial from '../components/Tutorial';
import JsonDisplay from '../components/JsonDisplay';
import CollectionActionPanel from '../components/CollectionActionPanel';
import SchemaRelationshipGraph from '../components/SchemaRelationshipGraph';
import SavedQueriesPanel from '../components/SavedQueriesPanel';
import SaveQueryDialog from '../components/SaveQueryDialog';
import ShareQueryDialog from '../components/ShareQueryDialog';
import ShortcutCheatsheet from '../components/ShortcutCheatsheet';
import { useTheme } from '../contexts/ThemeContext';
import MongoIcon from '../components/icons/MongoIcon';
import {
  XIcon,
  CachedIcon,
  ServerIcon,
  DatabaseIcon,
  HelpIcon,
  SunIcon,
  MoonIcon,
  CloudIcon,
  PinIcon,
  NotebookIcon,
  DownloadIcon,
  TrashIcon,
  PlusCircleIcon,
  EditIcon,
  BookmarkIcon,
  KeyboardIcon,
  DataGridIcon,
  SignOutIcon,
  ChevronDownIcon,
  SpinnerIcon,
  CheckIcon,
} from '../components/icons/material-icons-imports';


// --- New User Menu Component for the Header ---
const UserMenu: React.FC<{
  name?: string;
  onLogout: () => void;
  onClearCache: () => void;
  isClearingCache: boolean;
  cacheClearStatus: 'idle' | 'success' | 'error';
  onStartTutorial: () => void;
  onShowSavedQueries: () => void;
  onShowShortcuts: () => void;
  isForcedOpen?: boolean;
}> = ({ name, onLogout, onClearCache, isClearingCache, cacheClearStatus, onStartTutorial, onShowSavedQueries, onShowShortcuts, isForcedOpen }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isMenuVisible = isOpen || isForcedOpen;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const getCacheButtonContent = () => {
    if (isClearingCache) return <><SpinnerIcon className="w-4 h-4" /> Clearing...</>;
    if (cacheClearStatus === 'success') return <><CheckIcon className="w-4 h-4" /> Cleared!</>;
    if (cacheClearStatus === 'error') return <>Error</>;
    return <><CachedIcon className="w-4 h-4" /> Clear Cache</>;
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        id="user-menu-button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 h-9 px-3 border border-slate-300 dark:border-slate-600 rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title="Open user menu"
      >
        <span className="text-sm font-medium hidden sm:inline">{name || 'Menu'}</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isMenuVisible ? 'rotate-180' : ''}`} />
      </button>

      {isMenuVisible && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 animate-fade-in-fast">
          <div className="p-2">
            {name && (
              <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 mb-2">
                Signed in as <strong className="text-slate-700 dark:text-slate-200">{name}</strong>
              </div>
            )}
            <button id="tutorial-saved-queries-button" onClick={() => { onShowSavedQueries(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
              <BookmarkIcon className="w-5 h-5" /> Saved Queries
            </button>
            <button id="tutorial-shortcuts-button" onClick={() => { onShowShortcuts(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
              <KeyboardIcon className="w-5 h-5" /> Keyboard Shortcuts
            </button>
            <button onClick={() => { onStartTutorial(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700">
              <HelpIcon className="w-5 h-5" /> Start Tutorial
            </button>

            <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>

            <button onClick={onClearCache} disabled={isClearingCache || cacheClearStatus !== 'idle'} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50">
              {getCacheButtonContent()}
            </button>

            <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>

            <button onClick={() => { onLogout(); setIsOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/40">
              <SignOutIcon className="w-5 h-5" /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


// --- Header Component ---
interface HeaderUIProps {
  name?: string;
  onLogout: () => void;
  onClearCache: () => void;
  isClearingCache: boolean;
  cacheClearStatus: 'idle' | 'success' | 'error';
  onStartTutorial: () => void;
  onShowSavedQueries: () => void;
  onShowShortcuts: () => void;
  isUserMenuForcedOpen?: boolean;
}

const HeaderUI: React.FC<HeaderUIProps> = ({ name, onLogout, onClearCache, isClearingCache, cacheClearStatus, onStartTutorial, onShowSavedQueries, onShowShortcuts, isUserMenuForcedOpen }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header id="tutorial-header-actions" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div className="flex items-center space-x-4">
        <MongoIcon className="w-12 h-12 text-blue-500" />
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100">QueryPal</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">Your AI-powered database assistant.</p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={toggleTheme}
          className="h-9 w-9 flex items-center justify-center border border-slate-300 dark:border-slate-600 rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="Toggle theme"
          title="Toggle light/dark mode"
        >
          {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
        </button>

        <UserMenu
          name={name}
          onLogout={onLogout}
          onClearCache={onClearCache}
          isClearingCache={isClearingCache}
          cacheClearStatus={cacheClearStatus}
          onStartTutorial={onStartTutorial}
          onShowSavedQueries={onShowSavedQueries}
          onShowShortcuts={onShowShortcuts}
          isForcedOpen={isUserMenuForcedOpen}
        />
      </div>
    </header>
  );
};


// --- Notebook Panel Component ---
interface NotebookStepCardProps {
  step: NotebookStep;
  index: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, newContent: string) => void;
  onSetEditing: (id: string, isEditing: boolean) => void;
}

const NotebookStepCard: React.FC<NotebookStepCardProps> = ({ step, index, onRemove, onUpdate, onSetEditing }) => {
  const handleSave = () => onSetEditing(step.id, false);

  if (step.type === 'note') {
    return (
      <div className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 space-y-3 group">
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-bold text-slate-200">Note</h4>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {step.isEditing ? (
              <button onClick={handleSave} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" title="Save changes">
                <CheckIcon className="w-3 h-3" /> Save
              </button>
            ) : (
              <button onClick={() => onSetEditing(step.id, true)} className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-slate-600 text-slate-200 hover:bg-slate-500" title="Edit note">
                <EditIcon className="w-3 h-3" /> Edit
              </button>
            )}
            <button onClick={() => onRemove(step.id)} className="p-1 rounded-full text-slate-500 hover:bg-red-900/50 hover:text-red-400" aria-label="Remove note" title="Remove step">
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        {step.isEditing ? (
          <textarea
            value={step.prompt}
            onChange={(e) => onUpdate(step.id, e.target.value)}
            className="w-full h-28 bg-black/50 text-slate-200 p-2 rounded-md font-sans text-sm border border-slate-600 focus:border-blue-500 focus:ring-blue-500"
            placeholder="Enter your note here... (Markdown is supported on export)"
            autoFocus
          />
        ) : (
          <div className="text-sm text-slate-300 whitespace-pre-wrap p-2 rounded-md bg-black/20 min-h-[4rem]">
            {step.prompt || <span className="text-slate-500">Empty note</span>}
          </div>
        )}
      </div>
    );
  }

  // Render Query Step
  return (
    <div className="bg-slate-800/70 p-4 rounded-lg border border-slate-700 space-y-3 relative group">
      <div className="flex justify-between items-start">
        <h4 className="font-bold text-slate-200">Step {index + 1}</h4>
        <button
          onClick={() => onRemove(step.id)}
          className="p-1 rounded-full text-slate-500 hover:bg-red-900/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove step"
          title="Remove step"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
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
};

interface NotebookPanelProps {
  steps: NotebookStep[];
  onClose: () => void;
  onExport: () => void;
  onClear: () => void;
  onRemoveStep: (id: string) => void;
  onAddNote: () => void;
  onUpdateStep: (id: string, content: string) => void;
  onSetEditing: (id: string, isEditing: boolean) => void;
}

const NotebookPanel: React.FC<NotebookPanelProps> = ({ steps, onClose, onExport, onClear, onRemoveStep, onAddNote, onUpdateStep, onSetEditing }) => (
  <>
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black bg-opacity-60 z-40 animate-fade-in-fast"
      aria-hidden="true"
    ></div>
    <aside id="tutorial-notebook-panel" className="fixed top-0 right-0 h-full w-full md:w-[450px] bg-slate-900 shadow-2xl z-50 flex flex-col animate-slide-in-drawer">
      <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
        <h3 className="text-lg font-semibold text-white flex items-center gap-3">
          <NotebookIcon className="w-5 h-5 text-blue-400" />
          Query Notebook
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          aria-label="Close notebook panel"
          title="Close notebook"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </header>
      <div className="flex-shrink-0 p-4 border-b border-slate-700 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={onAddNote} className="flex items-center gap-2 px-3 py-1.5 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors" title="Add a new markdown note"><PlusCircleIcon className="w-4 h-4" />Add Note</button>
          <button onClick={onClear} disabled={steps.length === 0} className="flex items-center gap-2 px-3 py-1.5 border border-slate-600 text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Clear all steps"><TrashIcon className="w-4 h-4" />Clear All</button>
        </div>
        <button onClick={onExport} disabled={steps.length === 0} className="flex items-center gap-2 px-4 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Export as .ipynb notebook"><DownloadIcon className="w-4 h-4" />Export .ipynb</button>
      </div>
      <div className="flex-grow overflow-auto p-4 space-y-4">
        {steps.length > 0 ? (
          steps.map((step, index) => (
            <NotebookStepCard
              key={step.id}
              step={step}
              index={index}
              onRemove={onRemoveStep}
              onUpdate={onUpdateStep}
              onSetEditing={onSetEditing}
            />
          ))
        ) : (
          <div className="text-center text-slate-500 h-full flex flex-col items-center justify-center">
            <p className="font-semibold">No steps recorded yet.</p>
            <p className="text-sm">Run a query or add a note to begin.</p>
          </div>
        )}
      </div>
    </aside>
  </>
);

export interface QueryGeneratorPageProps {
  name?: string;
  email?: string;
  onLogout: () => void;
  onNavigateToExplorer: (connection: { resource: SelectedResource; dbInfo: DbInfo; accountName: string; availableDbs: DbInfo[], availableAccounts: CosmosDBAccount[] }) => void;
}

// --- Main Page Component ---
const QueryGeneratorPage: React.FC<QueryGeneratorPageProps> = ({ name, email, onLogout, onNavigateToExplorer }) => {
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
  const [isConnectingToDb, setIsConnectingToDb] = useState<string | null>(null);
  const [quickExploringAccountId, setQuickExploringAccountId] = useState<string | null>(null);

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

  // State for write evaluation
  const [isEvaluatingWrite, setIsEvaluatingWrite] = useState<boolean>(false);
  const [writeEvaluationResult, setWriteEvaluationResult] = useState<{evaluation: string} | null>(null);
  const [writeEvaluationError, setWriteEvaluationError] = useState<string | null>(null);

  // State for collection details
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  const [collectionDetailsMap, setCollectionDetailsMap] = useState<Record<string, CollectionInfo>>({});
  const [loadingCollections, setLoadingCollections] = useState<Record<string, boolean>>({});
  const [expandedCollectionSchemas, setExpandedCollectionSchemas] = useState<Record<string, boolean>>({}); // Track open/close state for stacking
  const [collectionInfoError, setCollectionInfoError] = useState<string | null>(null);

  // State for relationship inference
  const [relationships, setRelationships] = useState<SchemaRelationshipsResponse | null>(null);
  const [isAnalyzingRelationships, setIsAnalyzingRelationships] = useState<boolean>(false);
  const [relationshipError, setRelationshipError] = useState<string | null>(null);

  // State for cache clearing
  const [isClearingCache, setIsClearingCache] = useState<boolean>(false);
  const [cacheClearStatus, setCacheClearStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // State for tutorial
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const [isUserMenuOpenForTutorial, setIsUserMenuOpenForTutorial] = useState(false);


  // State for notebook panel
  const [notebookSteps, setNotebookSteps] = useState<NotebookStep[]>([]);
  const [isNotebookPanelOpen, setIsNotebookPanelOpen] = useState<boolean>(false);

  // --- State for Saved Queries ---
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [isLoadingSavedQueries, setIsLoadingSavedQueries] = useState<boolean>(false);
  const [isSavedQueriesPanelOpen, setIsSavedQueriesPanelOpen] = useState<boolean>(false);
  const [saveDialogState, setSaveDialogState] = useState<{ isOpen: boolean; data?: Partial<SavedQuery> & { prompt: string; code: string } }>({ isOpen: false });
  const [shareDialogState, setShareDialogState] = useState<{ isOpen: boolean; query?: SavedQuery }>({ isOpen: false });
  const [isSavingQuery, setIsSavingQuery] = useState(false);

  // State for Keyboard Shortcuts
  const [isShortcutCheatsheetOpen, setIsShortcutCheatsheetOpen] = useState(false);


  const connectedAccountName = useMemo(() => {
    if (!connectedResource) return '';
    return azureAccounts.find(acc => acc.id === connectedResource.accountId)?.name ?? 'Unknown Account';
  }, [connectedResource, azureAccounts]);

  const [isWaitingForAuth, setIsWaitingForAuth] = useState<boolean>(false);

  const fetchAccounts = useCallback(async () => {
    setIsLoadingAccounts(true);
    setDbError(null);
    let interactionInProgress = false;
    try {
      const accounts = await getAzureCosmosAccounts();
      setAzureAccounts(accounts);
    } catch (e: any) {
      if (e?.errorCode === 'interaction_in_progress') {
        console.warn("fetchAccounts skipped due to interaction in progress.");
        interactionInProgress = true;
        setIsWaitingForAuth(true);
        return;
      }
      if (e instanceof Error) {
        // Check for authentication-related errors
        if (isAuthenticationExpiredError(e)) {
          setDbError(getAuthErrorMessage(e));
        } else if (e.message.includes('AuthorizationFailed') || e.message.includes('403')) {
          setDbError("Permission Denied: You may not have the required permissions to list Azure resources. Please contact your administrator.");
        } else {
          setDbError("Could not load Azure accounts from server. " + (e.message || "Ensure the backend is running and you have permissions."));
        }
      } else {
        setDbError("An unknown error occurred while fetching Azure accounts.");
      }
    } finally {
      setIsLoadingAccounts(false);
      // Only set waiting for auth false if we actually finished without detecting an interaction
      if (!interactionInProgress) {
        setIsWaitingForAuth(false);
      }
    }
  }, []);

  const fetchSavedQueries = useCallback(async () => {
    setIsLoadingSavedQueries(true);
    try {
      const queries = await getSavedQueries();
      setSavedQueries(queries);
    } catch (e) {
      // Log error details for debugging
      if (e instanceof Error && isAuthenticationExpiredError(e)) {
        console.error("Failed to fetch saved queries due to authentication error:", getAuthErrorMessage(e));
      } else {
        console.error("Failed to fetch saved queries:", e);
      }
    } finally {
      setIsLoadingSavedQueries(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchSavedQueries();
    // Check if the user has seen the tutorial before
    const hasSeenTutorial = localStorage.getItem('hasSeenTutorial');
    if (!hasSeenTutorial) {
      setIsTutorialActive(true);
    }
  }, [fetchAccounts, fetchSavedQueries]);

  // Effect to manage tutorial state that affects the UI, like forcing menus open.
  useEffect(() => {
    // If the tutorial is active and on a step that targets an item inside the user menu, force it open.
    if (isTutorialActive && tutorialStepIndex === 6) {
      setIsUserMenuOpenForTutorial(true);
    } else {
      setIsUserMenuOpenForTutorial(false);
    }
  }, [isTutorialActive, tutorialStepIndex]);

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
    setAnalysisResult(null);
    setAnalysisError(null);
    setCodeHistory([]);
    setHistoryIndex(-1);
    setIntermediateContext(null);
    setQuerySourceCollection(null);
    setCurrentQueryContextSource(null);
    setRelationships(null); // Clear relationships
    setRelationshipError(null); // Clear relationship error
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnectedDbInfo(null);
    setConnectedResource(null);
    clearQueryState();
    setUserInput('');
    setSelectedCollections([]);
    setCollectionDetailsMap({});
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
    if (connectedResource?.accountId !== account.id) {
      handleDisconnect();
    }

    try {
      const dbs = await getDatabasesForAccount(account.id);
      setAccountDatabases(dbs);
    } catch (e) {
      if (e instanceof Error) {
        // Check for authentication-related errors first
        if (isAuthenticationExpiredError(e)) {
          setDbError(getAuthErrorMessage(e));
        } else if (e.message.includes('AuthorizationFailed') || e.message.includes('403')) {
          setDbError("Permission Denied: You may not have the required Azure role (e.g., 'Cosmos DB Operator') to access databases for this account. Please check your permissions.");
        } else {
          setDbError(e.message);
        }
      } else {
        setDbError("Could not load databases for this account.");
      }
    } finally {
      setIsLoadingDatabases(false);
    }
  }, [selectedAccountId, connectedResource, azureAccounts, handleDisconnect]);

  const handleConnectDatabase = useCallback(async (dbInfo: DbInfo) => {
    const account = azureAccounts.find(acc => acc.id === selectedAccountId);
    if (!account) return;

    setIsConnectingToDb(dbInfo.name);
    // Simulate connection delay for better UX
    await new Promise(resolve => setTimeout(resolve, 800));

    setConnectedResource({
      accountId: account.id,
      databaseName: dbInfo.name,
    });
    setConnectedDbInfo(dbInfo);
    clearQueryState();
    setIsConnectingToDb(null);
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
      const accountId = connectedResource?.accountId || selectedAccountId;
      if (!accountId) {
        throw new Error("No account ID available for query generation.");
      }

      // Map selected collection names to their full info objects
      const selectedCollectionInfos = selectedCollections
        .map(name => collectionDetailsMap[name])
        .filter((info): info is CollectionInfo => !!info);

      const result = await generateMongoQuery(
        prompt,
        accountId,
        connectedDbInfo ?? undefined,
        collectionCtx,
        intermediateContext?.data,
        selectedCollectionInfos
      );
      setQueryResult(result);
      setIntermediateContext(null); // Clear context after use

      // Add to history
      const newHistory = [...codeHistory.slice(0, historyIndex + 1), result.generated_code];
      const newIndex = newHistory.length - 1;
      setCodeHistory(newHistory);
      setHistoryIndex(newIndex);
      setEditableCode(newHistory[newIndex]);

      // Automatically display results for read queries, gate write queries
      if (result.is_write_action) {
        setExecutionResult(null);
        setExecutionError("⚠️ This is a write action. Please review the code carefully and click 'Run Query' to execute it.");
      } else if (result.query_result !== undefined) {
        if (result.query_result && typeof result.query_result === 'object' && result.query_result.error) {
            setExecutionError(result.query_result.error);
            setExecutionResult(null);
        } else if (typeof result.query_result === 'string' && (result.query_result.startsWith("Error:") || result.query_result.startsWith("Execution Exception:"))) {
            setExecutionError(result.query_result);
            setExecutionResult(null);
        } else {
            setExecutionResult(result.query_result);
            setExecutionError(null);
        }
      }

    } catch (e) {
      setQueryResult(null); // Clear old results on error
      if (e instanceof Error) setError(e.message);
      else setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [connectedDbInfo, codeHistory, historyIndex, intermediateContext, connectedResource, selectedAccountId, selectedCollections, collectionDetailsMap]);

  const handleGenerateQueryClick = useCallback(() => {
    if (intermediateContext) {
      setCurrentQueryContextSource(intermediateContext.source);
    } else {
      setCurrentQueryContextSource(null);
    }
    // For now, if multiple are selected, we might want to prioritize one for the "source" tag or change how it works.
    // Let's us the first selected one, or a joined string.
    setQuerySourceCollection(selectedCollections.length > 0 ? selectedCollections.join(', ') : null);
    setLastSuccessfulPrompt(userInput);
    // If a collection is selected, pass its info as context.
    const primaryContext = selectedCollections.length > 0 ? collectionDetailsMap[selectedCollections[0]] : undefined;
    handleGenerateQuery(userInput, primaryContext);
  }, [userInput, intermediateContext, selectedCollections, collectionDetailsMap, handleGenerateQuery]);

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
    setWriteEvaluationResult(null);
    setWriteEvaluationError(null);

    try {
      const result = await runMongoQuery(connectedResource.accountId, editableCode, connectedResource);
      setExecutionResult(result);

      // --- Add step to notebook ---
      const resultSample = Array.isArray(result) ? result.slice(0, 5) : result;
      const newStep: NotebookStep = {
        id: new Date().toISOString() + Math.random(),
        type: 'query',
        prompt: lastSuccessfulPrompt || 'Query executed without a new prompt.',
        query: editableCode,
        resultSample: resultSample,
        contextSource: currentQueryContextSource ?? undefined,
      };
      setNotebookSteps(prev => [...prev, newStep]);
      setCurrentQueryContextSource(null); // Reset after use

    } catch (e) {
      if (e instanceof Error) {
        if (e.message.includes('AuthorizationFailed') || e.message.includes('403')) {
          setExecutionError("Permission Denied: You do not have permission to execute queries against this database.");
        } else {
          setExecutionError(e.message);
        }
      } else {
        setExecutionError("An unknown error occurred while running the query.");
      }
    } finally {
      setIsExecuting(false);
    }
  }, [editableCode, connectedDbInfo, connectedResource, lastSuccessfulPrompt, currentQueryContextSource]);

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

  const handleEvaluateWrite = useCallback(async () => {
    if (!editableCode || !executionResult || !lastSuccessfulPrompt || !selectedAccountId || !connectedDbInfo) return;
    
    setIsEvaluatingWrite(true);
    setWriteEvaluationError(null);
    setWriteEvaluationResult(null);

    try {
      const result = await evaluateWriteResult(lastSuccessfulPrompt, editableCode, executionResult, selectedAccountId, connectedDbInfo.name);
      setWriteEvaluationResult(result);
    } catch (e) {
      if (e instanceof Error) setWriteEvaluationError(e.message);
      else setWriteEvaluationError("An unexpected error occurred during write evaluation.");
    } finally {
      setIsEvaluatingWrite(false);
    }
  }, [lastSuccessfulPrompt, editableCode, executionResult, selectedAccountId, connectedDbInfo]);


  const handleCollectionClick = useCallback(async (collectionName: string, event?: React.MouseEvent) => {
    if (!connectedResource) return;

    // Clear previous relationship analysis when selection changes
    setRelationships(null);
    setRelationshipError(null);

    const isModifierPressed = event ? (event.ctrlKey || event.metaKey) : false;

    let newSelection: string[] = [];

    if (isModifierPressed) {
      // Multi-selection logic
      if (selectedCollections.includes(collectionName)) {
        newSelection = selectedCollections.filter(c => c !== collectionName);
      } else {
        newSelection = [...selectedCollections, collectionName];
      }
    } else {
      // Single selection functionality (toggle off if same clicked, otherwise set new)
      if (selectedCollections.length === 1 && selectedCollections[0] === collectionName) {
        newSelection = [];
      } else {
        newSelection = [collectionName];
      }
    }

    setSelectedCollections(newSelection);

    if (newSelection.length === 0) {
      // Clear errors if any
      return;
    }

    // Fetch details for any newly selected collection that we don't have yet
    newSelection.forEach(async (col) => {
      if (!collectionDetailsMap[col] && !loadingCollections[col]) {
        setLoadingCollections(prev => ({ ...prev, [col]: true }));
        try {
          // Use the existing getCollectionInfo. 
          // Note: getCollectionInfo signature might be (accountId, dbName, collectionName) or (collectionName, resource).
          // I need to check the import or usage elsewhere. 
          // Line 4 import says: import { ... getCollectionInfo ... } from '../services/dbService';
          // Line 764 usage (in previous view) was: getCollectionInfo(newSelection[0], connectedResource);
          // But typically it is (accountId, databaseName, collectionName).
          // Let's assume (collectionName, connectedResource) based on previous usage or check dbService.
          // Actually in Step 382 I wrote: getCollectionInfo(connectedResource!.accountId, connectedResource!.databaseName, col);
          // Let's stick to what works. I will use the pattern that was there or verify signature.
          // In Step 374, import is from dbService.
          // In Step 382, I tried to use explicit args.
          // Let's assume signature: getCollectionInfo(collectionName, connectedResource) based on line 764 of previous original code?
          // Wait, original code was: `const info = await getCollectionInfo(newSelection[0], connectedResource);` in Step 382 diff (LEFT side).
          // So I should use that signature.
          const info = await getCollectionInfo(col, connectedResource);
          setCollectionDetailsMap(prev => ({ ...prev, [col]: info }));
        } catch (e: any) {
          console.error(`Failed to load details for ${col}`, e);
        } finally {
          setLoadingCollections(prev => ({ ...prev, [col]: false }));
        }
      }
    });
  }, [connectedResource, selectedCollections, collectionDetailsMap, loadingCollections]);

  const handleAnalyzeRelationships = useCallback(async () => {
    if (!connectedResource || selectedCollections.length < 2) return;

    setIsAnalyzingRelationships(true);
    setRelationshipError(null);
    // Don't clear immediately to prevent flashing if we are just refreshing? 
    // Actually for new selection we want to clear.

    try {
      const result = await inferSchemaRelationships(
        connectedResource.accountId,
        connectedResource.databaseName,
        selectedCollections
      );
      setRelationships(result);
    } catch (e: any) {
      setRelationshipError(e.message || "Failed to analyze relationships.");
    } finally {
      setIsAnalyzingRelationships(false);
    }
  }, [connectedResource, selectedCollections]);

  // Debounced effect to trigger analysis when selections change
  useEffect(() => {
    // Clean up previous state if selection is insufficient
    if (selectedCollections.length < 2) {
      setRelationships(null);
      setRelationshipError(null);
      return;
    }

    const timer = setTimeout(() => {
      handleAnalyzeRelationships();
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [selectedCollections, handleAnalyzeRelationships]);

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
    // Turn off editing mode for all notes before exporting
    const stepsToExport = notebookSteps.map(step => ({ ...step, isEditing: false }));
    const dbName = connectedDbInfo?.name;
    const content = generateIpynbContent(stepsToExport, dbName);
    downloadFile(content, 'querypal-notebook.ipynb', 'application/json');
  }, [notebookSteps, connectedDbInfo]);

  const handleClearNotebook = () => {
    setNotebookSteps([]);
  };

  const handleRemoveNotebookStep = useCallback((id: string) => {
    setNotebookSteps(prev => prev.filter(step => step.id !== id));
  }, []);

  const handleAddNoteStep = useCallback(() => {
    const newNote: NotebookStep = {
      id: new Date().toISOString() + Math.random(),
      type: 'note',
      prompt: '## New Note\n\nEdit this note content using markdown.',
      isEditing: true, // Start in editing mode
    };
    // Turn off editing for all other notes
    setNotebookSteps(prev => [...prev.map(s => ({ ...s, isEditing: false })), newNote]);
  }, []);

  const handleUpdateNotebookStep = (id: string, content: string) => {
    setNotebookSteps(prev => prev.map(s => s.id === id ? { ...s, prompt: content } : s));
  };

  const handleSetEditingStep = (id: string, isEditing: boolean) => {
    setNotebookSteps(prev => prev.map(s => s.id === id ? { ...s, isEditing } : { ...s, isEditing: false }));
  };

  // --- Saved Queries Handlers ---
  const handleOpenSaveDialog = useCallback(() => {
    if (!editableCode) return; // Don't open if there's no code to save
    setSaveDialogState({
      isOpen: true,
      data: { prompt: lastSuccessfulPrompt, code: editableCode }
    });
  }, [editableCode, lastSuccessfulPrompt]);

  const handleEditSavedQuery = (query: SavedQuery) => {
    setSaveDialogState({ isOpen: true, data: query });
  };

  const handleSaveOrUpdateQuery = useCallback(async (data: Pick<SavedQuery, 'name' | 'prompt' | 'code'> | SavedQuery) => {
    setIsSavingQuery(true);
    try {
      if ('id' in data) {
        // Update
        const updated = await updateSavedQuery(data as SavedQuery);
        setSavedQueries(prev => prev.map(q => q.id === updated.id ? updated : q));
      } else {
        // Create
        const newQuery = await saveQuery(data as Pick<SavedQuery, 'name' | 'prompt' | 'code'>);
        setSavedQueries(prev => [...prev, newQuery]);
      }
      setSaveDialogState({ isOpen: false });
    } catch (e) {
      console.error("Failed to save or update query:", e);
      // Maybe set an error in the dialog in the future
    } finally {
      setIsSavingQuery(false);
    }
  }, []);

  const handleDeleteSavedQuery = useCallback(async (queryId: string) => {
    // Optimistic delete
    const originalQueries = savedQueries;
    setSavedQueries(prev => prev.filter(q => q.id !== queryId));
    try {
      await deleteSavedQuery(queryId);
    } catch (e) {
      console.error("Failed to delete query:", e);
      setSavedQueries(originalQueries); // Revert on failure
    }
  }, [savedQueries]);

  const handleLoadSavedQuery = (query: SavedQuery) => {
    clearQueryState(); // Clear all results and errors
    setUserInput(query.prompt);
    setLastSuccessfulPrompt(query.prompt);
    setEditableCode(query.code);

    // Set code history for the loaded query
    setCodeHistory([query.code]);
    setHistoryIndex(0);

    setIsSavedQueriesPanelOpen(false); // Close panel after loading
  };

  // --- Sharing Handlers ---
  const handleOpenShareDialog = (query: SavedQuery) => {
    setShareDialogState({ isOpen: true, query });
  };

  const handleUpdateSharing = async (queryToUpdate: SavedQuery) => {
    // Optimistic update for a snappy UI
    setSavedQueries(prev => prev.map(q => q.id === queryToUpdate.id ? queryToUpdate : q));
    setShareDialogState({ isOpen: false }); // Close dialog immediately

    try {
      // Now call the backend
      await updateSavedQuery(queryToUpdate);
    } catch (e) {
      console.error("Failed to update sharing settings:", e);
      // On failure, revert the change by re-fetching from the source of truth
      fetchSavedQueries();
    }
  };

  const handleLaunchExplorer = useCallback((targetDb: DbInfo, targetAccount: CosmosDBAccount, explicitDbs?: DbInfo[]) => {
    // Determine the list of available DBs.
    // If explicitDbs is provided (e.g. from quick explore fetch), use it.
    // Else if we are launching for the currently selected account (in the list), use the state accountDatabases.
    // Otherwise fallback to just the target DB (which limits switching capabilities).
    const dbsForExplorer = explicitDbs ||
      ((selectedAccountId === targetAccount.id && accountDatabases.length > 0)
        ? accountDatabases
        : [targetDb]);

    onNavigateToExplorer({
      resource: { accountId: targetAccount.id, databaseName: targetDb.name },
      dbInfo: targetDb,
      accountName: targetAccount.name,
      availableDbs: dbsForExplorer,
      availableAccounts: azureAccounts,
    });
  }, [onNavigateToExplorer, selectedAccountId, accountDatabases, azureAccounts]);

  const handleQuickExploreAccount = useCallback(async (account: CosmosDBAccount) => {
    // If we already have the DBs for this account in state (because it's selected)
    if (selectedAccountId === account.id && accountDatabases.length > 0) {
      handleLaunchExplorer(accountDatabases[0], account, accountDatabases);
      return;
    }

    setQuickExploringAccountId(account.id);
    try {
      const dbs = await getDatabasesForAccount(account.id);
      if (dbs.length > 0) {
        handleLaunchExplorer(dbs[0], account, dbs);
      } else {
        setError(`No databases found in '${account.name}'. Cannot launch Data Explorer.`);
      }
    } catch (e) {
      console.error("Quick explorer failed", e);
      setError(`Failed to load databases for '${account.name}'.`);
    } finally {
      setQuickExploringAccountId(null);
    }
  }, [selectedAccountId, accountDatabases, handleLaunchExplorer]);

  // --- Tutorial Demo Mode Logic ---
  const isDemoModeForCollectionStep = isTutorialActive && tutorialStepIndex === 2;
  const isDemoModeForRunStep = isTutorialActive && tutorialStepIndex === 4;
  const isDemoModeForSaveStep = isTutorialActive && tutorialStepIndex === 5;
  const isDemoModeForSavedQueriesPanelStep = isTutorialActive && tutorialStepIndex === 7;
  const isDemoModeForDebugStep = isTutorialActive && tutorialStepIndex === 8;
  const isDemoModeForResultsStep = isTutorialActive && tutorialStepIndex >= 9 && tutorialStepIndex <= 11;
  const isDemoModeForContextActiveStep = isTutorialActive && tutorialStepIndex === 12;
  const isDemoModeForNotebookButtonStep = isTutorialActive && tutorialStepIndex === 13;
  const isDemoModeForNotebookPanelStep = isTutorialActive && tutorialStepIndex === 14;

  const demoActive = isDemoModeForCollectionStep || isDemoModeForResultsStep || isDemoModeForContextActiveStep || isDemoModeForDebugStep || isDemoModeForNotebookButtonStep || isDemoModeForNotebookPanelStep || isDemoModeForRunStep || isDemoModeForSaveStep || isDemoModeForSavedQueriesPanelStep;

  const isConnectedForRender = (connectedDbInfo && connectedResource) || demoActive;
  const isQuerySectionDisabled = !isConnectedForRender;

  // --- Global Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isModifier = isMac ? event.metaKey : event.ctrlKey;

      // Escape key to close modals/panels (topmost)
      if (event.key === 'Escape') {
        if (saveDialogState.isOpen) setSaveDialogState({ isOpen: false });
        else if (shareDialogState.isOpen) setShareDialogState({ isOpen: false });
        else if (isShortcutCheatsheetOpen) setIsShortcutCheatsheetOpen(false);
        else if (isNotebookPanelOpen) setIsNotebookPanelOpen(false);
        else if (isSavedQueriesPanelOpen) setIsSavedQueriesPanelOpen(false);
        else if (isContextViewerOpen) setIsContextViewerOpen(false);
        else if (isTutorialActive) setIsTutorialActive(false); // Also close tutorial
        return;
      }

      // Prevent shortcuts from firing while typing in dialogs/modals
      const isTypingInDialog = (event.target as HTMLElement).closest('[role="dialog"]');
      if (isTypingInDialog) return;

      if (isModifier) {
        // Cmd/Ctrl + S to Save
        if (event.key === 's') {
          event.preventDefault();
          if (editableCode && !isQuerySectionDisabled) {
            handleOpenSaveDialog();
          }
        }

        // Cmd/Ctrl + / to open shortcuts
        if (event.key === '/') {
          event.preventDefault();
          setIsShortcutCheatsheetOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editableCode, isQuerySectionDisabled, handleOpenSaveDialog, saveDialogState.isOpen, shareDialogState.isOpen, isShortcutCheatsheetOpen, isNotebookPanelOpen, isSavedQueriesPanelOpen, isContextViewerOpen, isTutorialActive]);

  const dbInfoForRender = demoActive ? mockECommerceDbInfo : connectedDbInfo;
  const accountNameForRender = demoActive ? 'prod-ecommerce-db' : connectedAccountName;

  const selectedCollectionsForRender = isDemoModeForCollectionStep ? ['users'] : selectedCollections;

  // For demo/tutorial purposes, ensure appropriate data is in the map if simulated
  const collectionDetailsMapForRender = useMemo(() => {
    if (isDemoModeForCollectionStep) {
      return { 'users': mockCollectionInfoMap.get('users')! };
    }
    return collectionDetailsMap;
  }, [isDemoModeForCollectionStep, collectionDetailsMap]);

  const isPromptUnchanged = userInput.trim() === lastSuccessfulPrompt.trim() && !!editableCode;

  const generateButtonText = useMemo(() => {
    if (isLoading) return 'Generating...';
    if (isPromptUnchanged) return 'Query Generated';
    if (selectedCollections.length > 0) {
      if (selectedCollections.length === 1) return `Generate Query for ${selectedCollections[0]} collection`;
      return `Generate Query across ${selectedCollections.length} collections`;
    }
    return 'Generate Query';
  }, [isLoading, selectedCollections, isPromptUnchanged]);

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
            title="Close context viewer"
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
    { id: 'demo-1', type: 'query', prompt: 'Find all users from Canada', query: "db['users'].find({'country': 'Canada'})", resultSample: mockUserFindResult.slice(0, 1) },
    { id: 'demo-2', type: 'query', prompt: 'From those users, find the ones named Alice', query: "db['users'].find({'name': 'Alice'})", resultSample: mockUserFindResult.slice(0, 1), contextSource: "'users' collection" },
  ];

  const notebookPanelDrawer = showNotebookPanel ? createPortal(
    <NotebookPanel
      steps={notebookSteps.length > 0 ? notebookSteps : (isDemoModeForNotebookPanelStep ? demoNotebookSteps : [])}
      onClose={() => setIsNotebookPanelOpen(false)}
      onExport={handleExportNotebook}
      onClear={handleClearNotebook}
      onRemoveStep={handleRemoveNotebookStep}
      onAddNote={handleAddNoteStep}
      onUpdateStep={handleUpdateNotebookStep}
      onSetEditing={handleSetEditingStep}
    />,
    document.body
  ) : null;

  const showSavedQueriesPanel = isSavedQueriesPanelOpen || isDemoModeForSavedQueriesPanelStep;
  const savedQueriesPanelDrawer = showSavedQueriesPanel ? createPortal(
    <SavedQueriesPanel
      onClose={() => setIsSavedQueriesPanelOpen(false)}
      queries={isDemoModeForSavedQueriesPanelStep ? mockSavedQueries : savedQueries}
      onLoad={handleLoadSavedQuery}
      onEdit={handleEditSavedQuery}
      onDelete={handleDeleteSavedQuery}
      onShare={handleOpenShareDialog}
      isLoading={isDemoModeForSavedQueriesPanelStep ? false : isLoadingSavedQueries}
      currentUserEmail={email || 'dev.user@example.com'}
    />,
    document.body
  ) : null;

  const saveQueryDialog = saveDialogState.isOpen ? createPortal(
    <SaveQueryDialog
      isOpen={saveDialogState.isOpen}
      onClose={() => setSaveDialogState({ isOpen: false })}
      onSave={handleSaveOrUpdateQuery}
      isSaving={isSavingQuery}
      initialData={saveDialogState.data!}
    />,
    document.body
  ) : null;

  const shareQueryDialog = shareDialogState.isOpen && shareDialogState.query ? createPortal(
    <ShareQueryDialog
      isOpen={shareDialogState.isOpen}
      onClose={() => setShareDialogState({ isOpen: false })}
      onSave={handleUpdateSharing}
      query={shareDialogState.query}
    />,
    document.body
  ) : null;

  const shortcutCheatsheet = createPortal(
    <ShortcutCheatsheet
      isOpen={isShortcutCheatsheetOpen}
      onClose={() => setIsShortcutCheatsheetOpen(false)}
    />,
    document.body
  );


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
          onShowSavedQueries={() => setIsSavedQueriesPanelOpen(true)}
          onShowShortcuts={() => setIsShortcutCheatsheetOpen(true)}
          isUserMenuForcedOpen={isUserMenuOpenForTutorial}
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
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => connectedDbInfo && connectedResource && handleLaunchExplorer(connectedDbInfo, azureAccounts.find(a => a.id === connectedResource.accountId) || azureAccounts[0])}
                      className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
                      title="Open in Data Explorer"
                    >
                      <DataGridIcon className="w-4 h-4" />
                      Explorer
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/50 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors"
                      title="Disconnect from database"
                    >
                      Disconnect
                    </button>
                  </div>
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
                    <p className="text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-2 font-medium">
                      <ServerIcon className="w-4 h-4" /> Collections
                      <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(Hold Ctrl/Cmd to select multiple)</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {dbInfoForRender.collections.map(col => (
                        <button
                          key={col.name}
                          onClick={(e) => handleCollectionClick(col.name, e)}
                          className={`text-xs font-mono px-3 py-1 rounded-full transition-all duration-200 ${selectedCollectionsForRender.includes(col.name) ? 'bg-blue-500 text-white font-bold ring-2 ring-blue-300 dark:bg-blue-600 dark:ring-blue-500' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                          title={`View details for the ${col.name} collection`}
                        >
                          {col.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Multi-Collection Analysis Panel */}
                {selectedCollectionsForRender.length > 1 && (
                  <div className="mt-6 bg-slate-50 dark:bg-slate-700/30 rounded-lg p-4 border border-slate-200 dark:border-slate-700 animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-md font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="text-blue-500">🔗</span> Schema Connections
                      </h3>
                      <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 text-xs px-2 py-1 rounded border border-blue-100 dark:border-blue-800/30 flex items-center gap-1">
                        <span>✨ AI Inferred</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 italic">
                      Note: These connections are inferred by AI based on the schema and may not reflect strict foreign key constraints.
                    </p>

                    {(isAnalyzingRelationships || !relationships) && !relationshipError && (
                      <div className="flex items-center justify-center p-6 text-slate-500 dark:text-slate-400">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
                        Searching for connections...
                      </div>
                    )}

                    {relationshipError && (
                      <div className="text-red-600 bg-red-50 border border-red-200 text-sm p-3 rounded-md dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300">
                        {relationshipError}
                      </div>
                    )}

                    {relationships && !isAnalyzingRelationships && (
                      <div className="animate-fade-in w-full flex justify-center">
                        <SchemaRelationshipGraph
                          relationships={relationships}
                          selectedCollections={selectedCollections}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Collection Action Panel (Single or Stacked) */}
                {selectedCollectionsForRender.length > 0 && (
                  <div id="tutorial-collection-panel" className="mt-4 space-y-2">
                    {/* Error Display */}
                    {collectionInfoError && (
                      <div className="text-red-600 bg-red-50 border border-red-200 text-sm p-3 rounded-md dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300">
                        {collectionInfoError}
                      </div>
                    )}

                    {selectedCollectionsForRender.map(colName => {
                      const info = collectionDetailsMapForRender[colName];
                      const isLoading = loadingCollections[colName];
                      const isExpanded = expandedCollectionSchemas[colName] || (selectedCollectionsForRender.length === 1); // Default expanded if single

                      return (
                        <div key={colName} className="bg-slate-50 dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <button
                            onClick={() => setExpandedCollectionSchemas(prev => ({ ...prev, [colName]: !prev[colName] }))}
                            className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDownIcon className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              <span className="font-bold text-slate-700 dark:text-slate-200">{colName}</span>
                              {isLoading && <SpinnerIcon className="w-4 h-4 animate-spin text-blue-500" />}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              {info && <span>{info.documentCount.toLocaleString()} docs</span>}
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                              {isLoading ? (
                                <div className="py-4 text-center text-slate-500 text-sm">Loading details...</div>
                              ) : info ? (
                                <CollectionActionPanel
                                  info={info}
                                  onClose={() => {
                                    // Deselect this collection
                                    setSelectedCollections(prev => prev.filter(c => c !== colName));
                                  }}
                                />
                              ) : (
                                <div className="py-4 text-center text-red-500 text-sm">Failed to load details.</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2"><DatabaseIcon className="w-6 h-6 text-blue-500" /> Select a Database to Connect</h2>
                {dbError && !isLoadingAccounts && !isLoadingDatabases && (
                  <p className="text-red-600 bg-red-50 border border-red-200 text-sm mt-4 p-3 rounded-md dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300">{dbError}</p>
                )}
                {isLoadingAccounts ? (
                  <div className="text-center p-8 text-slate-500 dark:text-slate-400">Loading your Azure accounts...</div>
                ) : isWaitingForAuth ? (
                  <div className="text-center p-8 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 rounded-lg mt-4 animate-pulse">
                    Waiting for authentication...
                    <br />
                    <span className="text-xs">Please complete the sign-in pop-up, or allow pop-ups if blocked.</span>
                  </div>
                ) : !dbError && azureAccounts.length === 0 ? (
                  <div className="text-center p-8 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg mt-4">
                    No accessible Cosmos DB accounts found.
                    <br />
                    <span className="text-xs">Ensure your account has Reader permissions on the resources.</span>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {azureAccounts.map(account => (
                      <div key={account.id} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border dark:border-slate-700">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleSelectAccount(account.id)}
                            disabled={isLoadingDatabases}
                            className="flex-grow text-left font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title={`Load databases for ${account.name}`}
                          >
                            <CloudIcon className="w-5 h-5 text-slate-500" />
                            {account.name}
                            {selectedAccountId === account.id && isLoadingDatabases && (
                              <SpinnerIcon className="w-4 h-4 animate-spin text-blue-500 ml-2" />
                            )}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleQuickExploreAccount(account); }}
                            disabled={quickExploringAccountId !== null}
                            className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 rounded-md transition-colors shadow-sm ml-2 ${quickExploringAccountId !== null && quickExploringAccountId !== account.id ? 'opacity-50' : ''}`}
                            title={`Quickly open Data Explorer for ${account.name} (first database)`}
                          >
                            {quickExploringAccountId === account.id ? (
                              <SpinnerIcon className="w-4 h-4 animate-spin" />
                            ) : (
                              <DataGridIcon className="w-4 h-4" />
                            )}
                            <span className="hidden sm:inline">Explorer</span>
                          </button>
                        </div>
                        {selectedAccountId === account.id && (
                          <div className="mt-3 pl-7 animate-fade-in">
                            {isLoadingDatabases ? (
                              <div className="text-sm text-slate-500 dark:text-slate-400 py-2">Loading databases...</div>
                            ) : dbError ? (
                              <div className="text-red-600 bg-red-50 border border-red-200 text-sm mt-2 p-3 rounded-md dark:bg-red-900/30 dark:border-red-500/50 dark:text-red-300">
                                {dbError}
                              </div>
                            ) : accountDatabases.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {accountDatabases.map(db => (
                                  <button
                                    key={db.name}
                                    type="button"
                                    onClick={() => handleConnectDatabase(db)}
                                    disabled={isConnectingToDb !== null}
                                    className={`px-4 py-2 border border-blue-600 dark:border-blue-500 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-800 focus:ring-blue-500 transition-colors flex items-center gap-2 ${isConnectingToDb !== null && isConnectingToDb !== db.name ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    title={`Connect to the ${db.name} database`}
                                  >
                                    {isConnectingToDb === db.name ? (
                                      <>
                                        <SpinnerIcon className="w-4 h-4 animate-spin" />
                                        Connecting...
                                      </>
                                    ) : (
                                      db.name
                                    )}
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
                      <button onClick={() => setIsContextViewerOpen(true)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold mt-1" title="View the full data being used as context">View Data</button>
                    </div>
                  </div>
                  <button onClick={() => setIntermediateContext(null)} className="p-1.5 rounded-full text-blue-600 dark:text-blue-400 hover:bg-blue-200/50 dark:hover:bg-blue-900/40" title="Remove the active query context">
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
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
                    e.preventDefault();
                    if (!isLoading && userInput.trim() && !isQuerySectionDisabled && !isPromptUnchanged) {
                      handleGenerateQueryClick();
                    }
                  }
                }}
                placeholder={isQuerySectionDisabled ? "Connect to a database to begin..." : (selectedCollections.length > 0 ? `Querying ${selectedCollections.length > 1 ? `${selectedCollections.length} collections` : `'${selectedCollections[0]}'`}... e.g., 'Find all users from Canada'` : "e.g., 'Find all users from Canada and sort them by name'")}
                className="w-full h-28 p-4 bg-slate-50 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 placeholder-slate-400 dark:placeholder-slate-500 resize-none"
                disabled={isLoading || isQuerySectionDisabled}
              />
              <button
                onClick={handleGenerateQueryClick}
                disabled={isLoading || !userInput.trim() || isQuerySectionDisabled || isPromptUnchanged}
                className="w-full flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.99]"
                title={isPromptUnchanged ? "The current query matches the prompt. Modify the prompt to generate a new query." : "Generate MongoDB code from your natural language command (⌘ + G)"}
              >
                {generateButtonText}
              </button>
            </div>

            <div id="tutorial-results-area" className="mt-8">
              <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 ${isQuerySectionDisabled ? 'hidden' : ''}`}>
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

              {isLoading && !isDemoModeForDebugStep && !isDemoModeForResultsStep && !isDemoModeForRunStep && <Loader message="Generating query..." />}

              {error && !isDemoModeForDebugStep && !isDemoModeForResultsStep && !isDemoModeForRunStep && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg animate-fade-in dark:bg-red-900/50 dark:border-red-500/50 dark:text-red-300" role="alert">
                  <strong className="font-bold">Error: </strong>
                  <span className="block sm:inline">{error}</span>
                </div>
              )}

              {/* Tutorial Demo for Run, Edit & Save Steps */}
              {(isDemoModeForRunStep || isDemoModeForSaveStep) && (
                <div className="space-y-8 animate-fade-in">
                  <QueryDisplay
                    code={mockFindUsersQuery.generated_code}
                    onCodeChange={() => { }}
                    onRunQuery={() => { }}
                    onSaveQuery={() => { }}
                    isExecuting={false}
                    historyCount={1}
                    historyIndex={0}
                    onNavigateHistory={() => { }}
                  />
                </div>
              )}

              {/* Tutorial Demo for Results View */}
              {(isDemoModeForResultsStep || isDemoModeForContextActiveStep) && (
                <div className="space-y-8 animate-fade-in">
                  <QueryDisplay
                    code={mockFindUsersQuery.generated_code}
                    onCodeChange={() => { }}
                    onRunQuery={() => { }}
                    onSaveQuery={() => { }}
                    isExecuting={false}
                    historyCount={1}
                    historyIndex={0}
                    onNavigateHistory={() => { }}
                  />
                  <QueryResult
                    isExecuting={false}
                    executionError={null}
                    executionResult={mockUserFindResult}
                    onDebug={() => { }}
                    isDebugging={false}
                    debuggingResult={null}
                    debugError={null}
                    sourceCollection={'users'}
                    onSetIntermediateContext={() => { }}
                    intermediateContext={null}
                    onAnalyze={() => { }}
                    isAnalyzing={false}
                    analysisResult={null}
                    analysisError={null}
                    onEvaluateWrite={() => { }}
                    isEvaluatingWrite={false}
                    writeEvaluationResult={null}
                    writeEvaluationError={null}
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
                    onCodeChange={() => { }}
                    onRunQuery={() => { }}
                    onSaveQuery={() => { }}
                    isExecuting={false}
                    historyCount={1}
                    historyIndex={0}
                    onNavigateHistory={() => { }}
                  />
                  <QueryResult
                    isExecuting={false}
                    executionError={"MongoDB query error: unknown operator: $sor (MongoServerError)"}
                    executionResult={null}
                    onDebug={() => { }}
                    isDebugging={false}
                    debuggingResult={null}
                    debugError={null}
                    sourceCollection={'users'}
                    onSetIntermediateContext={() => { }}
                    intermediateContext={null}
                    onAnalyze={() => { }}
                    isAnalyzing={false}
                    analysisResult={null}
                    analysisError={null}
                    onEvaluateWrite={() => { }}
                    isEvaluatingWrite={false}
                    writeEvaluationResult={null}
                    writeEvaluationError={null}
                    isTutorialActive={isTutorialActive}
                    tutorialStepIndex={tutorialStepIndex}
                  />
                </div>
              )}

              {/* Real results */}
              {(!isLoading && !error && !isDemoModeForResultsStep && !isDemoModeForDebugStep && !isDemoModeForContextActiveStep && !isDemoModeForRunStep && !isDemoModeForSaveStep) && (
                <div className="space-y-8">
                  {editableCode ? (
                    <>
                      <QueryDisplay
                        code={editableCode}
                        onCodeChange={setEditableCode}
                        onRunQuery={handleRunQuery}
                        onSaveQuery={handleOpenSaveDialog}
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
                        onEvaluateWrite={handleEvaluateWrite}
                        isEvaluatingWrite={isEvaluatingWrite}
                        writeEvaluationResult={writeEvaluationResult}
                        writeEvaluationError={writeEvaluationError}
                      />
                    </>
                  ) : (
                    <div className="text-center text-slate-500 dark:text-slate-400 py-10 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                      <p>{isQuerySectionDisabled ? 'Connect to a database to generate queries.' : 'Your generated query will appear here.'}</p>
                    </div>
                  )}
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
      {savedQueriesPanelDrawer}
      {saveQueryDialog}
      {shareQueryDialog}
      {shortcutCheatsheet}

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