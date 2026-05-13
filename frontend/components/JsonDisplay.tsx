
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CheckIcon, ChevronDownIcon, ClipboardIcon, SearchIcon, XIcon, ArrowUpwardIcon, ArrowDownwardIcon, CaseSensitiveIcon, WholeWordIcon, RegexIcon, ImageIcon } from './icons/material-icons-imports';

// ── Design-token colour constants ────────────────────────────────────────────
// All syntax colours chosen to read clearly on var(--soft) = #f3f0eb background.
const C = {
  key:     '#7c6fa0',          // object keys, BSON type labels
  str:     'var(--accent)',    // string values  (#3a8c5f green)
  num:     '#b07838',          // numbers (warm amber)
  bool:    '#2b6cb0',          // booleans (blue)
  nil:     'var(--status-err)',// null (#c94250 red)
  link:    '#2b6cb0',          // ObjectId clickable link (blue)
  muted:   'var(--muted)',     // collapsed counts, chevron, icons
  fg:      'var(--fg)',        // default / wrapper text
  border:  'var(--border)',    // tree-indent lines
  panel:   'var(--panel)',     // popup backgrounds
  soft:    'var(--soft)',      // hover backgrounds
  ok:      'var(--status-ok)', // copied-check icon
  accent:  'var(--accent)',
  accentSoft: 'var(--accent-soft)',
};

// ── Helper: highlight search matches ────────────────────────────────────────
const highlightText = (text: string, searchRegex: RegExp | null): React.ReactNode => {
  if (!searchRegex || !text) return text;

  let localRegex: RegExp;
  try {
    localRegex = new RegExp(searchRegex.source, searchRegex.flags.includes('g') ? searchRegex.flags : searchRegex.flags + 'g');
  } catch (e) {
    return text;
  }

  const matches: { start: number; end: number; text: string }[] = [];
  let match;
  localRegex.lastIndex = 0;

  while ((match = localRegex.exec(text)) !== null) {
    matches.push({ start: match.index, end: match.index + match[0].length, text: match[0] });
    if (match[0].length === 0) localRegex.lastIndex++;
  }

  if (matches.length === 0) return text;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((m, index) => {
    if (m.start > lastIndex) nodes.push(text.substring(lastIndex, m.start));
    nodes.push(
      <mark key={`match-${index}`} className="px-0.5 rounded text-black bg-yellow-200" data-search-match="true">
        {m.text}
      </mark>
    );
    lastIndex = m.end;
  });

  if (lastIndex < text.length) nodes.push(text.substring(lastIndex));
  return <>{nodes}</>;
};

// ── ObjectId with navigation + copy ─────────────────────────────────────────
const ObjectIdDisplay: React.FC<{
  objectId: string;
  onObjectIdClick?: (id: string, keyContext?: string, openInNewTab?: boolean, openToSide?: boolean) => void;
  keyContext?: string;
  showAsLink?: boolean;
}> = ({ objectId, onObjectIdClick, keyContext, showAsLink = true }) => {
  const [copied, setCopied] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(objectId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(err => console.error('Failed to copy ObjectId:', err));
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowContextMenu(false);
    onObjectIdClick?.(objectId, keyContext, false);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) onObjectIdClick?.(objectId, keyContext, true);
      else onObjectIdClick?.(objectId, keyContext, false);
    }
  };

  const handleOpenInNewTab = () => { setShowContextMenu(false); onObjectIdClick?.(objectId, keyContext, true); };
  const handleOpenInCurrentTab = () => { setShowContextMenu(false); onObjectIdClick?.(objectId, keyContext, false); };
  const handleCopyFromMenu = () => {
    setShowContextMenu(false);
    navigator.clipboard.writeText(objectId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(err => console.error('Failed to copy ObjectId:', err));
  };

  React.useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  const menuItemStyle: React.CSSProperties = {
    width: '100%', textAlign: 'left', padding: '6px 12px', fontSize: 12.5,
    border: 'none', background: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8,
    color: C.fg, fontFamily: 'var(--font-body)',
  };

  return (
    <span className="inline-flex items-center relative group/objectid">
      {showAsLink ? (
        <button
          onClick={handleClick}
          onContextMenu={handleRightClick}
          onKeyDown={handleKeyDown}
          style={{ color: C.link, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit', padding: 0, textDecoration: 'none' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
          title={`Find document with ID: ${objectId} • Click to navigate • Right-click for options • Ctrl+Enter to open in new tab`}
        >
          "{objectId}"
        </button>
      ) : (
        <span style={{ color: C.str }}>"{objectId}"</span>
      )}

      {/* Context menu */}
      {showContextMenu && (
        <div
          className="fixed z-50 rounded-md shadow-lg py-1 min-w-[180px]"
          style={{ left: contextMenuPosition.x, top: contextMenuPosition.y, transform: 'translate(-50%,0)', background: C.panel, border: `1px solid ${C.border}` }}
        >
          {[
            { label: 'Open in current view', fn: handleOpenInCurrentTab },
            { label: 'Open in new tab', fn: handleOpenInNewTab },
            { label: 'Open to side', fn: () => { setShowContextMenu(false); onObjectIdClick?.(objectId, keyContext, false, true); } },
          ].map(({ label, fn }) => (
            <button
              key={label}
              onClick={fn}
              style={menuItemStyle}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.soft; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              {label}
            </button>
          ))}
          <div style={{ borderTop: `1px solid ${C.border}`, margin: '3px 0' }} />
          <button
            onClick={handleCopyFromMenu}
            style={menuItemStyle}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.soft; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            Copy ObjectId
          </button>
        </div>
      )}

      {/* Inline copy button (appears on hover) */}
      <button
        onClick={handleCopy}
        className="absolute -right-5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover/objectid:opacity-100 transition-all duration-200 focus:opacity-100 z-10"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.soft; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
        title={copied ? 'Copied!' : 'Copy ObjectId'}
        aria-label="Copy ObjectId"
      >
        {copied
          ? <CheckIcon className="w-3 h-3" style={{ color: C.ok }} />
          : <ClipboardIcon className="w-3 h-3" style={{ color: C.muted }} />}
      </button>
    </span>
  );
};

// ── Image preview (hover tooltip + expand) ───────────────────────────────────
const ImagePreview: React.FC<{
  imageUrl: string;
  searchRegex: RegExp | null;
}> = ({ imageUrl, searchRegex }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);
  const iconRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const previewHeight = 220;
      const previewWidth = 220;
      let top = rect.top - previewHeight - 8;
      let left = rect.left;
      if (top < 10) top = rect.bottom + 8;
      if (left + previewWidth > window.innerWidth) left = window.innerWidth - previewWidth - 10;
      if (left < 10) left = 10;
      setPreviewPos({ x: left, y: top });
    }
  };

  const handleMouseLeave = () => setPreviewPos(null);

  if (isExpanded) {
    return (
      <span
        className="cursor-pointer rounded px-1 -ml-1 transition-colors"
        onClick={() => setIsExpanded(false)}
        title="Click to collapse back to icon"
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.soft; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
      >
        <span style={{ color: C.str }}>"
          {searchRegex ? highlightText(imageUrl, searchRegex) : imageUrl}"
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 group relative select-none" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <span ref={iconRef} className="cursor-pointer" onClick={() => { setIsExpanded(true); setPreviewPos(null); }}>
        <ImageIcon className="w-5 h-5 transition-colors" style={{ color: C.key }} />
      </span>
      {previewPos && (
        <div
          className="fixed z-[9999] p-2 rounded-lg shadow-xl pointer-events-none"
          style={{ left: previewPos.x, top: previewPos.y, background: C.panel, border: `1px solid ${C.border}` }}
        >
          <img src={imageUrl} alt="Preview" className="max-w-[200px] max-h-[200px] object-contain rounded" style={{ background: C.soft }} />
        </div>
      )}
    </span>
  );
};

// ── Recursive JSON node renderer ─────────────────────────────────────────────
const JsonNode: React.FC<{
  nodeValue: any;
  nodeKey?: string;
  isRoot?: boolean;
  onObjectIdClick?: (id: string, keyContext?: string, openInNewTab?: boolean, openToSide?: boolean) => void;
  parentKeyContext?: string;
  searchRegex?: RegExp | null;
  currentMatchIndex?: number;
}> = ({ nodeValue, nodeKey, isRoot = false, onObjectIdClick, parentKeyContext, searchRegex = null, currentMatchIndex = -1 }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const KeyLabel = nodeKey ? (
    <span style={{ color: C.key }}>
      "{searchRegex ? highlightText(nodeKey, searchRegex) : nodeKey}":&nbsp;
    </span>
  ) : null;

  const renderHeader = (prefix: string, suffix: string, count: number) => {
    const canCollapse = !isRoot;
    return (
      <span onClick={() => canCollapse && setIsExpanded(!isExpanded)} className={canCollapse ? 'cursor-pointer' : ''}>
        {KeyLabel}
        {canCollapse && (
          <ChevronDownIcon
            className={`w-3 h-3 inline-block mr-1 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
            style={{ color: C.muted }}
          />
        )}
        {prefix}
        {!isExpanded && (
          <>
            <span
              className="hover:underline"
              style={{ color: C.muted }}
            >
              {' '}...{count} {count === 1 ? (prefix === '[' ? 'item' : 'key') : (prefix === '[' ? 'items' : 'keys')}...{' '}
            </span>
            {suffix}
          </>
        )}
      </span>
    );
  };

  // null
  if (nodeValue === null) {
    return (
      <div className="inline-block">
        {KeyLabel}
        <span style={{ color: C.nil }}>null</span>
      </div>
    );
  }

  // BSON ObjectId
  if (typeof nodeValue === 'object' && nodeValue.$oid && Object.keys(nodeValue).length === 1 && typeof nodeValue.$oid === 'string') {
    return (
      <div className="inline-block">
        {KeyLabel}
        <span style={{ color: C.fg }}>
          <span style={{ color: C.key }}>ObjectId</span>(
          <ObjectIdDisplay objectId={nodeValue.$oid} onObjectIdClick={onObjectIdClick} keyContext={parentKeyContext} showAsLink={!!onObjectIdClick} />
          )
        </span>
      </div>
    );
  }

  // BSON Date
  if (typeof nodeValue === 'object' && nodeValue.$date && Object.keys(nodeValue).length === 1) {
    return (
      <div className="inline-block">
        {KeyLabel}
        <span style={{ color: C.fg }}>
          <span style={{ color: C.key }}>ISODate</span>("
          {searchRegex ? highlightText(new Date(nodeValue.$date).toISOString(), searchRegex) : new Date(nodeValue.$date).toISOString()}
          ")
        </span>
      </div>
    );
  }

  // Arrays
  if (Array.isArray(nodeValue)) {
    if (nodeValue.length === 0) {
      return (
        <span>
          {KeyLabel}
          []
        </span>
      );
    }
    return (
      <div>
        {renderHeader('[', ']', nodeValue.length)}
        {isExpanded && (
          <>
            <div className="pl-6 border-l ml-2" style={{ borderColor: C.border }}>
              {nodeValue.map((item, index) => (
                <div key={index}>
                  <JsonNode nodeValue={item} onObjectIdClick={onObjectIdClick} parentKeyContext={parentKeyContext} searchRegex={searchRegex} currentMatchIndex={currentMatchIndex} />
                  {index < nodeValue.length - 1 && ','}
                </div>
              ))}
            </div>
            ]
          </>
        )}
      </div>
    );
  }

  // Objects
  if (typeof nodeValue === 'object') {
    const keys = Object.keys(nodeValue);
    if (keys.length === 0) {
      return <span>{KeyLabel}{'{}'}</span>;
    }
    return (
      <div>
        {renderHeader('{', '}', keys.length)}
        {isExpanded && (
          <>
            <div className="pl-6 border-l ml-2" style={{ borderColor: C.border }}>
              {keys.map((key, index) => (
                <div key={key}>
                  <JsonNode nodeValue={nodeValue[key]} nodeKey={key} onObjectIdClick={onObjectIdClick} parentKeyContext={key} searchRegex={searchRegex} currentMatchIndex={currentMatchIndex} />
                  {index < keys.length - 1 && ','}
                </div>
              ))}
            </div>
            {'}'}
          </>
        )}
      </div>
    );
  }

  // Primitives
  const renderPrimitive = () => {
    switch (typeof nodeValue) {
      case 'string': {
        const isObjectIdLike = /^[0-9a-fA-F]{24}$/.test(nodeValue);
        if (isObjectIdLike && onObjectIdClick) {
          return (
            <span style={{ color: C.str }}>
              <ObjectIdDisplay objectId={nodeValue} onObjectIdClick={onObjectIdClick} keyContext={parentKeyContext} showAsLink={true} />
            </span>
          );
        }
        const isBase64Image = nodeValue.startsWith('data:image/');
        const isUrlImage = /^https?:\/\/.+\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(nodeValue);
        if (isBase64Image || isUrlImage) return <ImagePreview imageUrl={nodeValue} searchRegex={searchRegex} />;
        return (
          <span style={{ color: C.str }}>"
            {searchRegex ? highlightText(nodeValue, searchRegex) : nodeValue}"
          </span>
        );
      }
      case 'number':
        return <span style={{ color: C.num }}>{searchRegex ? highlightText(String(nodeValue), searchRegex) : String(nodeValue)}</span>;
      case 'boolean':
        return <span style={{ color: C.bool }}>{searchRegex ? highlightText(String(nodeValue), searchRegex) : String(nodeValue)}</span>;
      default:
        return <span>{searchRegex ? highlightText(String(nodeValue), searchRegex) : String(nodeValue)}</span>;
    }
  };

  return (
    <div className="inline-block">
      {KeyLabel}
      {renderPrimitive()}
    </div>
  );
};

// ── Public component ─────────────────────────────────────────────────────────
interface JsonDisplayProps {
  data: any;
  onObjectIdClick?: (id: string, keyContext?: string, openInNewTab?: boolean, openToSide?: boolean) => void;
}

const JsonDisplay: React.FC<JsonDisplayProps> = ({ data, onObjectIdClick }) => {
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [searchRegex, setSearchRegex] = useState<RegExp | null>(null);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const containerRef = useRef<HTMLPreElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Build regex + count matches
  useEffect(() => {
    if (!searchQuery) { setSearchRegex(null); setTotalMatches(0); setCurrentMatchIndex(0); return; }
    try {
      let pattern = searchQuery;
      let flags = 'g';
      if (!useRegex) pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (matchWholeWord) pattern = `\\b${pattern}\\b`;
      if (!matchCase) flags += 'i';
      const regex = new RegExp(pattern, flags);
      setSearchRegex(regex);
      const jsonString = JSON.stringify(data, null, 2);
      const matches = jsonString.match(regex);
      const count = matches ? matches.length : 0;
      setTotalMatches(count);
      if (count === 0) setCurrentMatchIndex(0);
      else if (currentMatchIndex >= count) setCurrentMatchIndex(0);
    } catch (e) { setSearchRegex(null); setTotalMatches(0); }
  }, [searchQuery, matchCase, matchWholeWord, useRegex, data]);

  // Scroll to current match
  const scrollToMatch = useCallback(() => {
    if (!containerRef.current || totalMatches === 0) return;
    const matches = containerRef.current.querySelectorAll('[data-search-match]');
    if (matches.length === 0) return;
    matches.forEach(m => { m.classList.remove('bg-yellow-300', 'ring-2', 'ring-yellow-400'); m.classList.add('bg-yellow-200'); });
    const current = matches[currentMatchIndex];
    if (current) {
      current.classList.remove('bg-yellow-200');
      current.classList.add('bg-yellow-300', 'ring-2', 'ring-yellow-400');
      current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatchIndex, totalMatches]);

  useEffect(() => { scrollToMatch(); }, [scrollToMatch]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setIsSearchVisible(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else if (e.key === 'Escape' && isSearchVisible) {
        setIsSearchVisible(false);
        setSearchQuery('');
        setCurrentMatchIndex(0);
      } else if (isSearchVisible && searchQuery && totalMatches > 0 && e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) setCurrentMatchIndex(prev => prev === 0 ? totalMatches - 1 : prev - 1);
        else setCurrentMatchIndex(prev => (prev + 1) % totalMatches);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchVisible, searchQuery, totalMatches]);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error('Failed to copy JSON:', err));
  };

  const handleNextMatch = () => { if (totalMatches > 0) setCurrentMatchIndex(prev => (prev + 1) % totalMatches); };
  const handlePrevMatch = () => { if (totalMatches > 0) setCurrentMatchIndex(prev => prev === 0 ? totalMatches - 1 : prev - 1); };
  const handleSearchClose = () => { setIsSearchVisible(false); setSearchQuery(''); setCurrentMatchIndex(0); };

  // Shared icon-button style for the search toolbar option toggles
  const searchOptBtn = (active: boolean): React.CSSProperties => ({
    padding: '3px 5px', borderRadius: 5, border: 'none', cursor: 'pointer',
    background: active ? C.accentSoft : 'transparent',
    color: active ? C.accent : C.muted,
    display: 'flex', alignItems: 'center',
  });

  // Shared top-right action button
  const actionBtnCls = 'p-2 rounded-md opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all duration-200';

  return (
    <div className="rounded-md relative group" style={{ color: C.fg }}>

      {/* Search bar */}
      {isSearchVisible && (
        <div
          className="absolute top-2 left-2 right-12 z-10 rounded-md shadow-lg p-2 flex items-center gap-2"
          style={{ background: C.panel, border: `1px solid ${C.border}` }}
        >
          <SearchIcon className="w-4 h-4" style={{ color: C.muted, flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search… (Enter: next, Shift+Enter: prev, Esc: close)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none focus:outline-none text-sm"
            style={{ color: C.fg, fontFamily: 'var(--font-body)', minWidth: 0 }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') handleSearchClose();
              else if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? handlePrevMatch() : handleNextMatch(); }
            }}
          />

          {/* Search options */}
          <div className="flex items-center gap-0.5 pr-2 mr-1" style={{ borderRight: `1px solid ${C.border}` }}>
            <button onClick={() => setMatchCase(!matchCase)} style={searchOptBtn(matchCase)} title="Match case"><CaseSensitiveIcon className="w-4 h-4" /></button>
            <button onClick={() => setMatchWholeWord(!matchWholeWord)} style={searchOptBtn(matchWholeWord)} title="Whole word"><WholeWordIcon className="w-4 h-4" /></button>
            <button onClick={() => setUseRegex(!useRegex)} style={searchOptBtn(useRegex)} title="Regular expression"><RegexIcon className="w-4 h-4" /></button>
          </div>

          {/* Match navigation */}
          {searchQuery && (
            <div className="flex items-center gap-1">
              <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>
                {totalMatches > 0 ? `${currentMatchIndex + 1}/${totalMatches}` : 'No matches'}
              </span>
              <button
                onClick={handlePrevMatch}
                disabled={totalMatches === 0}
                className="p-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.soft; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                title="Previous match (Shift+Enter)"
              >
                <ArrowUpwardIcon className="w-3 h-3" />
              </button>
              <button
                onClick={handleNextMatch}
                disabled={totalMatches === 0}
                className="p-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.soft; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                title="Next match (Enter)"
              >
                <ArrowDownwardIcon className="w-3 h-3" />
              </button>
            </div>
          )}

          <button
            onClick={handleSearchClose}
            className="p-1 rounded"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.soft; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            title="Close (Esc)"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* JSON content */}
      <pre
        className="text-sm p-4 overflow-x-auto"
        style={{ fontFamily: 'var(--font-mono)', color: C.fg, margin: 0, lineHeight: 1.7 }}
        ref={containerRef}
      >
        <code>
          <JsonNode
            nodeValue={data}
            isRoot
            onObjectIdClick={onObjectIdClick}
            searchRegex={searchRegex}
            currentMatchIndex={currentMatchIndex}
          />
        </code>
      </pre>

      {/* Top-right action buttons */}
      <div className="absolute top-2 right-2 flex items-center gap-1">
        {!isSearchVisible && (
          <button
            onClick={() => { setIsSearchVisible(true); setTimeout(() => searchInputRef.current?.focus(), 100); }}
            className={actionBtnCls}
            style={{ background: C.soft, border: 'none', cursor: 'pointer', color: C.muted }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.fg; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.muted; }}
            aria-label="Search in JSON (Ctrl+F / Cmd+F)"
            title="Search in JSON (Ctrl+F / Cmd+F)"
          >
            <SearchIcon className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleCopy}
          className={actionBtnCls}
          style={{ background: C.soft, border: 'none', cursor: 'pointer', color: C.muted }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.fg; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.muted; }}
          aria-label="Copy JSON"
          title={copied ? 'Copied!' : 'Copy raw JSON'}
        >
          {copied
            ? <CheckIcon className="w-4 h-4" style={{ color: C.ok }} />
            : <ClipboardIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default JsonDisplay;
