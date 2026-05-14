import React from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';
import { useTheme } from '../contexts/ThemeContext';

interface SaveConflictDialogProps {
  open: boolean;
  serverValue: string;
  localValue: string;
  onClose: () => void;
  onOverwrite: () => void;
}

const SaveConflictDialog: React.FC<SaveConflictDialogProps> = ({ open, serverValue, localValue, onClose, onOverwrite }) => {
  const { theme } = useTheme();

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)',
    }}>
      <div style={{
        background: 'var(--panel)', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        width: '90vw', maxWidth: 1000, maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border)',
          background: 'color-mix(in oklch, var(--status-err) 8%, var(--panel))',
          display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="17" height="17" viewBox="0 0 16 16" fill="none" stroke="var(--status-err)" strokeWidth="1.5">
              <path d="M8 1L15 14H1L8 1z"/><path d="M8 6v4M8 11.5v.5"/>
            </svg>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--status-err)', fontFamily: 'var(--font-body)' }}>
              Save Conflict Detected
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', fontFamily: 'var(--font-body)', margin: 0, paddingLeft: 25 }}>
            The document on the server has been modified since you started editing.
            Saving now will overwrite the server's changes with your own.
          </p>
        </div>

        {/* Diff viewer */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--soft)' }}>
          <ReactDiffViewer
            oldValue={serverValue}
            newValue={localValue}
            splitView={true}
            useDarkTheme={theme === 'dark'}
            leftTitle="Server Document"
            rightTitle="Your Edits"
            extraLinesSurroundingDiff={3}
            styles={{
              variables: {
                light: { diffViewerBackground: 'var(--soft)', addedBackground: '#e6ffed', removedBackground: '#ffeef0' },
                dark: { diffViewerBackground: '#1e293b', addedBackground: '#044B53', removedBackground: '#632F34', wordAddedBackground: '#055d67', wordRemovedBackground: '#7d3840' },
              },
              line: {
                fontSize: '13px',
                fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace)',
              },
            }}
          />
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0,
        }}>
          <button className="qa-btn" onClick={onClose} style={{ fontSize: 13 }}>
            Cancel Save
          </button>
          <button
            onClick={onOverwrite}
            style={{
              fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 7,
              background: 'var(--status-err)', color: '#fff',
              border: '1px solid var(--status-err)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-body)',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 1L15 14H1L8 1z"/><path d="M8 6v4M8 11.5v.5"/>
            </svg>
            Force Overwrite
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveConflictDialog;
