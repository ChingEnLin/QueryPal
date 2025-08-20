import React, { useState, useEffect } from 'react';
import {
  XIcon,
  HistoryIcon,
  AccessTimeIcon,
  PersonIcon,
  EditIcon,
  AddIcon,
  DeleteIcon,
  SpinnerIcon,
  ChevronDownIcon,
  ChevronRightIcon
} from './icons/material-icons-imports';
import { DocumentHistoryResponse, DocumentHistoryEntry, SelectedResource } from '../types';
import { getDocumentHistory } from '../services/dbService';

interface DocumentHistoryDialogProps {
  open: boolean;
  documentId: string;
  collectionName: string;
  resource: SelectedResource;
  onClose: () => void;
}

const DocumentHistoryDialog: React.FC<DocumentHistoryDialogProps> = ({
  open,
  documentId,
  collectionName,
  resource,
  onClose
}) => {
  const [historyData, setHistoryData] = useState<DocumentHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && documentId) {
      fetchDocumentHistory();
    }
  }, [open, documentId]);

  const fetchDocumentHistory = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await getDocumentHistory(resource, collectionName, documentId);
      setHistoryData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document history');
    } finally {
      setLoading(false);
    }
  };

  const toggleEntryExpansion = (entryId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(entryId)) {
      newExpanded.delete(entryId);
    } else {
      newExpanded.add(entryId);
    }
    setExpandedEntries(newExpanded);
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      relative: getRelativeTime(date)
    };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor(diff / (1000 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const getOperationIcon = (operation: string) => {
    switch (operation) {
      case 'insert': return <AddIcon className="w-4 h-4 text-green-500" />;
      case 'update': return <EditIcon className="w-4 h-4 text-blue-500" />;
      case 'delete': return <DeleteIcon className="w-4 h-4 text-red-500" />;
      default: return <EditIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getOperationColor = (operation: string) => {
    switch (operation) {
      case 'insert': return 'border-green-200 bg-green-50 dark:border-green-700 dark:bg-green-900/20';
      case 'update': return 'border-blue-200 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20';
      case 'delete': return 'border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/20';
      default: return 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20';
    }
  };

  const renderChangeValue = (value: any) => {
    if (value === null) return <span className="text-gray-400 italic">null</span>;
    if (typeof value === 'object') return <span className="font-mono text-xs">{JSON.stringify(value)}</span>;
    if (typeof value === 'string') return <span className="text-gray-800 dark:text-gray-200">"{value}"</span>;
    return <span className="text-gray-800 dark:text-gray-200">{String(value)}</span>;
  };

  const renderDiffData = (entry: DocumentHistoryEntry) => {
    if (entry.operation === 'insert') {
      return (
        <div className="mt-2 p-3 bg-green-100 dark:bg-green-900/30 rounded border">
          <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Document created with initial data:</p>
          <div className="text-xs font-mono bg-white dark:bg-gray-800 p-2 rounded border max-h-32 overflow-y-auto">
            <pre className="whitespace-pre-wrap">{JSON.stringify(entry.diff_data, null, 2)}</pre>
          </div>
        </div>
      );
    }

    if (entry.operation === 'delete') {
      return (
        <div className="mt-2 p-3 bg-red-100 dark:bg-red-900/30 rounded border">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">Document was deleted</p>
        </div>
      );
    }

    // Update operation
    const changes = Object.entries(entry.diff_data as Record<string, any>);
    
    return (
      <div className="mt-2 space-y-2">
        {changes.map(([field, change], index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-700 rounded p-2 bg-white dark:bg-gray-800">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">{field}</code>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="flex-1">
                <span className="text-red-600 dark:text-red-400 font-medium">Before:</span>{' '}
                {renderChangeValue(change.before)}
              </div>
              <span className="text-gray-400">→</span>
              <div className="flex-1">
                <span className="text-green-600 dark:text-green-400 font-medium">After:</span>{' '}
                {renderChangeValue(change.after)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 animate-fade-in-fast">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] m-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <HistoryIcon className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Document History</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <code className="font-mono">{documentId}</code> in <span className="font-medium">{collectionName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close dialog"
          >
            <XIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <SpinnerIcon className="w-8 h-8 animate-spin mb-2" />
              <p>Loading document history...</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
              <p className="font-medium">Error loading history</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {historyData && !loading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {historyData.total_entries} total change{historyData.total_entries !== 1 ? 's' : ''}
                </p>
              </div>

              {historyData.history_entries.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <HistoryIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">No history found</p>
                  <p className="text-sm">This document has no recorded changes.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {historyData.history_entries.map((entry: DocumentHistoryEntry) => {
                    const timestamp = formatTimestamp(entry.timestamp_utc);
                    const isExpanded = expandedEntries.has(entry.id);
                    const hasChanges = entry.operation === 'update' && Object.keys(entry.diff_data).length > 0;

                    return (
                      <div
                        key={entry.id}
                        className={`border rounded-lg ${getOperationColor(entry.operation)}`}
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                              {getOperationIcon(entry.operation)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                                  {entry.operation}
                                </span>
                                <span className="text-gray-400">•</span>
                                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                  <PersonIcon className="w-3 h-3" />
                                  <span>{entry.user_email}</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                                <AccessTimeIcon className="w-3 h-3" />
                                <span>{timestamp.relative}</span>
                                <span>•</span>
                                <span>{timestamp.date} at {timestamp.time}</span>
                              </div>

                              {entry.operation === 'update' && hasChanges && (
                                <button
                                  onClick={() => toggleEntryExpansion(entry.id)}
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                                >
                                  {isExpanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
                                  {Object.keys(entry.diff_data).length} field{Object.keys(entry.diff_data).length !== 1 ? 's' : ''} changed
                                </button>
                              )}

                              {(isExpanded || entry.operation !== 'update') && renderDiffData(entry)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
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

export default DocumentHistoryDialog;
