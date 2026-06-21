import type { TrendPoint } from "@/types/research";

interface TrendSparklineProps {
  points: TrendPoint[];
  className?: string;
  strokeClassName?: string;
}

export function TrendSparkline({
  points,
  className = "h-16 w-full",
  strokeClassName = "stroke-teal-500",
}: TrendSparklineProps) {
  const viewWidth = 220;
  const viewHeight = 64;

  if (points.length === 0) {
    return (
      <div className={["flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/76", className].join(" ")}>
        <span className="text-xs text-slate-500">暂无趋势样本</span>
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? viewWidth / 2 : (index / (points.length - 1)) * viewWidth;
    const y = viewHeight - ((point.value - min) / range) * (viewHeight - 10) - 5;
    return { x, y, value: point.value };
  });
  const path = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const latest = coordinates[coordinates.length - 1];

  return (
    <div className={["rounded-2xl border border-slate-200 bg-white/74 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]", className].join(" ")}>
      <svg viewBox={`0 0 ${viewWidth} ${viewHeight}`} className="h-full w-full">
        <path d={path} fill="none" strokeWidth="2.5" className={strokeClassName} />
        {coordinates.length === 1 ? (
          <circle cx={latest.x} cy={latest.y} r="4" className="fill-teal-500" />
        ) : null}
        <circle cx={latest.x} cy={latest.y} r="4" className="fill-teal-500 stroke-white" strokeWidth="2" />
      </svg>
    </div>
  );
}
