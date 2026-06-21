import { Search, X } from "lucide-react";
import type { ChainPayload, GroupOption } from "@/types/chain";

interface TopBarProps {
  payload: ChainPayload;
  groupOptions: GroupOption[];
  selectedGroups: string[];
  searchQuery: string;
  statusText: string;
  onToggleGroup: (group: string) => void;
  onClearGroups: () => void;
  onSearchChange: (value: string) => void;
}

export function TopBar({
  payload,
  groupOptions,
  selectedGroups,
  searchQuery,
  statusText,
  onToggleGroup,
  onClearGroups,
  onSearchChange,
}: TopBarProps) {
  return (
    <section className="panel-elevated p-4 md:p-5 xl:p-6">
      <div className="flex flex-col gap-4 xl:gap-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="chip-accent uppercase tracking-[0.3em]">
                {payload.kind === "fusion" ? "Fusion" : "Chain"}
              </span>
              <span className="text-xs text-slate-500">generated {payload.generated_at}</span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 md:text-[2rem]">{payload.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                {payload.flow_description
                  ? payload.flow_description.replace(/<[^>]+>/g, "")
                  : "基于 YAML 数据与离线布局结果构建的可交互产业链图谱。"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
            <StatCard label="环节" value={payload.stats.node_count} />
            <StatCard label="关系" value={payload.stats.edge_count} />
            <StatCard label="公司" value={payload.stats.stock_count} />
            <StatCard label="分组" value={payload.stats.group_count} />
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onClearGroups}
                className={[
                  "rounded-full border px-3.5 py-1.5 text-xs transition",
                  selectedGroups.length === 0
                    ? "border-teal-600 bg-teal-600 text-white shadow-[0_8px_18px_rgba(13,148,136,0.24)]"
                    : "border-slate-200 bg-white/82 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900",
                ].join(" ")}
              >
                全部
              </button>
              {groupOptions.map((option) => {
                const active = selectedGroups.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => onToggleGroup(option.key)}
                    className={[
                      "rounded-full border px-3.5 py-1.5 text-xs transition",
                      active
                        ? "border-teal-600 bg-teal-600 text-white shadow-[0_8px_18px_rgba(13,148,136,0.24)]"
                        : "border-slate-200 bg-white/82 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900",
                    ].join(" ")}
                    style={active && option.color ? { borderColor: option.color, backgroundColor: option.color, color: "#ffffff" } : undefined}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <label className="input-surface xl:min-w-[280px] 2xl:min-w-[320px]">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="搜索环节、公司、股票代码"
                className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
              />
              {searchQuery ? (
                <button type="button" onClick={() => onSearchChange("")} className="text-slate-500 hover:text-slate-900">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </label>
          </div>
          <p className="text-xs text-slate-500">{statusText}</p>
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel-soft px-4 py-2.5">
      <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-slate-900 md:text-2xl">{value}</p>
    </div>
  );
}
