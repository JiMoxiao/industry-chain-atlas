import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Legend } from "@/components/Legend";
import { StatePanel } from "@/components/StatePanel";
import { Tooltip } from "@/components/Tooltip";
import { useGraph } from "@/hooks/useGraph";
import type { ChainEdge, ChainNode } from "@/types/chain";

interface TooltipState {
  node: ChainNode | null;
  x: number;
  y: number;
  visible: boolean;
}

interface CanvasProps {
  nodes: ChainNode[];
  edges: ChainEdge[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onClearSelection: () => void;
}

export function Canvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onClearSelection,
}: CanvasProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    node: null,
    x: 0,
    y: 0,
    visible: false,
  });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const handleNodeHover = useCallback((node: ChainNode, position: { x: number; y: number }) => {
    setTooltip({
      node,
      x: position.x,
      y: position.y,
      visible: true,
    });
  }, []);

  const handleNodeLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const handleCanvasClick = useCallback(() => {
    onClearSelection();
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, [onClearSelection]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) {
      return;
    }

    const syncSize = () => {
      setContainerSize({
        width: section.clientWidth,
        height: section.clientHeight,
      });
    };

    syncSize();

    const observer = new ResizeObserver(() => {
      syncSize();
      setTooltip((prev) => ({ ...prev, visible: false }));
    });
    observer.observe(section);

    const hideTooltip = () => {
      setTooltip((prev) => ({ ...prev, visible: false }));
    };

    window.addEventListener("scroll", hideTooltip, true);
    window.addEventListener("resize", hideTooltip);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", hideTooltip, true);
      window.removeEventListener("resize", hideTooltip);
    };
  }, []);

  const { containerRef, isLoading, error } = useGraph({
    nodes,
    edges,
    selectedNodeId,
    onSelectNode,
    onCanvasClick: handleCanvasClick,
    onNodeHover: handleNodeHover,
    onNodeLeave: handleNodeLeave,
  });

  const emptyHint = useMemo(() => {
    if (nodes.length > 0) {
      return null;
    }
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/82">
        <div className="panel-soft px-6 py-5 text-sm text-slate-600">
          当前筛选条件下没有可显示的环节。
        </div>
      </div>
    );
  }, [nodes.length]);

  return (
    <section
      ref={sectionRef}
      className="panel-elevated relative h-[clamp(440px,64vh,760px)] overflow-hidden bg-[radial-gradient(circle_at_12%_8%,_rgba(15,118,110,0.08),_transparent_20%),radial-gradient(circle_at_88%_12%,_rgba(37,99,235,0.08),_transparent_22%),linear-gradient(180deg,_rgba(252,254,255,0.98),_rgba(243,247,250,0.98))]"
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />
      {isLoading ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/88 p-6">
          <StatePanel
            title="图谱画布初始化中"
            description="正在按需加载图谱引擎并挂载当前视图，首次进入图谱页时会稍慢一些。"
            compact
            className="w-full max-w-xl"
          />
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/92 p-6">
          <StatePanel
            title="图谱画布加载失败"
            description={`图谱引擎初始化异常：${error}。当前可切换到其他页面，或刷新后重试。`}
            compact
            tone="warn"
            className="w-full max-w-xl"
          />
        </div>
      ) : null}
      {emptyHint}
      <div ref={containerRef} className="h-full w-full" />
      <Legend />
      <Tooltip
        node={tooltip.node}
        x={tooltip.x}
        y={tooltip.y}
        visible={tooltip.visible}
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
      />
    </section>
  );
}
