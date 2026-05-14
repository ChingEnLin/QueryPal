
import React, { useState, useEffect } from 'react';
import { CollectionInfo } from '../types';
import { XIcon, ChevronDownIcon } from './icons/material-icons-imports';

const getType = (value: any): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    if (value.length > 0) return `Array<${getType(value[0])}>`;
    return 'Array<any>';
  }
  if (value && typeof value === 'object') {
    if (value.$oid && Object.keys(value).length === 1) return 'ObjectId';
    if (value.$date && Object.keys(value).length === 1) return 'Date';
    return 'Object';
  }
  const t = typeof value;
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const TYPE_COLORS: Record<string, string> = {
  String:    '#3a6a3a',
  Number:    '#1d6cf2',
  Boolean:   '#c98d42',
  ObjectId:  '#7c4fba',
  Date:      '#1d8fa0',
  Object:    '#6c6760',
  null:      '#c94250',
};

const typeColor = (t: string) =>
  TYPE_COLORS[t.split('<')[0]] ?? '#6c6760';

interface SchemaRendererProps {
  data: Record<string, any>;
  indent?: number;
}

export const SchemaRenderer: React.FC<SchemaRendererProps> = ({ data, indent = 0 }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
    {Object.entries(data).map(([key, value]) => {
      const type = getType(value);
      const isNested =
        (type === 'Object' || type.startsWith('Array<Object>')) &&
        value &&
        (Array.isArray(value) ? value.length > 0 : Object.keys(value).length > 0);
      const nestedData = Array.isArray(value) ? value[0] : value;

      return (
        <div key={key} style={{ paddingLeft: indent * 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg)', fontWeight: 500 }}>{key}</span>
            <span style={{ color: 'var(--muted)', fontSize: 10.5 }}>:</span>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10.5,
              color: typeColor(type),
              background: `color-mix(in oklch, ${typeColor(type)} 10%, var(--bg))`,
              padding: '1px 6px', borderRadius: 4,
            }}>{type}</span>
          </div>
          {isNested && <SchemaRenderer data={nestedData} indent={indent + 1} />}
        </div>
      );
    })}
  </div>
);


interface CollectionActionPanelProps {
  info: CollectionInfo;
  onClose: () => void;
}

const CollectionActionPanel: React.FC<CollectionActionPanelProps> = ({ info, onClose }) => {
  const [isSchemaOpen, setIsSchemaOpen] = useState(true);

  useEffect(() => { setIsSchemaOpen(true); }, [info.name]);

  const sampleDocument = info.sampleDocument || {};

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div style={{ background: 'var(--soft)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 2 }}>Documents</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
            {info.documentCount.toLocaleString()}
          </div>
        </div>
        <div style={{ background: 'var(--soft)', borderRadius: 'var(--radius-sm)', padding: '8px 10px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 2 }}>Avg. doc size</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
            {info.averageDocumentSize}
          </div>
        </div>
      </div>

      {/* Indexes */}
      {info.indexes.length > 0 && (
        <div>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: 6 }}>
            Indexes
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {info.indexes.map(idx => (
              <span key={idx} style={{
                fontFamily: 'var(--font-mono)', fontSize: 10.5,
                background: 'var(--accent-soft)', color: 'var(--accent)',
                padding: '2px 7px', borderRadius: 4,
              }}>{idx}</span>
            ))}
          </div>
        </div>
      )}

      {/* Schema */}
      <div>
        <button
          onClick={() => setIsSchemaOpen(!isSchemaOpen)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--fg)', fontFamily: 'var(--font-body)', padding: '0 0 6px',
          }}
          aria-expanded={isSchemaOpen}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="2" y="2" width="12" height="12" rx="2"/>
            <path d="M5 6h6M5 9h4"/>
          </svg>
          <span style={{ fontSize: 11.5, fontWeight: 500 }}>Inferred schema</span>
          <ChevronDownIcon
            className="w-3 h-3"
            style={{ marginLeft: 'auto', color: 'var(--muted)', transition: 'transform 0.2s', transform: isSchemaOpen ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        {isSchemaOpen && (
          <div style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '10px 12px',
            overflow: 'auto', maxHeight: 280,
          }}>
            {Object.keys(sampleDocument).length > 0 ? (
              <SchemaRenderer data={sampleDocument} />
            ) : (
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>No sample document available.</span>
            )}
          </div>
        )}
      </div>

      {/* Close / deselect */}
      <button
        onClick={onClose}
        style={{
          alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--muted)', fontSize: 11.5, fontFamily: 'var(--font-body)', padding: 0,
        }}
        title="Deselect collection"
      >
        <XIcon className="w-3 h-3" />
        Deselect {info.name}
      </button>
    </div>
  );
};

export default CollectionActionPanel;
