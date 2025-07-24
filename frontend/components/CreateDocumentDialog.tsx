import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Editor from '@monaco-editor/react';

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
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Create New Document in {collectionName}</DialogTitle>
      <DialogContent>
        <div style={{ minHeight: 480, minWidth: 600 }}>
          <Editor
            height="420px"
            defaultLanguage="json"
            value={editorValue}
            onChange={v => setEditorValue(v || '')}
            options={{ minimap: { enabled: false }, fontSize: 15 }}
          />
        </div>
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSave} color="primary" variant="contained" disabled={loading} startIcon={loading ? <CircularProgress size={18} /> : null}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateDocumentDialog;
