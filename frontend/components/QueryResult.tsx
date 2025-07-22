
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import JsonDisplay from './JsonDisplay';
import Table from './Table';
import JsonCrackViewer from './JsonCrackViewer';
import WriteSummaryDisplay from './WriteSummaryDisplay';
import DebuggingSuggestion from './DebuggingSuggestion';
import { AnalysisResult } from '../types';
import AnalysisResultDisplay from './AnalysisResultDisplay';
import {
  JsonIcon,
  TableIcon,
  ChevronDownIcon,
  GraphIcon,
  XIcon,
  InfoIcon,
  AiSparkleIcon,
  SpinnerIcon,
  PinIcon,
  DownloadIcon,
  BarChartIcon,
  EditIcon,
  UndoIcon,
  RedoIcon,
  RefreshIcon
} from './icons/material-icons-imports';

interface QueryResultProps {
  isExecuting: boolean;
  executionError: string | null;
  executionResult: any | null;
  // Props for debugging
  onDebug: () => void;
  isDebugging: boolean;
  debuggingResult: { suggestion: string } | null;
  debugError: string | null;
  // Props for multi-step context queries
  sourceCollection: string | null;
  onSetIntermediateContext: (data: any, source: string) => void;
  intermediateContext: { data: any; source: string; } | null;
  // Props for AI analysis
  onAnalyze: (dataToAnalyze: any) => void;
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  analysisError: string | null;
  // Props for tutorial
  isTutorialActive?: boolean;
  tutorialStepIndex?: number;
}

// Helper to check if data can be displayed as a table/is analyzable
const isTableCompatible = (data: any): data is Record<string, any>[] => {
  return Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null;
};

// Helper to check if data can be used as query context (any non-empty array)
const isContextCompatible = (data: any): boolean => {
  return Array.isArray(data) && data.length > 0;
};

// Helper to detect if the result is a summary of a write operation
const isWriteSummary = (data: any): boolean => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }
  const keys = Object.keys(data);
  const writeSummaryKeys = [
    'acknowledged',
    'matchedCount', 'matched_count',
    'modifiedCount', 'modified_count',
    'upsertedId', 'upserted_id',
    'upsertedCount', 'upserted_count',
    'deletedCount', 'deleted_count',
    'insertedId', 'inserted_id',
    'insertedCount',
    'insertedIds',
  ];

  // If at least one of these keys is present, we'll consider it a write summary.
  return keys.some(key => writeSummaryKeys.includes(key));
};


const QueryResult: React.FC<QueryResultProps> = ({ 
    isExecuting, executionError, executionResult, 
    onDebug, isDebugging, debuggingResult, debugError,
    sourceCollection, onSetIntermediateContext, intermediateContext,
    onAnalyze, isAnalyzing, analysisResult, analysisError,
    isTutorialActive, tutorialStepIndex
}) => {
  const [viewMode, setViewMode] = useState<'json' | 'table' | 'summary'>('json');
  const [isJsonCollapsed, setIsJsonCollapsed] = useState(false);
  const [isGraphVisible, setIsGraphVisible] = useState(false);
  const [isTableEditMode, setIsTableEditMode] = useState(false);
  
  // --- State for Table Column Editing ---
  const [columnHistory, setColumnHistory] = useState<string[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  
  // --- State for Download Menu ---
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadButtonRef = useRef<HTMLDivElement>(null);


  // Memoize checks on the execution result
  const isWriteOpSummary = useMemo(() => isWriteSummary(executionResult), [executionResult]);
  const canBeTable = useMemo(() => isTableCompatible(executionResult), [executionResult]);
  const canBeContext = useMemo(() => isContextCompatible(executionResult), [executionResult]);
  const isAnalyzable = useMemo(() => isTableCompatible(executionResult), [executionResult]);
  
  const allTableHeaders = useMemo(() => {
    if (!canBeTable) return [];
    const keySet = new Set<string>();
    (executionResult as Record<string, any>[]).forEach(row => {
        if (typeof row === 'object' && row !== null) {
            Object.keys(row).forEach(key => keySet.add(key));
        }
    });
    return Array.from(keySet);
  }, [executionResult, canBeTable]);

  const visibleHeaders = useMemo(() => columnHistory[historyIndex] || [], [columnHistory, historyIndex]);

  // Reset history whenever a new, table-compatible result comes in
  useEffect(() => {
    if (canBeTable) {
      setColumnHistory([allTableHeaders]);
      setHistoryIndex(0);
    }
  }, [allTableHeaders, canBeTable]); // Depends on allTableHeaders to rerun when data changes

  // Create a version of the execution result that is filtered based on table edits.
  const processedDataForActions = useMemo(() => {
    if (!isTableCompatible(executionResult) || visibleHeaders.length === 0) {
        return executionResult;
    }
    return executionResult.map(row => {
        const newRow: Record<string, any> = {};
        for (const header of visibleHeaders) {
            if (Object.prototype.hasOwnProperty.call(row, header)) {
                newRow[header] = row[header];
            }
        }
        return newRow;
    });
  }, [executionResult, visibleHeaders]);
  
  const isCurrentResultInContext = useMemo(() => {
    return intermediateContext?.data === executionResult;
  }, [intermediateContext, executionResult]);
  
  useEffect(() => {
    if (isWriteOpSummary) {
      setViewMode('summary');
    } else {
      setViewMode('json');
    }
    setIsJsonCollapsed(false);
    setIsGraphVisible(false);
    setIsTableEditMode(false);
  }, [executionResult, isWriteOpSummary]);

  // Effect to control view mode during tutorial
  useEffect(() => {
    if (isTutorialActive) {
        // Step 10 "View Your Results" (index 9) introduces the table.
        // Step 11 "Customize Your Table" (index 10) MUST show the table for its target element to be visible.
        if (tutorialStepIndex === 9 || tutorialStepIndex === 10) {
            setViewMode('table');
        } else {
            setViewMode('json');
        }
    }
  }, [isTutorialActive, tutorialStepIndex]);

  // Effect to handle closing the download context menu from outside clicks or Esc key.
  useEffect(() => {
    if (!isDownloadMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            setIsDownloadMenuOpen(false);
        }
    };

    const handleClickOutside = (event: MouseEvent) => {
        if (downloadButtonRef.current && !downloadButtonRef.current.contains(event.target as Node)) {
            setIsDownloadMenuOpen(false);
        }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDownloadMenuOpen]);


  // --- Handlers for Table Editing ---
  const updateHistory = (newHeaders: string[]) => {
      const newHistory = columnHistory.slice(0, historyIndex + 1);
      newHistory.push(newHeaders);
      setColumnHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  };
  
  const handleDeleteColumn = (headerToDelete: string) => {
      const newHeaders = visibleHeaders.filter(h => h !== headerToDelete);
      updateHistory(newHeaders);
  };
  
  const handleResetColumns = () => {
      updateHistory(allTableHeaders);
  };

  const handleUndo = () => {
    if (historyIndex > 0) setHistoryIndex(prev => prev - 1);
  };
  
  const handleRedo = () => {
    if (historyIndex < columnHistory.length - 1) setHistoryIndex(prev => prev + 1);
  };

  const handleSetContextClick = () => {
    if (executionResult) {
      // The source collection could be null if the query was DB-wide.
      // We create a descriptive source name for the UI.
      const sourceName = sourceCollection ? `'${sourceCollection}' collection` : 'the previous query';
      onSetIntermediateContext(processedDataForActions, sourceName);
    }
  };
  
  const handleAnalyzeClick = () => {
    if (!isAnalyzable || isAnalyzing || !!analysisResult) return;
    onAnalyze(processedDataForActions);
  };

  const handleDownloadCSV = useCallback((separator: ',' | ';') => {
    if (!canBeTable) return;

    // Special case for single-line semicolon export for email lists
    if (separator === ';') {
        const firstHeader = visibleHeaders[0];
        if (!firstHeader) {
            console.error("No visible columns to export for single-line format.");
            return;
        }
        
        const dataToExport = processedDataForActions as Record<string, any>[];
        const singleLineData = dataToExport
            .map(row => row[firstHeader])
            .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
            .join(';');

        const blob = new Blob([singleLineData], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `query_export_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        setIsDownloadMenuOpen(false);
        return; 
    }
    
    // Original logic for standard CSV export
    const headers = visibleHeaders;
    const escapeCell = (cell: any): string => {
        if (cell === null || cell === undefined) return '';
        const str = (typeof cell === 'object') ? JSON.stringify(cell) : String(cell);
        const needsQuotes = str.includes(separator) || str.includes('"') || str.includes('\n');

        if (needsQuotes) {
            const escapedStr = str.replace(/"/g, '""');
            return `"${escapedStr}"`;
        }
        return str;
    };
    
    const csvRows = [headers.map(h => escapeCell(h)).join(separator)];
    const dataToExport = processedDataForActions as Record<string, any>[];
    for (const row of dataToExport) {
        const values = headers.map(header => escapeCell(row[header]));
        csvRows.push(values.join(separator));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    link.href = URL.createObjectURL(blob);
    link.download = `query_result_${new Date().toISOString().split('T')[0]}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    setIsDownloadMenuOpen(false);
  }, [canBeTable, visibleHeaders, processedDataForActions]);

  if (isExecuting) {
    return (
        <div className="flex justify-center items-center p-8">
            <SpinnerIcon className="h-8 w-8 text-blue-500" />
            <span className="text-slate-600 dark:text-slate-400 text-lg ml-3">Running query...</span>
        </div>
    );
  }

  if (executionError) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/50 dark:border-red-500/50 dark:text-red-300 px-4 py-3 rounded-lg" role="alert">
          <strong className="font-bold">Execution Error: </strong>
          <span className="block sm:inline">{executionError}</span>
        </div>

        <div className="flex flex-col items-start gap-4">
            <button
                onClick={onDebug}
                disabled={isDebugging}
                className="flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 disabled:from-slate-400 disabled:to-slate-500 disabled:bg-gradient-to-r disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-800 focus:ring-violet-500 transition-all duration-200 transform hover:scale-[1.03] active:scale-[1]"
                title="Ask the AI to analyze the error and suggest a fix"
            >
                <AiSparkleIcon className="w-5 h-5" />
                {isDebugging ? 'Debugging with AI...' : 'Debug with AI'}
            </button>
            {isDebugging && <div className="text-slate-500 dark:text-slate-400 flex items-center gap-2"><SpinnerIcon className="h-5 w-5 text-blue-500" /><span>The AI is analyzing your query...</span></div>}
            {debugError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg w-full" role="alert"><strong className="font-bold">Debugging Error: </strong><span className="block sm:inline">{debugError}</span></div>}
            {debuggingResult && <div className="w-full"><DebuggingSuggestion suggestion={debuggingResult.suggestion} /></div>}
        </div>
      </div>
    );
  }
  
  if (executionResult) {
      const graphDrawer = isGraphVisible ? createPortal(
        <>
          <div onClick={() => setIsGraphVisible(false)} className="fixed inset-0 bg-black bg-opacity-60 z-40 animate-fade-in-fast" aria-hidden="true"></div>
          <aside className="fixed top-0 right-0 h-full w-full md:w-3/4 lg:w-2/3 bg-slate-900 shadow-2xl z-50 flex flex-col animate-slide-in-drawer">
            <header className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
              <h3 className="text-lg font-semibold text-white flex items-center gap-3"><GraphIcon className="w-5 h-5 text-blue-400" />Interactive Graph View</h3>
              <button onClick={() => setIsGraphVisible(false)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white transition-colors" aria-label="Close graph view" title="Close graph view"><XIcon className="w-5 h-5" /></button>
            </header>
            <div className="flex-grow overflow-hidden p-1"><JsonCrackViewer data={executionResult} /></div>
          </aside>
        </>,
        document.body
      ) : null;

      const renderTableActionsToolbar = () => {
        if (viewMode !== 'table' || !canBeTable) return null;

        return (
            <div id="tutorial-table-actions" className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                {isTableEditMode ? (
                     <div className="flex items-center gap-2">
                        <button onClick={handleUndo} disabled={historyIndex <= 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed" title="Undo last column change"><UndoIcon className="w-4 h-4"/>Undo</button>
                        <button onClick={handleRedo} disabled={historyIndex >= columnHistory.length - 1} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed" title="Redo last column change"><RedoIcon className="w-4 h-4"/>Redo</button>
                        <button onClick={handleResetColumns} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600" title="Restore all original columns"><RefreshIcon className="w-4 h-4"/>Reset Columns</button>
                    </div>
                ) : (
                   <div ref={downloadButtonRef} className="relative inline-flex rounded-md shadow-sm">
                        <button
                            type="button"
                            onClick={() => handleDownloadCSV(',')}
                            className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-l-md text-sm font-medium transition-colors border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            title="Download as CSV (comma-separated)"
                            disabled={isTableEditMode}
                        >
                            <DownloadIcon className="w-4 h-4" />
                            <span>Download CSV</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                            className="-ml-px relative inline-flex items-center px-2 py-1.5 rounded-r-md text-sm font-medium transition-colors border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            title="More download options"
                            disabled={isTableEditMode}
                        >
                           <ChevronDownIcon className="w-4 h-4" />
                        </button>

                        {isDownloadMenuOpen && (
                             <div className="origin-top-left absolute left-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 dark:ring-slate-600 focus:outline-none z-20">
                                <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                                    <button onClick={() => handleDownloadCSV(',')} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                                        CSV (Comma-separated)
                                    </button>
                                    <button onClick={() => handleDownloadCSV(';')} className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700" role="menuitem">
                                        TXT (Semicolon-separated)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                
                <button onClick={() => setIsTableEditMode(!isTableEditMode)} className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${isTableEditMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600'}`} title={isTableEditMode ? 'Finish editing columns' : 'Edit table columns'}>
                    <EditIcon className="w-4 h-4" />
                    {isTableEditMode ? 'Exit Edit Mode' : 'Edit Table'}
                </button>
            </div>
        );
      };

      return (
        <div className="space-y-4 animate-fade-in">
            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Query Result</h3>
            
            <div id="tutorial-view-switcher" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1 flex-wrap">
                    {isWriteOpSummary && (
                       <button onClick={() => setViewMode('summary')} disabled={viewMode === 'summary' || isTableEditMode} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${viewMode === 'summary' ? 'bg-blue-500 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50'}`} title="View a summary of the write operation"><InfoIcon className="w-4 h-4" />Summary</button>
                    )}
                    <button onClick={() => setViewMode('json')} disabled={viewMode === 'json' || isTableEditMode} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${viewMode === 'json' ? 'bg-blue-500 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50'}`} title="View the raw JSON output"><JsonIcon className="w-4 h-4" />JSON</button>
                    <button onClick={() => setViewMode('table')} disabled={!canBeTable || viewMode === 'table' || isTableEditMode} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${viewMode === 'table' ? 'bg-blue-500 text-white shadow' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50'}`} title="View the results in a sortable table"><TableIcon className="w-4 h-4" />Table</button>
                    <button onClick={() => setIsGraphVisible(true)} disabled={isTableEditMode} className={'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed'} title="View results in an interactive graph"><GraphIcon className="w-4 h-4" />Graph</button>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                     <button id="tutorial-analyze-button" onClick={handleAnalyzeClick} disabled={!isAnalyzable || isAnalyzing || !!analysisResult || isTableEditMode} className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed" title="Analyze result with AI"><BarChartIcon className="w-4 h-4" /><span>{isAnalyzing ? 'Analyzing...' : (analysisResult ? 'Analyzed' : 'Analyze')}</span></button>
                    <button onClick={handleSetContextClick} disabled={!canBeContext || isCurrentResultInContext || isTableEditMode} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${isCurrentResultInContext ? 'border-blue-500 bg-blue-500 text-white shadow' : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed`} title="Use this result as context for the next query"><PinIcon className="w-4 h-4" /><span>{isCurrentResultInContext ? 'Context Set' : 'Use as Context'}</span></button>
                    {viewMode === 'json' && (<button onClick={() => setIsJsonCollapsed(!isJsonCollapsed)} className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700" title={isJsonCollapsed ? 'Expand JSON view' : 'Collapse JSON view'}><ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${!isJsonCollapsed && 'rotate-180'}`} /></button>)}
                </div>
            </div>

            {/* Content Display */}
            <div className="space-y-6">
                {renderTableActionsToolbar()}

                <div>
                    {viewMode === 'summary' && <WriteSummaryDisplay data={executionResult} />}
                    {viewMode === 'json' && !isJsonCollapsed && <JsonDisplay data={executionResult} />}
                    {viewMode === 'table' && canBeTable && (
                      <Table 
                        data={executionResult} 
                        isEditMode={isTableEditMode}
                        visibleHeaders={visibleHeaders}
                        onDeleteColumn={handleDeleteColumn}
                      />
                    )}
                </div>
                
                {isAnalyzing && <div className="flex justify-center items-center p-8"><SpinnerIcon className="h-8 w-8 text-blue-500" /><span className="text-slate-600 dark:text-slate-400 text-lg ml-3">AI is analyzing the data...</span></div>}
                {analysisError && <div className="bg-red-100 border border-red-400 text-red-700 dark:bg-red-900/50 dark:border-red-500/50 dark:text-red-300 px-4 py-3 rounded-lg animate-fade-in" role="alert"><strong className="font-bold">Analysis Error: </strong><span className="block sm:inline">{analysisError}</span></div>}
                {analysisResult && <AnalysisResultDisplay result={analysisResult} />}
            </div>

            {graphDrawer}

            <style>{`
              @keyframes fade-in-fast { from { opacity: 0; } to { opacity: 1; } }
              .animate-fade-in-fast { animation: fade-in-fast 0.3s ease-out forwards; }
              @keyframes slide-in-drawer { from { transform: translateX(100%); } to { transform: translateX(0); } }
              .animate-slide-in-drawer { animation: slide-in-drawer 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
            `}</style>
        </div>
      );
  }

  return null;
};

export default QueryResult;
