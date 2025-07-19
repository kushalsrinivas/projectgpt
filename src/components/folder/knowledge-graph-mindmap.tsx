"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Move,
  FileText,
  Lightbulb,
  Tag,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnowledgeNode, KnowledgeEdge } from "@/lib/indexeddb";

interface KnowledgeGraphMindmapProps {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  onNodeClick?: (node: KnowledgeNode) => void;
  onNodeHover?: (node: KnowledgeNode | null) => void;
  className?: string;
}

interface ViewportTransform {
  x: number;
  y: number;
  scale: number;
}

interface NodePosition {
  x: number;
  y: number;
}

const NODE_COLORS = {
  document: "#3b82f6", // blue
  concept: "#10b981", // emerald
  entity: "#f59e0b", // amber
  topic: "#8b5cf6", // violet
} as const;

const NODE_ICONS = {
  document: FileText,
  concept: Lightbulb,
  entity: Tag,
  topic: BookOpen,
} as const;

export function KnowledgeGraphMindmap({
  nodes,
  edges,
  onNodeClick,
  onNodeHover,
  className,
}: KnowledgeGraphMindmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [viewport, setViewport] = useState<ViewportTransform>({
    x: 0,
    y: 0,
    scale: 1,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Calculate layout using a simple force-directed approach
  const calculateLayout = useCallback(
    (nodes: KnowledgeNode[]): Map<string, NodePosition> => {
      const positions = new Map<string, NodePosition>();

      if (nodes.length === 0) return positions;

      // If nodes already have positions, use them
      const hasExistingPositions = nodes.some((node) => node.position);

      if (hasExistingPositions) {
             for (const node of nodes) {
       if (node.position) {
         positions.set(node.id, node.position);
       }
     }
        return positions;
      }

      // Simple circular layout for demonstration
      const centerX = 400;
      const centerY = 300;
      const radius = Math.min(200, Math.max(100, nodes.length * 20));

      if (nodes.length === 1) {
        positions.set(nodes[0].id, { x: centerX, y: centerY });
        return positions;
      }

      nodes.forEach((node, index) => {
        const angle = (index / nodes.length) * 2 * Math.PI;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        positions.set(node.id, { x, y });
      });

      return positions;
    },
    []
  );

  const nodePositions = calculateLayout(nodes);

  // Handle mouse events for panning and zooming
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      // Left click
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging && dragStart) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        setViewport((prev) => ({
          ...prev,
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }));

        setDragStart({ x: e.clientX, y: e.clientY });
      }
    },
    [isDragging, dragStart]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(3, viewport.scale * scaleFactor));

      setViewport((prev) => ({
        ...prev,
        scale: newScale,
      }));
    },
    [viewport.scale]
  );

  // Zoom controls
  const zoomIn = () => {
    setViewport((prev) => ({
      ...prev,
      scale: Math.min(3, prev.scale * 1.2),
    }));
  };

  const zoomOut = () => {
    setViewport((prev) => ({
      ...prev,
      scale: Math.max(0.1, prev.scale / 1.2),
    }));
  };

  const resetView = () => {
    setViewport({ x: 0, y: 0, scale: 1 });
  };

  // Handle node interactions
  const handleNodeClick = (node: KnowledgeNode) => {
    setSelectedNode(node.id);
    onNodeClick?.(node);
  };

  const handleNodeHover = (node: KnowledgeNode | null) => {
    setHoveredNode(node?.id || null);
    onNodeHover?.(node);
  };

  // Get connected edges for highlighting
  const getConnectedEdges = (nodeId: string) => {
    return edges.filter(
      (edge) => edge.sourceId === nodeId || edge.targetId === nodeId
    );
  };

  const isEdgeHighlighted = (edge: KnowledgeEdge) => {
    return (
      hoveredNode &&
      (edge.sourceId === hoveredNode || edge.targetId === hoveredNode)
    );
  };

  if (nodes.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center h-64 text-muted-foreground",
          className
        )}
      >
        <div className="text-center">
          <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No Knowledge Graph</p>
          <p className="text-sm">
            Add documents to build the contextual mind map
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full", className)} ref={containerRef}>
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="flex gap-1 bg-background/80 backdrop-blur-sm border rounded-lg p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomIn}
            className="h-8 w-8 p-0"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={zoomOut}
            className="h-8 w-8 p-0"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetView}
            className="h-8 w-8 p-0"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="bg-background/80 backdrop-blur-sm border rounded-lg p-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Move className="h-3 w-3" />
            Drag to pan • Scroll to zoom
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm border rounded-lg p-3">
        <h4 className="text-sm font-medium mb-2">Node Types</h4>
        <div className="space-y-2">
          {Object.entries(NODE_COLORS).map(([type, color]) => {
            const Icon = NODE_ICONS[type as keyof typeof NODE_ICONS];
            return (
              <div key={type} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <Icon className="h-3 w-3" />
                <span className="capitalize">{type}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <g
          transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.scale})`}
        >
          {/* Render edges */}
          <g className="edges">
            {edges.map((edge) => {
              const sourcePos = nodePositions.get(edge.sourceId);
              const targetPos = nodePositions.get(edge.targetId);

              if (!sourcePos || !targetPos) return null;

              const isHighlighted = isEdgeHighlighted(edge);

              return (
                <g key={edge.id}>
                  <line
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={isHighlighted ? "#f59e0b" : "#d1d5db"}
                    strokeWidth={isHighlighted ? 2 : 1}
                    strokeOpacity={isHighlighted ? 0.8 : 0.4}
                    className="transition-all duration-200"
                  />

                  {/* Edge label */}
                  {isHighlighted && (
                    <text
                      x={(sourcePos.x + targetPos.x) / 2}
                      y={(sourcePos.y + targetPos.y) / 2}
                      textAnchor="middle"
                      className="fill-foreground text-xs"
                      dy="0.35em"
                    >
                      <title>{edge.type.replace("_", " ")}</title>
                      {edge.type.replace("_", " ")}
                    </text>
                  )}
                </g>
              );
            })}
          </g>

          {/* Render nodes */}
          <g className="nodes">
            {nodes.map((node) => {
              const position = nodePositions.get(node.id);
              if (!position) return null;

              const isHovered = hoveredNode === node.id;
              const isSelected = selectedNode === node.id;
              const nodeColor = NODE_COLORS[node.type];
              const radius = isHovered ? 25 : 20;

              return (
                <TooltipProvider key={node.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <g
                        className="cursor-pointer transition-all duration-200"
                        onClick={() => handleNodeClick(node)}
                        onMouseEnter={() => handleNodeHover(node)}
                        onMouseLeave={() => handleNodeHover(null)}
                      >
                        {/* Node circle */}
                        <circle
                          cx={position.x}
                          cy={position.y}
                          r={radius}
                          fill={nodeColor}
                          stroke={isSelected ? "#fbbf24" : "white"}
                          strokeWidth={isSelected ? 3 : 2}
                          className="transition-all duration-200"
                          opacity={isHovered ? 0.9 : 0.8}
                        />

                        {/* Node icon */}
                        <foreignObject
                          x={position.x - 8}
                          y={position.y - 8}
                          width={16}
                          height={16}
                        >
                          {React.createElement(NODE_ICONS[node.type], {
                            className: "h-4 w-4 text-white",
                          })}
                        </foreignObject>

                        {/* Node label */}
                        <text
                          x={position.x}
                          y={position.y + radius + 15}
                          textAnchor="middle"
                          className="fill-foreground text-sm font-medium"
                          style={{
                            fontSize: `${Math.max(10, 12 / viewport.scale)}px`,
                          }}
                        >
                          {node.label.length > 15
                            ? `${node.label.substring(0, 15)}...`
                            : node.label}
                        </text>
                      </g>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {node.type}
                          </Badge>
                          <span className="font-medium">{node.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {node.content.length > 100
                            ? `${node.content.substring(0, 100)}...`
                            : node.content}
                        </p>
                        <div className="text-xs text-muted-foreground">
                          <div>Documents: {node.documentIds.length}</div>
                          <div>Chunks: {node.chunkIds.length}</div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-background border rounded-lg p-4 max-h-48">
          <ScrollArea className="h-full">
            {(() => {
              const node = nodes.find((n) => n.id === selectedNode);
              if (!node) return null;

              const connectedEdges = getConnectedEdges(selectedNode);

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{node.type}</Badge>
                      <h3 className="font-medium">{node.label}</h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedNode(null)}
                    >
                      ×
                    </Button>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {node.content}
                  </p>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-medium">Sources:</span>
                      <div className="text-muted-foreground">
                        {node.documentIds.length} documents,{" "}
                        {node.chunkIds.length} chunks
                      </div>
                    </div>
                    <div>
                      <span className="font-medium">Connections:</span>
                      <div className="text-muted-foreground">
                        {connectedEdges.length} relationships
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
