import { cn } from "@/lib/utils";

interface StatePanelProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
  tone?: "default" | "warn";
}

export function StatePanel({
  title,
  description,
  actionLabel,
  onAction,
  className,
  compact = false,
  tone = "default",
}: StatePanelProps) {
  return (
    <div
      className={cn(
        "panel-elevated text-slate-700",
        compact ? "p-5" : "p-8",
        tone === "warn" ? "border-amber-200" : "border-slate-200",
        className
      )}
    >
      <div className={cn("mx-auto max-w-2xl", compact ? "space-y-2" : "space-y-3")}>
        <h2 className={cn("font-semibold text-slate-900", compact ? "text-lg" : "text-2xl")}>{title}</h2>
        <p className={cn("leading-7 text-slate-600", compact ? "text-sm" : "text-base")}>{description}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="btn-primary"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
