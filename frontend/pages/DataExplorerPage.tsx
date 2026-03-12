import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SelectedResource, DbInfo, BreadcrumbItem, CosmosDBAccount, CollectionInfo } from '../types';
import { getDocuments, getCollectionInfo, findDocumentById, getDatabasesForAccount, clearDocumentsCache, getSingleDocument, getDocumentsQueryCode } from '../services/dbService';
import { extractSchemaTree, SchemaKeyNode } from '../utils/schemaUtils';
import MongoIcon from '../components/icons/MongoIcon';
import { isEqual, omit } from 'lodash';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import {
  SpinnerIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  RefreshIcon,
  CachedIcon,
  ClearAllIcon,
  ArrowUpwardIcon,
  ArrowDownwardIcon,
  SunIcon,
  MoonIcon,
  CheckIcon,
  PinIcon,
  TrashIcon,
  ArrowLeftIcon,
  SearchIcon,
  XIcon,
  EditIcon,
  NoteAddIcon,
  FileCopyIcon,
  HistoryIcon
} from '../components/icons/material-icons-imports';
import JsonDisplay from '../components/JsonDisplay';
import DocumentEditView, { DocumentEditViewRef } from '../components/DocumentDetailView';
import CreateDocumentDialog from '../components/CreateDocumentDialog';
import DocumentHistoryDialog from '../components/DocumentHistoryDialog';
import DiffOverwriteDialog from '../components/DiffOverwriteDialog';
import { useTheme } from '../contexts/ThemeContext';


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
  resource: SelectedResource;
  dbInfo: DbInfo;
  accountName: string; // Keep this for the initial display before full state is ready
  availableDbs: DbInfo[];
  availableAccounts: CosmosDBAccount[];
  initialDocumentId?: string;
  onNavigateBack: () => void;
}

interface PinnedDocument {
  doc: Record<string, any>;
  collectionName: string;
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

// Delete Document Confirmation Dialog
const DeleteDocumentDialog: React.FC<{
  open: boolean;
  document: Record<string, any> | null;
  onClose: () => void;
  onDelete: () => void;
  loading?: boolean;
}> = ({ open, document, onClose, onDelete, loading }) => {
  if (!open || !document) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/60 animate-fade-in-fast">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
          <TrashIcon className="w-5 h-5" /> Confirm Delete Document
        </h2>
        <p className="mb-3 text-slate-700 dark:text-slate-200 text-sm">Are you sure you want to delete this document? This action cannot be undone.</p>
        <div className="bg-slate-100 dark:bg-slate-900 rounded p-3 text-xs overflow-x-auto text-slate-800 dark:text-slate-100 max-h-60 mb-4 border border-slate-200 dark:border-slate-700">
          <JsonDisplay data={document} />
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            disabled={loading}
            className="px-4 py-2 rounded-md border border-red-400 bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

const DataExplorerPage: React.FC<DataExplorerPageProps> = ({
  resource,
  dbInfo,
  availableDbs,
  availableAccounts,
  initialDocumentId,
  onNavigateBack
}) => {
  const navigate = useNavigate();

  // --- Account & DB State ---
  const [currentAccount, setCurrentAccount] = useState<CosmosDBAccount>(() => availableAccounts.find(a => a.id === resource.accountId)!);
  const [currentDb, setCurrentDb] = useState<DbInfo | null>(dbInfo);
  const [currentResource, setCurrentResource] = useState<SelectedResource>(resource);
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
  interface FilterState {
    id: string;
    key: string;
    value: string;
    isCustom: boolean;
    operator?: string;
    type?: 'string' | 'number' | 'boolean' | 'date';
  }
  const [filters, setFilters] = useState<FilterState[]>([{ id: 'default', key: 'all', value: '', isCustom: false, operator: 'equals', type: 'string' }]);
  const [debouncedFilters, setDebouncedFilters] = useState<FilterState[]>(filters);
  const [schemaTree, setSchemaTree] = useState<SchemaKeyNode[]>([]);
  const [isFetchingSchema, setIsFetchingSchema] = useState(false);
  const [currentCollectionInfo, setCurrentCollectionInfo] = useState<CollectionInfo | null>(null);

  const addFilter = () => {
    setFilters(prev => [...prev, { id: Math.random().toString(36).substring(7), key: 'all', value: '', isCustom: false, operator: 'equals', type: 'string' }]);
  };

  const removeFilter = (id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterState>) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  // --- Editor State ---
  const [selectedDocument, setSelectedDocument] = useState<Record<string, any> | null>(null);
  const [editMode, setEditMode] = useState(false);

  // --- Create Document Dialog State ---
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDocInitial, setCreateDocInitial] = useState<Record<string, any> | null>(null);

  // --- Delete Document Dialog State ---
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteTargetDoc, setDeleteTargetDoc] = React.useState<Record<string, any> | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // --- Document History Dialog State ---
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = React.useState(false);

  // --- Diff Overwrite Dialog State ---
  const [isDiffOverwriteDialogOpen, setIsDiffOverwriteDialogOpen] = useState(false);
  const [diffIncomingDocument, setDiffIncomingDocument] = useState<Record<string, any> | null>(null);
  const [diffCurrentEditedText, setDiffCurrentEditedText] = useState<string>('');

  // --- Editor Ref ---
  const editorRef = useRef<DocumentEditViewRef>(null);

  // Helper to infer schema for new document (mimic CollectionActionPanel logic)
  const getInitialDocFromSchema = useCallback(() => {
    if (!schemaTree || schemaTree.length === 0) return {};
    // Use sampleDocument from currentCollectionInfo
    const sampleDoc: any = currentCollectionInfo?.sampleDocument || {};
    // Helper to get value from sampleDoc by path
    const getSampleValue = (path: string[]): any => {
      let val = sampleDoc;
      for (const key of path) {
        if (val && typeof val === 'object') val = val[key];
        else return undefined;
      }
      return val;
    };

    const buildObj = (nodes: SchemaKeyNode[], path: string[] = []): any => {
      const obj: any = {};
      nodes.forEach(node => {
        if (node.key === '_id') return; // skip _id
        const fullPath = [...path, node.key];
        let sampleVal = getSampleValue(fullPath);
        if (node.children && node.children.length > 0) {
          if (Array.isArray(sampleVal)) {
            if (sampleVal.length > 0 && typeof sampleVal[0] === 'object' && sampleVal[0] !== null && !Array.isArray(sampleVal[0])) {
              // Array of objects: fill with one object using the structure of the first element
              obj[node.key] = [buildObj(node.children, fullPath.concat(['0']))];
            } else {
              // Array of primitives or empty
              obj[node.key] = [];
            }
          } else if (sampleVal && typeof sampleVal === 'object') {
            obj[node.key] = buildObj(node.children, fullPath);
          } else {
            obj[node.key] = {};
          }
        } else {
          // Primitives
          if (typeof sampleVal === 'number') {
            obj[node.key] = 0;
          } else if (typeof sampleVal === 'boolean') {
            obj[node.key] = false;
          } else if (typeof sampleVal === 'string') {
            obj[node.key] = '';
          } else if (Array.isArray(sampleVal)) {
            obj[node.key] = [];
          } else if (sampleVal && typeof sampleVal === 'object') {
            obj[node.key] = {};
          } else {
            obj[node.key] = '';
          }
        }
      });
      return obj;
    };
    return buildObj(schemaTree);
  }, [schemaTree, currentCollectionInfo]);

  // Open create dialog with inferred schema
  const handleOpenCreateDialog = useCallback(() => {
    setCreateDocInitial(getInitialDocFromSchema());
    setIsCreateDialogOpen(true);
  }, [getInitialDocFromSchema]);

  // Backend call to insert new document
  const handleCreateDocument = async (doc: Record<string, any>) => {
    if (!selectedCollection || !currentResource) return;
    setIsLoading(true);
    setError(null);
    try {
      // Use dbService addDocument (assume exists, or replace with correct import)
      const { addDocument } = await import('../services/dbService');
      const newDoc = await addDocument(selectedCollection, currentResource, doc);
      setDocuments(prev => [newDoc, ...prev]);
      setSelectedDocument(newDoc);
      setIsCreateDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create document.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete document handler
  const handleDeleteDocument = React.useCallback(async () => {
    if (!selectedCollection || !deleteTargetDoc || !currentResource) return;
    setIsDeleting(true);
    setError(null);
    try {
      const { deleteDocument } = await import('../services/dbService');
      const docId = getDocId(deleteTargetDoc);
      await deleteDocument(selectedCollection, currentResource, docId);
      setDocuments(prev => prev.filter(doc => getDocId(doc) !== docId));
      if (selectedDocument && getDocId(selectedDocument) === docId) {
        setSelectedDocument(null);
      }
      setIsDeleteDialogOpen(false);
      setDeleteTargetDoc(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete document.');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedCollection, deleteTargetDoc, currentResource, setDocuments, selectedDocument]);

  // --- Sorting State ---
  const [collectionSortKey, setCollectionSortKey] = useState<'name' | 'count'>('name');
  const [collectionSortOrder, setCollectionSortOrder] = useState<'asc' | 'desc'>('asc');

  // --- Navigation State ---
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

  // --- Pinned Documents State ---
  const [pinnedDocuments, setPinnedDocuments] = useState<PinnedDocument[]>([]);
  const [isPinnedDrawerOpen, setIsPinnedDrawerOpen] = useState(false);
  const [pinnedCardHeight, setPinnedCardHeight] = useState(260); // px, default height
  const [pinnedCardWidth, setPinnedCardWidth] = useState(320); // px, default width
  const minCardWidth = 180;
  const maxCardWidth = 600;
  const prevPinnedCount = useRef(pinnedDocuments.length);

  // --- Export Query State ---
  const [copiedQuery, setCopiedQuery] = useState(false);

  // --- Theme State ---
  const { theme, toggleTheme } = useTheme();

  // --- Cache State ---
  const [cacheClearStatus, setCacheClearStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const getDocId = (doc: Record<string, any>): string => {
    const id = doc?._id?.$oid || doc?._id;
    return String(id ?? JSON.stringify(doc)); // Fallback for docs without ID
  };

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
    setFilters([{ id: 'default', key: 'all', value: '', isCustom: false, operator: 'equals', type: 'string' }]);
    setDebouncedFilters([{ id: 'default', key: 'all', value: '', isCustom: false, operator: 'equals', type: 'string' }]);
    setSchemaTree([]);
    setIsFetchingSchema(false);
    setSelectedDocument(null);
    setBreadcrumbs([]);
    // Do not reset pinned documents here, as they should persist across DB/collection changes.
  }, []);

  // Debounce filters
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters(filters);
      setCurrentPage(1); // Reset to page 1 on new search
      setSelectedDocument(null); // Clear selection on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [filters]);

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

  // --- Pinned Documents Handlers ---
  const isDocumentPinned = useCallback((doc: Record<string, any>): boolean => {
    if (!doc) return false;
    const docId = getDocId(doc);
    return pinnedDocuments.some(pinned => getDocId(pinned.doc) === docId);
  }, [pinnedDocuments]);

  const handleTogglePin = useCallback((docToPin: Record<string, any>, collectionName: string) => {
    if (!docToPin || !collectionName) return;

    const docId = getDocId(docToPin);
    const alreadyPinned = pinnedDocuments.some(p => getDocId(p.doc) === docId);

    if (alreadyPinned) {
      setPinnedDocuments(prev => prev.filter(p => getDocId(p.doc) !== docId));
    } else {
      setPinnedDocuments(prev => [...prev, { doc: docToPin, collectionName }]);
    }
  }, [pinnedDocuments]);

  const handleClearAllPins = () => {
    setPinnedDocuments([]);
  };

  useEffect(() => {
    // Automatically open the drawer when a new document is pinned, but allow the user to close it.
    if (pinnedDocuments.length > prevPinnedCount.current) {
      setIsPinnedDrawerOpen(true);
    }
    // If all documents are unpinned, close the drawer automatically.
    if (pinnedDocuments.length === 0) {
      setIsPinnedDrawerOpen(false);
    }
    prevPinnedCount.current = pinnedDocuments.length;
  }, [pinnedDocuments]);

  const fetchDocuments = useCallback(async () => {
    if (!selectedCollection || !currentResource) {
      setDocuments([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const activeFilters = debouncedFilters.map(f => ({
        key: f.key,
        value: getCoercedFilterValue(f.value),
        operator: f.operator || 'equals',
        type: f.type || 'string'
      }));
      const response = await getDocuments(selectedCollection, currentResource, currentPage, 20, undefined, activeFilters);
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
  }, [selectedCollection, currentResource, currentPage, debouncedFilters]);

  useEffect(() => {
    if (breadcrumbs.length > 0 && selectedDocument) return;
    fetchDocuments();
  }, [fetchDocuments, breadcrumbs.length, selectedDocument]);

  const fetchSchemaForCollection = useCallback(async (collectionName: string) => {
    if (!collectionName || !currentResource) return;
    setIsFetchingSchema(true);
    setSchemaTree([]);
    setCurrentCollectionInfo(null);
    try {
      const info = await getCollectionInfo(collectionName, currentResource);
      setCurrentCollectionInfo(info);
      if (info.sampleDocument) {
        setSchemaTree(extractSchemaTree(info.sampleDocument));
      }
    } catch (e) {
      console.error("Failed to fetch schema for filters:", e);
    } finally {
      setIsFetchingSchema(false);
    }
  }, [currentResource]);

  // Handle initial document selection from URL (no collection specified)
  useEffect(() => {
    const handleInitialDocumentSelection = async () => {
      console.log('useEffect triggered - initialDocumentId:', initialDocumentId);
      console.log('currentDb:', currentDb, 'currentResource:', currentResource);

      if (!currentDb || !currentResource || !initialDocumentId) {
        console.log('Missing required data for initial document selection - initialDocumentId:', initialDocumentId, 'currentDb:', !!currentDb);
        return;
      }

      try {
        setIsLoading(true);
        const collectionNames = currentDb.collections.map(c => c.name);
        console.log('Searching for document:', initialDocumentId, 'across all collections');

        const result = await findDocumentById(initialDocumentId, currentResource, collectionNames);
        console.log('Found document in collection:', result.collectionName);

        // Set the collection that contains the document
        setSelectedCollection(result.collectionName);
        await fetchSchemaForCollection(result.collectionName);

        // Set the found document
        console.log('Setting selected document:', result.document);
        setSelectedDocument(result.document);

      } catch (error) {
        console.error('Failed to load initial document:', error);
        setError(`Document with ID '${initialDocumentId}' not found in any collection`);
      } finally {
        setIsLoading(false);
      }
    };

    handleInitialDocumentSelection();
  }, [initialDocumentId, currentDb, currentResource, fetchSchemaForCollection]);

  const handleAccountSwitch = useCallback(async (newAccount: CosmosDBAccount) => {
    if (newAccount.id === currentAccount.id) return;

    setIsAccountSwitcherOpen(false);
    setIsLoadingDbsForAccount(true);
    setError(null);

    // Don't reset explorer state immediately - let it blur out instead

    try {
      const dbs = await getDatabasesForAccount(newAccount.id);

      // Only update state and reset explorer after successful data fetch
      setCurrentAccount(newAccount);
      setCurrentAccountDbs(dbs);
      resetExplorerState();

      if (dbs.length > 0) {
        const firstDb = dbs[0];
        setCurrentDb(firstDb);
        setCurrentResource({ accountId: newAccount.id, databaseName: firstDb.name });

        // Navigate to the new URL with the updated account and database
        const encodedAccountId = encodeURIComponent(newAccount.id);
        const encodedDatabaseName = encodeURIComponent(firstDb.name);
        navigate(`/data-explorer/${encodedAccountId}/${encodedDatabaseName}`, { replace: true });
      } else {
        setCurrentDb(null);
        setCurrentResource({ accountId: newAccount.id, databaseName: '' });
        // Navigate to account-only URL if no databases
        const encodedAccountId = encodeURIComponent(newAccount.id);
        navigate(`/data-explorer/${encodedAccountId}/`, { replace: true });
      }
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("An unknown error occurred while fetching databases for the account.");
    } finally {
      setIsLoadingDbsForAccount(false);
    }
  }, [currentAccount, resetExplorerState, navigate]);

  const handleDbSwitch = useCallback((newDb: DbInfo) => {
    if (newDb.name === currentDb?.name) return;

    setIsDbSwitcherOpen(false);
    setCurrentDb(newDb);
    setCurrentResource(prev => ({ ...prev, databaseName: newDb.name }));

    resetExplorerState();

    // Navigate to the new URL with the updated database
    const encodedAccountId = encodeURIComponent(currentAccount.id);
    const encodedDatabaseName = encodeURIComponent(newDb.name);
    navigate(`/data-explorer/${encodedAccountId}/${encodedDatabaseName}`, { replace: true });
  }, [currentDb, currentAccount.id, resetExplorerState, navigate]);

  const handleCollectionClick = useCallback(async (collectionName: string) => {
    if (selectedCollection === collectionName) return;
    setSelectedCollection(collectionName);
    setCurrentPage(1);
    setFilters([{ id: 'default', key: 'all', value: '', isCustom: false, operator: 'equals', type: 'string' }]);
    setDebouncedFilters([{ id: 'default', key: 'all', value: '', isCustom: false, operator: 'equals', type: 'string' }]);
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

  const handleObjectIdClick = useCallback(async (objectId: string, keyContext?: string, openInNewTab?: boolean) => {
    if (!selectedDocument || !selectedCollection || !currentDb) return;

    if (openInNewTab) {
      // Generate URL for new tab - let backend find which collection contains the document
      const encodedAccountId = encodeURIComponent(currentAccount.id);
      const encodedDatabaseName = encodeURIComponent(currentDb.name);
      const encodedDocumentId = encodeURIComponent(objectId);
      const newTabUrl = `/data-explorer/${encodedAccountId}/${encodedDatabaseName}/document/${encodedDocumentId}`;
      window.open(newTabUrl, '_blank', 'noopener,noreferrer');
      return;
    }

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
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("An unknown error occurred while finding the document.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDocument, selectedCollection, currentResource, currentDb, currentAccount.id, fetchSchemaForCollection]);

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
    return collectionSortOrder === 'asc' ? <ArrowUpwardIcon className="w-3 h-3" /> : <ArrowDownwardIcon className="w-3 h-3" />;
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
          {debouncedFilters.some(f => f.value || f.operator === 'exists' || f.operator === 'not_exists') && <p className="text-xs">Try a different filter or value.</p>}
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full">
        <div className={`flex-grow overflow-y-auto ${isLoading ? 'opacity-50' : ''}`}>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {documents.map((doc) => {
              const docId = getDocId(doc);
              const isSelected = selectedDocument && getDocId(selectedDocument) === docId;
              const isPinned = isDocumentPinned(doc);

              return (
                <li
                  key={docId}
                  className={`flex items-center justify-between transition-colors group ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                >
                  <button
                    onClick={() => setSelectedDocument(doc)}
                    className="flex-grow text-left p-3 text-sm"
                  >
                    <p className="font-mono text-slate-800 dark:text-slate-200 truncate" title={String(doc._id?.$oid || doc._id)}>{String(doc._id?.$oid || doc._id)}</p>
                  </button>
                  <div className="flex items-center gap-1 mr-2">
                    {/* Delete button */}
                    <button
                      onClick={() => {
                        setDeleteTargetDoc(doc);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="p-2 rounded-full transition-colors text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-red-400 opacity-0 group-hover:opacity-100"
                      title="Delete document"
                      aria-label="Delete document"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                    {/* Copy as new document button */}
                    <button
                      onClick={() => {
                        const { _id, ...rest } = doc;
                        setCreateDocInitial(rest);
                        setIsCreateDialogOpen(true);
                      }}
                      className="p-2 rounded-full transition-colors text-slate-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 focus:outline-none focus:ring-2 focus:ring-blue-400 opacity-0 group-hover:opacity-100"
                      title="Copy as new document"
                      aria-label="Copy as new document"
                    >
                      <FileCopyIcon className="w-5 h-5" />
                    </button>
                    {/* Pin button */}
                    <button
                      onClick={() => handleTogglePin(doc, selectedCollection!)}
                      className={`p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${isPinned ? 'text-blue-500 hover:bg-blue-200/50 dark:hover:bg-blue-900/40' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'} ${!isPinned ? 'opacity-0 group-hover:opacity-100' : ''}`}
                      title={isPinned ? 'Unpin document' : 'Pin document'}
                      aria-label={isPinned ? 'Unpin document' : 'Pin document'}
                    >
                      <PinIcon className={`w-5 h-5 ${isPinned ? 'fill-current' : 'stroke-current'} transition-colors`} />
                    </button>
                  </div>
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

  const handleEditSave = async () => {
    if (selectedCollection && selectedDocument) {
      setIsLoading(true);
      try {
        const refreshed = await getSingleDocument(
          currentResource.accountId,
          currentResource.databaseName,
          selectedCollection,
          getDocId(selectedDocument)
        );
        setSelectedDocument(refreshed);
        // Sync pinned document if present
        setPinnedDocuments(prev => prev.map(p =>
          getDocId(p.doc) === getDocId(selectedDocument)
            ? { ...p, doc: refreshed }
            : p
        ));
      } catch (e) {
        // Optionally set error
      } finally {
        setIsLoading(false);
        setEditMode(false);
      }
    } else {
      setEditMode(false);
    }
  };

  const handleEditCancel = () => {
    setEditMode(false);
  };

  const renderEditorPanel = () => {
    if (isLoading && !selectedDocument) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
          <SpinnerIcon className="w-8 h-8" />
        </div>
      );
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
        {/* Toolbar for edit/view mode */}
        {/* Toolbar removed: Pin/Edit/Cancel now handled in header ID row */}
        {/* Read-only view */}
        {!editMode && (
          <div className="bg-slate-100 dark:bg-slate-800 rounded p-3 text-xs overflow-x-auto text-slate-800 dark:text-slate-100">
            <JsonDisplay data={selectedDocument} onObjectIdClick={handleObjectIdClick} />
          </div>
        )}
        {/* Edit mode: render DocumentEditView */}
        {editMode && (
          <DocumentEditView
            ref={editorRef}
            accountId={currentResource.accountId}
            databaseName={currentResource.databaseName}
            document={selectedDocument}
            collection={selectedCollection}
            docId={getDocId(selectedDocument)}
            loading={isLoading}
            onCancel={handleEditCancel}
            onSave={handleEditSave}
          />
        )}
      </div>
    );
  }

  // Only cover the editor area (right 60% for 2/4 xl:3/5), open/collapse vertically
  const PinnedDrawer = () => {
    const drawerHeight = isPinnedDrawerOpen ? '100%' : '48px';
    // Clamp min/max height for card
    const minCardHeight = 120;
    const maxCardHeight = 600;
    return (
      <div
        className="fixed bottom-0 right-0 z-30 transition-all duration-300 ease-in-out"
        style={{ width: '60vw', maxWidth: '100vw', minWidth: '320px', height: drawerHeight, pointerEvents: 'auto' }}
        aria-hidden={!isPinnedDrawerOpen && pinnedDocuments.length === 0}
      >
        <div className="h-full flex flex-col bg-white dark:bg-slate-800 border-l-2 border-blue-500 shadow-[0_0_20px_rgba(0,0,0,0.08)] dark:shadow-[0_0_30px_rgba(0,0,0,0.25)]">
          <button
            onClick={() => setIsPinnedDrawerOpen(!isPinnedDrawerOpen)}
            className="flex items-center justify-between p-3 text-left border-b border-slate-200 dark:border-slate-700 w-full"
            aria-expanded={isPinnedDrawerOpen}
            style={{ minHeight: '48px' }}
          >
            <div className="flex items-center gap-3">
              <PinIcon className="w-5 h-5 text-blue-500" />
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Pinned Documents ({pinnedDocuments.length})
              </h3>
            </div>
            <div className="flex items-center gap-4">
              {pinnedDocuments.length > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); handleClearAllPins(); }}
                  className="flex items-center gap-2 px-3 py-1.5 border border-red-300 dark:border-red-500/50 text-xs font-medium rounded-md text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/40"
                  title="Clear all pinned documents"
                >
                  <TrashIcon className="w-4 h-4" /> Clear All
                </button>
              )}
              <ChevronDownIcon className={`w-6 h-6 text-slate-500 dark:text-slate-400 transition-transform duration-300 ${isPinnedDrawerOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>
          {/* Card size drag handles (universal for all cards) */}
          {isPinnedDrawerOpen && pinnedDocuments.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 select-none" style={{ minHeight: '32px', height: '32px' }}>
              <div
                tabIndex={0}
                aria-label="Drag to resize pinned document cards"
                onMouseDown={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  if (e.clientX > rect.right - 20 && e.clientY > rect.bottom - 20) {
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startW = pinnedCardWidth;
                    const startH = pinnedCardHeight;
                    const onMove = (moveEvt: MouseEvent) => {
                      let newW = Math.max(minCardWidth, Math.min(maxCardWidth, startW + (moveEvt.clientX - startX)));
                      let newH = Math.max(minCardHeight, Math.min(maxCardHeight, startH + (moveEvt.clientY - startY)));
                      setPinnedCardWidth(newW);
                      setPinnedCardHeight(newH);
                    };
                    const onUp = () => {
                      window.removeEventListener('mousemove', onMove);
                      window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                  }
                }}
                style={{
                  width: 44,
                  height: 24,
                  minWidth: 44,
                  minHeight: 24,
                  maxWidth: 44,
                  maxHeight: 24,
                  position: 'relative',
                  background: 'transparent',
                  border: '1px dashed #60a5fa',
                  borderRadius: 6,
                  display: 'inline-block',
                  marginLeft: 0,
                  marginRight: 0,
                  cursor: 'nwse-resize',
                  userSelect: 'none',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ position: 'absolute', right: 0, bottom: 0, width: 20, height: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', pointerEvents: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="6" y="16" width="8" height="2" rx="1" fill="#60a5fa" /><rect x="12" y="10" width="2" height="8" rx="1" fill="#60a5fa" /></svg>
                </div>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium" style={{ marginLeft: 4 }}>{pinnedCardWidth}×{pinnedCardHeight}px</span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-900" style={{ display: isPinnedDrawerOpen ? 'block' : 'none' }}>
            {pinnedDocuments.length > 0 ? (
              <div className="p-4 flex flex-wrap gap-4">
                {pinnedDocuments.map(({ doc, collectionName }) => (
                  <div
                    key={getDocId(doc)}
                    className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-fade-in-fast"
                    style={{ height: pinnedCardHeight, width: pinnedCardWidth, minHeight: minCardHeight, maxHeight: maxCardHeight, minWidth: minCardWidth, maxWidth: maxCardWidth, flex: '0 0 auto' }}
                  >
                    <header className="p-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
                      <div>
                        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">{collectionName}</p>
                        <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate" title={getDocId(doc)}>{getDocId(doc)}</p>
                      </div>
                      <button
                        onClick={() => handleTogglePin(doc, collectionName)}
                        className="p-1.5 rounded-full text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        title="Unpin document"
                      >
                        <XIcon className="w-4 h-4" />
                      </button>
                    </header>
                    <div className="p-3 flex-grow overflow-y-auto">
                      <JsonDisplay data={doc} onObjectIdClick={handleObjectIdClick} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
                Pin documents to compare them here.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  let displayDiffOldValue = diffCurrentEditedText;
  let displayDiffNewValue = diffIncomingDocument ? JSON.stringify(diffIncomingDocument, null, 2) : '';

  if (diffIncomingDocument && isDiffOverwriteDialogOpen) {
    try {
      const parsedOld = JSON.parse(diffCurrentEditedText);
      const ignoredKeys = ['_id', 'datetime_creation', 'datetime_last_modified'];

      const modifiedOld = { ...parsedOld };

      ignoredKeys.forEach(key => {
        if (key in diffIncomingDocument) {
          modifiedOld[key] = diffIncomingDocument[key];
        } else {
          delete modifiedOld[key];
        }
      });
      displayDiffOldValue = JSON.stringify(modifiedOld, null, 2);
    } catch (e) {
      // If parsing fails, fall back to raw string
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-sans">
      <div className="flex flex-col h-screen relative">

        {/* Loading Overlay */}
        {isLoadingDbsForAccount && (
          <div className="absolute inset-0 z-50 bg-black/20 dark:bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl px-6 py-4 flex items-center gap-3 border border-slate-200 dark:border-slate-700">
              <SpinnerIcon className="w-5 h-5 animate-spin text-blue-500" />
              <span className="text-slate-700 dark:text-slate-200 font-medium">Switching account...</span>
            </div>
          </div>
        )}

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
                  onClick={handleClearDocCache}
                  disabled={cacheClearStatus !== 'idle'}
                  className="h-9 w-9 flex items-center justify-center border border-slate-300 dark:border-slate-600 rounded-md text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
                  title="Clear the server cache for linked document lookups"
                  aria-label="Clear cache"
                >
                  {cacheClearStatus === 'loading' && <SpinnerIcon className="w-5 h-5 animate-spin" />}
                  {cacheClearStatus === 'success' && <CheckIcon className="w-5 h-5 text-green-500" />}
                  {cacheClearStatus === 'error' && <XIcon className="w-5 h-5 text-red-500" />}
                  {cacheClearStatus === 'idle' && <CachedIcon className="w-5 h-5" />}
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
          <PanelGroup orientation="horizontal" id="querypal-panel-layout">
            {/* Column 1: Collections */}
            <Panel defaultSize={20} minSize={10}>
              <div className="h-full bg-slate-100 dark:bg-slate-800 overflow-y-auto">
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
            </Panel>

            <PanelResizeHandle className="w-1 bg-slate-200 dark:bg-slate-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors cursor-col-resize z-10 flex-shrink-0" />

            {/* Column 2: Documents */}
            <Panel defaultSize={20} minSize={15}>
              <div className="h-full bg-white dark:bg-slate-800/50 flex flex-col">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                      Documents {totalDocuments > 0 && `(${totalDocuments.toLocaleString()})`}
                    </h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleOpenCreateDialog}
                        disabled={!selectedCollection || isLoading || isFetchingSchema}
                        className={`p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40 ${isCreateDialogOpen ? 'text-blue-500 bg-blue-100 dark:bg-blue-900/50' : ''}`}
                        title="Create new document"
                        aria-label="Create new document"
                      >
                        <NoteAddIcon className={`w-5 h-5 ${isCreateDialogOpen ? 'fill-current' : 'stroke-current'} transition-colors`} />
                      </button>
                      <button
                        onClick={handleRefresh}
                        disabled={!selectedCollection || isLoading || isFetchingSchema}
                        className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Refresh documents and schema"
                      >
                        <ClearAllIcon className={`w-4 h-4 ${(isLoading || isFetchingSchema) ? 'animate-pulse' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {filters.map((f) => (
                      <div key={f.id} className="flex flex-col gap-2 p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg relative">
                        {filters.length > 1 && (
                          <button onClick={() => removeFilter(f.id)} className="absolute -top-2 -right-2 p-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-full text-slate-400 hover:text-red-500 hover:border-red-500 shadow-sm z-10 transition-colors">
                            <XIcon className="w-3 h-3" />
                          </button>
                        )}
                        <div className="flex gap-2">
                          <div className="flex-[2_2_0%] relative">
                            {!f.isCustom ? (
                              <>
                                <select
                                  value={f.key}
                                  onChange={(e) => {
                                    if (e.target.value === '__custom__') {
                                      updateFilter(f.id, { isCustom: true, key: '', type: 'string' });
                                    } else {
                                      const newKey = e.target.value;
                                      const isDate = newKey.toLowerCase().includes('date') || newKey.toLowerCase().includes('time');
                                      updateFilter(f.id, { key: newKey, type: isDate ? 'date' : 'string' });
                                    }
                                  }}
                                  disabled={!selectedCollection || isFetchingSchema}
                                  className="w-full text-sm appearance-none cursor-pointer p-2 pr-8 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
                                  title="Select a field to filter by"
                                >
                                  <option value="all">All Fields</option>
                                  <RenderOptions nodes={schemaTree} level={0} />
                                  <option disabled>──────────</option>
                                  <option value="__custom__">Type custom field...</option>
                                </select>
                                <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                              </>
                            ) : (
                              <div className="flex items-center relative">
                                <input
                                  type="text"
                                  value={f.key}
                                  onChange={(e) => {
                                    const newKey = e.target.value;
                                    const isDate = newKey.toLowerCase().includes('date') || newKey.toLowerCase().includes('time');
                                    updateFilter(f.id, { key: newKey, type: isDate ? 'date' : 'string' });
                                  }}
                                  disabled={!selectedCollection || isFetchingSchema}
                                  placeholder="e.g. internal_info.internal_id"
                                  className="w-full text-sm p-2 pr-8 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
                                  autoFocus
                                />
                                <button
                                  onClick={() => updateFilter(f.id, { isCustom: false, key: 'all' })}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors bg-slate-200 dark:bg-slate-600"
                                  title="Back to dropdown"
                                >
                                  <XIcon className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                          {f.key !== 'all' && (
                            <div className="flex-1 relative">
                              <select
                                value={f.operator || 'equals'}
                                onChange={(e) => updateFilter(f.id, { operator: e.target.value })}
                                disabled={!selectedCollection || isFetchingSchema}
                                className="w-full text-sm appearance-none cursor-pointer p-2 pr-8 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
                              >
                                <option value="equals">Equals</option>
                                <option value="not_equals">Does Not Equal</option>
                                <option value="contains">Contains</option>
                                <option value="greater_than">Greater Than (&gt;)</option>
                                <option value="less_than">Less Than (&lt;)</option>
                                <option value="exists">Exists</option>
                                <option value="not_exists">Does Not Exist</option>
                              </select>
                              <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                            </div>
                          )}
                        </div>
                        {(!f.operator || (f.operator !== 'exists' && f.operator !== 'not_exists')) && (
                          <div className="relative">
                            <input
                              type={f.type === 'date' ? 'datetime-local' : 'text'}
                              placeholder={isFetchingSchema ? 'Loading schema...' : 'Filter value...'}
                              value={f.value}
                              onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                              disabled={!selectedCollection || isFetchingSchema}
                              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:opacity-50"
                            />
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button
                        onClick={addFilter}
                        disabled={!selectedCollection || isFetchingSchema}
                        className="flex-1 flex justify-center items-center gap-1 p-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>+ Add Filter</span>
                      </button>
                      <button
                        onClick={() => {
                          if (!selectedCollection) return;

                          const validFilters = debouncedFilters.map(f => ({
                            key: f.key,
                            value: getCoercedFilterValue(f.value),
                            operator: f.operator || 'equals',
                            type: f.type || 'string'
                          }));

                          getDocumentsQueryCode(selectedCollection, currentResource, undefined, validFilters)
                            .then((queryCodeStr) => {
                              navigator.clipboard.writeText(queryCodeStr).then(() => {
                                setCopiedQuery(true);
                                setTimeout(() => setCopiedQuery(false), 2000);
                              });
                            })
                            .catch(err => {
                              console.error("Failed to generate query code:", err);
                              alert("Failed to generate query code: " + err.message);
                            });
                        }}
                        disabled={!selectedCollection || isFetchingSchema}
                        className="flex justify-center items-center gap-2 p-2 px-3 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Export current filter criteria as Python script (MongoDB PyMongo)"
                      >
                        {copiedQuery ? <CheckIcon className="w-4 h-4 text-green-500" /> : <FileCopyIcon className="w-4 h-4" />}
                        <span>Export</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex-grow overflow-hidden">
                  {renderDocumentList()}
                </div>
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-slate-200 dark:bg-slate-700 hover:bg-blue-400 dark:hover:bg-blue-500 transition-colors cursor-col-resize z-10 flex-shrink-0" />

            {/* Column 3: Document Editor */}
            <Panel defaultSize={60} minSize={30}>
              <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto">
                <div className="p-4 space-y-4">
                  <header className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Editor</h2>
                      {selectedDocument && (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-400 dark:text-slate-500">ID:</span>
                          <span className="font-mono text-xs text-slate-700 dark:text-slate-200">{getDocId(selectedDocument)}</span>
                          <button
                            onClick={() => handleTogglePin(selectedDocument, selectedCollection!)}
                            className={`ml-2 p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${isDocumentPinned(selectedDocument) ? 'text-blue-500 bg-blue-100 dark:bg-blue-900/50' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            title={isDocumentPinned(selectedDocument) ? 'Unpin document' : 'Pin document'}
                            aria-label={isDocumentPinned(selectedDocument) ? 'Unpin document' : 'Pin document'}
                          >
                            <PinIcon className={`w-5 h-5 ${isDocumentPinned(selectedDocument) ? 'fill-current' : 'stroke-current'} transition-colors`} />
                          </button>
                          <button
                            onClick={async () => {
                              if (selectedCollection && selectedDocument) {
                                setIsLoading(true);
                                try {
                                  const refreshed = await getSingleDocument(
                                    currentResource.accountId,
                                    currentResource.databaseName,
                                    selectedCollection,
                                    getDocId(selectedDocument)
                                  );

                                  if (editMode && editorRef.current) {
                                    const editedValue = editorRef.current.getCurrentValue();
                                    let isDifferent = false;

                                    try {
                                      const parsedEdited = JSON.parse(editedValue);
                                      const ignoredKeys = ['_id', 'datetime_creation', 'datetime_last_modified'];

                                      const editedWithoutIgnored = omit(parsedEdited, ignoredKeys);
                                      const refreshedWithoutIgnored = omit(refreshed, ignoredKeys);

                                      isDifferent = !isEqual(editedWithoutIgnored, refreshedWithoutIgnored);
                                    } catch (e) {
                                      // If JSON is invalid, fall back to string comparison
                                      const freshString = JSON.stringify(refreshed, null, 2);
                                      isDifferent = editedValue !== freshString;
                                    }

                                    if (isDifferent) {
                                      // Setup dialog state
                                      setDiffCurrentEditedText(editedValue);
                                      setDiffIncomingDocument(refreshed);
                                      setIsDiffOverwriteDialogOpen(true);
                                      setIsLoading(false);
                                      return;
                                    }
                                  }

                                  setSelectedDocument(refreshed);
                                  setPinnedDocuments(prev => prev.map(p =>
                                    getDocId(p.doc) === getDocId(selectedDocument)
                                      ? { ...p, doc: refreshed }
                                      : p
                                  ));
                                  if (editMode && editorRef.current) {
                                    editorRef.current.setCurrentValue(JSON.stringify(refreshed, null, 2));
                                  }
                                } catch (e) {
                                  // Optionally set error
                                } finally {
                                  setIsLoading(false);
                                }
                              }
                            }}
                            className="p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                            title="Refresh document"
                            aria-label="Refresh document"
                            disabled={isLoading}
                          >
                            <RefreshIcon className="w-5 h-5" />
                          </button>
                          {!editMode && (
                            <>
                              <button
                                className={`p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 ${editMode ? 'text-blue-500 bg-blue-100 dark:bg-blue-900/50' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                onClick={() => setEditMode(true)}
                                disabled={isLoading}
                                title="Edit document"
                                aria-label="Edit document"
                              >
                                <EditIcon className={`w-5 h-5 ${editMode ? 'fill-current' : 'stroke-current'} transition-colors`} />
                              </button>
                              <button
                                className="p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                                onClick={() => {
                                  if (selectedDocument) {
                                    // Remove _id from copy if present
                                    const { _id, ...rest } = selectedDocument;
                                    setCreateDocInitial(rest);
                                    setIsCreateDialogOpen(true);
                                  }
                                }}
                                disabled={isLoading || !selectedDocument}
                                title="Insert copy as new document"
                                aria-label="Insert copy as new document"
                              >
                                <FileCopyIcon className="w-5 h-5 stroke-current transition-colors" />
                              </button>
                              <button
                                className="p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 text-slate-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40"
                                onClick={() => {
                                  if (selectedDocument) {
                                    setDeleteTargetDoc(selectedDocument);
                                    setIsDeleteDialogOpen(true);
                                  }
                                }}
                                disabled={isLoading || !selectedDocument}
                                title="Delete document"
                                aria-label="Delete document"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                              <button
                                className="p-2 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 text-slate-400 hover:text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                                onClick={() => setIsHistoryDialogOpen(true)}
                                disabled={isLoading || !selectedDocument}
                                title="View document history"
                                aria-label="View document history"
                              >
                                <HistoryIcon className="w-5 h-5" />
                              </button>
                            </>
                          )}
                          {editMode && (
                            <button
                              className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400"
                              onClick={() => setEditMode(false)}
                              disabled={isLoading}
                              title="Cancel edit"
                              aria-label="Cancel edit"
                            >
                              <XIcon className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {selectedDocument && !editMode && <button onClick={() => { setSelectedDocument(null); setBreadcrumbs([]); }} className="p-1.5 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title="Close document view"><XIcon className="w-4 h-4" /></button>}
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
            </Panel>
          </PanelGroup>
        </main>
        {pinnedDocuments.length > 0 && <PinnedDrawer />}
      </div>
      {/* Create Document Dialog */}
      <CreateDocumentDialog
        open={isCreateDialogOpen}
        initialDoc={createDocInitial}
        onClose={() => setIsCreateDialogOpen(false)}
        onSave={handleCreateDocument}
        loading={isLoading}
        collectionName={selectedCollection || ''}
      />
      {/* Delete Document Dialog */}
      <DeleteDocumentDialog
        open={isDeleteDialogOpen}
        document={deleteTargetDoc}
        onClose={() => { setIsDeleteDialogOpen(false); setDeleteTargetDoc(null); }}
        onDelete={handleDeleteDocument}
        loading={isDeleting}
      />
      {/* Document History Dialog */}
      <DocumentHistoryDialog
        open={isHistoryDialogOpen}
        documentId={selectedDocument ? getDocId(selectedDocument) : ''}
        collectionName={selectedCollection || ''}
        resource={currentResource}
        onClose={() => setIsHistoryDialogOpen(false)}
      />
      {/* Diff Overwrite Dialog */}
      <DiffOverwriteDialog
        open={isDiffOverwriteDialogOpen}
        oldValue={displayDiffOldValue}
        newValue={displayDiffNewValue}
        onClose={() => setIsDiffOverwriteDialogOpen(false)}
        onOverwrite={() => {
          if (diffIncomingDocument) {
            setSelectedDocument(diffIncomingDocument);
            setPinnedDocuments(prev => prev.map(p =>
              getDocId(p.doc) === getDocId(diffIncomingDocument)
                ? { ...p, doc: diffIncomingDocument }
                : p
            ));
            if (editMode && editorRef.current) {
              editorRef.current.setCurrentValue(JSON.stringify(diffIncomingDocument, null, 2));
            }
          }
          setIsDiffOverwriteDialogOpen(false);
        }}
      />
      <style>{`
          @keyframes fade-in-fast { 
            from { opacity: 0; } 
            to { opacity: 1; } 
          }
          .animate-fade-in-fast { 
            animation: fade-in-fast 0.3s ease-out forwards; 
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.1); opacity: 0.7; }
          }
          .animate-pulse { 
            animation: pulse 1s infinite; 
          }
      `}</style>
    </div>
  );
};

export default DataExplorerPage;