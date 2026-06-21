import type { ChainEdge, ChainNode, OrphanRelationship, PanelTab } from "@/types/chain";
import { formatSignedPercent, heatToColor } from "@/utils/heatColor";
import { getPositionLabel } from "@/utils/graphHelpers";
import { CompaniesTab } from "@/components/panel/CompaniesTab";
import { EdgesTab } from "@/components/panel/EdgesTab";
import { MetricsTab } from "@/components/panel/MetricsTab";
import { OverviewTab } from "@/components/panel/OverviewTab";

interface DetailPanelProps {
  chainSlug: string;
  node: ChainNode | null;
  edges: ChainEdge[];
  orphanRelationships: OrphanRelationship[];
  nodeMap: Map<string, ChainNode>;
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onClose: () => void;
}

const tabs: PanelTab[] = ["overview", "companies", "metrics", "edges"];

export function DetailPanel({
  chainSlug,
  node,
  edges,
  orphanRelationships,
  nodeMap,
  activeTab,
  onTabChange,
  onClose,
}: DetailPanelProps) {
  if (!node) {
    return (
      <aside className="panel-elevated flex h-[clamp(440px,64vh,760px)] flex-col overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 xl:px-6 xl:py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 xl:text-xl">详情面板</h3>
              <p className="mt-1 text-xs text-slate-500">节点详情、公司、指标和关系会在这里同步展示。</p>
            </div>
            <span className="chip-neutral">未选择节点</span>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-5 xl:p-6">
          <div className="surface-muted flex w-full max-w-[280px] flex-col items-center gap-3 border-dashed px-6 py-8 text-center">
            <p className="text-sm font-medium text-slate-900">先选一个图谱节点</p>
            <p className="text-xs leading-6 text-slate-500">
              点击画布中的任意环节后，这里会展示该环节的热度、公司、指标和上下游关系。
            </p>
          </div>
        </div>
      </aside>
    );
  }

  const colors = heatToColor(node.heat_d20);

  return (
    <aside className="panel-elevated flex h-[clamp(440px,64vh,760px)] flex-col overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4 xl:px-6 xl:py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 xl:text-xl">{node.name}</h3>
            <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
              {node.node_kind === "shadow" ? (
                <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-fuchsia-700">
                  影子节点
                </span>
              ) : null}
              <span
                className="rounded-full px-3 py-1"
                style={{ background: colors.tagBg, color: colors.tagText }}
              >
                {node.node_kind === "shadow"
                  ? node.shadow_role === "buyer"
                    ? "候选买方"
                    : "候选供方"
                  : getPositionLabel(node.position)}
              </span>
              {node.node_kind === "shadow" ? (
                <span className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">
                  线索 {node.orphan_count ?? 1} 条
                </span>
              ) : (
                <>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">
                    20日 {formatSignedPercent(node.heat_d20)}
                  </span>
                  <span className="rounded-full border border-slate-200 px-3 py-1 text-slate-600">
                    {node.companies.length} 家公司
                  </span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:border-slate-300 hover:text-slate-900"
          >
            关闭
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 border-b border-slate-200 bg-slate-50/72 px-2 py-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={[
              "rounded-2xl px-2.5 py-2 text-[11px] capitalize transition xl:px-3 xl:text-xs",
              activeTab === tab
                ? "border border-slate-200 bg-white text-slate-900 shadow-[0_8px_18px_rgba(148,163,184,0.14)]"
                : "text-slate-500 hover:bg-white/60 hover:text-slate-900",
            ].join(" ")}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 p-5 xl:p-6">
        <div className="h-full overflow-y-auto pr-1">
          {activeTab === "overview" ? <OverviewTab chainSlug={chainSlug} node={node} orphanRelationships={orphanRelationships} /> : null}
          {activeTab === "companies" ? <CompaniesTab node={node} /> : null}
          {activeTab === "metrics" ? <MetricsTab node={node} /> : null}
          {activeTab === "edges" ? (
            <EdgesTab
              node={node}
              edges={edges}
              orphanRelationships={orphanRelationships}
              nodeMap={nodeMap}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
