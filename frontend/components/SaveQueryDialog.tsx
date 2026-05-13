
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SavedQuery } from '../types';

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', background: 'var(--soft)',
  border: '1px solid var(--border)', borderRadius: 6,
  color: 'var(--fg)', fontFamily: 'var(--font-body)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

interface SaveQueryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Pick<SavedQuery, 'name' | 'prompt' | 'code'> | SavedQuery) => void;
  isSaving: boolean;
  initialData: Partial<SavedQuery> & { prompt: string; code: string };
}

const SaveQueryDialog: React.FC<SaveQueryDialogProps> = ({ isOpen, onClose, onSave, isSaving, initialData }) => {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const isEditMode = !!initialData.id;

  useEffect(() => {
    if (isOpen) {
      setName(initialData.name || '');
      setPrompt(initialData.prompt || '');
      setCode(initialData.code || '');
      setError('');
    }
  }, [isOpen, initialData]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Query name is required.'); return; }
    const saveData = isEditMode
      ? { ...(initialData as SavedQuery), name, prompt, code }
      : { name, prompt, code };
    onSave(saveData);
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes qp-dialog-in {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
        .qp-dialog-box { animation: qp-dialog-in 0.18s cubic-bezier(0.16,1,0.3,1); }
        .qp-field:focus { border-color: var(--accent) !important; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      >
        {/* Dialog */}
        <div
          className="qp-dialog-box"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sqd-title"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 12, width: '100%', maxWidth: 560,
            boxShadow: '0 20px 60px rgba(0,0,0,0.14)',
            fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column',
          }}
        >
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <span id="sqd-title" style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>
                {isEditMode ? 'Edit saved query' : 'Save query'}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 5 }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l10 10M13 3L3 13"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh', overflowY: 'auto' }}>
              <div>
                <label htmlFor="sqd-name" style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--fg)', display: 'block', marginBottom: 5 }}>
                  Name
                </label>
                <input
                  id="sqd-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="qp-field"
                  style={fieldStyle}
                  placeholder="e.g., Active Canadian Users"
                  required
                />
                {error && <p style={{ fontSize: 11.5, color: 'var(--status-err)', marginTop: 4 }}>{error}</p>}
              </div>

              <div>
                <label htmlFor="sqd-prompt" style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--fg)', display: 'block', marginBottom: 5 }}>
                  Natural language prompt
                </label>
                <textarea
                  id="sqd-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="qp-field"
                  style={{ ...fieldStyle, resize: 'vertical', minHeight: 72, lineHeight: 1.55 }}
                />
              </div>

              <div>
                <label htmlFor="sqd-code" style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--fg)', display: 'block', marginBottom: 5 }}>
                  Query code
                </label>
                <textarea
                  id="sqd-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="qp-field"
                  style={{
                    ...fieldStyle,
                    background: '#0f0e0d', color: '#c8c4bc',
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    lineHeight: 1.65, resize: 'vertical', minHeight: 120,
                  }}
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
              padding: '12px 18px', borderTop: '1px solid var(--border)',
              background: 'var(--soft)', borderRadius: '0 0 12px 12px',
            }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="qa-btn"
                style={{ fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="qa-btn primary"
                style={{ fontSize: 13, minWidth: 80, justifyContent: 'center', opacity: isSaving ? 0.6 : 1 }}
              >
                {isSaving ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'qp-spin 0.8s linear infinite' }}>
                    <circle cx="8" cy="8" r="6" strokeOpacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6"/>
                  </svg>
                ) : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body
  );
};

export default SaveQueryDialog;
