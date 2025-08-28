
import React, { useState } from 'react';
import { CheckIcon, ChevronDownIcon, ClipboardIcon } from './icons/material-icons-imports';

// Component to render ObjectId with both click navigation and copy functionality
const ObjectIdDisplay: React.FC<{
  objectId: string;
  onObjectIdClick?: (id: string, keyContext?: string, openInNewTab?: boolean) => void;
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
          title={`Find document with ID: ${objectId}\n• Click to navigate in current tab\n• Right-click for options\n• Ctrl+Enter (⌘+Enter on Mac) to open in new tab`}
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

// A single, recursive component to render all parts of the JSON object.
const JsonNode: React.FC<{
  nodeValue: any;
  nodeKey?: string; // The key of this node, if it's in an object
  isRoot?: boolean; // The top-level object is not collapsible
  onObjectIdClick?: (id: string, keyContext?: string, openInNewTab?: boolean) => void;
  parentKeyContext?: string; // The key of the parent, used for context in clicks
}> = ({ nodeValue, nodeKey, isRoot = false, onObjectIdClick, parentKeyContext }) => {
  // All nodes are expanded by default.
  const [isExpanded, setIsExpanded] = useState(true);

  const renderHeader = (prefix: string, suffix: string, count: number) => {
    // Collapsing is disabled for the root element.
    const canCollapse = !isRoot;
    return (
      <span onClick={() => canCollapse && setIsExpanded(!isExpanded)} className={canCollapse ? 'cursor-pointer' : ''}>
        {nodeKey && <span className="text-purple-600 dark:text-purple-400">"{nodeKey}"</span>}
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
        {nodeKey && <span className="text-purple-600 dark:text-purple-400">"{nodeKey}": </span>}
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
            {nodeKey && <span className="text-purple-600 dark:text-purple-400">"{nodeKey}": </span>}
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
                {nodeKey && <span className="text-purple-600 dark:text-purple-400">"{nodeKey}": </span>}
                <span className="text-slate-700 dark:text-slate-300">
                    <span className="text-purple-600 dark:text-purple-400">ISODate</span>("{new Date(nodeValue.$date).toISOString()}")
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
          {nodeKey && <span className="text-purple-600 dark:text-purple-400">"{nodeKey}": </span>}
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
                  <JsonNode nodeValue={item} onObjectIdClick={onObjectIdClick} parentKeyContext={parentKeyContext} />
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
              {nodeKey && <span className="text-purple-600 dark:text-purple-400">"{nodeKey}": </span>}
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
                  <JsonNode nodeValue={nodeValue[key]} nodeKey={key} onObjectIdClick={onObjectIdClick} parentKeyContext={key} />
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
          return <span className="text-emerald-700 dark:text-emerald-300">"{nodeValue}"</span>;
        }
        case 'number':
          return <span className="text-amber-600 dark:text-amber-400">{nodeValue}</span>;
        case 'boolean':
          return <span className="text-sky-600 dark:text-sky-400">{String(nodeValue)}</span>;
        default:
          return <span>{String(nodeValue)}</span>;
      }
  };

  return (
    <div className="inline-block">
        {nodeKey && <span className="text-purple-600 dark:text-purple-400">"{nodeKey}": </span>}
        {renderPrimitive()}
    </div>
  );
};

interface JsonDisplayProps {
  data: any;
  onObjectIdClick?: (id: string, keyContext?: string, openInNewTab?: boolean) => void;
}

const JsonDisplay: React.FC<JsonDisplayProps> = ({ data, onObjectIdClick }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const jsonString = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
        console.error("Failed to copy JSON:", err);
    });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-md relative group ring-1 ring-slate-200 dark:ring-slate-700">
      <pre className="text-sm p-4 overflow-x-auto font-mono text-slate-900 dark:text-slate-100">
        <code>
          <JsonNode nodeValue={data} isRoot onObjectIdClick={onObjectIdClick} />
        </code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-slate-100/80 dark:bg-slate-700/80 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-800 dark:hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Copy JSON result"
        title={copied ? 'Copied!' : 'Copy raw JSON'}
      >
        {copied ? <CheckIcon className="w-4 h-4 text-blue-500" /> : <ClipboardIcon className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default JsonDisplay;
