import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { parseQueryForHandover } from '../utils/queryHandover';
import { generateMongoQuery, debugMongoQuery, analyzeQueryResult, inferSchemaRelationships, evaluateWriteResult, getAvailableModels } from '../services/geminiService';
import { getAzureCosmosAccounts, getDatabasesForAccount, runMongoQuery, getCollectionInfo, clearSystemCache } from '../services/dbService';
import { getSavedQueries, saveQuery, updateSavedQuery, deleteSavedQuery } from '../services/userDataService';
import { generateIpynbContent, downloadFile } from '../services/notebookService';
import { QueryResultData, DbInfo, CollectionInfo, CosmosDBAccount, SelectedResource, DebuggingResult, AnalysisResult, NotebookStep, SavedQuery, SchemaRelationshipsResponse, CollectionSummary } from '../types';
import { mockECommerceDbInfo, mockCollectionInfoMap, mockFindUsersQuery, mockUserFindResult, mockSavedQueries } from '../services/mockData';
import { getAuthErrorMessage, isAuthenticationExpiredError } from '../utils/authErrorHandler';
import QueryDisplay from '../components/QueryDisplay';
import { useRoles } from '../hooks/useRoles';
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
      <div className="qa-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 500 }}>Note</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {step.isEditing ? (
              <button onClick={handleSave} className="qa-btn" style={{ fontSize: 11, padding: '3px 8px' }}>
                <CheckIcon className="w-3 h-3" style={{ width: 12, height: 12 }} /> Save
              </button>
            ) : (
              <button onClick={() => onSetEditing(step.id, true)} className="qa-btn" style={{ fontSize: 11, padding: '3px 8px' }}>
                <EditIcon className="w-3 h-3" style={{ width: 12, height: 12 }} /> Edit
              </button>
            )}
            <button
              onClick={() => onRemove(step.id)}
              aria-label="Remove note"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4,
                color: 'var(--muted)', display: 'flex',
              }}
            >
              <TrashIcon className="w-4 h-4" style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>
        {step.isEditing ? (
          <textarea
            value={step.prompt}
            onChange={(e) => onUpdate(step.id, e.target.value)}
            style={{
              width: '100%', height: 96, padding: '8px 10px', background: 'var(--soft)',
              color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: 6,
              fontFamily: 'var(--font-body)', fontSize: 12.5, resize: 'vertical', outline: 'none',
              boxSizing: 'border-box',
            }}
            placeholder="Enter your note here... (Markdown is supported on export)"
            autoFocus
          />
        ) : (
          <div style={{
            fontSize: 12.5, color: 'var(--fg)', whiteSpace: 'pre-wrap', lineHeight: 1.55,
            padding: '6px 8px', background: 'var(--soft)', borderRadius: 5, minHeight: 48,
          }}>
            {step.prompt || <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Empty note</span>}
          </div>
        )}
      </div>
    );
  }

  // Render Query Step
  return (
    <div className="qa-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', fontWeight: 500 }}>
          Step {index + 1}
        </span>
        <button
          onClick={() => onRemove(step.id)}
          aria-label="Remove step"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4,
            color: 'var(--muted)', display: 'flex',
          }}
        >
          <TrashIcon className="w-4 h-4" style={{ width: 14, height: 14 }} />
        </button>
      </div>
      {step.contextSource && (
        <div style={{
          fontSize: 11, color: 'var(--accent)', background: 'var(--accent-soft)',
          padding: '4px 8px', borderRadius: 5,
        }}>
          Context: output from <em>{step.contextSource}</em>
        </div>
      )}
      <blockquote style={{
        borderLeft: '2px solid var(--accent)', paddingLeft: 10, margin: 0,
        fontSize: 12.5, fontStyle: 'italic', color: 'var(--muted)', lineHeight: 1.5,
      }}>
        {step.prompt}
      </blockquote>
      <div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 5 }}>Query</div>
        <pre style={{
          margin: 0, padding: '8px 10px', background: '#0f0e0d', color: '#c8c4bc',
          fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.6, borderRadius: 6,
          overflowX: 'auto',
        }}>
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
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }}
      aria-hidden="true"
    />
    <aside
      id="tutorial-notebook-panel"
      className="qp-drawer"
      style={{
        position: 'fixed', top: 0, right: 0, height: '100%', width: 440,
        maxWidth: '100vw', background: 'var(--panel)', borderLeft: '1px solid var(--border)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.4">
          <rect x="2" y="1" width="12" height="14" rx="2"/>
          <path d="M5 5h6M5 8h6M5 11h4"/>
        </svg>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--fg)' }}>Query Notebook</span>
        <button
          onClick={onClose}
          aria-label="Close notebook panel"
          style={{
            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 5,
          }}
        >
          <XIcon className="w-5 h-5" style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <button onClick={onAddNote} className="qa-btn" style={{ fontSize: 12 }}>
          <PlusCircleIcon className="w-4 h-4" style={{ width: 14, height: 14 }} />
          Add note
        </button>
        <button onClick={onClear} disabled={steps.length === 0} className="qa-btn" style={{ fontSize: 12, opacity: steps.length === 0 ? 0.4 : 1 }}>
          <TrashIcon className="w-4 h-4" style={{ width: 14, height: 14 }} />
          Clear all
        </button>
        <button
          onClick={onExport}
          disabled={steps.length === 0}
          className="qa-btn primary"
          style={{ fontSize: 12, marginLeft: 'auto', opacity: steps.length === 0 ? 0.4 : 1 }}
        >
          <DownloadIcon className="w-4 h-4" style={{ width: 14, height: 14 }} />
          Export .ipynb
        </button>
      </div>

      {/* Steps */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 6, color: 'var(--muted)',
          }}>
            <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4">
              <rect x="2" y="1" width="12" height="14" rx="2"/>
              <path d="M5 5h6M5 8h6M5 11h4"/>
            </svg>
            <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>No steps yet</p>
            <p style={{ fontSize: 12, margin: 0 }}>Run a query or add a note to begin.</p>
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
  onConnectionChange?: (accountId: string | null, databaseName: string | null, accountName?: string | null, collections?: CollectionSummary[], availableAccounts?: CosmosDBAccount[], availableDbs?: DbInfo[]) => void;
  embedded?: boolean;
  preselectedAccountId?: string;
  /** Sidebar click trigger. The token must change on every click so the page
   *  re-applies the selection even when the same name is clicked twice. */
  sidebarCollectionClick?: { name: string; modifier: boolean; token: number } | null;
  /** Notify the wrapper of the full current selection so it can highlight every
   *  selected collection in the sidebar (multi-select aware). */
  onSelectedCollectionsChange?: (collectionNames: string[]) => void;
}

// --- Main Page Component ---
const QueryGeneratorPage: React.FC<QueryGeneratorPageProps> = ({ name, email, onLogout, onNavigateToExplorer, onConnectionChange, embedded = false, preselectedAccountId, sidebarCollectionClick, onSelectedCollectionsChange }) => {
  const navigate = useNavigate();
  const { can } = useRoles();

  const [userInput, setUserInput] = useState<string>(() => {
    try {
      const ws = JSON.parse(sessionStorage.getItem('qp_workspace') ?? 'null');
      const conn = JSON.parse(sessionStorage.getItem('qp_connection') ?? 'null');
      if (ws && conn && ws.accountId === conn.accountId && ws.databaseName === conn.databaseName) return ws.userInput ?? '';
    } catch { /* ignore */ }
    return '';
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Restore previous connection from sessionStorage (when navigating away and back, not from Hub)
  const [initialConnection] = useState<{ accountId: string; databaseName: string } | null>(() => {
    if (preselectedAccountId) return null;
    try {
      const saved = sessionStorage.getItem('qp_connection');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

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
  const [_queryResult, setQueryResult] = useState<QueryResultData | null>(() => {
    try {
      const ws = JSON.parse(sessionStorage.getItem('qp_workspace') ?? 'null');
      const conn = JSON.parse(sessionStorage.getItem('qp_connection') ?? 'null');
      if (ws && conn && ws.accountId === conn.accountId && ws.databaseName === conn.databaseName) return ws.queryResult ?? null;
    } catch { /* ignore */ }
    return null;
  });
  const [querySourceCollection, setQuerySourceCollection] = useState<string | null>(() => {
    try {
      const ws = JSON.parse(sessionStorage.getItem('qp_workspace') ?? 'null');
      const conn = JSON.parse(sessionStorage.getItem('qp_connection') ?? 'null');
      if (ws && conn && ws.accountId === conn.accountId && ws.databaseName === conn.databaseName) return ws.querySourceCollection ?? null;
    } catch { /* ignore */ }
    return null;
  });
  const [editableCode, setEditableCode] = useState<string>(() => {
    try {
      const ws = JSON.parse(sessionStorage.getItem('qp_workspace') ?? 'null');
      const conn = JSON.parse(sessionStorage.getItem('qp_connection') ?? 'null');
      if (ws && conn && ws.accountId === conn.accountId && ws.databaseName === conn.databaseName) return ws.editableCode ?? '';
    } catch { /* ignore */ }
    return '';
  });
  const [codeHistory, setCodeHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [lastSuccessfulPrompt, setLastSuccessfulPrompt] = useState<string>('');

  // State for query execution
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<any | null>(() => {
    try {
      const ws = JSON.parse(sessionStorage.getItem('qp_workspace') ?? 'null');
      const conn = JSON.parse(sessionStorage.getItem('qp_connection') ?? 'null');
      if (ws && conn && ws.accountId === conn.accountId && ws.databaseName === conn.databaseName) return ws.executionResult ?? null;
    } catch { /* ignore */ }
    return null;
  });
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
  const [writeEvaluationResult, setWriteEvaluationResult] = useState<{ evaluation: string } | null>(null);
  const [writeEvaluationError, setWriteEvaluationError] = useState<string | null>(null);

  // Agent configuration
  const [maxIterations, setMaxIterations] = useState<number>(3);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('qp_selected_model') ?? 'gemini-2.5-flash'
  );
  const [availableModels, setAvailableModels] = useState<string[]>(['gemini-2.5-flash']);

  // State for collection details
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  const [collectionDetailsMap, setCollectionDetailsMap] = useState<Record<string, CollectionInfo>>({});
  const [loadingCollections, setLoadingCollections] = useState<Record<string, boolean>>({});
  const [expandedCollectionSchemas, setExpandedCollectionSchemas] = useState<Record<string, boolean>>({}); // Track open/close state for stacking
  const [collectionInfoError, _setCollectionInfoError] = useState<string | null>(null);

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

  // Open saved queries panel from sidebar URL param
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('panel') === 'saved') {
      setIsSavedQueriesPanelOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [saveDialogState, setSaveDialogState] = useState<{ isOpen: boolean; data?: Partial<SavedQuery> & { prompt: string; code: string } }>({ isOpen: false });
  const [shareDialogState, setShareDialogState] = useState<{ isOpen: boolean; query?: SavedQuery }>({ isOpen: false });
  const [isSavingQuery, setIsSavingQuery] = useState(false);

  // State for Keyboard Shortcuts
  const [isShortcutCheatsheetOpen, setIsShortcutCheatsheetOpen] = useState(false);

  // State for DB switcher dropdown (embedded workspace)
  const [isDbSwitcherOpen, setIsDbSwitcherOpen] = useState(false);


  const connectedAccountName = useMemo(() => {
    if (!connectedResource) return '';
    return azureAccounts.find(acc => acc.id === connectedResource.accountId)?.name ?? 'Unknown Account';
  }, [connectedResource, azureAccounts]);

  // Query handover — detect transferable find() queries for "Open in Explorer"
  const handover = useMemo(
    () => editableCode && !_queryResult?.is_write_action ? parseQueryForHandover(editableCode) : null,
    [editableCode, _queryResult]
  );

  const handleOpenInExplorer = useCallback(() => {
    if (!handover || !connectedResource || !connectedDbInfo) return;
    navigate(
      `/data-explorer/${encodeURIComponent(connectedResource.accountId)}/${encodeURIComponent(connectedResource.databaseName)}`,
      {
        state: {
          dbInfo: connectedDbInfo,
          accountName: connectedAccountName,
          availableDbs: accountDatabases,
          availableAccounts: azureAccounts,
          initialCollection: handover.collection,
          initialFilters: handover.filters,
        },
      }
    );
  }, [handover, connectedResource, connectedDbInfo, connectedAccountName, accountDatabases, azureAccounts, navigate]);

  // Persist workspace state so it survives sidebar tab switches
  useEffect(() => {
    if (!connectedResource) return;
    try {
      const payload: Record<string, unknown> = {
        accountId: connectedResource.accountId,
        databaseName: connectedResource.databaseName,
        userInput,
        editableCode,
        querySourceCollection,
        queryResult: _queryResult,
      };
      // Only persist executionResult if it's under 1 MB to avoid quota errors
      if (executionResult !== null) {
        const resultStr = JSON.stringify(executionResult);
        if (resultStr.length < 1_000_000) payload.executionResult = executionResult;
      }
      sessionStorage.setItem('qp_workspace', JSON.stringify(payload));
    } catch { /* ignore */ }
  }, [userInput, editableCode, querySourceCollection, connectedResource, _queryResult, executionResult]);

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
    getAvailableModels().then(models => {
      if (models.length > 0) setAvailableModels(models);
    });
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
    sessionStorage.removeItem('qp_workspace');
  }, []);

  const handleDisconnect = useCallback(() => {
    setConnectedDbInfo(null);
    setConnectedResource(null);
    sessionStorage.removeItem('qp_connection');
    onConnectionChange?.(null, null, null, undefined);
    clearQueryState();
    setUserInput('');
    setSelectedCollections([]);
    setCollectionDetailsMap({});
  }, [clearQueryState, onConnectionChange]);

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

    // If a database from a different account is connected, disconnect it first
    if (connectedResource && connectedResource.accountId !== account.id) {
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

  const handleConnectDatabase = useCallback(async (dbInfo: DbInfo, preserveWorkspace = false) => {
    const account = azureAccounts.find(acc => acc.id === selectedAccountId);
    if (!account) return;

    setIsConnectingToDb(dbInfo.name);

    setConnectedResource({
      accountId: account.id,
      databaseName: dbInfo.name,
    });
    setConnectedDbInfo(dbInfo);
    sessionStorage.setItem('qp_connection', JSON.stringify({ accountId: account.id, databaseName: dbInfo.name, accountName: account.name, collections: dbInfo.collections, availableAccounts: azureAccounts, availableDbs: accountDatabases }));
    onConnectionChange?.(account.id, dbInfo.name, account.name, dbInfo.collections, azureAccounts, accountDatabases);
    if (!preserveWorkspace) clearQueryState();
    setIsConnectingToDb(null);
  }, [selectedAccountId, azureAccounts, clearQueryState, onConnectionChange]);

  // Auto-select account from Hub navigation, restored session, or chip-based account switch
  useEffect(() => {
    const targetAccountId = preselectedAccountId ?? initialConnection?.accountId;
    if (!targetAccountId || azureAccounts.length === 0) return;
    const switchingToDifferentAccount =
      preselectedAccountId &&
      connectedResource &&
      connectedResource.accountId !== preselectedAccountId &&
      !isLoadingDatabases &&
      !isConnectingToDb;
    if ((!connectedResource && !selectedAccountId) || switchingToDifferentAccount) {
      handleSelectAccount(targetAccountId);
    }
  }, [preselectedAccountId, initialConnection, azureAccounts, connectedResource, selectedAccountId, isLoadingDatabases, isConnectingToDb, handleSelectAccount]);

  // Auto-connect database after account is selected
  useEffect(() => {
    const targetAccountId = preselectedAccountId ?? initialConnection?.accountId;
    const targetDatabaseName = initialConnection?.databaseName;
    if (
      targetAccountId &&
      selectedAccountId === targetAccountId &&
      accountDatabases.length > 0 &&
      !connectedResource &&
      !isLoadingDatabases &&
      !isConnectingToDb
    ) {
      if (targetDatabaseName) {
        const db = accountDatabases.find(d => d.name === targetDatabaseName) ?? accountDatabases[0];
        handleConnectDatabase(db, true);
      } else if (accountDatabases.length === 1) {
        handleConnectDatabase(accountDatabases[0], true);
      }
    }
  }, [preselectedAccountId, initialConnection, selectedAccountId, accountDatabases, connectedResource, isLoadingDatabases, isConnectingToDb, handleConnectDatabase]);

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
        selectedCollectionInfos,
        maxIterations,
        selectedModel
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
  }, [connectedDbInfo, codeHistory, historyIndex, intermediateContext, connectedResource, selectedAccountId, selectedCollections, collectionDetailsMap, selectedModel]);

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

  const executeCode = useCallback(async (code: string) => {
    if (!code.trim() || !connectedDbInfo || !connectedResource) {
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
      const result = await runMongoQuery(connectedResource.accountId, code, connectedResource);
      setExecutionResult(result);

      // --- Add step to notebook ---
      const resultSample = Array.isArray(result) ? result.slice(0, 5) : result;
      const newStep: NotebookStep = {
        id: new Date().toISOString() + Math.random(),
        type: 'query',
        prompt: lastSuccessfulPrompt || 'Query executed without a new prompt.',
        query: code,
        resultSample: resultSample,
        contextSource: currentQueryContextSource ?? undefined,
      };
      setNotebookSteps(prev => [...prev, newStep]);
      setCurrentQueryContextSource(null);

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
  }, [connectedDbInfo, connectedResource, lastSuccessfulPrompt, currentQueryContextSource]);

  const handleRunQuery = useCallback(() => executeCode(editableCode), [executeCode, editableCode]);

  const handleDebugQuery = useCallback(async () => {
    if (!editableCode || !executionError) return;

    setIsDebugging(true);
    setDebugError(null);
    setDebuggingResult(null);

    try {
      const result = await debugMongoQuery(editableCode, executionError, selectedModel);
      setDebuggingResult(result);
    } catch (e) {
      if (e instanceof Error) setDebugError(e.message);
      else setDebugError("An unexpected error occurred while debugging.");
    } finally {
      setIsDebugging(false);
    }
  }, [editableCode, executionError, selectedModel]);

  const handleAnalyzeQuery = useCallback(async (dataToAnalyze: any) => {
    if (!dataToAnalyze) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const result = await analyzeQueryResult(dataToAnalyze, selectedModel);
      setAnalysisResult(result);
    } catch (e) {
      if (e instanceof Error) setAnalysisError(e.message);
      else setAnalysisError("An unexpected error occurred during AI analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedModel]);

  const handleEvaluateWrite = useCallback(async () => {
    if (!editableCode || !executionResult || !lastSuccessfulPrompt || !selectedAccountId || !connectedDbInfo) return;

    setIsEvaluatingWrite(true);
    setWriteEvaluationError(null);
    setWriteEvaluationResult(null);

    try {
      const result = await evaluateWriteResult(lastSuccessfulPrompt, editableCode, executionResult, selectedAccountId, connectedDbInfo.name, selectedModel);
      setWriteEvaluationResult(result);
    } catch (e) {
      if (e instanceof Error) setWriteEvaluationError(e.message);
      else setWriteEvaluationError("An unexpected error occurred during write evaluation.");
    } finally {
      setIsEvaluatingWrite(false);
    }
  }, [lastSuccessfulPrompt, editableCode, executionResult, selectedAccountId, connectedDbInfo, selectedModel]);


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

  // Sidebar-driven collection selection — mirrors the middle-panel buttons,
  // including Cmd/Ctrl+click multi-select. Driven by a token so re-clicking the
  // same collection (toggle off) still triggers the effect.
  const lastSidebarToken = useRef<number | null>(null);
  useEffect(() => {
    if (!sidebarCollectionClick) return;
    if (lastSidebarToken.current === sidebarCollectionClick.token) return;
    lastSidebarToken.current = sidebarCollectionClick.token;
    if (!connectedResource) return;
    const fakeEvent = {
      ctrlKey: sidebarCollectionClick.modifier,
      metaKey: sidebarCollectionClick.modifier,
    } as React.MouseEvent;
    handleCollectionClick(sidebarCollectionClick.name, fakeEvent);
  }, [sidebarCollectionClick, connectedResource, handleCollectionClick]);

  // Report the full selection back so the sidebar can highlight every selected
  // collection when picks come from the middle panel.
  useEffect(() => {
    onSelectedCollectionsChange?.(selectedCollections);
  }, [selectedCollections, onSelectedCollectionsChange]);

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
        selectedCollections,
        selectedModel
      );
      setRelationships(result);
    } catch (e: any) {
      setRelationshipError(e.message || "Failed to analyze relationships.");
    } finally {
      setIsAnalyzingRelationships(false);
    }
  }, [connectedResource, selectedCollections, selectedModel]);

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
    clearQueryState();
    setUserInput(query.prompt);
    setLastSuccessfulPrompt(query.prompt);
    setEditableCode(query.code);
    setCodeHistory([query.code]);
    setHistoryIndex(0);
    setIsSavedQueriesPanelOpen(false);
  };

  const handleLoadAndRunSavedQuery = (query: SavedQuery) => {
    clearQueryState();
    setUserInput(query.prompt);
    setLastSuccessfulPrompt(query.prompt);
    setEditableCode(query.code);
    setCodeHistory([query.code]);
    setHistoryIndex(0);
    setIsSavedQueriesPanelOpen(false);
    executeCode(query.code);
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
  const dbReady = !isLoadingAccounts && !isLoadingDatabases && !isConnectingToDb && !!connectedResource;
  const savedQueriesPanelDrawer = showSavedQueriesPanel ? createPortal(
    <SavedQueriesPanel
      onClose={() => setIsSavedQueriesPanelOpen(false)}
      queries={isDemoModeForSavedQueriesPanelStep ? mockSavedQueries : savedQueries}
      onLoad={handleLoadSavedQuery}
      onLoadAndRun={handleLoadAndRunSavedQuery}
      onEdit={handleEditSavedQuery}
      onDelete={handleDeleteSavedQuery}
      onShare={handleOpenShareDialog}
      isLoading={isDemoModeForSavedQueriesPanelStep ? false : isLoadingSavedQueries}
      dbReady={isDemoModeForSavedQueriesPanelStep ? true : dbReady}
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


  const innerContent = (
    <>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {!embedded && (
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
        )}

        <main className="space-y-8">
          {/* Connection Manager */}
          <div id="tutorial-account-section" style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, marginBottom: 16 }}>
            {isConnectedForRender && dbInfoForRender ? (
              <div className="animate-fade-in">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--fg)' }}>Database Information</h2>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      Connected to: {accountNameForRender} / <span className="font-bold">{dbInfoForRender.name}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => connectedDbInfo && connectedResource && handleLaunchExplorer(connectedDbInfo, azureAccounts.find(a => a.id === connectedResource.accountId) || azureAccounts[0])}
                      className="qa-btn"
                      title="Open in Data Explorer"
                    >
                      <DataGridIcon className="w-4 h-4" />
                      Explorer
                    </button>
                    <button
                      onClick={handleDisconnect}
                      style={{ padding: '5px 10px', border: '1px solid color-mix(in oklch, var(--status-err) 30%, var(--border))', borderRadius: 'var(--radius-sm)', background: 'none', color: 'var(--status-err)', fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                      title="Disconnect from database"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div style={{ background: 'var(--soft)', padding: 12, borderRadius: 8 }}>
                    <p style={{ color: 'var(--muted)', fontSize: 12 }}>Total Documents</p>
                    <p style={{ color: 'var(--fg)', fontWeight: 600, fontSize: 18 }}>{dbInfoForRender.totalDocuments.toLocaleString()}</p>
                  </div>
                  <div style={{ background: 'var(--soft)', padding: 12, borderRadius: 8 }}>
                    <p style={{ color: 'var(--muted)', fontSize: 12 }}>Database Size</p>
                    <p style={{ color: 'var(--fg)', fontWeight: 600, fontSize: 18 }}>{dbInfoForRender.size ?? 'N/A'}</p>
                  </div>
                  <div style={{ background: 'var(--soft)', padding: 12, borderRadius: 8 }} className="col-span-1 md:col-span-3">
                    <p style={{ color: 'var(--fg)', fontSize: 13, fontWeight: 500 }} className="mb-2 flex items-center gap-2">
                      <ServerIcon className="w-4 h-4" /> Collections
                      <span className="text-xs font-normal text-slate-400 dark:text-slate-500">(Hold Ctrl/Cmd to select multiple)</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {dbInfoForRender.collections.map(col => (
                        <button
                          key={col.name}
                          onClick={(e) => handleCollectionClick(col.name, e)}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 11,
                            padding: '3px 10px',
                            borderRadius: 99,
                            border: selectedCollectionsForRender.includes(col.name) ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                            background: selectedCollectionsForRender.includes(col.name) ? 'var(--accent)' : 'var(--soft)',
                            color: selectedCollectionsForRender.includes(col.name) ? '#fff' : 'var(--fg)',
                            cursor: 'pointer',
                            transition: 'all 0.1s',
                          }}
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
                  <div style={{ marginTop: 20, background: 'var(--soft)', borderRadius: 'var(--radius-md)', padding: 16, border: '1px solid var(--border)' }} className="animate-fade-in">
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
                        <div key={colName} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                          <button
                            onClick={() => setExpandedCollectionSchemas(prev => ({ ...prev, [colName]: !prev[colName] }))}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg)', fontFamily: 'var(--font-body)' }}
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
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}><DatabaseIcon className="w-6 h-6 text-blue-500" /> Select a Database to Connect</h2>
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
                      <div key={account.id} style={{ background: 'var(--soft)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleSelectAccount(account.id)}
                            disabled={isLoadingDatabases}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, fontSize: 14, color: 'var(--fg)', flex: 1, textAlign: 'left' }}
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
                            className="qa-btn"
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
                                    className="qa-btn primary"
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
          <div id="tutorial-prompt-section" style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, opacity: isQuerySectionDisabled ? 0.4 : 1, pointerEvents: isQuerySectionDisabled ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
            {showContextBanner && contextForRender && (
              <div id="tutorial-context-banner" style={{ position: 'relative', background: 'var(--accent-soft)', border: '1px solid color-mix(in oklch, var(--accent) 25%, var(--border))', borderRadius: 'var(--radius-md)', padding: 16, marginBottom: 24 }} className="animate-fade-in">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <PinIcon className="w-6 h-6 text-blue-500 flex-shrink-0" />
                    <div>
                      <h4 style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--accent)' }}>Query Context Active</h4>
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
              <label htmlFor="userInput" style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>
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
                style={{ width: '100%', height: 112, padding: 14, background: 'var(--soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 14, fontFamily: 'var(--font-body)', color: 'var(--fg)', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                disabled={isLoading || isQuerySectionDisabled}
              />
              {/* Agent iterations control */}
              <div className="flex items-center justify-between gap-3 py-2">
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="max-iterations-slider"
                    style={{ fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}
                  >
                    Agent Iterations: <span className="text-blue-600 dark:text-blue-400 font-semibold">{maxIterations}</span>
                  </label>
                  <div className="relative group">
                    <button
                      type="button"
                      className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs flex items-center justify-center cursor-help hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                      aria-label="Info: Agent iterations"
                    >
                      ?
                    </button>
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 px-3 py-2 bg-slate-800 text-slate-100 text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      More iterations allow the agent to self-correct by re-generating and re-testing the query when it detects an error. Higher values can improve accuracy for complex queries but take longer. Max: 10.
                      <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800"></div>
                    </div>
                  </div>
                </div>
                <input
                  id="max-iterations-slider"
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={maxIterations}
                  onChange={(e) => setMaxIterations(Number(e.target.value))}
                  disabled={isLoading || isQuerySectionDisabled}
                  className="w-32 accent-blue-600 disabled:opacity-40 cursor-pointer"
                  aria-label={`Agent iterations: ${maxIterations}`}
                />
              </div>
              {/* Model selector */}
              <div className="flex items-center justify-between gap-3 py-1">
                <label htmlFor="model-select" style={{ fontSize: 12.5, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  Model:
                </label>
                <select
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => { setSelectedModel(e.target.value); localStorage.setItem('qp_selected_model', e.target.value); }}
                  disabled={isLoading || isQuerySectionDisabled}
                  style={{
                    fontSize: 12.5,
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                    background: 'var(--soft)',
                    color: 'var(--fg)',
                    cursor: 'pointer',
                    maxWidth: 240,
                  }}
                  aria-label="Select AI model"
                >
                  {availableModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleGenerateQueryClick}
                disabled={isLoading || !userInput.trim() || isQuerySectionDisabled || isPromptUnchanged}
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px 24px', border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500, cursor: 'pointer', background: 'var(--accent)', color: '#fff', opacity: (isLoading || !userInput.trim() || isQuerySectionDisabled || isPromptUnchanged) ? 0.45 : 1, transition: 'opacity 0.15s' }}
                title={isPromptUnchanged ? "The current query matches the prompt. Modify the prompt to generate a new query." : "Generate MongoDB code from your natural language command (⌘ + G)"}
              >
                {generateButtonText}
              </button>
            </div>

            <div id="tutorial-results-area" className="mt-8">
              <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 ${isQuerySectionDisabled ? 'hidden' : ''}`}>
                <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 15, color: 'var(--fg)' }}>
                  Query Output
                </h3>
                <button
                  id="tutorial-notebook-button"
                  onClick={() => setIsNotebookPanelOpen(true)}
                  className="qa-btn"
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

        <footer style={{ textAlign: 'center', marginTop: 32, color: 'var(--muted)', fontSize: 12 }}>
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
    </>
  );

  // Portals and animations shared by all embedded layouts
  const sharedTail = (
    <>
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
        @keyframes fade-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        @keyframes fade-in-fast { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in-fast { animation: fade-in-fast 0.3s ease-out forwards; }
        @keyframes slide-in-drawer { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in-drawer { animation: slide-in-drawer 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </>
  );

  if (!embedded) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans p-4 sm:p-6 lg:p-8">
        {innerContent}
      </div>
    );
  }

  // ── Embedded: not yet connected ───────────────────────────────────────
  if (!isConnectedForRender) {
    return (
      <>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24, fontFamily: 'var(--font-body)', color: 'var(--fg)', padding: '40px 32px' }}>
          {(isLoadingAccounts || isLoadingDatabases || isConnectingToDb) ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 13 }}>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              {isConnectingToDb ? `Connecting to ${isConnectingToDb}…` : isLoadingDatabases ? 'Loading databases…' : 'Loading accounts…'}
            </div>
          ) : dbError ? (
            <div style={{ color: 'var(--status-err)', fontSize: 13, textAlign: 'center', maxWidth: 400 }}>{dbError}</div>
          ) : accountDatabases.length > 0 ? (
            <>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, textAlign: 'center', marginBottom: 6 }}>Select a database</div>
                <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center' }}>Choose which database to query</div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {accountDatabases.map(db => (
                  <button
                    key={db.name}
                    onClick={() => handleConnectDatabase(db)}
                    disabled={isConnectingToDb !== null}
                    className="qa-btn primary"
                    style={{ fontSize: 14, padding: '8px 20px', height: 'auto' }}
                  >
                    {db.name}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, textAlign: 'center' }}>No database selected</div>
              <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', maxWidth: 320 }}>
                Go back to Hub and click a connection to start querying.
              </div>
            </>
          )}
        </div>
        {sharedTail}
      </>
    );
  }

  // ── Embedded: connected — 2-column workspace layout ──────────────────
  const insightsRail = (
    <aside style={{
      width: 300, flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      overflow: 'auto',
      padding: '16px 14px',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M8 2l1.6 4.4L14 8l-4.4 1.6L8 14l-1.6-4.4L2 8l4.4-1.6z"/>
        </svg>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500 }}>Insights</span>
        <span className="qa-chip" style={{ marginLeft: 'auto', fontSize: 10 }}>auto</span>
      </div>

      {/* Analysis result */}
      {analysisResult && (
        <div className="qa-card animate-fade-in" style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: 6 }}>Analysis</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--fg)' }}>{analysisResult.insight}</div>
        </div>
      )}

      {/* Debug result */}
      {debuggingResult && (
        <div className="qa-card animate-fade-in" style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--status-warn)', marginBottom: 6 }}>Debug suggestion</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--fg)' }}>{debuggingResult.suggestion}</div>
        </div>
      )}

      {/* Write evaluation */}
      {writeEvaluationResult && (
        <div className="qa-card animate-fade-in" style={{ padding: '10px 12px' }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--status-warn)', marginBottom: 6 }}>Write evaluation</div>
          <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--fg)' }}>{writeEvaluationResult.evaluation}</div>
        </div>
      )}

      {/* Empty state */}
      {!analysisResult && !debuggingResult && !writeEvaluationResult && (
        <div style={{ background: 'var(--soft)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Run a query to see AI insights</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>After executing, use "Analyze" on the results to get patterns, anomalies, and follow-up suggestions.</div>
        </div>
      )}

      {/* Notebook shortcut */}
      <button
        onClick={() => setIsNotebookPanelOpen(true)}
        className="qa-btn"
        style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M4 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM6 6h4M6 9h4M6 12h2"/>
        </svg>
        View notebook
      </button>
    </aside>
  );

  const queryColumn = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '16px 20px', gap: 12, minWidth: 0 }}>
      {/* DB switcher + collection selector strip */}
      {dbInfoForRender && (
        <div id="tutorial-account-section" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Database switcher */}
          {accountDatabases.length > 1 && connectedDbInfo && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsDbSwitcherOpen(o => !o)}
                className="qa-btn"
                style={{ fontSize: 11.5, gap: 5 }}
                title="Switch database"
              >
                <DatabaseIcon className="w-3 h-3" />
                {connectedDbInfo.name}
                <ChevronDownIcon className={`w-3 h-3 transition-transform ${isDbSwitcherOpen ? 'rotate-180' : ''}`} />
              </button>
              {isDbSwitcherOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 20,
                  background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  boxShadow: '0 8px 24px -8px rgba(20,18,14,0.15)', minWidth: 160, overflow: 'hidden',
                }}>
                  {accountDatabases.map(db => (
                    <button
                      key={db.name}
                      onClick={() => { handleConnectDatabase(db); setIsDbSwitcherOpen(false); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 12px',
                        background: db.name === connectedDbInfo.name ? 'var(--soft)' : 'none',
                        border: 'none', borderBottom: '1px solid var(--border)',
                        fontFamily: 'var(--font-mono)', fontSize: 12,
                        color: db.name === connectedDbInfo.name ? 'var(--accent)' : 'var(--fg)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      {db.name === connectedDbInfo.name && (
                        <CheckIcon className="w-3 h-3" style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      )}
                      {db.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            {accountDatabases.length > 1 ? '›' : <><DatabaseIcon className="w-3 h-3" style={{ display: 'inline', marginRight: 3 }} />{connectedDbInfo?.name}</>}
          </span>

          {dbInfoForRender.collections.map(col => (
            <button
              key={col.name}
              onClick={(e) => handleCollectionClick(col.name, e)}
              title={`Select ${col.name} (hold ⌘/Ctrl for multi-select)`}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 11,
                padding: '3px 10px', borderRadius: 99,
                border: selectedCollectionsForRender.includes(col.name) ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: selectedCollectionsForRender.includes(col.name) ? 'var(--accent)' : 'var(--soft)',
                color: selectedCollectionsForRender.includes(col.name) ? '#fff' : 'var(--fg)',
                cursor: 'pointer', transition: 'all 0.1s',
              }}
            >
              {col.name}
            </button>
          ))}
        </div>
      )}

      {/* Schema panel for selected collections */}
      {selectedCollectionsForRender.length > 0 && (
        <div id="tutorial-collection-panel" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {collectionInfoError && (
            <div style={{ background: 'color-mix(in oklch, var(--status-err) 10%, var(--bg))', border: '1px solid color-mix(in oklch, var(--status-err) 30%, var(--border))', color: 'var(--status-err)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
              {collectionInfoError}
            </div>
          )}

          {/* Multi-collection schema relationships */}
          {selectedCollectionsForRender.length > 1 && (
            <div className="animate-fade-in" style={{ background: 'var(--soft)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Schema Connections</span>
              </div>
              {(isAnalyzingRelationships || !relationships) && !relationshipError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted)', fontSize: 12, padding: '8px 0' }}>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  Searching for connections…
                </div>
              )}
              {relationshipError && (
                <div style={{ color: 'var(--status-err)', fontSize: 12 }}>{relationshipError}</div>
              )}
              {relationships && !isAnalyzingRelationships && (
                <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'center' }}>
                  <SchemaRelationshipGraph relationships={relationships} selectedCollections={selectedCollections} />
                </div>
              )}
            </div>
          )}

          {/* Per-collection schema accordion */}
          {selectedCollectionsForRender.map(colName => {
            const info = collectionDetailsMapForRender[colName];
            const isColLoading = loadingCollections[colName];
            const isExpanded = expandedCollectionSchemas[colName] ?? (selectedCollectionsForRender.length === 1);
            return (
              <div key={colName} style={{ background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                <button
                  onClick={() => setExpandedCollectionSchemas(prev => ({ ...prev, [colName]: !isExpanded }))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg)', fontFamily: 'var(--font-body)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <ChevronDownIcon className={`w-4 h-4 transition-transform`} style={{ color: 'var(--muted)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>{colName}</span>
                    {isColLoading && <SpinnerIcon className="w-3 h-3 animate-spin text-blue-500" />}
                  </div>
                  {info && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{info.documentCount.toLocaleString()} docs</span>}
                </button>
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--border)', background: 'var(--panel)' }}>
                    {isColLoading ? (
                      <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--muted)' }}>Loading schema…</div>
                    ) : info ? (
                      <CollectionActionPanel info={info} onClose={() => setSelectedCollections(prev => prev.filter(c => c !== colName))} />
                    ) : (
                      <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--status-err)' }}>Failed to load schema.</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Query Generator section */}
      <div
        id="tutorial-prompt-section"
        style={{ opacity: isQuerySectionDisabled ? 0.4 : 1, pointerEvents: isQuerySectionDisabled ? 'none' : 'auto', transition: 'opacity 0.3s', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {/* Context banner */}
        {showContextBanner && contextForRender && (
          <div id="tutorial-context-banner" className="animate-fade-in" style={{ position: 'relative', background: 'var(--accent-soft)', border: '1px solid color-mix(in oklch, var(--accent) 25%, var(--border))', borderRadius: 'var(--radius-md)', padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PinIcon className="w-5 h-5" style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>Query Context Active</div>
                  <div style={{ fontSize: 12, color: 'var(--fg)', marginTop: 2 }}>
                    Using results from <strong style={{ fontFamily: 'var(--font-mono)' }}>{contextForRender.source}</strong> ({Array.isArray(contextForRender.data) ? contextForRender.data.length : 1} items)
                  </div>
                  <button onClick={() => setIsContextViewerOpen(true)} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 2 }}>View data →</button>
                </div>
              </div>
              <button onClick={() => setIntermediateContext(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 4 }}>
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Prompt input card */}
        <div className="qa-card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--muted)' }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 8l3 3 7-7"/></svg>
            Ask in plain English
            {selectedCollectionsForRender.length > 0 && (
              <span className="qa-chip" style={{ marginLeft: 'auto' }}>{selectedCollectionsForRender.join(', ')}</span>
            )}
          </div>
          <textarea
            id="userInput"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
                e.preventDefault();
                if (!isLoading && userInput.trim() && !isQuerySectionDisabled && !isPromptUnchanged) handleGenerateQueryClick();
              }
            }}
            placeholder={isQuerySectionDisabled ? 'Select a collection to begin…' : selectedCollections.length > 0 ? `Querying '${selectedCollections.join(', ')}'… e.g. 'Find all documents from last 30 days'` : "e.g. 'Find all users from Canada and sort by name'"}
            style={{ width: '100%', minHeight: 80, padding: 10, background: 'transparent', border: 'none', outline: 'none', resize: 'none', fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--fg)', lineHeight: 1.55, boxSizing: 'border-box' }}
            disabled={isLoading || isQuerySectionDisabled}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleGenerateQueryClick}
              disabled={isLoading || !userInput.trim() || isQuerySectionDisabled || isPromptUnchanged}
              className="qa-btn primary"
              style={{ fontSize: 13 }}
            >
              {isLoading ? 'Generating…' : isPromptUnchanged ? 'Generated ✓' : 'Generate query'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{ fontSize: 11.5, color: 'var(--muted)', cursor: 'default' }}
                title="More iterations let the AI agent self-correct by re-generating and re-testing the query when it detects errors. Higher values improve accuracy for complex queries but take longer. Max: 10."
              >Iterations:</span>
              <input
                id="max-iterations-slider"
                type="range" min={1} max={10} step={1}
                value={maxIterations}
                onChange={(e) => setMaxIterations(Number(e.target.value))}
                disabled={isLoading || isQuerySectionDisabled}
                className="accent-blue-600 disabled:opacity-40 cursor-pointer"
                style={{ width: 72, accentColor: 'var(--accent)' }}
                title={`Agent iterations: ${maxIterations} — more iterations allow self-correction but take longer`}
              />
              <span style={{ fontSize: 11.5, color: 'var(--accent)', fontFamily: 'var(--font-mono)', minWidth: 14 }}>{maxIterations}</span>
            </div>
            <select
              value={selectedModel}
              onChange={(e) => { setSelectedModel(e.target.value); localStorage.setItem('qp_selected_model', e.target.value); }}
              disabled={isLoading || isQuerySectionDisabled}
              style={{
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: 'var(--soft)',
                color: 'var(--muted)',
                cursor: 'pointer',
                maxWidth: 180,
              }}
              aria-label="Select AI model"
            >
              {availableModels.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <span className="qa-chip" style={{ marginLeft: 'auto', fontSize: 10.5, cursor: 'pointer' }}
              onClick={() => setIsShortcutCheatsheetOpen(true)} title="Keyboard shortcuts">⌘/</span>
          </div>
        </div>

        {/* Loading */}
        {isLoading && !isDemoModeForDebugStep && !isDemoModeForResultsStep && !isDemoModeForRunStep && (
          <Loader message="Generating query…" />
        )}

        {/* Error */}
        {error && !isDemoModeForDebugStep && !isDemoModeForResultsStep && !isDemoModeForRunStep && (
          <div style={{ background: 'color-mix(in oklch, var(--status-err) 10%, var(--bg))', border: '1px solid color-mix(in oklch, var(--status-err) 30%, var(--border))', color: 'var(--status-err)', padding: '10px 14px', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
            <strong>Error: </strong>{error}
          </div>
        )}

        {/* Results area */}
        <div id="tutorial-results-area">
          {/* Tutorial demo modes */}
          {(isDemoModeForRunStep || isDemoModeForSaveStep) && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <QueryDisplay code={mockFindUsersQuery.generated_code} onCodeChange={() => {}} onRunQuery={() => {}} onSaveQuery={() => {}} isExecuting={false} historyCount={1} historyIndex={0} onNavigateHistory={() => {}} />
            </div>
          )}
          {(isDemoModeForResultsStep || isDemoModeForContextActiveStep) && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <QueryDisplay code={mockFindUsersQuery.generated_code} onCodeChange={() => {}} onRunQuery={() => {}} onSaveQuery={() => {}} isExecuting={false} historyCount={1} historyIndex={0} onNavigateHistory={() => {}} />
              <QueryResult isExecuting={false} executionError={null} executionResult={mockUserFindResult} onDebug={() => {}} isDebugging={false} debuggingResult={null} debugError={null} sourceCollection={'users'} onSetIntermediateContext={() => {}} intermediateContext={null} onAnalyze={() => {}} isAnalyzing={false} analysisResult={null} analysisError={null} onEvaluateWrite={() => {}} isEvaluatingWrite={false} writeEvaluationResult={null} writeEvaluationError={null} isTutorialActive={isTutorialActive} tutorialStepIndex={tutorialStepIndex} />
            </div>
          )}
          {isDemoModeForDebugStep && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <QueryDisplay code={"db['users'].find({}).sor([('name', 1)])"} onCodeChange={() => {}} onRunQuery={() => {}} onSaveQuery={() => {}} isExecuting={false} historyCount={1} historyIndex={0} onNavigateHistory={() => {}} />
              <QueryResult isExecuting={false} executionError={"MongoDB query error: unknown operator: $sor (MongoServerError)"} executionResult={null} onDebug={() => {}} isDebugging={false} debuggingResult={null} debugError={null} sourceCollection={'users'} onSetIntermediateContext={() => {}} intermediateContext={null} onAnalyze={() => {}} isAnalyzing={false} analysisResult={null} analysisError={null} onEvaluateWrite={() => {}} isEvaluatingWrite={false} writeEvaluationResult={null} writeEvaluationError={null} isTutorialActive={isTutorialActive} tutorialStepIndex={tutorialStepIndex} />
            </div>
          )}

          {/* Real results */}
          {(!isLoading && !error && !isDemoModeForResultsStep && !isDemoModeForDebugStep && !isDemoModeForContextActiveStep && !isDemoModeForRunStep && !isDemoModeForSaveStep) && (
            editableCode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <QueryDisplay code={editableCode} onCodeChange={setEditableCode} onRunQuery={handleRunQuery} onSaveQuery={handleOpenSaveDialog} isExecuting={isExecuting} historyCount={codeHistory.length} historyIndex={historyIndex} onNavigateHistory={handleNavigateHistory} isTransferable={!!handover} onOpenInExplorer={handleOpenInExplorer} canWrite={can('data:write')} />
                <QueryResult isExecuting={isExecuting} executionError={executionError} executionResult={executionResult} onDebug={handleDebugQuery} isDebugging={isDebugging} debuggingResult={debuggingResult} debugError={debugError} sourceCollection={querySourceCollection} onSetIntermediateContext={handleSetIntermediateContext} intermediateContext={intermediateContext} onAnalyze={handleAnalyzeQuery} isAnalyzing={isAnalyzing} analysisResult={analysisResult} analysisError={analysisError} onEvaluateWrite={handleEvaluateWrite} isEvaluatingWrite={isEvaluatingWrite} writeEvaluationResult={writeEvaluationResult} writeEvaluationError={writeEvaluationError} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '32px 0', border: '1.5px dashed var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13 }}>
                Your generated query will appear here.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'var(--font-body)', color: 'var(--fg)', background: 'var(--bg)' }}>
        {queryColumn}
        {insightsRail}
      </div>
      {sharedTail}
    </>
  );
};

export default QueryGeneratorPage;