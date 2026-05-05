
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CheckIcon, ChevronDownIcon, ClipboardIcon, SearchIcon, XIcon, ArrowUpwardIcon, ArrowDownwardIcon, CaseSensitiveIcon, WholeWordIcon, RegexIcon, ImageIcon } from './icons/material-icons-imports';

// Removed unused SearchState interface

// Helper function to highlight search matches in text
// Helper function to highlight search matches in text
const highlightText = (text: string, searchRegex: RegExp | null): React.ReactNode => {
  if (!searchRegex || !text) {
    return text;
  }

  // Create a local regex with 'g' flag to find all matches in this string
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
    if (match[0].length === 0) localRegex.lastIndex++; // Avoid infinite loop
  }

  if (matches.length === 0) return text;

  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;

  matches.forEach((m, index) => {
    if (m.start > lastIndex) {
      nodes.push(text.substring(lastIndex, m.start));
    }
    nodes.push(
      <mark
        key={`match-${index}`}
        className="px-0.5 rounded text-black bg-yellow-200"
        data-search-match="true"
      >
        {m.text}
      </mark>
    );
    lastIndex = m.end;
  });

  if (lastIndex < text.length) {
    nodes.push(text.substring(lastIndex));
  }

  return <>{nodes}</>;
};

// Component to render ObjectId with both click navigation and copy functionality
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
    }).catch(err => {
      console.error("Failed to copy ObjectId:", err);
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowContextMenu(false); // Hide context menu if clicking normally
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
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Enter or Cmd+Enter opens in new tab
        onObjectIdClick?.(objectId, keyContext, true);
      } else {
        // Regular Enter navigates in same tab
        onObjectIdClick?.(objectId, keyContext, false);
      }
    }
  };

  const handleOpenInNewTab = () => {
    setShowContextMenu(false);
    onObjectIdClick?.(objectId, keyContext, true);
  };

  const handleOpenInCurrentTab = () => {
    setShowContextMenu(false);
    onObjectIdClick?.(objectId, keyContext, false);
  };

  const handleCopyFromMenu = () => {
    setShowContextMenu(false);
    navigator.clipboard.writeText(objectId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(err => {
      console.error("Failed to copy ObjectId:", err);
    });
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  return (
    <span className="inline-flex items-center relative group/objectid">
      {showAsLink ? (
        <button
          onClick={handleClick}
          onContextMenu={handleRightClick}
          onKeyDown={handleKeyDown}
          className="text-blue-600 dark:text-blue-400 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
          title={`Find document with ID: ${objectId} • Click to navigate in current tab • Right-click for options • Ctrl+Enter (⌘+Enter on Mac) to open in new tab`}
        >
          "{objectId}"
        </button>
      ) : (
        <span className="text-emerald-700 dark:text-emerald-300">"{objectId}"</span>
      )}

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg py-1 min-w-[180px]"
          style={{
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
            transform: 'translate(-50%, 0)'
          }}
        >
          <button
            onClick={handleOpenInCurrentTab}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <span>Open in Current Tab</span>
          </button>
          <button
            onClick={handleOpenInNewTab}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <span>Open in New Tab</span>
          </button>
          <button
            onClick={() => {
              setShowContextMenu(false);
              onObjectIdClick?.(objectId, keyContext, false, true);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <span>Open to Side</span>
          </button>
          <div className="border-t border-slate-200 dark:border-slate-600 my-1"></div>
          <button
            onClick={handleCopyFromMenu}
            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
          >
            <span>Copy ObjectId</span>
          </button>
        </div>
      )}

      <button
        onClick={handleCopy}
        className="absolute -right-5 top-1/2 -translate-y-1/2 p-0.5 rounded opacity-0 group-hover/objectid:opacity-100 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all duration-200 focus:opacity-100 z-10"
        title={copied ? 'Copied!' : 'Copy ObjectId'}
        aria-label="Copy ObjectId"
      >
        {copied ? (
          <CheckIcon className="w-3 h-3 text-green-500" />
        ) : (
          <ClipboardIcon className="w-3 h-3 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" />
        )}
      </button>
    </span>
  );
};

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
      const previewHeight = 220; // Approx max height
      const previewWidth = 220; // Approx max width

      // Default to showing above
      let top = rect.top - previewHeight - 8;
      let left = rect.left;

      // If not enough space on top, show below
      if (top < 10) {
        top = rect.bottom + 8;
      }

      // Prevent right overflow
      if (left + previewWidth > window.innerWidth) {
        left = window.innerWidth - previewWidth - 10;
      }

      // Prevent left overflow
      if (left < 10) left = 10;

      setPreviewPos({ x: left, y: top });
    }
  };

  const handleMouseLeave = () => {
    setPreviewPos(null);
  };

  if (isExpanded) {
    return (
      <span
        className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-1 -ml-1 transition-colors"
        onClick={() => setIsExpanded(false)}
        title="Click to collapse back to icon"
      >
        <span className="text-emerald-700 dark:text-emerald-300">"
          {searchRegex ? highlightText(imageUrl, searchRegex) : imageUrl}"
        </span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-2 group relative select-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        ref={iconRef}
        className="cursor-pointer"
        onClick={() => {
          setIsExpanded(true);
          setPreviewPos(null);
        }}
      >
        <ImageIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors" />
      </span>

      {/* Tooltip Image Preview - Uses fixed positioning to escape container clipping */}
      {previewPos && (
        <div
          className="fixed z-[9999] bg-white dark:bg-slate-800 p-2 rounded-lg shadow-xl border border-slate-200 dark:border-slate-600 pointer-events-none"
          style={{
            left: `${previewPos.x}px`,
            top: `${previewPos.y}px`
          }}
        >
          <img
            src={imageUrl}
            alt="Preview"
            className="max-w-[200px] max-h-[200px] object-contain rounded bg-slate-100 dark:bg-slate-900"
          />
        </div>
      )}
    </span>
  );
};

// A single, recursive component to render all parts of the JSON object.
const JsonNode: React.FC<{
  nodeValue: any;
  nodeKey?: string; // The key of this node, if it's in an object
  isRoot?: boolean; // The top-level object is not collapsible
  onObjectIdClick?: (id: string, keyContext?: string, openInNewTab?: boolean, openToSide?: boolean) => void;
  parentKeyContext?: string; // The key of the parent, used for context in clicks
  searchRegex?: RegExp | null; // Regex for highlighting
  currentMatchIndex?: number; // Current match index for highlighting
}> = ({ nodeValue, nodeKey, isRoot = false, onObjectIdClick, parentKeyContext, searchRegex = null, currentMatchIndex = -1 }) => {
  // All nodes are expanded by default.
  const [isExpanded, setIsExpanded] = useState(true);

  const renderHeader = (prefix: string, suffix: string, count: number) => {
    // Collapsing is disabled for the root element.
    const canCollapse = !isRoot;
    return (
      <span onClick={() => canCollapse && setIsExpanded(!isExpanded)} className={canCollapse ? 'cursor-pointer' : ''}>
        {nodeKey && <span className="text-purple-600 dark:text-purple-400">"
          {searchRegex ? highlightText(nodeKey, searchRegex) : nodeKey}"
        </span>}
        {nodeKey && <span className="mr-1">:</span>}
        {canCollapse && (
          <ChevronDownIcon
            className={`w-3 h-3 inline-block mr-1 text-slate-500 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
          />
        )}
        {prefix}
        {!isExpanded && (
          <>
            <span className="text-slate-500 dark:text-slate-400 hover:underline"> ... {count} {count === 1 ? (prefix === '[' ? 'item' : 'key') : (prefix === '[' ? 'items' : 'keys')} ... </span>
            {suffix}
          </>
        )}
      </span>
    );
  };

  // --- Value Rendering Logic ---

  if (nodeValue === null) {
    return (
      <div className="inline-block">
        {nodeKey && <span className="text-purple-600 dark:text-purple-400">"
          {searchRegex ? highlightText(nodeKey, searchRegex) : nodeKey}":
        </span>}
        <span className="text-rose-500 dark:text-rose-400">null</span>
      </div>
    );
  }

  // BSON Types: ObjectId, Date
  if (typeof nodeValue === 'object' && nodeValue !== null) {
    if (nodeValue.$oid && Object.keys(nodeValue).length === 1 && typeof nodeValue.$oid === 'string') {
      const objectId = nodeValue.$oid;
      return (
        <div className="inline-block">
          {nodeKey && <span className="text-purple-600 dark:text-purple-400">"
            {searchRegex ? highlightText(nodeKey, searchRegex) : nodeKey}":
          </span>}
          <span className="text-slate-700 dark:text-slate-300">
            <span className="text-purple-600 dark:text-purple-400">ObjectId</span>(
            <ObjectIdDisplay
              objectId={objectId}
              onObjectIdClick={onObjectIdClick}
              keyContext={parentKeyContext}
              showAsLink={!!onObjectIdClick}
            />
            )
          </span>
        </div>
      );
    }
    if (nodeValue.$date && Object.keys(nodeValue).length === 1) {
      return (
        <div className="inline-block">
          {nodeKey && <span className="text-purple-600 dark:text-purple-400">"
            {searchRegex ? highlightText(nodeKey, searchRegex) : nodeKey}":
          </span>}
          <span className="text-slate-700 dark:text-slate-300">
            <span className="text-purple-600 dark:text-purple-400">ISODate</span>("
            {searchRegex ? highlightText(new Date(nodeValue.$date).toISOString(), searchRegex) : new Date(nodeValue.$date).toISOString()}")
          </span>
        </div>
      );
    }
  }

  // Arrays
  if (Array.isArray(nodeValue)) {
    if (nodeValue.length === 0) {
      return (
        <span>
          {nodeKey && <span className="text-purple-600 dark:text-purple-400">"
            {searchRegex ? highlightText(nodeKey, searchRegex) : nodeKey}":
          </span>}
          []
        </span>
      );
    }
    return (
      <div>
        {renderHeader('[', ']', nodeValue.length)}
        {isExpanded && (
          <>
            <div className="pl-6 border-l border-slate-200 dark:border-slate-700 ml-2">
              {nodeValue.map((item, index) => (
                <div key={index}>
                  <JsonNode
                    nodeValue={item}
                    onObjectIdClick={onObjectIdClick}
                    parentKeyContext={parentKeyContext}
                    searchRegex={searchRegex}
                    currentMatchIndex={currentMatchIndex}
                  />
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
      return (
        <span>
          {nodeKey && <span className="text-purple-600 dark:text-purple-400">"
            {searchRegex ? highlightText(nodeKey, searchRegex) : nodeKey}":
          </span>}
          {`{}`}
        </span>
      );
    }
    return (
      <div>
        {renderHeader('{', '}', keys.length)}
        {isExpanded && (
          <>
            <div className="pl-6 border-l border-slate-200 dark:border-slate-700 ml-2">
              {keys.map((key, index) => (
                <div key={key}>
                  <JsonNode
                    nodeValue={nodeValue[key]}
                    nodeKey={key}
                    onObjectIdClick={onObjectIdClick}
                    parentKeyContext={key}
                    searchRegex={searchRegex}
                    currentMatchIndex={currentMatchIndex}
                  />
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
            <span className="text-emerald-700 dark:text-emerald-300">
              <ObjectIdDisplay
                objectId={nodeValue}
                onObjectIdClick={onObjectIdClick}
                keyContext={parentKeyContext}
                showAsLink={true}
              />
            </span>
          );
        }

        const isBase64Image = nodeValue.startsWith("data:image/");
        const isUrlImage = /^https?:\/\/.+\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i.test(nodeValue);

        if (isBase64Image || isUrlImage) {
          return <ImagePreview imageUrl={nodeValue} searchRegex={searchRegex} />;
        }

        return <span className="text-emerald-700 dark:text-emerald-300">"
          {searchRegex ? highlightText(nodeValue, searchRegex) : nodeValue}"
        </span>;
      }
      case 'number':
        const numberStr = String(nodeValue);
        return <span className="text-amber-600 dark:text-amber-400">
          {searchRegex ? highlightText(numberStr, searchRegex) : numberStr}
        </span>;
      case 'boolean':
        const boolStr = String(nodeValue);
        return <span className="text-sky-600 dark:text-sky-400">
          {searchRegex ? highlightText(boolStr, searchRegex) : boolStr}
        </span>;
      default:
        const defaultStr = String(nodeValue);
        return <span>
          {searchRegex ? highlightText(defaultStr, searchRegex) : defaultStr}
        </span>;
    }
  };

  return (
    <div className="inline-block">
      {nodeKey && <span className="text-purple-600 dark:text-purple-400">"
        {searchRegex ? highlightText(nodeKey, searchRegex) : nodeKey}":
      </span>}
      {renderPrimitive()}
    </div>
  );
};

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

  // Update regex and count matches when inputs change
  useEffect(() => {
    if (!searchQuery) {
      setSearchRegex(null);
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      return;
    }

    try {
      let pattern = searchQuery;
      let flags = 'g';

      if (!useRegex) {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }

      if (matchWholeWord) {
        pattern = `\\b${pattern}\\b`;
      }

      if (!matchCase) {
        flags += 'i';
      }

      const regex = new RegExp(pattern, flags);
      setSearchRegex(regex);

      const jsonString = JSON.stringify(data, null, 2);
      const matches = jsonString.match(regex);
      const count = matches ? matches.length : 0;

      setTotalMatches(count);
      if (count === 0) {
        setCurrentMatchIndex(0);
      } else if (currentMatchIndex >= count) {
        setCurrentMatchIndex(0);
      }
    } catch (e) {
      setSearchRegex(null);
      setTotalMatches(0);
    }
  }, [searchQuery, matchCase, matchWholeWord, useRegex, data]); // removed currentMatchIndex dependency to prevent loop, added data

  // Navigate to current match
  const scrollToMatch = useCallback(() => {
    if (!containerRef.current || totalMatches === 0) return;

    // allow a tick for DOM to update with highlights
    // but useEffect is post-render, so DOM should be ready if nodes rendered.
    // However, JsonNode is recursive, might take time? No, sync render.

    const matches = containerRef.current.querySelectorAll('[data-search-match]');
    if (matches.length === 0) return;

    // Remove previous highlight
    matches.forEach(match => {
      match.classList.remove('bg-yellow-300', 'ring-2', 'ring-yellow-400');
      match.classList.add('bg-yellow-200');
    });

    // Highlight current match
    const currentMatch = matches[currentMatchIndex];
    if (currentMatch) {
      currentMatch.classList.remove('bg-yellow-200');
      currentMatch.classList.add('bg-yellow-300', 'ring-2', 'ring-yellow-400');
      currentMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentMatchIndex, totalMatches]);

  // Scroll to match when current index changes
  useEffect(() => {
    scrollToMatch();
  }, [scrollToMatch]);

  // Handle keyboard shortcuts
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
      } else if (isSearchVisible && searchQuery && totalMatches > 0) {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) {
            // Previous match
            setCurrentMatchIndex(prev => prev === 0 ? totalMatches - 1 : prev - 1);
          } else {
            // Next match
            setCurrentMatchIndex(prev => (prev + 1) % totalMatches);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchVisible, searchQuery, totalMatches]);

  const handleCopy = () => {
    const jsonString = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy JSON:", err);
    });
  };

  const handleNextMatch = () => {
    if (totalMatches > 0) {
      setCurrentMatchIndex(prev => (prev + 1) % totalMatches);
    }
  };

  const handlePrevMatch = () => {
    if (totalMatches > 0) {
      setCurrentMatchIndex(prev => prev === 0 ? totalMatches - 1 : prev - 1);
    }
  };

  const handleSearchClose = () => {
    setIsSearchVisible(false);
    setSearchQuery('');
    setCurrentMatchIndex(0);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-md relative group ring-1 ring-slate-200 dark:ring-slate-700">
      {/* Search Bar */}
      {isSearchVisible && (
        <div className="absolute top-2 left-2 right-12 z-10 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-lg p-2 flex items-center gap-2">
          <SearchIcon className="w-4 h-4 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search in JSON... (Enter: next, Shift+Enter: previous)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-2 py-1 text-sm bg-transparent border-none focus:outline-none text-slate-900 dark:text-slate-100"
            title="Use Enter to go to next match, Shift+Enter for previous match, Esc to close"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleSearchClose();
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                  handlePrevMatch();
                } else {
                  handleNextMatch();
                }
              }
            }}
          />
          <div className="flex items-center gap-0.5 border-r border-slate-300 dark:border-slate-600 pr-2 mr-2">
            <button
              onClick={() => setMatchCase(!matchCase)}
              className={`p-1 rounded ${matchCase ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
              title="Match Case"
            >
              <CaseSensitiveIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMatchWholeWord(!matchWholeWord)}
              className={`p-1 rounded ${matchWholeWord ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
              title="Match Whole Word"
            >
              <WholeWordIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setUseRegex(!useRegex)}
              className={`p-1 rounded ${useRegex ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
              title="Use Regular Expression"
            >
              <RegexIcon className="w-4 h-4" />
            </button>
          </div>

          {searchQuery && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {totalMatches > 0 ? `${currentMatchIndex + 1}/${totalMatches}` : 'No matches'}
              </span>
              <button
                onClick={handlePrevMatch}
                disabled={totalMatches === 0}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous match (Shift+Enter)"
              >
                <ArrowUpwardIcon className="w-3 h-3" />
              </button>
              <button
                onClick={handleNextMatch}
                disabled={totalMatches === 0}
                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next match (Enter)"
              >
                <ArrowDownwardIcon className="w-3 h-3" />
              </button>
            </div>
          )}
          <button
            onClick={handleSearchClose}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-600"
            title="Close search (Esc)"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      <pre className="text-sm p-4 overflow-x-auto font-mono text-slate-900 dark:text-slate-100" ref={containerRef}>
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

      <div className="absolute top-2 right-2 flex items-center gap-1">
        {!isSearchVisible && (
          <button
            onClick={() => {
              setIsSearchVisible(true);
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
            className="p-2 bg-slate-100/80 dark:bg-slate-700/80 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Search in JSON (Ctrl+F / Cmd+F)"
            title="Search in JSON (Ctrl+F / Cmd+F)"
          >
            <SearchIcon className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleCopy}
          className="p-2 bg-slate-100/80 dark:bg-slate-700/80 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
          aria-label="Copy JSON result"
          title={copied ? 'Copied!' : 'Copy raw JSON'}
        >
          {copied ? <CheckIcon className="w-4 h-4 text-blue-500" /> : <ClipboardIcon className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default JsonDisplay;
