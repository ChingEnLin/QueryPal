
import React, { useState, useMemo, useEffect } from 'react';

interface QueryDisplayProps {
  code: string;
  onCodeChange: (newCode: string) => void;
  onRunQuery: () => void;
  onSaveQuery: () => void;
  isExecuting: boolean;
  historyCount: number;
  historyIndex: number;
  onNavigateHistory: (direction: 'prev' | 'next') => void;
  isTransferable?: boolean;
  onOpenInExplorer?: () => void;
  canWrite?: boolean;
}

const WRITE_OPERATION_REGEX = /\.(insert_one|insert_many|update_one|update_many|replace_one|delete_one|delete_many|bulk_write|drop|drop_index|drop_indexes|create_index|create_indexes|rename_collection)\s*\(/i;

const detectQueryType = (code: string): string => {
  if (/\.aggregate\s*\(/.test(code)) {
    const stageMatches = code.match(/\{\s*\$[a-z]+/g);
    const stageCount = stageMatches ? stageMatches.length : 0;
    return stageCount > 0 ? `aggregate · ${stageCount} stage${stageCount !== 1 ? 's' : ''}` : 'aggregate';
  }
  if (/\.find\s*\(/.test(code)) return 'find';
  if (/\.count\s*\(|\.countDocuments\s*\(/.test(code)) return 'count';
  if (/\.distinct\s*\(/.test(code)) return 'distinct';
  if (WRITE_OPERATION_REGEX.test(code)) return 'write';
  return 'query';
};

const QueryDisplay: React.FC<QueryDisplayProps> = ({
  code, onCodeChange, onRunQuery, onSaveQuery,
  isExecuting, historyCount, historyIndex, onNavigateHistory,
  isTransferable, onOpenInExplorer, canWrite = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [allowWrite, setAllowWrite] = useState(false);

  const isWriteOperation = useMemo(() => WRITE_OPERATION_REGEX.test(code), [code]);
  const queryType = useMemo(() => detectQueryType(code), [code]);

  useEffect(() => {
    if (isWriteOperation) setAllowWrite(false);
  }, [code, isWriteOperation]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error('Failed to copy:', err));
  };

  const writeBlocked = isWriteOperation && !canWrite;
  const isRunDisabled = isExecuting || writeBlocked || (isWriteOperation && !allowWrite);

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isRunDisabled) { onRunQuery(); setAllowWrite(false); }
    }
  };

  return (
    <div id="query-display-panel" className="qa-card animate-fade-in" style={{ padding: '10px 14px 12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg)' }}>// generated query</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--muted)', background: 'var(--soft)', padding: '2px 8px', borderRadius: 4 }}>
            {queryType}
          </span>
          {historyCount > 1 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'var(--soft)', borderRadius: 99, padding: '1px 6px' }}>
              <button
                onClick={() => onNavigateHistory('prev')}
                disabled={historyIndex <= 0}
                aria-label="Previous query version"
                style={{ background: 'none', border: 'none', cursor: historyIndex <= 0 ? 'default' : 'pointer', color: historyIndex <= 0 ? 'var(--border)' : 'var(--muted)', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
                title="Previous version"
              >‹</button>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', minWidth: 36, textAlign: 'center' }}>
                v{historyIndex + 1}/{historyCount}
              </span>
              <button
                onClick={() => onNavigateHistory('next')}
                disabled={historyIndex >= historyCount - 1}
                aria-label="Next query version"
                style={{ background: 'none', border: 'none', cursor: historyIndex >= historyCount - 1 ? 'default' : 'pointer', color: historyIndex >= historyCount - 1 ? 'var(--border)' : 'var(--muted)', fontSize: 12, padding: '0 2px', lineHeight: 1 }}
                title="Next version"
              >›</button>
            </span>
          )}
          {isWriteOperation && (
            <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 4, background: 'color-mix(in oklch, #c94250 12%, var(--bg))', color: '#c94250', fontFamily: 'var(--font-mono)' }}>
              write op
            </span>
          )}
          {onOpenInExplorer && (
            <button
              onClick={isTransferable ? onOpenInExplorer : undefined}
              disabled={!isTransferable}
              title={
                isTransferable
                  ? 'Open in Data Explorer'
                  : 'This query can\'t be opened in Explorer (only find() queries are supported). Your result will be saved if you switch tabs.'
              }
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: isTransferable ? 'var(--accent-soft)' : 'var(--soft)',
                border: `1px solid ${isTransferable ? 'color-mix(in oklch, var(--accent) 30%, transparent)' : 'var(--border)'}`,
                color: isTransferable ? 'var(--accent)' : 'var(--muted)',
                borderRadius: 4, cursor: isTransferable ? 'pointer' : 'default',
                fontSize: 11, padding: '2px 8px', fontFamily: 'var(--font-body)',
                opacity: isTransferable ? 1 : 0.55,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <path d="M11.5 11.5h3m-1.5-1.5v3" strokeLinecap="round" />
              </svg>
              Open in Explorer
            </button>
          )}
        </div>
      </div>

      {/* Code editor */}
      <div style={{ position: 'relative', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
        <textarea
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          onKeyDown={handleEditorKeyDown}
          style={{
            width: '100%', minHeight: 160, padding: '12px 14px',
            background: '#0f0e0d', color: '#c8c4bc',
            fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.65,
            border: 'none', outline: 'none', resize: 'vertical',
            boxSizing: 'border-box', borderRadius: 'var(--radius-sm)',
            display: 'block',
          }}
          spellCheck={false}
        />
        <button
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Copy'}
          style={{
            position: 'absolute', top: 8, right: 8,
            padding: '3px 9px', borderRadius: 4, cursor: 'pointer',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
            color: copied ? '#4aab73' : '#8a8580', fontSize: 11,
            fontFamily: 'var(--font-mono)', transition: 'color 0.15s',
          }}
        >
          {copied ? '✓ copied' : 'copy'}
        </button>
      </div>

      {/* Write acknowledge / permission gate */}
      {isWriteOperation && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 8,
          padding: '8px 12px', borderRadius: 'var(--radius-sm)',
          background: 'color-mix(in oklch, #c94250 8%, var(--bg))',
          border: '1px solid color-mix(in oklch, #c94250 22%, var(--border))',
        }}>
          {writeBlocked ? (
            <span style={{ fontSize: 12, color: '#c94250', flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Write operations are disabled for your role. Contact an Admin to request access.
            </span>
          ) : (
            <>
              <span style={{ fontSize: 12, color: '#c94250', flex: 1 }}>
                Write operation detected — acknowledge to enable Run
              </span>
              <div
                onClick={() => setAllowWrite(!allowWrite)}
                role="switch"
                aria-checked={allowWrite}
                id="allow-write-toggle"
                title="Toggle to acknowledge write operation"
                style={{
                  width: 36, height: 20, borderRadius: 99, cursor: 'pointer', flexShrink: 0,
                  background: allowWrite ? 'var(--accent)' : 'var(--border)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2,
                  left: allowWrite ? 18 : 2,
                  width: 16, height: 16, borderRadius: 99,
                  background: 'white', transition: 'left 0.2s',
                }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <button
          id="tutorial-save-button"
          onClick={onSaveQuery}
          disabled={!code}
          className="qa-btn"
          style={{ fontSize: 12 }}
        >
          Save
        </button>
        <button
          onClick={() => { onRunQuery(); setAllowWrite(false); }}
          disabled={isRunDisabled}
          className="qa-btn primary"
          aria-label={isExecuting ? 'Running' : 'Run query'}
          title={writeBlocked ? 'Write operations require Analyst or Admin role' : (isWriteOperation && !allowWrite) ? 'Acknowledge the write operation above to enable Run' : undefined}
          style={{ fontSize: 12 }}
        >
          {isExecuting ? 'Running' : 'Run'}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
          ⌘↩ run
        </span>
      </div>
    </div>
  );
};

export default QueryDisplay;
