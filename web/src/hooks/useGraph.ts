import { useEffect, useMemo, useRef, useState } from "react";
import { EDGE_FOCUS_STYLE, EDGE_STYLE } from "@/utils/edgeStyles";
import { formatSignedPercent, heatToColor } from "@/utils/heatColor";
import { collectConnectedNodeIds, getNodeMap, getPositionLabel } from "@/utils/graphHelpers";
import type { ChainEdge, ChainNode } from "@/types/chain";

const CANDIDATE_EDGE_STYLE = {
  stroke: "#cc8cdf",
  lineWidth: 1.4,
  arrowSize: 7,
  lineDash: [6, 4],
};

const CANDIDATE_EDGE_FOCUS_STYLE = {
  stroke: "#a21caf",
  lineWidth: 2.6,
  arrowSize: 10,
  lineDash: [6, 4],
};

interface PointerPosition {
  x: number;
  y: number;
}

interface UseGraphOptions {
  nodes: ChainNode[];
  edges: ChainEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onCanvasClick: () => void;
  onNodeHover: (node: ChainNode, position: PointerPosition) => void;
  onNodeLeave: () => void;
}

interface GraphNodeItem {
  getID(): string;
  getModel(): { nodeData?: ChainNode };
  setState(state: string, value: boolean): void;
}

interface GraphEdgeItem {
  getModel(): { edgeData?: ChainEdge; source?: string; target?: string };
}

interface GraphEvent {
  item: GraphNodeItem;
  canvasX?: number;
  canvasY?: number;
  x?: number;
  y?: number;
  originalEvent?: MouseEvent;
}

interface GraphInstance {
  data(graphData: ReturnType<typeof toGraphData>): void;
  render(): void;
  fitView(padding?: number): void;
  on(eventName: string, handler: (event: GraphEvent) => void): void;
  changeSize(width: number, height: number): void;
  destroy(): void;
  changeData(graphData: ReturnType<typeof toGraphData>): void;
  getNodes(): GraphNodeItem[];
  getEdges(): GraphEdgeItem[];
  updateItem(item: GraphEdgeItem, model: Record<string, unknown>): void;
}

let nodeRegistered = false;

let g6Promise: Promise<typeof import("@antv/g6")["default"]> | null = null;

function loadG6() {
  if (!g6Promise) {
    g6Promise = import("@antv/g6").then((module) => module.default);
  }

  return g6Promise;
}

type G6Lib = Awaited<ReturnType<typeof loadG6>>;

function ensureNodeRegistered(G6: G6Lib) {
  if (nodeRegistered) {
    return;
  }

  G6.registerNode("heat-node", {
    draw(cfg, group) {
      const nodeData = (cfg?.nodeData ?? {}) as ChainNode;
      const isShadowNode = nodeData.node_kind === "shadow";
      const width = isShadowNode ? 154 : 172;
      const height = isShadowNode ? 72 : 82;
      const radius = 14;
      const tokens = heatToColor(nodeData.heat_d20 ?? 0);
      const positionLabel = isShadowNode
        ? nodeData.shadow_role === "buyer"
          ? "候选买方"
          : "候选供方"
        : getPositionLabel(nodeData.position);
      const title = nodeData.name.length > 14 ? `${nodeData.name.slice(0, 14)}..` : nodeData.name;
      const boxStyle = isShadowNode
        ? {
            fill: "rgba(250,232,255,0.92)",
            stroke: "#cc8cdf",
            lineWidth: 2,
            lineDash: [6, 4],
            shadowColor: "rgba(192,38,211,0.14)",
            shadowBlur: 10,
          }
        : {
            fill: tokens.fill,
            stroke: tokens.stroke,
            lineWidth: 2.5,
            shadowColor: "rgba(148,163,184,0.14)",
            shadowBlur: 14,
          };

      const keyShape = group?.addShape("rect", {
        attrs: {
          x: -width / 2,
          y: -height / 2,
          width,
          height,
          radius,
          fill: boxStyle.fill,
          stroke: boxStyle.stroke,
          lineWidth: boxStyle.lineWidth,
          lineDash: boxStyle.lineDash,
          shadowColor: boxStyle.shadowColor,
          shadowBlur: boxStyle.shadowBlur,
          cursor: "pointer",
        },
        name: "main-box",
      });

      group?.addShape("text", {
        attrs: {
          x: -width / 2 + 12,
          y: -height / 2 + 14,
          text: isShadowNode ? nodeData.shadow_company_code || "候选线索" : nodeData.id,
          fontSize: 9,
          fontWeight: 700,
          fill: isShadowNode ? "#9d174d" : tokens.tagText,
          opacity: 0.72,
          fontFamily: "Consolas, monospace",
        },
      });

      group?.addShape("text", {
        attrs: {
          x: -width / 2 + 12,
          y: -height / 2 + 34,
          text: title,
          fontSize: 14,
          fontWeight: 700,
          fill: isShadowNode ? "#701a75" : tokens.text,
        },
      });

      group?.addShape("text", {
        attrs: {
          x: -width / 2 + 12,
          y: -height / 2 + 56,
          text: isShadowNode
            ? `线索 ${nodeData.orphan_count ?? 1} 条`
            : `20日 ${formatSignedPercent(nodeData.heat_d20 ?? 0)}`,
          fontSize: 10,
          fontWeight: 600,
          fill: isShadowNode ? "#a21caf" : tokens.heatText,
        },
      });

      const tagWidth = positionLabel.length * 10 + 14;

      group?.addShape("rect", {
        attrs: {
          x: width / 2 - tagWidth - 10,
          y: height / 2 - 22,
          width: tagWidth,
          height: 18,
          radius: 7,
          fill: isShadowNode ? "rgba(192,38,211,0.12)" : tokens.tagBg,
          opacity: 0.95,
        },
      });

      group?.addShape("text", {
        attrs: {
          x: width / 2 - tagWidth / 2 - 10,
          y: height / 2 - 13,
          text: positionLabel,
          fontSize: 9,
          fontWeight: 700,
          fill: isShadowNode ? "#86198f" : tokens.tagText,
          textAlign: "center",
        },
      });

      return keyShape as never;
    },
    getAnchorPoints() {
      return [
        [0, 0.5],
        [1, 0.5],
        [0.5, 0],
        [0.5, 1],
      ];
    },
  });

  nodeRegistered = true;
}

function toGraphData(nodes: ChainNode[], edges: ChainEdge[], G6: G6Lib) {
  const nodeMap = getNodeMap(nodes);
  const graphNodes = nodes.map((node) => ({
    id: node.id,
    type: "heat-node",
    group: node.group,
    nodeData: node,
    x: node.x,
    y: node.y,
  }));

  const graphEdges = edges.map((edge) => {
    const sourceNode = nodeMap.get(edge.from);
    const targetNode = nodeMap.get(edge.to);
    const sameLayer = sourceNode && targetNode && sourceNode.layer === targetNode.layer;
    const baseStyle =
      edge.relationship_status === "candidate"
        ? CANDIDATE_EDGE_STYLE
        : EDGE_STYLE[edge.rel_type] ?? EDGE_STYLE.primary;

    let sourceAnchor = 1;
    let targetAnchor = 0;
    let type = "cubic-horizontal";

    if (sameLayer && sourceNode && targetNode) {
      type = "cubic-vertical";
      if (sourceNode.y <= targetNode.y) {
        sourceAnchor = 3;
        targetAnchor = 2;
      } else {
        sourceAnchor = 2;
        targetAnchor = 3;
      }
    } else if (sourceNode && targetNode && sourceNode.x > targetNode.x) {
      sourceAnchor = 0;
      targetAnchor = 1;
    }

    return {
      source: edge.from,
      target: edge.to,
      type,
      sourceAnchor,
      targetAnchor,
      edgeData: edge,
      style: {
        stroke: baseStyle.stroke,
        lineWidth: baseStyle.lineWidth,
        lineDash: baseStyle.lineDash,
        endArrow: {
          path: G6.Arrow.triangle(baseStyle.arrowSize, baseStyle.arrowSize * 1.25, 0),
          fill: baseStyle.stroke,
        },
      },
    };
  });

  return { nodes: graphNodes, edges: graphEdges };
}

export function useGraph({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onCanvasClick,
  onNodeHover,
  onNodeLeave,
}: UseGraphOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<GraphInstance | null>(null);
  const g6Ref = useRef<G6Lib | null>(null);
  const onSelectNodeRef = useRef(onSelectNode);
  const onCanvasClickRef = useRef(onCanvasClick);
  const onNodeHoverRef = useRef(onNodeHover);
  const onNodeLeaveRef = useRef(onNodeLeave);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const graphState = useMemo(() => ({ nodes, edges }), [edges, nodes]);
  const latestGraphStateRef = useRef(graphState);

  useEffect(() => {
    onSelectNodeRef.current = onSelectNode;
    onCanvasClickRef.current = onCanvasClick;
    onNodeHoverRef.current = onNodeHover;
    onNodeLeaveRef.current = onNodeLeave;
  }, [onCanvasClick, onNodeHover, onNodeLeave, onSelectNode]);

  useEffect(() => {
    latestGraphStateRef.current = graphState;
  }, [graphState]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    let observer: ResizeObserver | null = null;

    setIsLoading(true);
    setError(null);

    loadG6()
      .then((G6) => {
        if (cancelled) {
          return;
        }

        ensureNodeRegistered(G6);

        const graph = new G6.Graph({
          container,
          width: container.clientWidth || 1200,
          height: container.clientHeight || 800,
          fitView: true,
          fitViewPadding: 40,
          modes: { default: ["drag-canvas", "zoom-canvas", "drag-node", "click-select"] },
          defaultNode: { type: "heat-node" },
          defaultEdge: { type: "cubic-horizontal" },
          nodeStateStyles: {
            selected: { lineWidth: 3.2, shadowBlur: 18, shadowColor: "rgba(13,148,136,0.18)" },
            active: {
              shadowBlur: 18,
              shadowColor: "rgba(37,99,235,0.14)",
              stroke: "#0f766e",
              lineWidth: 3,
            },
            hover: {
              shadowBlur: 20,
              shadowColor: "rgba(37,99,235,0.18)",
              lineWidth: 3.1,
            },
            inactive: { opacity: 0.3 },
          },
          edgeStateStyles: {
            hover: { lineWidth: 4, shadowBlur: 8, shadowColor: "rgba(37,99,235,0.18)" },
          },
        }) as unknown as GraphInstance;

        graph.data(toGraphData(latestGraphStateRef.current.nodes, latestGraphStateRef.current.edges, G6));
        graph.render();
        graph.fitView(40);

        graph.on("canvas:click", () => onCanvasClickRef.current());
        graph.on("node:click", (evt: GraphEvent) => onSelectNodeRef.current(evt.item.getID()));
        graph.on("node:mouseenter", (evt: GraphEvent) => {
          const node = evt.item.getModel().nodeData as ChainNode;
          const rect = container.getBoundingClientRect();
          const pointerX = evt.originalEvent ? evt.originalEvent.clientX - rect.left : evt.canvasX ?? evt.x ?? 0;
          const pointerY = evt.originalEvent ? evt.originalEvent.clientY - rect.top : evt.canvasY ?? evt.y ?? 0;
          evt.item.setState("hover", true);
          onNodeHoverRef.current(node, {
            x: pointerX,
            y: pointerY,
          });
        });
        graph.on("node:mousemove", (evt: GraphEvent) => {
          const node = evt.item.getModel().nodeData as ChainNode;
          const rect = container.getBoundingClientRect();
          const pointerX = evt.originalEvent ? evt.originalEvent.clientX - rect.left : evt.canvasX ?? evt.x ?? 0;
          const pointerY = evt.originalEvent ? evt.originalEvent.clientY - rect.top : evt.canvasY ?? evt.y ?? 0;
          onNodeHoverRef.current(node, {
            x: pointerX,
            y: pointerY,
          });
        });
        graph.on("node:mouseleave", (evt: GraphEvent) => {
          evt.item.setState("hover", false);
          onNodeLeaveRef.current();
        });

        observer = new ResizeObserver(() => {
          graph.changeSize(container.clientWidth || 1200, container.clientHeight || 800);
          graph.fitView(40);
        });
        observer.observe(container);

        graphRef.current = graph;
        g6Ref.current = G6;
        setIsLoading(false);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "图谱画布初始化失败");
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
      graphRef.current?.destroy();
      graphRef.current = null;
      g6Ref.current = null;
    };
  }, []);

  useEffect(() => {
    const graph = graphRef.current;
    const G6 = g6Ref.current;
    if (!graph || !G6) {
      return;
    }

    graph.changeData(toGraphData(graphState.nodes, graphState.edges, G6));
    graph.fitView(40);
  }, [graphState]);

  useEffect(() => {
    const graph = graphRef.current;
    const G6 = g6Ref.current;
    if (!graph || !G6) {
      return;
    }

    const connectedNodeIds = collectConnectedNodeIds(selectedNodeId, edges);

    graph.getNodes().forEach((item) => {
      const id = item.getID();
      item.setState("selected", selectedNodeId === id);
      item.setState("active", connectedNodeIds.has(id));
      item.setState("inactive", selectedNodeId !== null && !connectedNodeIds.has(id));
    });

    graph.getEdges().forEach((edgeItem) => {
      const model = edgeItem.getModel();
      const edgeData = model.edgeData as ChainEdge;
      const sourceId = model.source as string;
      const targetId = model.target as string;
      const isConnected =
        selectedNodeId !== null &&
        connectedNodeIds.has(sourceId) &&
        connectedNodeIds.has(targetId);

      const tokens = isConnected
        ? edgeData.relationship_status === "candidate"
          ? CANDIDATE_EDGE_FOCUS_STYLE
          : EDGE_FOCUS_STYLE[edgeData.rel_type] ?? EDGE_FOCUS_STYLE.primary
        : edgeData.relationship_status === "candidate"
          ? CANDIDATE_EDGE_STYLE
          : EDGE_STYLE[edgeData.rel_type] ?? EDGE_STYLE.primary;

      graph.updateItem(edgeItem, {
        style: {
          stroke: tokens.stroke,
          lineWidth: tokens.lineWidth,
          lineDash: tokens.lineDash,
          opacity: selectedNodeId === null ? 1 : isConnected ? 1 : 0.18,
          endArrow: {
            path: G6.Arrow.triangle(tokens.arrowSize, tokens.arrowSize * 1.25, 0),
            fill: tokens.stroke,
          },
        },
      });
    });
  }, [edges, selectedNodeId]);

  return { containerRef, isLoading, error };
}
