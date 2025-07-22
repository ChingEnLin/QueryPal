
import React, { useState } from 'react';
import CheckIcon from './icons/CheckIcon';
import ClipboardIcon from './icons/ClipboardIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';

// A single, recursive component to render all parts of the JSON object.
const JsonNode: React.FC<{
  nodeValue: any;
  nodeKey?: string; // The key of this node, if it's in an object
  isRoot?: boolean; // The top-level object is not collapsible
  onObjectIdClick?: (id: string, keyContext?: string) => void;
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
              <button
                onClick={() => onObjectIdClick?.(objectId, parentKeyContext)}
                className="text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                title={`Find document with ID: ${objectId}`}
              >
                "{objectId}"
              </button>
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
            <div className="pl-6 border-l border-slate-600/30 dark:border-slate-700/50 ml-2">
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
            <div className="pl-6 border-l border-slate-600/30 dark:border-slate-700/50 ml-2">
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
                "
                <button
                  onClick={() => onObjectIdClick(nodeValue, parentKeyContext)}
                  className="text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                  title={`Find document with ID: ${nodeValue}`}
                >
                  {nodeValue}
                </button>
                "
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
  onObjectIdClick?: (id: string, keyContext?: string) => void;
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
    <div className="bg-slate-800 dark:bg-black/30 rounded-md relative group ring-1 ring-slate-700 dark:ring-slate-700">
      <pre className="text-sm p-4 overflow-x-auto font-mono text-slate-300">
        <code>
          <JsonNode nodeValue={data} isRoot onObjectIdClick={onObjectIdClick} />
        </code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-slate-600/80 dark:bg-slate-700/80 rounded-md text-slate-300 hover:bg-slate-500 dark:hover:bg-slate-600 hover:text-white transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Copy JSON result"
        title={copied ? 'Copied!' : 'Copy raw JSON'}
      >
        {copied ? <CheckIcon className="w-4 h-4 text-blue-400" /> : <ClipboardIcon className="w-4 h-4" />}
      </button>
    </div>
  );
};

export default JsonDisplay;
