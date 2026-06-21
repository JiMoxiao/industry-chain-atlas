import { useEffect, useMemo, useState } from "react";
import { StatePanel } from "@/components/StatePanel";
import { TrendSparkline } from "@/components/TrendSparkline";
import { loadResearchTrendsPayload } from "@/data/research";
import type { ChainNode, OrphanRelationship } from "@/types/chain";
import type { ResearchTrendsPayload } from "@/types/research";
import { formatSignedPercent, heatToColor } from "@/utils/heatColor";
import { getPositionLabel } from "@/utils/graphHelpers";

export function OverviewTab({
  chainSlug,
  node,
  orphanRelationships,
}: {
  chainSlug: string;
  node: ChainNode;
  orphanRelationships: OrphanRelationship[];
}) {
  const [researchTrendsPayload, setResearchTrendsPayload] = useState<ResearchTrendsPayload | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);
  const colors = heatToColor(node.heat_d20);

  useEffect(() => {
    let cancelled = false;

    loadResearchTrendsPayload()
      .then((payload) => {
        if (!cancelled) {
          setResearchTrendsPayload(payload);
          setTrendError(null);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setTrendError(reason instanceof Error ? reason.message : "趋势数据加载失败");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const chainTrend = useMemo(
    () => researchTrendsPayload?.chains.find((chain) => chain.slug === chainSlug) ?? null,
    [chainSlug, researchTrendsPayload]
  );
  const segmentTrend = useMemo(
    () => chainTrend?.segments.find((segment) => segment.id === node.id) ?? null,
    [chainTrend, node.id]
  );
  const relatedOrphans = orphanRelationships.filter((relationship) => {
    if (node.node_kind === "shadow") {
      return (
        relationship.supplier_code === node.shadow_company_code ||
        relationship.buyer_code === node.shadow_company_code
      );
    }

    return node.companies.some(
      (company) =>
        company.code === relationship.supplier_code || company.code === relationship.buyer_code
    );
  });

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-teal-200/80 bg-[linear-gradient(135deg,rgba(240,253,250,0.96),rgba(255,255,255,0.92))] p-4 text-sm leading-7 text-slate-700 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
        {node.description || "暂无描述。"}
      </div>

      {node.node_kind === "shadow" ? (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="节点类型" value="影子节点" tone="neutral" />
          <MetricCard label="线索条数" value={`${node.orphan_count ?? 1}`} tone="neutral" />
          <MetricCard
            label="角色"
            value={node.shadow_role === "buyer" ? "候选买方" : "候选供方"}
            tone="neutral"
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="当日" value={formatSignedPercent(node.heat_d)} tone={node.heat_d >= 0 ? "up" : "down"} />
          <MetricCard label="近5日" value={formatSignedPercent(node.heat_d5)} tone={node.heat_d5 >= 0 ? "up" : "down"} />
          <MetricCard label="近20日" value={formatSignedPercent(node.heat_d20)} tone={node.heat_d20 >= 0 ? "up" : "down"} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
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
          <span className="chip-neutral">
            非正式环节占位
          </span>
        ) : (
          <span className="chip-neutral">
            {node.companies.length} 家上市公司
          </span>
        )}
      </div>

      <div className="panel-soft p-4">
        <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50/72 p-4 text-sm leading-7 text-slate-700">
          <p className="font-medium text-slate-900">正式关系与候选关系说明</p>
          <p className="mt-2 text-xs text-slate-600">
            正式关系是已经完成环节映射的主图连线；候选关系来自 `orphan_relationships` 的公司级供应线索，
            由于对端未映射、同层/同环节内关系，或仅能证明公司级连接，暂不直接并入正式主链。
          </p>
          <p className="mt-2 text-xs text-slate-600">
            图上的紫色虚线表示候选关系；紫色虚框节点表示影子节点，即“已有线索但尚未沉淀为正式环节”的占位对象。
          </p>
        </div>
      </div>

      {node.node_kind === "shadow" ? null : (
        <div className="panel-soft p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-medium text-slate-900">产能趋势</h4>
              <p className="mt-1 text-xs text-slate-500">
                {segmentTrend
                  ? `已聚合 ${segmentTrend.metric_count} 个指标序列`
                  : "当前环节暂无可聚合快照样本"}
              </p>
            </div>
            <span className="chip-neutral">
              快照 {researchTrendsPayload ? chainTrend?.snapshot_count ?? 0 : "加载中"}
            </span>
          </div>

          {trendError ? (
            <StatePanel
              title="趋势卡片暂不可用"
              description={`趋势快照资源加载失败：${trendError}。当前仍可继续查看公司、指标和关系明细。`}
              compact
              tone="warn"
              className="mt-4"
            />
          ) : !researchTrendsPayload ? (
            <StatePanel
              title="趋势快照加载中"
              description="正在按需读取当前环节相关的趋势序列。"
              compact
              className="mt-4"
            />
          ) : segmentTrend ? (
            <div className="mt-4 space-y-3">
              {segmentTrend.metrics.slice(0, 3).map((series) => (
                <div key={series.key} className="surface-subtle p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm font-medium text-slate-900">{series.metric_name}</p>
                    <span className={deltaTone(series.delta_value ?? null)}>
                      {formatDelta(series.delta_value ?? null, series.delta_ratio ?? null)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    最新值 {formatMetricValue(series.latest_value, series.unit)} · 样本 {series.sample_count}
                  </p>
                  <div className="mt-3">
                    <TrendSparkline points={series.points} className="h-20 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">当前环节暂无可聚合的趋势快照样本。</p>
          )}
        </div>
      )}

      <div className="panel-soft p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-slate-900">候选关系线索</h4>
            <p className="mt-1 text-xs text-slate-500">
              这里展示的是已被提升到图上候选虚线/影子节点背后的公司级线索明细。
            </p>
          </div>
          <span className="chip-neutral">
            {relatedOrphans.length} 条
          </span>
        </div>

        {relatedOrphans.length > 0 ? (
          <div className="mt-4 space-y-2">
            {relatedOrphans.slice(0, 3).map((relationship, index) => (
              <div
                key={`${relationship.supplier_code}-${relationship.buyer_code}-${index}`}
                className="surface-subtle px-4 py-3 text-sm text-slate-700"
              >
                <p className="font-medium text-slate-900">
                  {relationship.supplier_name || relationship.supplier_code} →{" "}
                  {relationship.buyer_name || relationship.buyer_code || "待映射买方"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {relationship.product || "未命名关系"} · {relationship.rel_type}
                  {relationship.estimated ? " · 含估算" : ""}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">当前没有和该对象直接关联的候选关系线索。</p>
        )}
      </div>

      {node.node_kind !== "shadow" && node.new_capacity.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-900">在建 / 扩产产能</h4>
          <div className="space-y-2">
            {node.new_capacity.map((item, index) => (
              <div
                key={`${item.company}-${index}`}
                className="surface-subtle p-4 text-sm text-slate-700"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-900">{item.company}</span>
                  <span className="text-xs text-slate-500">{item.expected_online || "时间待定"}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                  <span>{item.scale || "规模待补充"}</span>
                  <span>{item.status || "状态待补充"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "up" | "down" | "neutral";
}) {
  return (
    <div className="panel-soft p-4 text-center">
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p
        className={[
          "mt-3 text-xl font-semibold",
          tone === "up" ? "text-rose-600" : tone === "down" ? "text-teal-600" : "text-slate-800",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}

function formatMetricValue(value: number, unit?: string | null) {
  const normalized = Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  return unit ? `${normalized} ${unit}` : normalized;
}

function formatDelta(deltaValue: number | null, deltaRatio: number | null) {
  if (deltaValue == null) {
    return "样本不足";
  }
  const prefix = deltaValue > 0 ? "+" : "";
  const delta = `${prefix}${Number.isInteger(deltaValue) ? deltaValue.toLocaleString() : deltaValue.toFixed(2)}`;
  if (deltaRatio == null) {
    return delta;
  }
  return `${delta} (${prefix}${deltaRatio.toFixed(2)}%)`;
}

function deltaTone(deltaValue: number | null) {
  if (deltaValue == null) {
    return "chip-neutral";
  }
  if (deltaValue > 0) {
    return "chip-danger";
  }
  if (deltaValue < 0) {
    return "chip-accent";
  }
  return "chip-neutral";
}
