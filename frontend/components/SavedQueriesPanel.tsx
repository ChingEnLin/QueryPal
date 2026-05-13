
import React, { useState, useMemo } from 'react';
import { SavedQuery } from '../types';
import { EditIcon, TrashIcon, ShareIcon } from './icons/material-icons-imports';

interface SavedQueriesPanelProps {
    onClose: () => void;
    queries: SavedQuery[];
    onLoad: (query: SavedQuery) => void;
    onEdit: (query: SavedQuery) => void;
    onDelete: (queryId: string) => void;
    onShare: (query: SavedQuery) => void;
    isLoading: boolean;
    currentUserEmail?: string | null;
}

const timeAgo = (dateString: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const m = Math.floor(seconds / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
};

const PinIcon = () => (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="var(--accent)" stroke="var(--accent)" strokeWidth="1.2">
        <path d="M5 2v6l-2 2v1h4v4h2v-4h4v-1l-2-2V2z"/>
    </svg>
);

interface SavedQueryCardProps {
    query: SavedQuery;
    onLoad: (q: SavedQuery) => void;
    onEdit: (q: SavedQuery) => void;
    onDelete: (id: string) => void;
    onShare: (q: SavedQuery) => void;
    isOwned: boolean;
}

const SavedQueryCard: React.FC<SavedQueryCardProps> = ({ query, onLoad, onEdit, onDelete, onShare, isOwned }) => {
    const handleDelete = () => {
        if (window.confirm(`Delete "${query.name}"? This cannot be undone.`)) onDelete(query.id);
    };
    return (
        <div
            className="qa-card"
            style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', cursor: 'default' }}
        >
            {/* Pin icon */}
            {(query as any).pinned && (
                <span style={{ position: 'absolute', top: 12, right: 12 }}><PinIcon /></span>
            )}

            {/* Name + tags row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingRight: 20 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', lineHeight: 1.3 }}>{query.name}</span>
            </div>

            {/* Prompt quote */}
            <blockquote style={{
                margin: 0, borderLeft: '2px solid var(--accent)',
                paddingLeft: 10, fontSize: 12, fontStyle: 'italic',
                color: 'var(--muted)', lineHeight: 1.5,
                maxHeight: 60, overflow: 'hidden',
            }}>
                {query.prompt}
            </blockquote>

            {/* Shared-by info */}
            {!isOwned && (
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Shared by <strong style={{ color: 'var(--fg)' }}>{query.ownerEmail}</strong>
                    {' · '}edited {timeAgo(query.updatedAt)} by {query.lastModifiedBy.split('@')[0]}
                </div>
            )}

            {/* Footer row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <button
                    onClick={() => onLoad(query)}
                    className="qa-btn primary"
                    style={{ fontSize: 12, padding: '4px 12px' }}
                >
                    Load
                </button>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {isOwned && (
                        <button
                            onClick={() => onShare(query)}
                            aria-label="Share query"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 4 }}
                        >
                            <ShareIcon className="w-4 h-4" style={{ width: 14, height: 14 }} />
                        </button>
                    )}
                    <button
                        onClick={() => onEdit(query)}
                        aria-label="Edit query"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 4 }}
                    >
                        <EditIcon className="w-4 h-4" style={{ width: 14, height: 14 }} />
                    </button>
                    {isOwned && (
                        <button
                            onClick={handleDelete}
                            aria-label="Delete query"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 4 }}
                        >
                            <TrashIcon className="w-4 h-4" style={{ width: 14, height: 14 }} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const SavedQueriesPanel: React.FC<SavedQueriesPanelProps> = ({
    onClose, queries, onLoad, onEdit, onDelete, onShare, isLoading, currentUserEmail,
}) => {
    const [activeTab, setActiveTab] = useState<'my_queries' | 'shared_with_me'>('my_queries');

    const { myQueries, sharedWithMe } = useMemo(() => {
        if (!currentUserEmail) return { myQueries: [], sharedWithMe: [] };
        const myq: SavedQuery[] = [];
        const swm: SavedQuery[] = [];
        queries.forEach(q => {
            if (q.ownerEmail === currentUserEmail) myq.push(q);
            else if (q.sharedWith.includes(currentUserEmail!)) swm.push(q);
        });
        return { myQueries: myq, sharedWithMe: swm };
    }, [queries, currentUserEmail]);

    const queriesToDisplay = activeTab === 'my_queries' ? myQueries : sharedWithMe;

    const renderContent = () => {
        if (isLoading) {
            return (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--muted)' }}>
                    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5" style={{ animation: 'qp-spin 0.8s linear infinite' }}>
                        <circle cx="8" cy="8" r="6" strokeOpacity="0.3"/><path d="M8 2a6 6 0 0 1 6 6"/>
                    </svg>
                    <span style={{ fontSize: 13 }}>Loading queries…</span>
                </div>
            );
        }
        if (queriesToDisplay.length > 0) {
            return queriesToDisplay.map(q => (
                <SavedQueryCard
                    key={q.id}
                    query={q}
                    onLoad={onLoad}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onShare={onShare}
                    isOwned={activeTab === 'my_queries'}
                />
            ));
        }
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--muted)' }}>
                <svg width="32" height="32" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4">
                    <path d="M4 2h6l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
                    <path d="M6 7h5M6 10h3"/>
                </svg>
                {activeTab === 'my_queries' ? (
                    <>
                        <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>No saved queries yet</p>
                        <p style={{ fontSize: 12, margin: 0, textAlign: 'center' }}>Click Save on a generated query to add it here.</p>
                    </>
                ) : (
                    <>
                        <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>Nothing shared with you</p>
                        <p style={{ fontSize: 12, margin: 0, textAlign: 'center' }}>When a colleague shares a query, it appears here.</p>
                    </>
                )}
            </div>
        );
    };

    return (
        <>
            <style>{`@keyframes qp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            <div
                onClick={onClose}
                style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }}
                aria-hidden="true"
            />
            <aside
                id="tutorial-saved-queries-panel"
                className="qp-drawer"
                style={{
                    position: 'fixed', top: 0, right: 0, height: '100%', width: 460,
                    maxWidth: '100vw', background: 'var(--panel)', borderLeft: '1px solid var(--border)',
                    zIndex: 50, display: 'flex', flexDirection: 'column',
                    fontFamily: 'var(--font-body)',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
                    borderBottom: '1px solid var(--border)', flexShrink: 0,
                }}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.4">
                        <path d="M4 2h6l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/>
                        <path d="M6 7h5M6 10h3"/>
                    </svg>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--fg)' }}>Saved Queries</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 2 }}>· {queries.length}</span>
                    <button
                        onClick={onClose}
                        aria-label="Close saved queries panel"
                        style={{
                            marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--muted)', display: 'flex', padding: 4, borderRadius: 5,
                        }}
                    >
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 3l10 10M13 3L3 13"/>
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: 2, background: 'var(--soft)', borderRadius: 6, padding: 2 }}>
                        {(['my_queries', 'shared_with_me'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                style={{
                                    flex: 1, padding: '4px 0', fontSize: 12, fontWeight: activeTab === tab ? 500 : 400,
                                    border: 'none', borderRadius: 4, cursor: 'pointer',
                                    background: activeTab === tab ? 'var(--panel)' : 'transparent',
                                    boxShadow: activeTab === tab ? '0 0 0 1px var(--border)' : 'none',
                                    color: activeTab === tab ? 'var(--fg)' : 'var(--muted)',
                                    fontFamily: 'var(--font-body)',
                                }}
                            >
                                {tab === 'my_queries' ? 'My queries' : 'Shared with me'}
                                {tab === 'my_queries' && myQueries.length > 0 && (
                                    <span style={{ marginLeft: 5, fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{myQueries.length}</span>
                                )}
                                {tab === 'shared_with_me' && sharedWithMe.length > 0 && (
                                    <span style={{ marginLeft: 5, fontSize: 10.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{sharedWithMe.length}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {renderContent()}
                </div>
            </aside>
        </>
    );
};

export default SavedQueriesPanel;
