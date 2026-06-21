export function Legend() {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-5 rounded-full border border-slate-200/90 bg-white/92 px-5 py-2 text-xs text-slate-600 shadow-[0_12px_28px_rgba(148,163,184,0.16)] backdrop-blur-xl">
      <span className="flex items-center gap-2">
        <span className="h-[2px] w-5 rounded bg-teal-400" />
        主要供应
      </span>
      <span className="flex items-center gap-2">
        <span className="h-[2px] w-5 rounded bg-blue-300" />
        次要供应
      </span>
      <span className="flex items-center gap-2">
        <span className="h-[2px] w-5 rounded border-t-2 border-dashed border-orange-400" />
        独家供应
      </span>
      <span className="flex items-center gap-2">
        <span className="h-[2px] w-5 rounded border-t-2 border-dashed border-fuchsia-400" />
        候选关系
      </span>
      <span className="flex items-center gap-2">
        <span className="h-3 w-5 rounded border border-dashed border-fuchsia-400 bg-fuchsia-50" />
        影子节点
      </span>
    </div>
  );
}
