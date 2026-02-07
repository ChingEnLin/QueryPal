
import React, { useMemo, useState } from 'react';
import { Relationship, SchemaRelationshipsResponse } from '../types';

interface SchemaRelationshipGraphProps {
    relationships: SchemaRelationshipsResponse;
    selectedCollections: string[];
}

interface Node {
    id: string;
    x: number;
    y: number;
}

interface Edge {
    source: Node;
    target: Node;
    data: Relationship;
}

const SchemaRelationshipGraph: React.FC<SchemaRelationshipGraphProps> = ({ relationships, selectedCollections }) => {
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);
    const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);

    // Filter collections to only those selected (or involved in relationships between selected)
    // Actually, we should show all "selected" collections as nodes, even if isolated.
    const nodes: Node[] = useMemo(() => {
        const uniqueCols = Array.from(new Set(selectedCollections));
        const count = uniqueCols.length;
        const radius = 120; // Radius of the circle layout
        const centerX = 200;
        const centerY = 150; // Reduced height

        if (count === 2) {
            return [
                { id: uniqueCols[0], x: 80, y: centerY },
                { id: uniqueCols[1], x: 320, y: centerY }
            ];
        }

        return uniqueCols.map((col, i) => {
            const angle = (i / count) * 2 * Math.PI - Math.PI / 2; // Start from top
            return {
                id: col,
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            };
        });
    }, [selectedCollections]);

    const edges: Edge[] = useMemo(() => {
        return relationships.relationships
            .filter(rel => selectedCollections.includes(rel.source_collection) && selectedCollections.includes(rel.target_collection))
            .map(rel => {
                const sourceNode = nodes.find(n => n.id === rel.source_collection);
                const targetNode = nodes.find(n => n.id === rel.target_collection);
                if (!sourceNode || !targetNode) return null;
                return { source: sourceNode, target: targetNode, data: rel };
            })
            .filter((e): e is Edge => e !== null);
    }, [relationships, nodes, selectedCollections]);

    // Helper to calculate bezier curve control point
    const getPath = (source: Node, target: Node, index: number) => {
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Curvature logic: Straight line if direct, curved if multiple or loops
        let cx = (source.x + target.x) / 2;
        let cy = (source.y + target.y) / 2;

        // Add offset for multiple edges or just for style
        // If it's a bidirectional pair, we need curvature.
        // Simple logic: curve upwards/downwards based on direction or index

        // A simple consistent curve offset
        // const offset = 40; // This variable was not used, removed.
        // Calculate perpendicular vector
        const px = -dy / dist;
        const py = dx / dist;

        // Small randomish offset based on data string hash or index to allow separate lines for multiple rels
        const curveAmount = 30 + (index * 20);

        cx += px * curveAmount;
        cy += py * curveAmount;

        // Calculate intersection point on the edge of the target circle (radius 30 + arrow size approx 10)
        // We want the arrow to point to the edge, efficiently.
        // Actually, Q curves are hard to chop exactly. 
        // Easier approach: Use a marker-end that has refX properly set, OR calculate the point on the circle.

        // Let's recalculate target/source points to be on the circumference.
        const radius = 30 + 5; // Node radius + buffer
        const angleSource = Math.atan2(cy - source.y, cx - source.x);
        const angleTarget = Math.atan2(cy - target.y, cx - target.x);

        const sx = source.x + radius * Math.cos(angleSource);
        const sy = source.y + radius * Math.sin(angleSource);

        const tx = target.x + radius * Math.cos(angleTarget);
        const ty = target.y + radius * Math.sin(angleTarget);

        return `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;
    };

    return (
        <div className="w-full flex flex-col items-center bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6 overflow-hidden relative">
            <div className="absolute top-2 right-2 flex gap-2">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    AI Inferred Connection
                </div>
            </div>

            <svg width="400" height="300" viewBox="0 0 400 300" className="w-full max-w-[500px] h-auto pointer-events-auto">
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="22" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" className="dark:fill-slate-400" />
                    </marker>
                    <marker id="arrowhead-hover" markerWidth="10" markerHeight="7" refX="22" refY="3.5" orient="auto">
                        <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                    </marker>
                    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Edges */}
                {edges.map((edge, i) => {
                    const isHovered = hoveredEdge === i;
                    const pathData = getPath(edge.source, edge.target, i);

                    return (
                        <g
                            key={i}
                            onMouseEnter={() => setHoveredEdge(i)}
                            onMouseLeave={() => setHoveredEdge(null)}
                            className="transition-opacity duration-300"
                            style={{ opacity: (hoveredEdge !== null && !isHovered) ? 0.3 : 1 }}
                        >
                            {/* Invisible wideline for easier hovering */}
                            <path d={pathData} stroke="transparent" strokeWidth="20" fill="none" className="cursor-pointer" />

                            {/* Visible line - No arrowheads */}
                            <path
                                d={pathData}
                                stroke={isHovered ? "#3b82f6" : "#cbd5e1"}
                                strokeWidth={isHovered ? 3 : 2}
                                fill="none"
                                className={`transition-colors duration-300 ${isHovered ? '' : 'dark:stroke-slate-600'}`}
                            />

                            {/* Animated particle flow only on hover */}
                            {isHovered && (
                                <circle r="3" fill="#3b82f6">
                                    <animateMotion dur="1.5s" repeatCount="indefinite" path={pathData} />
                                </circle>
                            )}
                        </g>
                    );
                })}

                {/* Nodes */}
                {nodes.map(node => {
                    const isHovered = hoveredNode === node.id;
                    const isRelatedToHoveredEdge = hoveredEdge !== null && (edges[hoveredEdge!].source.id === node.id || edges[hoveredEdge!].target.id === node.id);

                    return (
                        <g
                            key={node.id}
                            transform={`translate(${node.x},${node.y})`}
                            onMouseEnter={() => setHoveredNode(node.id)}
                            onMouseLeave={() => setHoveredNode(null)}
                            className="cursor-pointer transition-all duration-300"
                            style={{
                                opacity: (hoveredEdge !== null && !isRelatedToHoveredEdge) ? 0.4 : 1
                            }}
                        >
                            <circle
                                r="30"
                                fill={isHovered || isRelatedToHoveredEdge ? "#eff6ff" : "white"}
                                stroke={isHovered || isRelatedToHoveredEdge ? "#3b82f6" : "#cbd5e1"}
                                strokeWidth={isHovered ? 3 : 2}
                                className={`transition-colors duration-300 dark:bg-slate-800 dark:fill-slate-800 ${isHovered ? '' : 'dark:stroke-slate-600'}`}
                                filter={isHovered ? "url(#glow)" : ""}
                            />
                            {/* Full Name */}
                            <text
                                y="5"
                                textAnchor="middle"
                                alignmentBaseline="middle"
                                className={`text-[10px] font-bold pointer-events-none custom-text-shadow ${isHovered ? 'fill-blue-600' : 'fill-slate-600 dark:fill-slate-300'}`}
                                style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}
                            >
                                {node.id}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* Detail Card Overlay - Appears when hovering an edge */}
            <div className={`absolute bottom-4 left-0 right-0 mx-auto w-[90%] bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 shadow-lg rounded-lg p-3 transition-transform duration-300 ${hoveredEdge !== null ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
                {hoveredEdge !== null && (
                    <div className="flex flex-col items-center text-center">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs text-slate-700 dark:text-slate-200 font-bold">
                                {edges[hoveredEdge].data.source_collection}.{edges[hoveredEdge].data.source_field}
                            </span>
                            <span className="text-slate-400">→</span>
                            <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs text-slate-700 dark:text-slate-200 font-bold">
                                {edges[hoveredEdge].data.target_collection}.{edges[hoveredEdge].data.target_field}
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                            {edges[hoveredEdge].data.description}
                        </p>
                    </div>
                )}
            </div>

            {/* Empty State Overlay */}
            {edges.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur p-4 rounded-lg text-center">
                        <p className="text-slate-500 text-sm">No connections found</p>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SchemaRelationshipGraph;
