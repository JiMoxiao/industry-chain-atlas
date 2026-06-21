import type { ChainNode } from "@/types/chain";
import { formatSignedPercent } from "@/utils/heatColor";

interface TooltipProps {
  node: ChainNode | null;
  x: number;
  y: number;
  visible: boolean;
  containerWidth: number;
  containerHeight: number;
}

export function Tooltip({ node, x, y, visible, containerWidth, containerHeight }: TooltipProps) {
  if (!node) {
    return null;
  }

  const isShadowNode = node.node_kind === "shadow";
  const tooltipWidth = 320;
  const tooltipHeight = isShadowNode ? 176 : 260;
  const gap = 18;
  const shouldFlipX = x > containerWidth - tooltipWidth - 56;
  const shouldFlipY = y > containerHeight - tooltipHeight - 56;
  const left = Math.max(
    16,
    Math.min(
      shouldFlipX ? x - tooltipWidth - gap : x + gap,
      containerWidth - tooltipWidth - 16
    )
  );
  const top = Math.max(
    16,
    Math.min(
      shouldFlipY ? y - tooltipHeight - gap : y + gap,
      containerHeight - tooltipHeight - 16
    )
  );
  const arrowLeft = Math.max(26, Math.min(x - left, tooltipWidth - 26));
  const arrowTop = Math.max(22, Math.min(y - top, tooltipHeight - 22));
  const arrowMode = shouldFlipX ? "right" : shouldFlipY ? "bottom" : "left";
  const arrowClassName =
    arrowMode === "right"
      ? "absolute -right-1.5 h-3.5 w-3.5 rotate-45 border border-slate-200 border-t-0 border-l-0 bg-white/96 shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
      : arrowMode === "bottom"
        ? "absolute -bottom-1.5 h-3.5 w-3.5 rotate-45 border border-slate-200 border-t-0 border-l-0 bg-white/96 shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
        : "absolute -left-1.5 h-3.5 w-3.5 rotate-45 border border-slate-200 border-r-0 border-b-0 bg-white/96 shadow-[0_8px_18px_rgba(15,23,42,0.08)]";
  const arrowStyle =
    arrowMode === "right"
      ? { top: arrowTop }
      : arrowMode === "bottom"
        ? { left: arrowLeft }
        : { top: arrowTop };

  return (
    <div
      className={[
        "pointer-events-none absolute z-30 w-[320px] rounded-[24px] border border-slate-200 bg-white/96 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.16)] backdrop-blur-xl transition",
        visible ? "opacity-100" : "opacity-0",
      ].join(" ")}
      style={{ left, top }}
    >
      <span className={arrowClassName} style={arrowStyle} />
      <div className="mb-3">
        <p className="text-sm font-semibold text-slate-900">{node.name}</p>
        {isShadowNode ? (
          <p className="mt-1 text-xs text-slate-600">
            影子节点 · {node.shadow_role === "buyer" ? "候选买方" : "候选供方"} · {node.orphan_count ?? 1} 条线索
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-600">
            当日 {formatSignedPercent(node.heat_d)} · 5日 {formatSignedPercent(node.heat_d5)} · 20日{" "}
            {formatSignedPercent(node.heat_d20)}
          </p>
        )}
      </div>
      {isShadowNode ? (
        <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50/80 px-3 py-3 text-xs leading-6 text-slate-700">
          该节点来自 `orphan_relationships` 的占位展示，用于表达“已有公司级供应线索，但尚未沉淀为正式产业链环节/正式关系”。
        </div>
      ) : (
        <div className="space-y-2">
          {node.companies.slice(0, 8).map((company) => (
            <div
              key={company.code}
              className="surface-muted flex items-center justify-between px-3 py-2 text-xs"
            >
              <span className="truncate text-slate-800">
                <span className="mr-2 font-mono text-slate-500">{company.code}</span>
                {company.name}
              </span>
              <span className={company.d >= 0 ? "text-rose-600" : "text-teal-600"}>
                {formatSignedPercent(company.d)}
              </span>
            </div>
          ))}
          {node.companies.length > 8 ? (
            <p className="text-xs text-slate-500">还有 {node.companies.length - 8} 家上市公司</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
