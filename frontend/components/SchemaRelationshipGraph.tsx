import React, { useMemo, useState } from 'react';
import { Relationship, SchemaRelationshipsResponse } from '../types';

interface SchemaRelationshipGraphProps {
  relationships: SchemaRelationshipsResponse;
  selectedCollections: string[];
}

interface Node { id: string; x: number; y: number; }
interface Edge { source: Node; target: Node; data: Relationship; }

const SchemaRelationshipGraph: React.FC<SchemaRelationshipGraphProps> = ({ relationships, selectedCollections }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);

  const nodes: Node[] = useMemo(() => {
    const cols = Array.from(new Set(selectedCollections));
    const cx = 200, cy = 140, r = 100;
    if (cols.length === 2) {
      return [
        { id: cols[0], x: 70,  y: cy },
        { id: cols[1], x: 330, y: cy },
      ];
    }
    return cols.map((col, i) => {
      const angle = (i / cols.length) * 2 * Math.PI - Math.PI / 2;
      return { id: col, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
  }, [selectedCollections]);

  const edges: Edge[] = useMemo(() => (
    relationships.relationships
      .filter(rel =>
        selectedCollections.includes(rel.source_collection) &&
        selectedCollections.includes(rel.target_collection)
      )
      .map(rel => {
        const src = nodes.find(n => n.id === rel.source_collection);
        const tgt = nodes.find(n => n.id === rel.target_collection);
        if (!src || !tgt) return null;
        return { source: src, target: tgt, data: rel };
      })
      .filter((e): e is Edge => e !== null)
  ), [relationships, nodes, selectedCollections]);

  const getPath = (src: Node, tgt: Node, idx: number) => {
    const dx = tgt.x - src.x, dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const px = -dy / dist, py = dx / dist;
    const curve = 28 + idx * 18;
    const cx = (src.x + tgt.x) / 2 + px * curve;
    const cy = (src.y + tgt.y) / 2 + py * curve;
    const R = 34;
    const aS = Math.atan2(cy - src.y, cx - src.x);
    const aT = Math.atan2(cy - tgt.y, cx - tgt.x);
    return `M ${src.x + R * Math.cos(aS)} ${src.y + R * Math.sin(aS)} Q ${cx} ${cy} ${tgt.x + R * Math.cos(aT)} ${tgt.y + R * Math.sin(aT)}`;
  };

  const activeEdge = hoveredEdge !== null ? edges[hoveredEdge] : null;

  return (
    <div style={{
      width: '100%', position: 'relative',
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', overflow: 'hidden',
    }}>
      {/* Badge */}
      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 2,
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'var(--accent-soft)', color: 'var(--accent)',
        fontSize: 10, fontFamily: 'var(--font-body)', fontWeight: 500,
        padding: '2px 8px', borderRadius: 99,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--accent)', display: 'inline-block' }} />
        AI inferred
      </div>

      <svg
        width="400" height="280" viewBox="0 0 400 280"
        style={{ width: '100%', maxWidth: 480, display: 'block', margin: '0 auto' }}
      >
        <defs>
          <filter id="qp-node-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const hov = hoveredEdge === i;
          const dim = hoveredEdge !== null && !hov;
          const d = getPath(edge.source, edge.target, i);
          return (
            <g key={i} style={{ opacity: dim ? 0.2 : 1, transition: 'opacity 0.2s' }}
              onMouseEnter={() => setHoveredEdge(i)}
              onMouseLeave={() => setHoveredEdge(null)}
            >
              {/* hit area */}
              <path d={d} stroke="transparent" strokeWidth={20} fill="none" style={{ cursor: 'pointer' }} />
              <path
                d={d} fill="none"
                stroke={hov ? 'var(--accent)' : 'var(--border)'}
                strokeWidth={hov ? 2 : 1.5}
                style={{ transition: 'stroke 0.15s' }}
              />
              {hov && (
                <circle r="3.5" fill="var(--accent)">
                  <animateMotion dur="1.2s" repeatCount="indefinite" path={d} />
                </circle>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const hov = hoveredNode === node.id;
          const edgeRelated = hoveredEdge !== null && (edges[hoveredEdge]?.source.id === node.id || edges[hoveredEdge]?.target.id === node.id);
          const dim = hoveredEdge !== null && !edgeRelated;
          const active = hov || edgeRelated;
          // truncate long names
          const label = node.id.length > 11 ? node.id.slice(0, 10) + '…' : node.id;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              style={{ cursor: 'default', opacity: dim ? 0.25 : 1, transition: 'opacity 0.2s' }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <circle
                r={32}
                fill={active ? 'var(--accent-soft)' : 'var(--panel)'}
                stroke={active ? 'var(--accent)' : 'var(--border)'}
                strokeWidth={active ? 1.5 : 1}
                filter={active ? 'url(#qp-node-glow)' : ''}
                style={{ transition: 'fill 0.15s, stroke 0.15s' }}
              />
              <text
                textAnchor="middle" dominantBaseline="middle"
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 10,
                  fontWeight: 600, pointerEvents: 'none',
                  fill: active ? 'var(--accent)' : 'var(--fg)',
                  transition: 'fill 0.15s',
                }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Edge detail overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'var(--panel)', borderTop: '1px solid var(--border)',
        padding: '10px 14px',
        transform: activeEdge ? 'translateY(0)' : 'translateY(100%)',
        opacity: activeEdge ? 1 : 0,
        transition: 'transform 0.2s, opacity 0.2s',
        pointerEvents: activeEdge ? 'auto' : 'none',
      }}>
        {activeEdge && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--soft)', color: 'var(--fg)', padding: '2px 6px', borderRadius: 4 }}>
                {activeEdge.data.source_collection}.{activeEdge.data.source_field}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>→</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--soft)', color: 'var(--fg)', padding: '2px 6px', borderRadius: 4 }}>
                {activeEdge.data.target_collection}.{activeEdge.data.target_field}
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--muted)', margin: 0, lineHeight: 1.4 }}>
              {activeEdge.data.description}
            </p>
          </div>
        )}
      </div>

      {/* Empty state */}
      {edges.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>No connections found between these collections</span>
        </div>
      )}
    </div>
  );
};

export default SchemaRelationshipGraph;
