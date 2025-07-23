import React, { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '@mui/material';
import MonacoEditor from '@monaco-editor/react';
import { updateDocument } from '../services/dbService';


interface DocumentEditViewProps {
  document: Record<string, any>;
  collection: string | null;
  docId: string;
  loading?: boolean;
  onCancel?: () => void;
}

const DocumentEditView: React.FC<DocumentEditViewProps> = ({ document, collection, docId, loading, onCancel }) => {
  const [jsonValue, setJsonValue] = useState(JSON.stringify(document, null, 2));
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const { theme } = useTheme();

  const handleSave = async () => {
    try {
      const parsed = JSON.parse(jsonValue);
      if (!collection || !docId) throw new Error('Missing collection or document ID');
      await updateDocument(collection, docId, parsed);
      setFeedback({ type: 'success', message: 'Document saved successfully.' });
      if (onCancel) onCancel();
    } catch (e: any) {
      setFeedback({ type: 'error', message: e?.message || 'Invalid JSON or failed to save.' });
    }
  };

  // ...existing code...

  return (
    <div className="relative p-4 rounded-lg shadow bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Edit Document</h3>
        <div className="flex gap-2">
          <Button variant="contained" color="success" size="small" onClick={handleSave} disabled={loading}>
            Save
          </Button>
        </div>
      </div>
      <div className="mb-2">
        <div className="w-full py-2 px-3 rounded bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 font-semibold text-center border border-blue-200 dark:border-blue-700 mb-2">
          You are in <b>Edit Mode</b>. Changes are not saved until you click Save.
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs text-slate-500 dark:text-slate-400 font-semibold">Edit JSON</div>
        <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden" style={{ minHeight: 800, height: 800, width: '100%', display: 'flex' }}>
          <MonacoEditor
            height="100%"
            width="100%"
            defaultLanguage="json"
            value={jsonValue}
            onChange={v => setJsonValue(v ?? '')}
            theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
            options={{
              minimap: { enabled: false },
              folding: true,
              scrollBeyondLastLine: false,
              fontSize: 14,
              wordWrap: 'on',
              readOnly: !!loading,
              lineNumbers: 'on',
              formatOnPaste: true,
              formatOnType: true,
              automaticLayout: true,
            }}
          />
        </div>
      </div>
      {feedback && (
        <div className={`fixed left-1/2 -translate-x-1/2 bottom-6 px-4 py-2 rounded shadow text-sm font-semibold z-50 ${feedback.type === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
          {feedback.message}
        </div>
      )}
    </div>
  );
};

export default DocumentEditView;
