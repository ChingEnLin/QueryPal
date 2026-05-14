
import React from 'react';
import { createPortal } from 'react-dom';

interface ShortcutCheatsheetProps {
  isOpen: boolean;
  onClose: () => void;
}

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd style={{
    padding: '3px 7px', fontSize: 11.5, fontFamily: 'var(--font-mono)',
    color: 'var(--fg)', background: 'var(--soft)', border: '1px solid var(--border)',
    borderRadius: 5, lineHeight: 1,
  }}>
    {children}
  </kbd>
);

const ShortcutItem: React.FC<{ keys: string[]; description: string }> = ({ keys, description }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px', background: 'var(--soft)', borderRadius: 7,
  }}>
    <span style={{ fontSize: 13, color: 'var(--fg)' }}>{description}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {keys.map((key, i) => (
        <React.Fragment key={key}>
          <Kbd>{key}</Kbd>
          {i < keys.length - 1 && <span style={{ fontSize: 11, color: 'var(--muted)' }}>+</span>}
        </React.Fragment>
      ))}
    </div>
  </div>
);

const ShortcutCheatsheet: React.FC<ShortcutCheatsheetProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const cmd = typeof window !== 'undefined' && /mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';

  return createPortal(
    <>
      <style>{`
        @keyframes qp-dialog-in {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        .qp-dialog-box { animation: qp-dialog-in 0.18s cubic-bezier(0.16,1,0.3,1); }
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
          aria-labelledby="sc-title"
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 12, width: '100%', maxWidth: 480,
            boxShadow: '0 20px 60px rgba(0,0,0,0.14)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.4" style={{ marginRight: 8, flexShrink: 0 }}>
              <rect x="1" y="4" width="14" height="9" rx="2"/>
              <path d="M4 7h1M7 7h1M10 7h1M4 10h2M9 10h3"/>
            </svg>
            <span id="sc-title" style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>Keyboard shortcuts</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 5 }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3l10 10M13 3L3 13"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ShortcutItem keys={[cmd, 'Enter']} description="Run query (in editor)" />
            <ShortcutItem keys={[cmd, 'G']} description="Generate query (in prompt)" />
            <ShortcutItem keys={[cmd, 'S']} description="Save current query" />
            <ShortcutItem keys={[cmd, '/']} description="Show this cheatsheet" />
            <ShortcutItem keys={['Esc']} description="Close dialog or panel" />
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'flex-end',
            padding: '10px 18px', borderTop: '1px solid var(--border)',
            background: 'var(--soft)', borderRadius: '0 0 12px 12px',
          }}>
            <button
              type="button"
              onClick={onClose}
              className="qa-btn"
              style={{ fontSize: 13 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default ShortcutCheatsheet;
