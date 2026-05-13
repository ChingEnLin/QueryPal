import React, { useState, useEffect } from 'react';
import MonacoEditor from '@monaco-editor/react';
import { useTheme } from '../contexts/ThemeContext';

interface CreateDocumentDialogProps {
  open: boolean;
  initialDoc: Record<string, any> | null;
  onClose: () => void;
  onSave: (doc: Record<string, any>) => void;
  loading?: boolean;
  collectionName: string;
}

const CreateDocumentDialog: React.FC<CreateDocumentDialogProps> = ({ open, initialDoc, onClose, onSave, loading, collectionName }) => {
  const [editorValue, setEditorValue] = useState<string>(JSON.stringify(initialDoc || {}, null, 2));
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    setEditorValue(JSON.stringify(initialDoc || {}, null, 2));
    setError(null);
  }, [initialDoc, open]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(editorValue);
      onSave(parsed);
    } catch {
      setError('Invalid JSON. Please fix errors before saving.');
    }
  };

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        background: 'var(--panel)', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        width: '90vw', maxWidth: 780, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              background: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                <rect x="2" y="2" width="12" height="12" rx="2"/>
                <path d="M8 5v6M5 8h6"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-body)' }}>
                New Document
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
                {collectionName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={!!loading}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', padding: 4, borderRadius: 5, display: 'flex',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8"/>
            </svg>
          </button>
        </div>

        {/* Editor */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{
            flex: 1, border: 'none', minHeight: 480,
          }}>
            <MonacoEditor
              height="480px"
              defaultLanguage="json"
              theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
              value={editorValue}
              onChange={v => setEditorValue(v || '')}
              options={{
                minimap: { enabled: false },
                folding: true,
                scrollBeyondLastLine: false,
                fontSize: 13,
                wordWrap: 'on',
                readOnly: !!loading,
                lineNumbers: 'on',
                formatOnPaste: true,
                formatOnType: true,
                automaticLayout: true,
              }}
            />
          </div>
          {error && (
            <div style={{
              margin: '0 16px 0', padding: '8px 12px', borderRadius: 6,
              background: 'color-mix(in oklch, var(--status-err) 10%, var(--panel))',
              border: '1px solid color-mix(in oklch, var(--status-err) 25%, var(--border))',
              color: 'var(--status-err)', fontSize: 12.5, fontFamily: 'var(--font-body)',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0,
        }}>
          <button className="qa-btn" onClick={onClose} disabled={!!loading} style={{ fontSize: 13 }}>
            Cancel
          </button>
          <button
            className="qa-btn primary"
            onClick={handleSave}
            disabled={!!loading}
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, opacity: loading ? 0.7 : 1 }}
          >
            {loading && (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'qp-spin 0.7s linear infinite' }}>
                <circle cx="8" cy="8" r="6" strokeOpacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6"/>
              </svg>
            )}
            {loading ? 'Saving…' : 'Create Document'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateDocumentDialog;
