
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
  GraphIcon,
  XIcon,
  AiSparkleIcon,
  PinIcon,
  DownloadIcon,
  BarChartIcon,
  EditIcon,
  UndoIcon,
  RedoIcon,
  RestoreIcon,
  ChevronDownIcon,
} from './icons/material-icons-imports';

interface QueryResultProps {
  isExecuting: boolean;
  executionError: string | null;
  executionResult: any | null;
  onDebug: () => void;
  isDebugging: boolean;
  debuggingResult: { suggestion: string } | null;
  debugError: string | null;
  sourceCollection: string | null;
  onSetIntermediateContext: (data: any, source: string) => void;
  intermediateContext: { data: any; source: string; } | null;
  onAnalyze: (dataToAnalyze: any) => void;
  isAnalyzing: boolean;
  analysisResult: AnalysisResult | null;
  analysisError: string | null;
  onEvaluateWrite?: () => void;
  isEvaluatingWrite?: boolean;
  writeEvaluationResult?: { evaluation: string } | null;
  writeEvaluationError?: string | null;
  isTutorialActive?: boolean;
  tutorialStepIndex?: number;
}

const isTableCompatible = (data: any): data is Record<string, any>[] =>
  Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && data[0] !== null;

const isContextCompatible = (data: any): boolean =>
  Array.isArray(data) && data.length > 0;

const isWriteSummary = (data: any): boolean => {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  const writeSummaryKeys = ['acknowledged','matchedCount','matched_count','modifiedCount','modified_count','upsertedId','upserted_id','upsertedCount','upserted_count','deletedCount','deleted_count','insertedId','inserted_id','insertedCount','insertedIds'];
  return Object.keys(data).some(k => writeSummaryKeys.includes(k));
};

// Segmented control tab
const Tab: React.FC<{ label: string; active: boolean; disabled?: boolean; onClick: () => void }> = ({ label, active, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled || active}
    style={{
      padding: '2px 10px', fontSize: 11.5, borderRadius: 4, border: 'none', cursor: disabled ? 'not-allowed' : active ? 'default' : 'pointer',
      background: active ? 'var(--panel)' : 'transparent',
      boxShadow: active ? '0 0 0 1px var(--border)' : 'none',
      color: active ? 'var(--fg)' : disabled ? 'var(--border)' : 'var(--muted)',
      fontWeight: active ? 500 : 400,
      transition: 'color 0.15s, background 0.15s',
      fontFamily: 'var(--font-body)',
    }}
  >
    {label}
  </button>
);

// Icon button
const IconBtn: React.FC<{ id?: string; title: string; disabled?: boolean; active?: boolean; onClick: () => void; children: React.ReactNode }> = ({ id, title, disabled, active, onClick, children }) => (
  <button
    id={id}
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
      background: active ? 'var(--accent-soft)' : 'var(--soft)',
      color: active ? 'var(--accent)' : disabled ? 'var(--border)' : 'var(--muted)',
      transition: 'border-color 0.15s, background 0.15s, color 0.15s',
    }}
  >
    {children}
  </button>
);

const QueryResult: React.FC<QueryResultProps> = ({
  isExecuting, executionError, executionResult,
  onDebug, isDebugging, debuggingResult, debugError,
  sourceCollection, onSetIntermediateContext, intermediateContext,
  onAnalyze, isAnalyzing, analysisResult, analysisError,
  onEvaluateWrite, isEvaluatingWrite, writeEvaluationResult, writeEvaluationError,
  isTutorialActive, tutorialStepIndex,
}) => {
  const [viewMode, setViewMode] = useState<'json' | 'table' | 'summary'>('json');
  const [isJsonCollapsed, setIsJsonCollapsed] = useState(false);
  const [isGraphVisible, setIsGraphVisible] = useState(false);
  const [isTableEditMode, setIsTableEditMode] = useState(false);
  const [columnHistory, setColumnHistory] = useState<string[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isDownloadMenuOpen, setIsDownloadMenuOpen] = useState(false);
  const downloadButtonRef = useRef<HTMLDivElement>(null);

  const isWriteOpSummary = useMemo(() => isWriteSummary(executionResult), [executionResult]);
  const canBeTable = useMemo(() => isTableCompatible(executionResult), [executionResult]);
  const canBeContext = useMemo(() => isContextCompatible(executionResult), [executionResult]);
  const isAnalyzable = useMemo(() => isTableCompatible(executionResult), [executionResult]);

  const allTableHeaders = useMemo(() => {
    if (!canBeTable) return [];
    const keySet = new Set<string>();
    (executionResult as Record<string, any>[]).forEach(row => {
      if (typeof row === 'object' && row !== null) Object.keys(row).forEach(k => keySet.add(k));
    });
    return Array.from(keySet);
  }, [executionResult, canBeTable]);

  const visibleHeaders = useMemo(() => columnHistory[historyIndex] || [], [columnHistory, historyIndex]);

  useEffect(() => {
    if (canBeTable) { setColumnHistory([allTableHeaders]); setHistoryIndex(0); }
  }, [allTableHeaders, canBeTable]);

  const processedDataForActions = useMemo(() => {
    if (!isTableCompatible(executionResult) || visibleHeaders.length === 0) return executionResult;
    return executionResult.map(row => {
      const newRow: Record<string, any> = {};
      for (const h of visibleHeaders) { if (Object.prototype.hasOwnProperty.call(row, h)) newRow[h] = row[h]; }
      return newRow;
    });
  }, [executionResult, visibleHeaders]);

  const isCurrentResultInContext = useMemo(() => intermediateContext?.data === executionResult, [intermediateContext, executionResult]);

  useEffect(() => {
    if (isWriteOpSummary) setViewMode('summary'); else setViewMode('json');
    setIsJsonCollapsed(false); setIsGraphVisible(false); setIsTableEditMode(false);
  }, [executionResult, isWriteOpSummary]);

  useEffect(() => {
    if (isTutorialActive) {
      if (tutorialStepIndex === 9 || tutorialStepIndex === 10) setViewMode('table');
      else setViewMode('json');
    }
  }, [isTutorialActive, tutorialStepIndex]);

  useEffect(() => {
    if (!isDownloadMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsDownloadMenuOpen(false); };
    const onClickOutside = (e: MouseEvent) => {
      if (downloadButtonRef.current && !downloadButtonRef.current.contains(e.target as Node)) setIsDownloadMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClickOutside); document.removeEventListener('keydown', onKey); };
  }, [isDownloadMenuOpen]);

  const updateHistory = (newHeaders: string[]) => {
    const newHistory = columnHistory.slice(0, historyIndex + 1);
    newHistory.push(newHeaders);
    setColumnHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };
  const handleDeleteColumn = (h: string) => updateHistory(visibleHeaders.filter(v => v !== h));
  const handleResetColumns = () => updateHistory(allTableHeaders);
  const handleUndo = () => { if (historyIndex > 0) setHistoryIndex(p => p - 1); };
  const handleRedo = () => { if (historyIndex < columnHistory.length - 1) setHistoryIndex(p => p + 1); };

  const handleSetContextClick = () => {
    if (executionResult) {
      const src = sourceCollection ? `'${sourceCollection}' collection` : 'the previous query';
      onSetIntermediateContext(processedDataForActions, src);
    }
  };

  const handleAnalyzeClick = () => {
    if (!isAnalyzable || isAnalyzing || !!analysisResult) return;
    onAnalyze(processedDataForActions);
  };

  const handleDownloadCSV = useCallback((separator: ',' | ';') => {
    if (!canBeTable) return;
    if (separator === ';') {
      const firstHeader = visibleHeaders[0];
      if (!firstHeader) return;
      const data = (processedDataForActions as Record<string, any>[]).map(r => r[firstHeader]).filter(v => v !== null && v !== undefined && String(v).trim() !== '').join(';');
      const blob = new Blob([data], { type: 'text/plain;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `query_export_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
      URL.revokeObjectURL(link.href); setIsDownloadMenuOpen(false); return;
    }
    const escapeCell = (cell: any): string => {
      if (cell === null || cell === undefined) return '';
      const str = typeof cell === 'object' ? JSON.stringify(cell) : String(cell);
      return (str.includes(separator) || str.includes('"') || str.includes('\n')) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csvRows = [visibleHeaders.map(h => escapeCell(h)).join(separator)];
    for (const row of processedDataForActions as Record<string, any>[]) csvRows.push(visibleHeaders.map(h => escapeCell(row[h])).join(separator));
    const blob = new Blob([`﻿${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `query_result_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(link.href); setIsDownloadMenuOpen(false);
  }, [canBeTable, visibleHeaders, processedDataForActions]);

  // --- Render: executing ---
  if (isExecuting) {
    return (
      <div className="qa-card" style={{ padding: '24px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--muted)', fontSize: 13 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'spin 1s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
        </svg>
        Running query…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // --- Render: error ---
  if (executionError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeIn 0.2s' }}>
        <div className="qa-card" style={{ padding: '10px 14px', background: 'color-mix(in oklch, #c94250 8%, var(--bg))', border: '1px solid color-mix(in oklch, #c94250 22%, var(--border))' }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c94250', marginBottom: 4 }}>Execution error</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#c94250', lineHeight: 1.5 }}>{executionError}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onDebug}
            disabled={isDebugging}
            className="qa-btn primary"
            style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          >
            <AiSparkleIcon className="w-4 h-4" />
            {isDebugging ? 'Debugging…' : 'Debug with AI'}
          </button>
          {isDebugging && (
            <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
              </svg>
              Analyzing error…
            </div>
          )}
          {debugError && (
            <div style={{ fontSize: 12, color: '#c94250' }}>Debugging failed: {debugError}</div>
          )}
          {debuggingResult && <DebuggingSuggestion suggestion={debuggingResult.suggestion} />}
        </div>
      </div>
    );
  }

  // --- Render: result ---
  if (executionResult) {
    const docCount = Array.isArray(executionResult) ? executionResult.length : 1;

    const graphDrawer = isGraphVisible ? createPortal(
      <>
        <div onClick={() => setIsGraphVisible(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40 }} />
        <aside style={{ position: 'fixed', top: 0, right: 0, height: '100%', width: '75%', maxWidth: 900, background: 'var(--panel)', borderLeft: '1px solid var(--border)', zIndex: 50, display: 'flex', flexDirection: 'column', animation: 'slideInRight 0.35s cubic-bezier(0.16,1,0.3,1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>Graph View</span>
            <button onClick={() => setIsGraphVisible(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
              <XIcon className="w-4 h-4" />
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'hidden', padding: 4 }}><JsonCrackViewer data={executionResult} /></div>
        </aside>
      </>,
      document.body
    ) : null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeIn 0.2s' }}>
        <div className="qa-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Card header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>Results</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, background: 'var(--soft)', color: 'var(--muted)', padding: '2px 8px', borderRadius: 4 }}>
              {docCount} {docCount === 1 ? 'doc' : 'docs'}
            </span>

            {/* Segmented view switcher */}
            <div id="tutorial-view-switcher" style={{ marginLeft: 'auto', display: 'flex', gap: 2, background: 'var(--soft)', padding: 2, borderRadius: 6 }}>
              {isWriteOpSummary && <Tab label="Summary" active={viewMode === 'summary'} disabled={isTableEditMode} onClick={() => setViewMode('summary')} />}
              <Tab label="JSON" active={viewMode === 'json'} disabled={isTableEditMode} onClick={() => setViewMode('json')} />
              <Tab label="Table" active={viewMode === 'table'} disabled={!canBeTable || isTableEditMode} onClick={() => setViewMode('table')} />
            </div>

            {/* Icon actions */}
            <div style={{ display: 'flex', gap: 5 }}>
              <IconBtn title="Graph view" disabled={isTableEditMode} onClick={() => setIsGraphVisible(true)}>
                <GraphIcon className="w-3 h-3" />
              </IconBtn>
              <IconBtn id="tutorial-analyze-button" title={isAnalyzing ? 'Analyzing…' : analysisResult ? 'Analyzed' : 'Analyze with AI'} disabled={!isAnalyzable || isAnalyzing || !!analysisResult || isTableEditMode} active={!!analysisResult} onClick={handleAnalyzeClick}>
                <BarChartIcon className="w-3 h-3" />
              </IconBtn>
              <IconBtn title={isCurrentResultInContext ? 'Context set' : 'Use as context'} disabled={!canBeContext || isTableEditMode} active={isCurrentResultInContext} onClick={handleSetContextClick}>
                <PinIcon className="w-3 h-3" />
              </IconBtn>
              {viewMode === 'json' && (
                <IconBtn title={isJsonCollapsed ? 'Expand' : 'Collapse'} onClick={() => setIsJsonCollapsed(!isJsonCollapsed)}>
                  <ChevronDownIcon className="w-3 h-3" style={{ transform: isJsonCollapsed ? 'none' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
                </IconBtn>
              )}
              {isWriteOpSummary && onEvaluateWrite && (
                <IconBtn title={isEvaluatingWrite ? 'Evaluating…' : writeEvaluationResult ? 'Evaluated' : 'Evaluate with AI'} disabled={isEvaluatingWrite || !!writeEvaluationResult || isTableEditMode} active={!!writeEvaluationResult} onClick={onEvaluateWrite}>
                  <AiSparkleIcon className="w-3 h-3" />
                </IconBtn>
              )}
            </div>
          </div>

          {/* Table actions toolbar */}
          {viewMode === 'table' && canBeTable && (
            <div id="tutorial-table-actions" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', borderBottom: '1px solid var(--border)', background: 'var(--soft)', flexShrink: 0 }}>
              {isTableEditMode ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleUndo} disabled={historyIndex <= 0} className="qa-btn" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <UndoIcon className="w-3 h-3" /> Undo
                  </button>
                  <button onClick={handleRedo} disabled={historyIndex >= columnHistory.length - 1} className="qa-btn" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RedoIcon className="w-3 h-3" /> Redo
                  </button>
                  <button onClick={handleResetColumns} className="qa-btn" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RestoreIcon className="w-3 h-3" /> Reset
                  </button>
                </div>
              ) : (
                <div ref={downloadButtonRef} style={{ position: 'relative', display: 'inline-flex' }}>
                  <button
                    onClick={() => handleDownloadCSV(',')}
                    className="qa-btn"
                    style={{ fontSize: 11, borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}
                    disabled={isTableEditMode}
                    title="Download CSV"
                  >
                    <DownloadIcon className="w-3 h-3" /> CSV
                  </button>
                  <button
                    onClick={() => setIsDownloadMenuOpen(!isDownloadMenuOpen)}
                    className="qa-btn"
                    style={{ fontSize: 11, borderRadius: '0 4px 4px 0', borderLeft: '1px solid var(--border)', padding: '4px 6px' }}
                    disabled={isTableEditMode}
                    title="More export options"
                  >
                    <ChevronDownIcon className="w-3 h-3" />
                  </button>
                  {isDownloadMenuOpen && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', zIndex: 20, minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                      <button onClick={() => handleDownloadCSV(',')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--fg)', background: 'none', border: 'none', cursor: 'pointer' }}>CSV (comma-separated)</button>
                      <button onClick={() => handleDownloadCSV(';')} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 12, color: 'var(--fg)', background: 'none', border: 'none', cursor: 'pointer' }}>TXT (semicolon-separated)</button>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => setIsTableEditMode(!isTableEditMode)}
                className="qa-btn"
                style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, ...(isTableEditMode ? { background: 'var(--accent)', color: 'white', border: '1px solid transparent' } : {}) }}
                title={isTableEditMode ? 'Done editing' : 'Edit columns'}
              >
                <EditIcon className="w-3 h-3" />
                {isTableEditMode ? 'Done' : 'Edit'}
              </button>
            </div>
          )}

          {/* Content */}
          <div style={{ padding: viewMode === 'table' ? 0 : '10px 14px', overflow: 'auto', maxHeight: 420 }}>
            {viewMode === 'summary' && (
              <div style={{ padding: '10px 14px' }}>
                <WriteSummaryDisplay data={executionResult} />
                {isEvaluatingWrite && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
                    AI evaluating…
                  </div>
                )}
                {writeEvaluationError && <div style={{ marginTop: 10, fontSize: 12, color: '#c94250' }}>{writeEvaluationError}</div>}
                {writeEvaluationResult && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--accent-soft)', border: '1px solid color-mix(in oklch, var(--accent) 20%, var(--border))', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: 4 }}>AI Evaluation</div>
                    <div style={{ fontSize: 12.5, color: 'var(--fg)', lineHeight: 1.5 }}>{writeEvaluationResult.evaluation}</div>
                  </div>
                )}
              </div>
            )}
            {viewMode === 'json' && !isJsonCollapsed && <JsonDisplay data={executionResult} />}
            {viewMode === 'table' && canBeTable && (
              <Table data={executionResult} isEditMode={isTableEditMode} visibleHeaders={visibleHeaders} onDeleteColumn={handleDeleteColumn} />
            )}
          </div>
        </div>

        {/* Analysis */}
        {isAnalyzing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', fontSize: 12, color: 'var(--muted)' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" /></svg>
            AI analyzing data…
          </div>
        )}
        {analysisError && (
          <div style={{ fontSize: 12, color: '#c94250', padding: '8px 0' }}>Analysis error: {analysisError}</div>
        )}
        {analysisResult && <AnalysisResultDisplay result={analysisResult} />}

        {graphDrawer}

        <style>{`
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        `}</style>
      </div>
    );
  }

  return null;
};

export default QueryResult;
