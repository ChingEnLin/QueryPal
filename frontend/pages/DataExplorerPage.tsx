import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FilterState } from '../utils/queryHandover';
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
  ArrowRightIcon,
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
  initialFilters?: FilterState[];
  onNavigateBack: () => void;
  embedded?: boolean;
  sidebarSelectedCollection?: string;
  onCollectionChange?: (name: string | undefined) => void;
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
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', fontFamily: 'var(--font-body)' }}>
      <div style={{ background: 'var(--panel)', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.14)', maxWidth: 480, width: '100%', padding: 24, border: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: 'var(--status-err)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9"/></svg>
          Confirm Delete Document
        </h2>
        <p style={{ marginBottom: 12, color: 'var(--fg)', fontSize: 13 }}>Are you sure you want to delete this document? This action cannot be undone.</p>
        <div style={{ background: 'var(--soft)', borderRadius: 8, padding: 12, fontSize: 11.5, overflowX: 'auto', maxHeight: 240, marginBottom: 16, fontFamily: 'var(--font-mono)', border: '1px solid var(--border)' }}>
          <JsonDisplay data={document} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={loading} className="qa-btn" style={{ fontSize: 13 }}>Cancel</button>
          <button
            onClick={onDelete}
            disabled={loading}
            style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: 'var(--status-err)', color: 'white', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'var(--font-body)' }}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export interface OpenDocument {
  id: string;
  doc: Record<string, any>;
  collectionName: string;
  editMode: boolean;
  breadcrumbs: BreadcrumbItem[];
}

const DataExplorerPage: React.FC<DataExplorerPageProps> = ({
  resource,
  dbInfo,
  availableDbs,
  availableAccounts,
  initialDocumentId,
  initialFilters,
  onNavigateBack,
  embedded = false,
  sidebarSelectedCollection,
  onCollectionChange,
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
  const [filters, setFilters] = useState<FilterState[]>([{ id: 'default', key: 'all', value: '', isCustom: false, operator: 'contains', type: 'string' }]);
  const [debouncedFilters, setDebouncedFilters] = useState<FilterState[]>(filters);
  const [schemaTree, setSchemaTree] = useState<SchemaKeyNode[]>([]);
  const [isFetchingSchema, setIsFetchingSchema] = useState(false);
  const [currentCollectionInfo, setCurrentCollectionInfo] = useState<CollectionInfo | null>(null);

  const addFilter = () => {
    setFilters(prev => [...prev, { id: Math.random().toString(36).substring(7), key: 'all', value: '', isCustom: false, operator: 'contains', type: 'string' }]);
  };

  const removeFilter = (id: string) => {
    setFilters(prev => prev.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, updates: Partial<FilterState>) => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  // --- Editor State ---
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [docWidths, setDocWidths] = useState<Record<string, number>>({});

  // --- Create Document Dialog State ---
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDocInitial, setCreateDocInitial] = useState<Record<string, any> | null>(null);

  // --- Delete Document Dialog State ---
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [deleteTargetDoc, setDeleteTargetDoc] = React.useState<Record<string, any> | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // --- Document History Dialog State ---
  const [historyTargetDoc, setHistoryTargetDoc] = React.useState<{ docId: string, collectionName: string } | null>(null);

  // --- Diff Overwrite Dialog State ---
  const [isDiffOverwriteDialogOpen, setIsDiffOverwriteDialogOpen] = useState(false);
  const [diffIncomingDocument, setDiffIncomingDocument] = useState<Record<string, any> | null>(null);
  const [diffCurrentEditedText, setDiffCurrentEditedText] = useState<string>('');
  const [diffTargetDocId, setDiffTargetDocId] = useState<string | null>(null);

  // --- Editor Ref ---
  const editorRefs = useRef<Record<string, DocumentEditViewRef | null>>({});

  // --- Unsaved changes discard confirmation ---
  const [discardConfirmDocId, setDiscardConfirmDocId] = useState<string | null>(null);

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
      setOpenDocuments(prev => [{
        id: Math.random().toString(36).substring(7),
        doc: newDoc,
        collectionName: selectedCollection,
        editMode: false,
        breadcrumbs: []
      }, ...prev]);
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
      setOpenDocuments(prev => prev.filter(od => getDocId(od.doc) !== docId));
      setIsDeleteDialogOpen(false);
      setDeleteTargetDoc(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete document.');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedCollection, deleteTargetDoc, currentResource, setDocuments]);

  // --- Sorting State ---
  const [collectionSort, setCollectionSort] = useState<'name_asc' | 'name_desc' | 'count_desc' | 'count_asc'>('name_asc');

  // --- Navigation State ---
  // global breadcrumbs removed

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
    setFilters([{ id: 'default', key: 'all', value: '', isCustom: false, operator: 'contains', type: 'string' }]);
    setDebouncedFilters([{ id: 'default', key: 'all', value: '', isCustom: false, operator: 'contains', type: 'string' }]);
    setSchemaTree([]);
    setIsFetchingSchema(false);
    setOpenDocuments([]);
    // Do not reset pinned documents here, as they should persist across DB/collection changes.
  }, []);

  // Apply handover filters once after the first collection selection
  const appliedInitialFilters = useRef(false);
  useEffect(() => {
    if (!initialFilters?.length || appliedInitialFilters.current || !selectedCollection) return;
    appliedInitialFilters.current = true;
    setFilters(initialFilters);
    setDebouncedFilters(initialFilters);
  }, [selectedCollection, initialFilters]);

  // Debounce filters
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters(filters);
      setCurrentPage(1); // Reset to page 1 on new search
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
    fetchDocuments();
  }, [fetchDocuments]);

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
      if (e instanceof Error) setError(e.message);
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
        console.log('Setting open document:', result.document);
        setOpenDocuments([{
          id: Math.random().toString(36).substring(7),
          doc: result.document,
          collectionName: result.collectionName,
          editMode: false,
          breadcrumbs: []
        }]);

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
    setFilters([{ id: 'default', key: 'all', value: '', isCustom: false, operator: 'contains', type: 'string' }]);
    setDebouncedFilters([{ id: 'default', key: 'all', value: '', isCustom: false, operator: 'contains', type: 'string' }]);
    await fetchSchemaForCollection(collectionName);
  }, [fetchSchemaForCollection, selectedCollection]);

  // Sync active collection back to the sidebar
  useEffect(() => {
    onCollectionChange?.(selectedCollection ?? undefined);
  }, [selectedCollection, onCollectionChange]);

  // Respond to sidebar collection selection
  useEffect(() => {
    if (sidebarSelectedCollection && sidebarSelectedCollection !== selectedCollection) {
      handleCollectionClick(sidebarSelectedCollection);
    }
  }, [sidebarSelectedCollection, selectedCollection, handleCollectionClick]);

  // Auto-select first collection in embedded mode when none is selected
  useEffect(() => {
    if (embedded && !selectedCollection && !initialDocumentId && !sidebarSelectedCollection && currentDb && currentDb.collections.length > 0) {
      const first = [...currentDb.collections].sort((a, b) => a.name.localeCompare(b.name))[0];
      handleCollectionClick(first.name);
    }
  }, [embedded, selectedCollection, initialDocumentId, sidebarSelectedCollection, currentDb, handleCollectionClick]);

  const handleRefresh = useCallback(() => {
    if (!selectedCollection) return;
    setError(null);
    fetchSchemaForCollection(selectedCollection);
    fetchDocuments();
  }, [selectedCollection, fetchSchemaForCollection, fetchDocuments]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
    setCurrentPage(newPage);
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

  const sortedCollections = useMemo(() => {
    if (!currentDb) return [];
    return [...currentDb.collections].sort((a, b) => {
      if (collectionSort === 'name_asc') return a.name.localeCompare(b.name);
      if (collectionSort === 'name_desc') return b.name.localeCompare(a.name);
      if (collectionSort === 'count_desc') return b.count - a.count;
      return a.count - b.count;
    });
  }, [currentDb, collectionSort]);

  const handleObjectIdClick = useCallback(async (openDocId: string | null, objectId: string, keyContext?: string, openInNewTab?: boolean, openToSide?: boolean) => {
    if (!currentDb) return;

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

    const openDoc = openDocId ? openDocuments.find(d => d.id === openDocId) : null;
    const currentBreadcrumb: BreadcrumbItem | null = openDoc ? { collectionName: openDoc.collectionName, document: openDoc.doc } : null;

    try {
      const collectionNames = currentDb.collections.map(c => c.name);
      const result = await findDocumentById(objectId, currentResource, collectionNames, keyContext);

      if (openDocId && openDoc && !openToSide) {
        setOpenDocuments(prev => prev.map(od =>
          od.id === openDocId
            ? { ...od, collectionName: result.collectionName, doc: result.document, breadcrumbs: [...od.breadcrumbs, currentBreadcrumb!] }
            : od
        ));
      } else {
        setOpenDocuments(prev => {
          if (prev.some(od => getDocId(od.doc) === getDocId(result.document) && od.collectionName === result.collectionName)) return prev;
          return [...prev, {
            id: Math.random().toString(36).substring(7),
            doc: result.document,
            collectionName: result.collectionName,
            editMode: false,
            breadcrumbs: []
          }];
        });
      }
      if (result.collectionName !== selectedCollection) {
        onCollectionChange?.(result.collectionName);
      }
      await fetchSchemaForCollection(result.collectionName);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("An unknown error occurred while finding the document.");
    } finally {
      setIsLoading(false);
    }
  }, [openDocuments, currentResource, currentDb, currentAccount.id, fetchSchemaForCollection, selectedCollection, onCollectionChange]);

  const handleBreadcrumbClick = useCallback(async (openDocId: string, index: number) => {
    const openDoc = openDocuments.find(d => d.id === openDocId);
    if (!openDoc) return;

    const targetState = openDoc.breadcrumbs[index];
    const newBreadcrumbs = openDoc.breadcrumbs.slice(0, index);

    setOpenDocuments(prev => prev.map(od =>
      od.id === openDocId
        ? { ...od, collectionName: targetState.collectionName, doc: targetState.document, breadcrumbs: newBreadcrumbs }
        : od
    ));
    await fetchSchemaForCollection(targetState.collectionName);
  }, [openDocuments, fetchSchemaForCollection]);

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


  const renderDocumentList = () => {
    if (isLoading && documents.length === 0) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted)' }}>
          <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'qp-spin 0.8s linear infinite' }}>
            <circle cx="8" cy="8" r="6" strokeOpacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6"/>
          </svg>
          <p style={{ marginTop: 8, fontSize: 13 }}>Loading documents...</p>
        </div>
      );
    }

    if (error && !isLoading) {
      return (
        <div style={{ margin: 12, padding: '10px 14px', color: 'var(--status-err)', background: 'color-mix(in oklch, #c94250 8%, var(--bg))', border: '1px solid color-mix(in oklch, #c94250 22%, var(--border))', fontSize: 13, borderRadius: 8 }}>
          {error}
        </div>
      );
    }

    if (!selectedCollection) {
      return (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 16px' }}>
          <p style={{ fontSize: 13 }}>Select a collection to view its documents.</p>
        </div>
      );
    }

    if (documents.length === 0 && !isLoading) {
      return (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 16px' }}>
          <p style={{ fontSize: 13 }}>No documents found.</p>
          {debouncedFilters.some(f => f.value || f.operator === 'exists' || f.operator === 'not_exists') && <p style={{ fontSize: 11.5, marginTop: 4 }}>Try a different filter or value.</p>}
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flexGrow: 1, overflowY: 'auto', opacity: isLoading ? 0.5 : 1 }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {documents.map((doc) => {
              const docId = getDocId(doc);
              const isSelected = openDocuments.some(od => getDocId(od.doc) === docId);
              const isPinned = isDocumentPinned(doc);

              return (
                <li
                  key={docId}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: isSelected ? 'var(--accent-soft)' : 'transparent' }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <button
                    onClick={(e) => {
                      const newDocObj = {
                        id: Math.random().toString(36).substring(7),
                        doc,
                        collectionName: selectedCollection!,
                        editMode: false,
                        breadcrumbs: []
                      };
                      const isAlreadyOpen = openDocuments.some(od => getDocId(od.doc) === docId && od.collectionName === selectedCollection);

                      if (e.metaKey || e.ctrlKey) {
                        if (!isAlreadyOpen) {
                          setOpenDocuments(prev => [...prev, newDocObj]);
                        } else {
                          setOpenDocuments(prev => prev.filter(od => !(getDocId(od.doc) === docId && od.collectionName === selectedCollection)));
                        }
                      } else {
                        if (isAlreadyOpen) {
                          setOpenDocuments(prev => prev.filter(od => getDocId(od.doc) === docId && od.collectionName === selectedCollection));
                        } else {
                          setOpenDocuments([newDocObj]);
                        }
                      }
                    }}
                    style={{ flexGrow: 1, textAlign: 'left', padding: '9px 12px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={String(doc._id?.$oid || doc._id)}
                  >
                    {String(doc._id?.$oid || doc._id)}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 6 }}>
                    <button
                      onClick={() => { setDeleteTargetDoc(doc); setIsDeleteDialogOpen(true); }}
                      style={{ padding: 5, borderRadius: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
                      title="Delete document"
                      aria-label="Delete document"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--status-err)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9"/></svg>
                    </button>
                    <button
                      onClick={() => { const { _id, ...rest } = doc; setCreateDocInitial(rest); setIsCreateDialogOpen(true); }}
                      style={{ padding: 5, borderRadius: 5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
                      title="Copy as new document"
                      aria-label="Copy as new document"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    </button>
                    <button
                      onClick={() => handleTogglePin(doc, selectedCollection!)}
                      style={{ padding: 5, borderRadius: 5, background: 'none', border: 'none', cursor: 'pointer', color: isPinned ? 'var(--accent)' : 'var(--muted)', display: 'flex' }}
                      title={isPinned ? 'Unpin document' : 'Pin document'}
                      aria-label={isPinned ? 'Unpin document' : 'Pin document'}
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"><path d="M9.5 1.5l5 5-1.5 1.5-1-1-3 3v4l-1.5-1.5-3-3-1.5 1.5v-4l3-3-1-1zM1.5 14.5l4-4"/></svg>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        {/* Pagination */}
        <div style={{ flexShrink: 0, padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1 || isLoading} className="qa-btn" style={{ fontSize: 12, padding: '4px 10px' }}>
            Previous
          </button>
          <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Page</span>
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={handlePageInputSubmit}
              onBlur={handlePageInputSubmit}
              disabled={isLoading || totalPages <= 1}
              style={{ width: 40, textAlign: 'center', background: 'var(--soft)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, color: 'var(--fg)', padding: '2px 4px', fontFamily: 'var(--font-body)' }}
              aria-label="Current page"
            />
            <span>of {totalPages}</span>
          </div>
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages || isLoading} className="qa-btn" style={{ fontSize: 12, padding: '4px 10px' }}>
            Next
          </button>
        </div>
      </div>
    );
  };

  const handleEditSave = async (openDocId: string) => {
    const openDoc = openDocuments.find(d => d.id === openDocId);
    if (openDoc) {
      setIsLoading(true);
      try {
        const refreshed = await getSingleDocument(
          currentResource.accountId,
          currentResource.databaseName,
          openDoc.collectionName,
          getDocId(openDoc.doc)
        );

        setDiscardConfirmDocId(null);
        setOpenDocuments(prev => prev.map(od => od.id === openDocId ? { ...od, doc: refreshed, editMode: false } : od));

        // Sync pinned document if present
        setPinnedDocuments(prev => prev.map(p =>
          getDocId(p.doc) === getDocId(openDoc.doc)
            ? { ...p, doc: refreshed }
            : p
        ));
      } catch (e) {
        // Optionally set error
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleEditCancel = (openDocId: string) => {
    const od = openDocuments.find(d => d.id === openDocId);
    if (od && editorRefs.current[openDocId]) {
      const currentVal = editorRefs.current[openDocId]!.getCurrentValue();
      const original = JSON.stringify(od.doc, null, 2);
      if (currentVal !== original) {
        setDiscardConfirmDocId(openDocId);
        return;
      }
    }
    setOpenDocuments(prev => prev.map(od => od.id === openDocId ? { ...od, editMode: false } : od));
  };

  const confirmDiscard = (openDocId: string) => {
    setDiscardConfirmDocId(null);
    setOpenDocuments(prev => prev.map(od => od.id === openDocId ? { ...od, editMode: false } : od));
  };

  const PinnedDrawer = () => {
    const drawerHeight = isPinnedDrawerOpen ? '100%' : '48px';
    const minCardHeight = 120;
    const maxCardHeight = 600;
    return (
      <div
        style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 30, width: '60vw', maxWidth: '100vw', minWidth: 320, height: drawerHeight, pointerEvents: 'auto', transition: 'height 0.3s ease-in-out' }}
        aria-hidden={!isPinnedDrawerOpen && pinnedDocuments.length === 0}
      >
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--panel)', borderLeft: '2px solid var(--accent)', boxShadow: '0 0 20px rgba(0,0,0,0.1)' }}>
          <button
            onClick={() => setIsPinnedDrawerOpen(!isPinnedDrawerOpen)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', minHeight: 48, background: 'none', border: 'none', cursor: 'pointer', width: '100%', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-body)' }}
            aria-expanded={isPinnedDrawerOpen}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5"><path d="M9.5 1.5l5 5-1.5 1.5-1-1-3 3v4l-1.5-1.5-3-3-1.5 1.5v-4l3-3-1-1zM1.5 14.5l4-4"/></svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>Pinned Documents ({pinnedDocuments.length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {pinnedDocuments.length > 0 && (
                <button
                  onClick={e => { e.stopPropagation(); handleClearAllPins(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid color-mix(in oklch, #c94250 40%, var(--border))', borderRadius: 6, fontSize: 12, color: 'var(--status-err)', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                  title="Clear all pinned documents"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9"/></svg>
                  Clear All
                </button>
              )}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="1.5" style={{ transform: isPinnedDrawerOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}><path d="M3 6l5 5 5-5"/></svg>
            </div>
          </button>
          {isPinnedDrawerOpen && pinnedDocuments.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px', background: 'var(--soft)', borderBottom: '1px solid var(--border)', minHeight: 32, userSelect: 'none' }}>
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
                style={{ width: 44, height: 24, position: 'relative', background: 'transparent', border: '1px dashed var(--accent)', borderRadius: 6, display: 'inline-block', cursor: 'nwse-resize', userSelect: 'none', boxSizing: 'border-box' }}
              >
                <div style={{ position: 'absolute', right: 0, bottom: 0, width: 20, height: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', pointerEvents: 'none' }}>
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none"><rect x="6" y="16" width="8" height="2" rx="1" fill="var(--accent)" /><rect x="12" y="10" width="2" height="8" rx="1" fill="var(--accent)" /></svg>
                </div>
              </div>
              <span style={{ fontSize: 11.5, color: 'var(--muted)', marginLeft: 4 }}>{pinnedCardWidth}×{pinnedCardHeight}px</span>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)', display: isPinnedDrawerOpen ? 'block' : 'none' }}>
            {pinnedDocuments.length > 0 ? (
              <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {pinnedDocuments.map(({ doc, collectionName }) => (
                  <div
                    key={getDocId(doc)}
                    className="qa-card"
                    style={{ height: pinnedCardHeight, width: pinnedCardWidth, minHeight: minCardHeight, maxHeight: maxCardHeight, minWidth: minCardWidth, maxWidth: maxCardWidth, flex: '0 0 auto', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                  >
                    <header style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', margin: 0 }}>{collectionName}</p>
                        <p style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }} title={getDocId(doc)}>{getDocId(doc)}</p>
                      </div>
                      <button
                        onClick={() => handleTogglePin(doc, collectionName)}
                        style={{ padding: 4, borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
                        title="Unpin document"
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--status-err)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
                      </button>
                    </header>
                    <div style={{ padding: 12, flexGrow: 1, overflowY: 'auto' }}>
                      <JsonDisplay data={doc} onObjectIdClick={(objId, keyCtx, openNewTab, openToSide) => handleObjectIdClick(null, objId, keyCtx, openNewTab, openToSide)} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
                Pin documents to compare them here.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  const handleMoveDocument = (id: string, direction: 'left' | 'right') => {
    setOpenDocuments(prev => {
      const index = prev.findIndex(d => d.id === id);
      if (index === -1) return prev;
      
      const newDocs = [...prev];
      if (direction === 'left' && index > 0) {
        [newDocs[index - 1], newDocs[index]] = [newDocs[index], newDocs[index - 1]];
      } else if (direction === 'right' && index < prev.length - 1) {
        [newDocs[index], newDocs[index + 1]] = [newDocs[index + 1], newDocs[index]];
      }
      return newDocs;
    });
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

  const pageContent = (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', height: embedded ? '100%' : '100vh', position: 'relative', background: 'var(--bg)', fontFamily: 'var(--font-body)' }}>

        {/* Loading Overlay */}
        {isLoadingDbsForAccount && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--panel)', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.12)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ animation: 'qp-spin 0.8s linear infinite' }}>
                <circle cx="8" cy="8" r="6" strokeOpacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6"/>
              </svg>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>Switching account...</span>
            </div>
          </div>
        )}

        {/* Header — hidden in embedded mode (AppTopBar handles breadcrumb) */}
        {!embedded && <header style={{ flexShrink: 0, background: 'var(--panel)', borderBottom: '1px solid var(--border)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <MongoIcon className="w-9 h-9" style={{ color: 'var(--accent)' }} />
                <div>
                  <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg)', margin: 0 }}>Data Explorer</h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    <div style={{ position: 'relative' }} ref={accountSwitcherRef}>
                      <button
                        onClick={() => setIsAccountSwitcherOpen(!isAccountSwitcherOpen)}
                        disabled={availableAccounts.length <= 1}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: availableAccounts.length <= 1 ? 'default' : 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
                        title="Switch account"
                      >
                        {currentAccount.name}
                        {availableAccounts.length > 1 && <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isAccountSwitcherOpen ? 'rotate(180deg)' : 'none' }}><path d="M3 6l5 5 5-5"/></svg>}
                      </button>
                      {isAccountSwitcherOpen && (
                        <div style={{ position: 'absolute', top: '100%', marginTop: 6, width: 240, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 20, padding: 6 }}>
                          {availableAccounts.map(acc => (
                            <button
                              key={acc.id}
                              onClick={() => handleAccountSwitch(acc)}
                              style={{ width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: 'none', cursor: 'pointer', background: acc.id === currentAccount.id ? 'var(--accent-soft)' : 'none', color: acc.id === currentAccount.id ? 'var(--accent)' : 'var(--fg)', fontWeight: acc.id === currentAccount.id ? 600 : 400 }}
                            >
                              {acc.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <span style={{ color: 'var(--muted)' }}>/</span>
                    <div style={{ position: 'relative' }} ref={dbSwitcherRef}>
                      <button
                        onClick={() => setIsDbSwitcherOpen(!isDbSwitcherOpen)}
                        disabled={currentAccountDbs.length <= 1 || isLoadingDbsForAccount}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: currentAccountDbs.length <= 1 ? 'default' : 'pointer', color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}
                        title="Switch database"
                      >
                        {isLoadingDbsForAccount ? 'Loading...' : (currentDb?.name || 'Select Database')}
                        {!isLoadingDbsForAccount && currentAccountDbs.length > 1 && <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isDbSwitcherOpen ? 'rotate(180deg)' : 'none' }}><path d="M3 6l5 5 5-5"/></svg>}
                      </button>
                      {isDbSwitcherOpen && (
                        <div style={{ position: 'absolute', top: '100%', marginTop: 6, width: 240, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 20, padding: 6 }}>
                          {currentAccountDbs.map(db => (
                            <button
                              key={db.name}
                              onClick={() => handleDbSwitch(db)}
                              style={{ width: '100%', textAlign: 'left', padding: '7px 10px', fontSize: 13, borderRadius: 6, border: 'none', cursor: 'pointer', background: db.name === currentDb?.name ? 'var(--accent-soft)' : 'none', color: db.name === currentDb?.name ? 'var(--accent)' : 'var(--fg)', fontWeight: db.name === currentDb?.name ? 600 : 400 }}
                            >
                              {db.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={handleClearDocCache}
                  disabled={cacheClearStatus !== 'idle'}
                  className="qa-btn"
                  style={{ width: 36, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Clear the server cache for linked document lookups"
                  aria-label="Clear cache"
                >
                  {cacheClearStatus === 'loading' && <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'qp-spin 0.8s linear infinite' }}><circle cx="8" cy="8" r="6" strokeOpacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6"/></svg>}
                  {cacheClearStatus === 'success' && <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5"><path d="M3 8l3.5 3.5L13 5"/></svg>}
                  {cacheClearStatus === 'error' && <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--status-err)" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>}
                  {cacheClearStatus === 'idle' && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>}
                </button>
                <button
                  onClick={onNavigateBack}
                  className="qa-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                  title="Return to the query generator"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3L5 8l5 5"/></svg>
                  Back to Query Generator
                </button>
              </div>
            </div>
          </div>
        </header>}

        {/* Main Content Area */}
        <main style={{ flexGrow: 1, overflow: 'hidden', display: 'block', width: '100%', height: '100%', position: 'relative' }}>
          <PanelGroup orientation="horizontal" id={embedded ? 'querypal-panel-layout-embedded' : 'querypal-panel-layout'} style={{ width: '100%', height: '100%', position: 'relative' }}>
            {/* Column 1: Collections — hidden in embedded mode (sidebar handles this) */}
            {!embedded && <Panel defaultSize={20} minSize={10}>
              <div style={{ height: '100%', background: 'var(--soft)', overflowY: 'auto' }}>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: 0 }}>Collections</h2>
                    <select
                      value={collectionSort}
                      onChange={(e) => setCollectionSort(e.target.value as typeof collectionSort)}
                      title="Sort collections"
                      style={{ fontSize: 11.5, fontFamily: 'var(--font-body)', color: 'var(--muted)', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px', cursor: 'pointer', outline: 'none' }}
                    >
                      <option value="name_asc">A → Z</option>
                      <option value="name_desc">Z → A</option>
                      <option value="count_desc">Most docs</option>
                      <option value="count_asc">Fewest docs</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {isLoadingDbsForAccount ? (
                      <div style={{ textAlign: 'center', padding: 16, color: 'var(--muted)', fontSize: 13 }}>Loading collections...</div>
                    ) : sortedCollections.length > 0 ? (
                      sortedCollections.map(col => (
                        <button
                          key={col.name}
                          onClick={() => handleCollectionClick(col.name)}
                          style={{ width: '100%', textAlign: 'left', padding: '9px 11px', borderRadius: 7, fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', background: selectedCollection === col.name ? 'var(--accent)' : 'var(--panel)', color: selectedCollection === col.name ? 'white' : 'var(--fg)' }}
                          onMouseEnter={(e) => { if (selectedCollection !== col.name) (e.currentTarget as HTMLElement).style.background = 'var(--accent-soft)'; }}
                          onMouseLeave={(e) => { if (selectedCollection !== col.name) (e.currentTarget as HTMLElement).style.background = 'var(--panel)'; }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.name}</span>
                            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 10, background: selectedCollection === col.name ? 'rgba(255,255,255,0.2)' : 'var(--soft)', flexShrink: 0, marginLeft: 6 }}>{col.count.toLocaleString()}</span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div style={{ textAlign: 'center', padding: 16, color: 'var(--muted)', fontSize: 13 }}>No collections found.</div>
                    )}
                  </div>
                </div>
              </div>
            </Panel>}

            {!embedded && <PanelResizeHandle style={{ width: 1, background: 'var(--border)', cursor: 'col-resize', flexShrink: 0, zIndex: 10 }} />}

            {/* Column 2: Documents */}
            <Panel defaultSize={embedded ? 28 : 20} minSize={15}>
              <div style={{ height: '100%', background: 'var(--panel)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', margin: 0 }}>
                      Documents {totalDocuments > 0 && <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({totalDocuments.toLocaleString()})</span>}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        onClick={handleOpenCreateDialog}
                        disabled={!selectedCollection || isLoading || isFetchingSchema}
                        style={{ padding: 5, borderRadius: 5, background: isCreateDialogOpen ? 'var(--accent-soft)' : 'none', border: 'none', cursor: !selectedCollection ? 'not-allowed' : 'pointer', color: isCreateDialogOpen ? 'var(--accent)' : 'var(--muted)', display: 'flex', opacity: !selectedCollection ? 0.5 : 1 }}
                        title="Create new document"
                        aria-label="Create new document"
                        onMouseEnter={(e) => { if (selectedCollection) (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                        onMouseLeave={(e) => { if (!isCreateDialogOpen) (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                      </button>
                      <button
                        onClick={handleRefresh}
                        disabled={!selectedCollection || isLoading || isFetchingSchema}
                        style={{ padding: 5, borderRadius: 5, background: 'none', border: 'none', cursor: !selectedCollection ? 'not-allowed' : 'pointer', color: 'var(--muted)', display: 'flex', opacity: !selectedCollection ? 0.5 : 1 }}
                        title="Refresh documents and schema"
                        onMouseEnter={(e) => { if (selectedCollection) (e.currentTarget as HTMLElement).style.color = 'var(--fg)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: (isLoading || isFetchingSchema) ? 'qp-spin 1s linear infinite' : 'none' }}><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                    {filters.map((f) => (
                      <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, background: 'var(--soft)', border: '1px solid var(--border)', borderRadius: 8, position: 'relative', flexShrink: 0 }}>
                        {filters.length > 1 && (
                          <button
                            onClick={() => removeFilter(f.id)}
                            style={{ position: 'absolute', top: -8, right: -8, padding: 3, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '50%', color: 'var(--muted)', display: 'flex', cursor: 'pointer', zIndex: 10 }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--status-err)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--status-err)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
                          >
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l10 10M13 3L3 13"/></svg>
                          </button>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <div style={{ flex: '2 2 0%', position: 'relative' }}>
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
                                      updateFilter(f.id, { key: newKey, type: isDate ? 'date' : 'string', operator: 'equals' });
                                    }
                                  }}
                                  disabled={!selectedCollection || isFetchingSchema}
                                  style={{ width: '100%', fontSize: 12, appearance: 'none', cursor: 'pointer', padding: '6px 26px 6px 8px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}
                                  title="Select a field to filter by"
                                >
                                  <option value="all">All Fields</option>
                                  <RenderOptions nodes={schemaTree} level={0} />
                                  <option disabled>──────────</option>
                                  <option value="__custom__">Type custom field...</option>
                                </select>
                                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M3 6l5 5 5-5"/></svg>
                              </>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
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
                                  style={{ width: '100%', fontSize: 12, padding: '6px 26px 6px 8px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}
                                  autoFocus
                                />
                                <button
                                  onClick={() => updateFilter(f.id, { isCustom: false, key: 'all' })}
                                  style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', padding: 2, borderRadius: '50%', background: 'var(--soft)', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
                                  title="Back to dropdown"
                                >
                                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l10 10M13 3L3 13"/></svg>
                                </button>
                              </div>
                            )}
                          </div>
                          {/* Operator always visible: "All Fields" gets contains-only; specific fields get full list */}
                          <div style={{ flex: '1 1 0%', position: 'relative' }}>
                            <select
                              value={f.operator || (f.key === 'all' ? 'contains' : 'equals')}
                              onChange={(e) => updateFilter(f.id, { operator: e.target.value })}
                              disabled={!selectedCollection || isFetchingSchema}
                              style={{ width: '100%', fontSize: 12, appearance: 'none', cursor: 'pointer', padding: '6px 26px 6px 8px', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}
                            >
                              {f.key === 'all' ? (
                                <option value="contains">Contains</option>
                              ) : (
                                <>
                                  <option value="equals">Equals</option>
                                  <option value="not_equals">Not Equals</option>
                                  <option value="contains">Contains</option>
                                  <option value="greater_than">{'>'} Greater</option>
                                  <option value="less_than">{'<'} Less</option>
                                  <option value="exists">Exists</option>
                                  <option value="not_exists">Not Exists</option>
                                </>
                              )}
                            </select>
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><path d="M3 6l5 5 5-5"/></svg>
                          </div>
                        </div>
                        {(!f.operator || (f.operator !== 'exists' && f.operator !== 'not_exists')) && (
                          <div style={{ position: 'relative' }}>
                            <input
                              type={f.type === 'date' ? 'datetime-local' : 'text'}
                              placeholder={isFetchingSchema ? 'Loading schema...' : 'Filter value...'}
                              value={f.value}
                              onChange={(e) => updateFilter(f.id, { value: e.target.value })}
                              disabled={!selectedCollection || isFetchingSchema}
                              style={{ width: '100%', paddingLeft: 30, paddingRight: 8, paddingTop: 6, paddingBottom: 6, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--fg)', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
                            />
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={addFilter}
                        disabled={!selectedCollection || isFetchingSchema}
                        className="qa-btn"
                        style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 12 }}
                      >
                        + Add Filter
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
                        className="qa-btn"
                        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, fontSize: 12 }}
                        title="Export current filter criteria as Python script (MongoDB PyMongo)"
                      >
                        {copiedQuery
                          ? <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5"><path d="M3 8l3.5 3.5L13 5"/></svg>
                          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        }
                        Export
                      </button>
                    </div>
                  </div>
                </div>
                <div style={{ flexGrow: 1, overflow: 'hidden' }}>
                  {renderDocumentList()}
                </div>
              </div>
            </Panel>

            <PanelResizeHandle style={{ width: 1, background: 'var(--border)', cursor: 'col-resize', flexShrink: 0, zIndex: 10 }} />

            {/* Column 3: Document View */}
            <Panel defaultSize={embedded ? 72 : 60} minSize={30}>
              <div style={{ height: '100%', background: 'var(--bg)', overflowX: 'auto', overflowY: 'hidden', display: 'flex', flexDirection: 'row', position: 'relative' }}>
                {openDocuments.length === 0 ? (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--muted)' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ opacity: 0.35 }}>
                      <rect x="3" y="3" width="18" height="18" rx="3"/>
                      <path d="M7 8h10M7 12h7M7 16h5"/>
                    </svg>
                    <span style={{ fontSize: 12.5, fontFamily: 'var(--font-body)' }}>Select a document to view it here</span>
                  </div>
                ) : (
                  openDocuments.map((openDoc, index) => (
                    <div
                      key={openDoc.id}
                      style={{
                        height: '100%',
                        width: openDocuments.length === 1 ? '100%' : (docWidths[openDoc.id] || 600),
                        minWidth: openDocuments.length === 1 ? undefined : 400,
                        flexShrink: openDocuments.length === 1 ? undefined : 0,
                        display: 'flex',
                        flexDirection: 'column',
                        borderLeft: index === 0 ? 'none' : '1px solid var(--border)',
                        background: 'var(--panel)',
                        position: 'relative',
                      }}
                    >
                      {/* Drag-resize handle for side-by-side docs */}
                      {openDocuments.length > 1 && (
                        <div
                          style={{ position: 'absolute', right: -1, top: 0, bottom: 0, width: 4, cursor: 'col-resize', zIndex: 20 }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const startX = e.clientX;
                            const startWidth = docWidths[openDoc.id] || 600;
                            const onMouseMove = (moveEvent: MouseEvent) => {
                              const newWidth = Math.max(400, startWidth + (moveEvent.clientX - startX));
                              setDocWidths(prev => ({ ...prev, [openDoc.id]: newWidth }));
                            };
                            const onMouseUp = () => {
                              window.removeEventListener('mousemove', onMouseMove);
                              window.removeEventListener('mouseup', onMouseUp);
                            };
                            window.addEventListener('mousemove', onMouseMove);
                            window.addEventListener('mouseup', onMouseUp);
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        />
                      )}

                      {/* Header bar */}
                      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', height: 44, borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
                        {/* Title: collection + id */}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0, maxWidth: '40%' }} title={openDoc.collectionName}>
                            {openDoc.collectionName}
                          </span>
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="var(--border)" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M6 3l5 5-5 5"/></svg>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={getDocId(openDoc.doc)}>
                            {getDocId(openDoc.doc)}
                          </span>
                        </div>

                        {/* Toolbar */}
                        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                          {/* Pin */}
                          <button
                            onClick={() => handleTogglePin(openDoc.doc, openDoc.collectionName)}
                            title={isDocumentPinned(openDoc.doc) ? 'Unpin document' : 'Pin document'}
                            style={{ padding: '5px 6px', borderRadius: 6, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', background: isDocumentPinned(openDoc.doc) ? 'var(--accent-soft)' : 'transparent', color: isDocumentPinned(openDoc.doc) ? 'var(--accent)' : 'var(--muted)' }}
                            onMouseEnter={(e) => { if (!isDocumentPinned(openDoc.doc)) (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                            onMouseLeave={(e) => { if (!isDocumentPinned(openDoc.doc)) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <svg width="13" height="13" viewBox="0 0 16 16" fill={isDocumentPinned(openDoc.doc) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5"><path d="M9.5 1.5l5 5-1.5 1.5-1-1-3 3v4l-1.5-1.5-3-3-1.5 1.5v-4l3-3-1-1zM1.5 14.5l4-4"/></svg>
                          </button>

                          {/* Refresh */}
                          <button
                            onClick={async () => {
                              setIsLoading(true);
                              try {
                                const refreshed = await getSingleDocument(
                                  currentResource.accountId,
                                  currentResource.databaseName,
                                  openDoc.collectionName,
                                  getDocId(openDoc.doc)
                                );
                                if (openDoc.editMode && editorRefs.current[openDoc.id]) {
                                  const editedValue = editorRefs.current[openDoc.id]!.getCurrentValue();
                                  let isDifferent = false;
                                  try {
                                    const parsedEdited = JSON.parse(editedValue);
                                    const ignoredKeys = ['_id', 'datetime_creation', 'datetime_last_modified'];
                                    const editedWithoutIgnored = omit(parsedEdited, ignoredKeys);
                                    const refreshedWithoutIgnored = omit(refreshed, ignoredKeys);
                                    isDifferent = !isEqual(editedWithoutIgnored, refreshedWithoutIgnored);
                                  } catch (e) {
                                    const freshString = JSON.stringify(refreshed, null, 2);
                                    isDifferent = editedValue !== freshString;
                                  }
                                  if (isDifferent) {
                                    setDiffCurrentEditedText(editedValue);
                                    setDiffIncomingDocument(refreshed);
                                    setDiffTargetDocId(openDoc.id);
                                    setIsDiffOverwriteDialogOpen(true);
                                    setIsLoading(false);
                                    return;
                                  }
                                }
                                setOpenDocuments(prev => prev.map(od => od.id === openDoc.id ? { ...od, doc: refreshed } : od));
                                setPinnedDocuments(prev => prev.map(p =>
                                  getDocId(p.doc) === getDocId(openDoc.doc) ? { ...p, doc: refreshed } : p
                                ));
                                if (openDoc.editMode && editorRefs.current[openDoc.id]) {
                                  editorRefs.current[openDoc.id]!.setCurrentValue(JSON.stringify(refreshed, null, 2));
                                }
                              } catch (e) {
                              } finally {
                                setIsLoading(false);
                              }
                            }}
                            title="Refresh document"
                            disabled={isLoading}
                            style={{ padding: '5px 6px', borderRadius: 6, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', background: 'transparent', color: 'var(--muted)', opacity: isLoading ? 0.4 : 1 }}
                            onMouseEnter={(e) => { if (!isLoading) { (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; } }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                          </button>

                          {!openDoc.editMode && (
                            <>
                              {/* Edit */}
                              <button
                                onClick={() => setOpenDocuments(prev => prev.map(od => od.id === openDoc.id ? { ...od, editMode: true } : od))}
                                disabled={isLoading}
                                title="Edit document"
                                style={{ padding: '5px 6px', borderRadius: 6, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', background: 'transparent', color: 'var(--muted)', opacity: isLoading ? 0.4 : 1 }}
                                onMouseEnter={(e) => { if (!isLoading) { (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; } }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              {/* Duplicate */}
                              <button
                                onClick={() => { const { _id, ...rest } = openDoc.doc; setCreateDocInitial(rest); setIsCreateDialogOpen(true); }}
                                disabled={isLoading}
                                title="Insert copy as new document"
                                style={{ padding: '5px 6px', borderRadius: 6, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', background: 'transparent', color: 'var(--muted)', opacity: isLoading ? 0.4 : 1 }}
                                onMouseEnter={(e) => { if (!isLoading) { (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; } }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                              </button>
                              {/* History */}
                              <button
                                onClick={() => setHistoryTargetDoc({ docId: getDocId(openDoc.doc), collectionName: openDoc.collectionName })}
                                disabled={isLoading}
                                title="View document history"
                                style={{ padding: '5px 6px', borderRadius: 6, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', background: 'transparent', color: 'var(--muted)', opacity: isLoading ? 0.4 : 1 }}
                                onMouseEnter={(e) => { if (!isLoading) { (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--fg)'; } }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => { setDeleteTargetDoc(openDoc.doc); setIsDeleteDialogOpen(true); }}
                                disabled={isLoading}
                                title="Delete document"
                                style={{ padding: '5px 6px', borderRadius: 6, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', background: 'transparent', color: 'var(--muted)', opacity: isLoading ? 0.4 : 1 }}
                                onMouseEnter={(e) => { if (!isLoading) { (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--status-err) 8%, var(--bg))'; (e.currentTarget as HTMLElement).style.color = 'var(--status-err)'; } }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                              >
                                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9"/></svg>
                              </button>
                            </>
                          )}

                          {openDoc.editMode && (
                            /* Cancel edit */
                            <button
                              onClick={() => handleEditCancel(openDoc.id)}
                              disabled={isLoading}
                              title="Cancel edit"
                              style={{ padding: '5px 6px', borderRadius: 6, border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', background: 'transparent', color: 'var(--muted)', opacity: isLoading ? 0.4 : 1 }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--fg)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                            >
                              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13"/></svg>
                            </button>
                          )}

                          {/* Divider */}
                          <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 3px' }} />

                          {/* Move left/right (multi-doc) */}
                          {openDocuments.length > 1 && (
                            <>
                              <button
                                onClick={() => handleMoveDocument(openDoc.id, 'left')}
                                disabled={index === 0}
                                title="Move left"
                                style={{ padding: '5px 6px', borderRadius: 6, border: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', background: 'transparent', color: 'var(--muted)', opacity: index === 0 ? 0.3 : 1 }}
                                onMouseEnter={(e) => { if (index !== 0) (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3L5 8l5 5"/></svg>
                              </button>
                              <button
                                onClick={() => handleMoveDocument(openDoc.id, 'right')}
                                disabled={index === openDocuments.length - 1}
                                title="Move right"
                                style={{ padding: '5px 6px', borderRadius: 6, border: 'none', cursor: index === openDocuments.length - 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', background: 'transparent', color: 'var(--muted)', opacity: index === openDocuments.length - 1 ? 0.3 : 1 }}
                                onMouseEnter={(e) => { if (index !== openDocuments.length - 1) (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                              >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3l5 5-5 5"/></svg>
                              </button>
                            </>
                          )}

                          {/* Close — disabled while editing */}
                          <button
                            onClick={() => setOpenDocuments(prev => prev.filter(od => od.id !== openDoc.id))}
                            title={openDoc.editMode ? 'Exit edit mode before closing' : 'Close'}
                            disabled={openDoc.editMode}
                            style={{ padding: '5px 6px', borderRadius: 6, border: 'none', cursor: openDoc.editMode ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', background: 'var(--soft)', color: 'var(--muted)', opacity: openDoc.editMode ? 0.35 : 1 }}
                            onMouseEnter={(e) => { if (!openDoc.editMode) { (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklch, var(--status-err) 10%, var(--bg))'; (e.currentTarget as HTMLElement).style.color = 'var(--status-err)'; } }}
                            onMouseLeave={(e) => { if (!openDoc.editMode) { (e.currentTarget as HTMLElement).style.background = 'var(--soft)'; (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; } }}
                          >
                            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l10 10M13 3L3 13"/></svg>
                          </button>
                        </div>
                      </div>

                      {/* Breadcrumb trail (linked-doc navigation) */}
                      {openDoc.breadcrumbs.length > 0 && (
                        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3, padding: '5px 14px', background: 'var(--soft)', borderBottom: '1px solid var(--border)', fontSize: 11.5, color: 'var(--muted)' }}>
                          {openDoc.breadcrumbs.map((crumb, i) => (
                            <React.Fragment key={`${i}-${getDocId(crumb.document)}`}>
                              <button
                                onClick={() => handleBreadcrumbClick(openDoc.id, i)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'var(--font-body)', fontSize: 11.5, padding: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '14ch' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                              >
                                <span style={{ fontWeight: 600 }}>{crumb.collectionName}</span>
                                <span style={{ fontFamily: 'var(--font-mono)', marginLeft: 3 }}>/ {getDocId(crumb.document)}</span>
                              </button>
                              <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, opacity: 0.4 }}><path d="M6 3l5 5-5 5"/></svg>
                            </React.Fragment>
                          ))}
                          <span style={{ fontWeight: 600, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '14ch' }}>
                            {openDoc.collectionName}<span style={{ fontFamily: 'var(--font-mono)', fontWeight: 400, marginLeft: 3 }}>/ {getDocId(openDoc.doc)}</span>
                          </span>
                        </div>
                      )}

                      {/* Document content */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12, opacity: isLoading ? 0.45 : 1 }}>
                        {!openDoc.editMode && (
                          <div style={{ background: 'var(--soft)', flex: 1, borderRadius: 8, padding: '12px 14px', fontSize: 11.5, overflowX: 'auto', fontFamily: 'var(--font-mono)', lineHeight: 1.7, border: '1px solid var(--border)' }}>
                            <JsonDisplay data={openDoc.doc} onObjectIdClick={(objId, keyCtx, openNewTab, openToSide) => handleObjectIdClick(openDoc.id, objId, keyCtx, openNewTab, openToSide)} />
                          </div>
                        )}
                        {openDoc.editMode && discardConfirmDocId === openDoc.id && (
                          <div style={{
                            padding: '10px 14px', borderRadius: 8, flexShrink: 0,
                            background: 'color-mix(in oklch, var(--status-err) 9%, var(--panel))',
                            border: '1px solid color-mix(in oklch, var(--status-err) 28%, var(--border))',
                            display: 'flex', alignItems: 'center', gap: 10,
                          }}>
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--status-err)" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                              <path d="M8 1L15 14H1L8 1z"/><path d="M8 6v4M8 11.5v.5"/>
                            </svg>
                            <span style={{ flex: 1, fontSize: 12.5, color: 'var(--status-err)', fontFamily: 'var(--font-body)' }}>
                              You have unsaved changes. Discard them?
                            </span>
                            <button
                              onClick={() => setDiscardConfirmDocId(null)}
                              style={{ fontSize: 12, fontWeight: 500, padding: '4px 10px', borderRadius: 6, border: '1px solid color-mix(in oklch, var(--status-err) 28%, var(--border))', background: 'var(--panel)', color: 'var(--fg)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                            >
                              Keep editing
                            </button>
                            <button
                              onClick={() => confirmDiscard(openDoc.id)}
                              style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--status-err)', background: 'var(--status-err)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                            >
                              Discard
                            </button>
                          </div>
                        )}
                        {openDoc.editMode && (
                          <DocumentEditView
                            ref={(el) => {
                              if (el) editorRefs.current[openDoc.id] = el;
                              else delete editorRefs.current[openDoc.id];
                            }}
                            accountId={currentResource.accountId}
                            databaseName={currentResource.databaseName}
                            document={openDoc.doc}
                            collection={openDoc.collectionName}
                            docId={getDocId(openDoc.doc)}
                            loading={isLoading}
                            onCancel={() => handleEditCancel(openDoc.id)}
                            onSave={() => handleEditSave(openDoc.id)}
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
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
        open={!!historyTargetDoc}
        documentId={historyTargetDoc?.docId || ''}
        collectionName={historyTargetDoc?.collectionName || ''}
        resource={currentResource}
        onClose={() => setHistoryTargetDoc(null)}
      />
      {/* Diff Overwrite Dialog */}
      <DiffOverwriteDialog
        open={isDiffOverwriteDialogOpen}
        oldValue={displayDiffOldValue}
        newValue={displayDiffNewValue}
        onClose={() => setIsDiffOverwriteDialogOpen(false)}
        onOverwrite={() => {
          if (diffIncomingDocument && diffTargetDocId) {
            setOpenDocuments(prev => prev.map(od => od.id === diffTargetDocId ? { ...od, doc: diffIncomingDocument } : od));
            setPinnedDocuments(prev => prev.map(p =>
              getDocId(p.doc) === getDocId(diffIncomingDocument)
                ? { ...p, doc: diffIncomingDocument }
                : p
            ));
            const od = openDocuments.find(d => d.id === diffTargetDocId);
            if (od?.editMode && editorRefs.current[diffTargetDocId]) {
              editorRefs.current[diffTargetDocId]!.setCurrentValue(JSON.stringify(diffIncomingDocument, null, 2));
            }
          }
          setIsDiffOverwriteDialogOpen(false);
          setDiffTargetDocId(null);
        }}
      />
      <style>{`
        @keyframes qp-spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );

  return embedded ? pageContent : (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
      {pageContent}
    </div>
  );
};

export default DataExplorerPage;