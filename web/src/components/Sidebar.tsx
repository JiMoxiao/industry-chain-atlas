import { NavLink } from "react-router-dom";
import { Database, GitBranch, Home, Network, Orbit, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { loadChainPayload } from "@/data";
import { cn } from "@/lib/utils";
import { chainMetas } from "@/utils/chainMeta";

const iconMap = {
  home: Home,
  fusion: Network,
  semiconductor: Orbit,
  electronic_chemicals: Database,
  nonferrous_metals: GitBranch,
  silicon_materials: Database,
  pcb_materials: Database,
};

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps) {
  const prefetchChain = (slug: string) => {
    if (slug === "home") {
      return;
    }

    void loadChainPayload(slug);
  };

  return (
    <aside
      className={cn(
        "panel-elevated relative z-10 flex w-full flex-col gap-5 rounded-[28px] p-5 xl:sticky xl:top-6 xl:self-start xl:rounded-[32px]",
        collapsed ? "xl:gap-4 xl:p-4" : "xl:gap-6 xl:p-6"
      )}
    >
      <div className={cn("flex items-start justify-between gap-3", collapsed && "xl:flex-col xl:items-center")}>
        <div className={cn("space-y-2", collapsed && "xl:space-y-1 xl:text-center")}>
          <p className="text-xs uppercase tracking-[0.36em] text-teal-700/70">
          Semiconductor
          </p>
          <h1 className={cn("text-2xl font-semibold text-slate-900", collapsed && "xl:text-base")}>
            <span className={cn(collapsed && "xl:hidden")}>研究图谱工作台</span>
            <span className={cn("hidden", collapsed && "xl:inline")}>工作台</span>
          </h1>
          <p
            className={cn(
              "text-sm leading-6 text-slate-600",
              collapsed && "xl:text-xs xl:leading-5"
            )}
          >
            <span className={cn(collapsed && "xl:hidden")}>先看研究总览与质量审计，再下钻子链图谱与融合关系。</span>
            <span className={cn("hidden", collapsed && "xl:inline")}>展开后查看完整导航</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="hidden xl:inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/84 text-slate-600 transition hover:border-slate-300 hover:bg-white hover:text-slate-900"
          aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="space-y-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "rounded-[22px] border transition",
              collapsed ? "xl:flex xl:justify-center xl:px-0 xl:py-3" : "flex items-center gap-3 px-4 py-3",
              isActive
                ? "border-teal-200 bg-white text-slate-950 shadow-[0_12px_28px_rgba(148,163,184,0.16)]"
                : "border-transparent bg-white/36 text-slate-700 hover:border-slate-200 hover:bg-white/80 hover:text-slate-900"
            )
          }
          title="研究总览"
          aria-label="研究总览"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Home className="h-4 w-4" />
          </span>
          <span className={cn("min-w-0", collapsed && "xl:hidden")}>
            <span className="block text-sm font-medium">研究总览</span>
            <span className="block truncate text-xs text-slate-500">
              汇总覆盖范围、质量审计与高风险条目。
            </span>
          </span>
        </NavLink>

        {chainMetas.map((item) => {
          const Icon = iconMap[item.slug as keyof typeof iconMap] ?? Database;
          const to = item.slug === "fusion" ? "/fusion" : `/chain/${item.slug}`;
          return (
            <NavLink
              key={item.slug}
              to={to}
              onMouseEnter={() => {
                prefetchChain(item.slug);
              }}
              onFocus={() => {
                prefetchChain(item.slug);
              }}
              className={({ isActive }) =>
                cn(
                  "rounded-[22px] border transition",
                  collapsed ? "xl:flex xl:justify-center xl:px-0 xl:py-3" : "flex items-center gap-3 px-4 py-3",
                  isActive
                    ? "border-teal-200 bg-white text-slate-950 shadow-[0_12px_28px_rgba(148,163,184,0.16)]"
                    : "border-transparent bg-white/36 text-slate-700 hover:border-slate-200 hover:bg-white/80 hover:text-slate-900"
                )
              }
              title={item.label}
              aria-label={item.label}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Icon className="h-4 w-4" />
              </span>
              <span className={cn("min-w-0", collapsed && "xl:hidden")}>
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block truncate text-xs text-slate-500">
                  {item.description}
                </span>
              </span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
