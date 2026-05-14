import { useState, forwardRef, useImperativeHandle } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import MonacoEditor from '@monaco-editor/react';
import { updateDocument, getSingleDocument } from '../services/dbService';
import { isEqual, omit } from 'lodash';
import SaveConflictDialog from './SaveConflictDialog';

interface DocumentEditViewProps {
  accountId?: string;
  databaseName?: string;
  document: Record<string, any>;
  collection: string | null;
  docId: string;
  loading?: boolean;
  onCancel?: () => void;
  onSave?: () => void | Promise<void>;
}

export interface DocumentEditViewRef {
  getCurrentValue: () => string;
  setCurrentValue: (val: string) => void;
}

const DocumentEditView = forwardRef<DocumentEditViewRef, DocumentEditViewProps>(
  ({ accountId, databaseName, document, collection, docId, loading, onCancel, onSave }, ref) => {
    const [jsonValue, setJsonValue] = useState(JSON.stringify(document, null, 2));
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const { theme } = useTheme();
    const [isSaving, setIsSaving] = useState(false);
    const [isConflictDialogOpen, setIsConflictDialogOpen] = useState(false);
    const [conflictServerDocStr, setConflictServerDocStr] = useState<string>('');

    useImperativeHandle(ref, () => ({
      getCurrentValue: () => jsonValue,
      setCurrentValue: (val: string) => setJsonValue(val),
    }));

    const handleSave = async (forceSave = false) => {
      setIsSaving(true);
      try {
        const parsed = JSON.parse(jsonValue);
        if (!accountId || !databaseName || !collection || !docId) throw new Error('Missing DB info');

        if (!forceSave) {
          const refreshed = await getSingleDocument(accountId, databaseName, collection, docId);
          const ignoredKeys = ['_id', 'datetime_creation', 'datetime_last_modified'];
          const oldWithoutIgnored = omit(document, ignoredKeys);
          const newWithoutIgnored = omit(refreshed, ignoredKeys);

          if (!isEqual(oldWithoutIgnored, newWithoutIgnored)) {
            const displayServerDoc = { ...refreshed };
            ignoredKeys.forEach(key => {
              if (key in parsed) displayServerDoc[key] = parsed[key];
              else delete displayServerDoc[key];
            });
            setConflictServerDocStr(JSON.stringify(displayServerDoc, null, 2));
            setIsConflictDialogOpen(true);
            setIsSaving(false);
            return;
          }
        }

        await updateDocument(accountId, databaseName, collection, docId, parsed);
        const refreshed = await getSingleDocument(accountId, databaseName, collection, docId);
        setJsonValue(JSON.stringify(refreshed, null, 2));
        setFeedback({ type: 'success', message: 'Document saved.' });
        if (onSave) await onSave();
        if (onCancel) onCancel();
      } catch (e: any) {
        setFeedback({ type: 'error', message: e?.message || 'Invalid JSON or failed to save.' });
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>

        {/* Edit mode banner */}
        <div style={{
          padding: '8px 14px', borderRadius: 7,
          background: 'var(--accent-soft)', border: '1px solid color-mix(in oklch, var(--accent) 25%, var(--border))',
          fontSize: 12.5, color: 'var(--accent)', fontFamily: 'var(--font-body)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
            <circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5.5v.5"/>
          </svg>
          <span>Edit mode — changes are not saved until you click <strong>Save</strong>.</span>
        </div>

        {/* Monaco editor */}
        <div style={{
          flex: 1, border: '1px solid var(--border)', borderRadius: 8,
          overflow: 'hidden', minHeight: 400, display: 'flex', flexDirection: 'column',
        }}>
          <MonacoEditor
            height="560px"
            width="100%"
            defaultLanguage="json"
            value={jsonValue}
            onChange={v => setJsonValue(v ?? '')}
            theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
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

        {/* Footer actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button
            className="qa-btn"
            onClick={onCancel}
            disabled={isSaving || !!loading}
            style={{ fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            className="qa-btn primary"
            onClick={() => handleSave(false)}
            disabled={isSaving || !!loading}
            style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, opacity: (isSaving || loading) ? 0.7 : 1 }}
          >
            {isSaving && (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'qp-spin 0.7s linear infinite' }}>
                <circle cx="8" cy="8" r="6" strokeOpacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6"/>
              </svg>
            )}
            {isSaving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* Feedback toast */}
        {feedback && (
          <div style={{
            position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)',
            padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            zIndex: 50, fontFamily: 'var(--font-body)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            background: feedback.type === 'error'
              ? 'color-mix(in oklch, var(--status-err) 12%, var(--panel))'
              : 'color-mix(in oklch, var(--status-ok) 12%, var(--panel))',
            color: feedback.type === 'error' ? 'var(--status-err)' : 'var(--status-ok)',
            border: `1px solid ${feedback.type === 'error' ? 'color-mix(in oklch, var(--status-err) 30%, var(--border))' : 'color-mix(in oklch, var(--status-ok) 30%, var(--border))'}`,
          }}>
            {feedback.message}
          </div>
        )}

        <SaveConflictDialog
          open={isConflictDialogOpen}
          serverValue={conflictServerDocStr}
          localValue={jsonValue}
          onClose={() => setIsConflictDialogOpen(false)}
          onOverwrite={() => { setIsConflictDialogOpen(false); handleSave(true); }}
        />
      </div>
    );
  }
);

export default DocumentEditView;
