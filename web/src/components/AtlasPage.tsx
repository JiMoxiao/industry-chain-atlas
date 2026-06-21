import { useEffect, useMemo } from "react";
import { Canvas } from "@/components/Canvas";
import { DetailPanel } from "@/components/DetailPanel";
import { TopBar } from "@/components/TopBar";
import { useLiveHeat } from "@/hooks/useLiveHeat";
import { useChainStore } from "@/store/useChainStore";
import type { ChainPayload } from "@/types/chain";
import {
  filterGraphData,
  getGroupOptions,
  getNodeMap,
  mergePayloadHeat,
} from "@/utils/graphHelpers";

interface AtlasPageProps {
  payload: ChainPayload;
}

export function AtlasPage({ payload }: AtlasPageProps) {
  const {
    selectedNodeId,
    activeTab,
    selectedGroups,
    searchQuery,
    toggleGroup,
    clearGroups,
    setSelectedNodeId,
    setActiveTab,
    setSearchQuery,
    resetForSlug,
  } = useChainStore();

  useEffect(() => {
    resetForSlug(payload.slug);
  }, [payload.slug, resetForSlug]);

  const { heatMap, isLoading, progressText, updatedAt } = useLiveHeat(payload.stock_codes);

  const mergedPayload = useMemo(() => mergePayloadHeat(payload, heatMap), [payload, heatMap]);
  const groupOptions = useMemo(() => getGroupOptions(mergedPayload), [mergedPayload]);
  const filtered = useMemo(
    () => filterGraphData(mergedPayload, selectedGroups, searchQuery),
    [mergedPayload, searchQuery, selectedGroups]
  );
  const nodeMap = useMemo(() => getNodeMap(filtered.nodes), [filtered.nodes]);
  const selectedNode =
    selectedNodeId && filtered.visibleNodeIds.has(selectedNodeId)
      ? nodeMap.get(selectedNodeId) ?? null
      : null;

  useEffect(() => {
    if (selectedNodeId && !filtered.visibleNodeIds.has(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [filtered.visibleNodeIds, selectedNodeId, setSelectedNodeId]);

  const statusText = useMemo(() => {
    const base =
      `显示 ${filtered.formalNodeCount}/${mergedPayload.nodes.length} 个正式环节` +
      ` · ${filtered.edges.filter((edge) => edge.relationship_status === "formal").length} 条正式关系` +
      ` · ${filtered.candidateEdgeCount} 条候选关系` +
      ` · ${filtered.shadowNodeCount} 个影子节点`;
    if (isLoading) {
      return `${base} · ${progressText}`;
    }
    if (progressText) {
      return updatedAt ? `${base} · ${progressText} · ${updatedAt}` : `${base} · ${progressText}`;
    }
    return base;
  }, [
    filtered.edges,
    filtered.candidateEdgeCount,
    filtered.formalNodeCount,
    filtered.shadowNodeCount,
    isLoading,
    mergedPayload.nodes.length,
    progressText,
    updatedAt,
  ]);

  return (
    <div className="space-y-4 md:space-y-5 xl:space-y-6">
      <TopBar
        payload={mergedPayload}
        groupOptions={groupOptions}
        selectedGroups={selectedGroups}
        searchQuery={searchQuery}
        statusText={statusText}
        onToggleGroup={toggleGroup}
        onClearGroups={clearGroups}
        onSearchChange={setSearchQuery}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_clamp(320px,22vw,440px)] xl:items-stretch 2xl:gap-6">
        <Canvas
          nodes={filtered.nodes}
          edges={filtered.edges}
          selectedNodeId={selectedNode?.id ?? null}
          onSelectNode={(nodeId) => {
            setSelectedNodeId(nodeId);
            setActiveTab("overview");
          }}
          onClearSelection={() => setSelectedNodeId(null)}
        />
        <DetailPanel
          chainSlug={mergedPayload.slug}
          node={selectedNode}
          edges={filtered.edges}
          orphanRelationships={mergedPayload.orphan_relationships ?? []}
          nodeMap={nodeMap}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onClose={() => setSelectedNodeId(null)}
        />
      </div>
    </div>
  );
}
