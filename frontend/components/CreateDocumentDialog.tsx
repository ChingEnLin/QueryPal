import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
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
  const [doc, setDoc] = useState<Record<string, any>>(initialDoc || {});
  const [editorValue, setEditorValue] = useState<string>(JSON.stringify(initialDoc || {}, null, 2));
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    setDoc(initialDoc || {});
    setEditorValue(JSON.stringify(initialDoc || {}, null, 2));
    setError(null);
  }, [initialDoc, open]);

  const handleSave = () => {
    try {
      const parsed = JSON.parse(editorValue);
      onSave(parsed);
    } catch (e) {
      setError('Invalid JSON. Please fix errors before saving.');
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        style: {
          backgroundColor: theme === 'dark' ? '#1e293b' : undefined,
          color: theme === 'dark' ? '#f1f5f9' : undefined,
        },
      }}
    >
      <DialogTitle 
        style={{
          backgroundColor: theme === 'dark' ? '#1e293b' : undefined,
          color: theme === 'dark' ? '#f1f5f9' : undefined,
        }}
      >
        Create New Document in {collectionName}
      </DialogTitle>
      <DialogContent 
        style={{
          backgroundColor: theme === 'dark' ? '#1e293b' : undefined,
          color: theme === 'dark' ? '#f1f5f9' : undefined,
        }}
      >
        <div style={{ minHeight: 480, minWidth: 600 }}>
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
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </DialogContent>
      <DialogActions 
        style={{
          backgroundColor: theme === 'dark' ? '#1e293b' : undefined,
          color: theme === 'dark' ? '#f1f5f9' : undefined,
        }}
      >
        <Button onClick={onClose} disabled={loading} style={theme === 'dark' ? { color: '#f1f5f9' } : {}}>Cancel</Button>
        <Button onClick={handleSave} color="primary" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={18} /> : null} style={theme === 'dark' ? { color: '#f1f5f9' } : {}}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateDocumentDialog;
