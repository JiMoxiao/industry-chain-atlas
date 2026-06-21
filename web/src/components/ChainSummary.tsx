import { ArrowRight, Boxes, Building2, Link2, Sparkles } from "lucide-react";
import type { ChainPayload } from "@/types/chain";

interface ChainSummaryProps {
  payload: ChainPayload;
  description: string;
}

const statItems = [
  { key: "node_count", label: "环节", icon: Boxes },
  { key: "edge_count", label: "关系", icon: Link2 },
  { key: "stock_count", label: "公司", icon: Building2 },
  { key: "group_count", label: "分组", icon: Sparkles },
] as const;

export function ChainSummary({ payload, description }: ChainSummaryProps) {
  const topNodes = [...payload.nodes]
    .sort((a, b) => b.companies.length - a.companies.length)
    .slice(0, 6);

  return (
    <section className="space-y-6">
      <div className="panel-elevated p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs uppercase tracking-[0.36em] text-teal-600/60">
              Migration Preview
            </p>
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 lg:text-4xl">
                {payload.title}
              </h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-600">
                {description}
              </p>
            </div>
          </div>
          <div className="rounded-[24px] border border-teal-200 bg-[linear-gradient(135deg,rgba(240,253,250,0.96),rgba(255,255,255,0.92))] px-4 py-3 text-sm text-teal-700 shadow-[0_10px_24px_rgba(148,163,184,0.12)]">
            当前展示静态 JSON 驱动的第一版页面骨架，下一阶段接入 G6 画布与交互。
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statItems.map(({ key, label, icon: Icon }) => (
            <article
              key={key}
              className="panel-soft p-5"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  {label}
                </span>
                <Icon className="h-4 w-4 text-teal-600" />
              </div>
              <p className="text-3xl font-semibold text-slate-900">
                {payload.stats[key].toLocaleString()}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <article className="panel-elevated p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-slate-900">关键环节</h3>
              <p className="text-sm text-slate-500">按覆盖上市公司数量排序</p>
            </div>
            <span className="chip-neutral">
              generated {payload.generated_at}
            </span>
          </div>
          <div className="space-y-3">
            {topNodes.map((node) => (
              <div
                key={node.id}
                className="panel-soft flex items-center justify-between px-4 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{node.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {node.group} · layer {node.layer} · heat {node.heat_d20.toFixed(2)}%
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-teal-600">
                  <span>{node.companies.length} 家</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel-elevated p-6">
          <h3 className="text-lg font-medium text-slate-900">当前迁移状态</h3>
          <div className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <p>
              已完成 <code>YAML -&gt; JSON</code> 导出链路，单链与融合图谱数据均可直接被前端消费。
            </p>
            <p>已建立统一路由与导航壳层，后续页面将接入搜索、多选筛选、详情面板和 G6 画布。</p>
            <p>旧版 HTML 与 Python 生成链路保持不动，可继续作为稳定回退方案使用。</p>
          </div>
        </article>
      </div>
    </section>
  );
}
