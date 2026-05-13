
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { SavedQuery } from '../types';

interface ShareQueryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedQuery: SavedQuery) => void;
  query: SavedQuery;
}

const fieldStyle: React.CSSProperties = {
  flex: 1, padding: '7px 10px', background: 'var(--soft)',
  border: '1px solid var(--border)', borderRadius: 6,
  color: 'var(--fg)', fontFamily: 'var(--font-body)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

const ShareQueryDialog: React.FC<ShareQueryDialogProps> = ({ isOpen, onClose, onSave, query }) => {
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSharedWith(query.sharedWith || []);
      setNewEmail('');
      setError('');
    }
  }, [isOpen, query]);

  const handleAddEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) { setError('Please enter a valid email address.'); return; }
    if (sharedWith.includes(trimmed)) { setError('This email has already been added.'); return; }
    if (trimmed === query.ownerEmail) { setError('You cannot share a query with its owner.'); return; }
    setSharedWith([...sharedWith, trimmed]);
    setNewEmail('');
    setError('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddEmail(); }
  };

  const handleRemoveEmail = (email: string) => {
    setSharedWith(sharedWith.filter(e => e !== email));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await onSave({ ...query, sharedWith });
    setIsSaving(false);
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <style>{`
        @keyframes qp-dialog-in {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        .qp-dialog-box { animation: qp-dialog-in 0.18s cubic-bezier(0.16,1,0.3,1); }
        .qp-share-field:focus { border-color: var(--accent) !important; outline: none; }
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
          aria-labelledby="sqdlg-title"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 12, width: '100%', maxWidth: 520,
            boxShadow: '0 20px 60px rgba(0,0,0,0.14)',
            fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column',
          }}
        >
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', padding: '14px 18px', borderBottom: '1px solid var(--border)', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div id="sqdlg-title" style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>Share query</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{query.name}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 5, flexShrink: 0 }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 3l10 10M13 3L3 13"/>
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto' }}>
              {/* Add email row */}
              <div>
                <label htmlFor="sqdlg-email" style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--fg)', display: 'block', marginBottom: 6 }}>
                  Add people by email
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    id="sqdlg-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => { setNewEmail(e.target.value); setError(''); }}
                    onKeyDown={handleKeyDown}
                    className="qp-share-field"
                    style={fieldStyle}
                    placeholder="colleague@example.com"
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    className="qa-btn"
                    style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0 }}
                  >
                    Add
                  </button>
                </div>
                {error && <p style={{ fontSize: 11.5, color: 'var(--status-err)', marginTop: 4, margin: '4px 0 0' }}>{error}</p>}
              </div>

              {/* People with access */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--fg)', marginBottom: 8 }}>People with access</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Owner row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 10px', background: 'var(--soft)', borderRadius: 7,
                  }}>
                    <span style={{ fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>{query.ownerEmail}</span>
                    <span style={{
                      fontSize: 10.5, color: 'var(--accent)', fontWeight: 600, textTransform: 'uppercase',
                      letterSpacing: '0.05em', background: 'var(--accent-soft)', padding: '2px 7px', borderRadius: 4,
                    }}>Owner</span>
                  </div>

                  {/* Shared-with rows */}
                  {sharedWith.map(email => (
                    <div
                      key={email}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 10px', background: 'var(--soft)', borderRadius: 7,
                      }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--fg)' }}>{email}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEmail(email)}
                        aria-label={`Remove ${email}`}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 4 }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--status-err)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--muted)'; }}
                      >
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9"/>
                        </svg>
                      </button>
                    </div>
                  ))}

                  {sharedWith.length === 0 && (
                    <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '8px 0', margin: 0 }}>
                      Not shared with anyone yet.
                    </p>
                  )}
                </div>
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
                style={{ fontSize: 13, minWidth: 72, justifyContent: 'center', opacity: isSaving ? 0.6 : 1 }}
              >
                {isSaving ? (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ animation: 'qp-spin 0.8s linear infinite' }}>
                    <circle cx="8" cy="8" r="6" strokeOpacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6"/>
                  </svg>
                ) : 'Done'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>,
    document.body
  );
};

export default ShareQueryDialog;
