import type { ChainNode, DataPoint } from "@/types/chain";

export function MetricsTab({ node }: { node: ChainNode }) {
  if (node.node_kind === "shadow") {
    return <EmptyHint text="影子节点没有正式指标口径，需先完成环节映射后再承接指标体系。" />;
  }

  if (node.data_points.length === 0) {
    return <EmptyHint text="暂无定义数据指标。" />;
  }

  return (
    <div className="space-y-3">
      {node.data_points.map((point, index) => (
        <article
          key={`${point.name}-${index}`}
          className="panel-soft p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-medium text-slate-900">{point.name}</h4>
              <p className="mt-1 text-xs text-slate-500">{point.type}</p>
            </div>
            <MetricValue point={point} />
          </div>
          <div className="mt-3 text-xs text-slate-600">
            <span>{point.unit || "单位未定义"}</span>
            {point.source_name ? <span className="ml-3">{point.source_name}</span> : null}
            {point.last_updated ? <span className="ml-3">{point.last_updated}</span> : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <Badge text={point.source_tier_label || "待校验"} tone={tierTone(point.source_tier)} />
            <Badge
              text={`可信度 ${point.source_confidence_label || "待定"}${point.source_confidence ? ` · ${point.source_confidence}/5` : ""}`}
              tone={confidenceTone(point.source_confidence)}
            />
            {point.estimated ? <Badge text="含估算" tone="warn" /> : null}
          </div>
          {point.source_url ? (
            <a
              href={point.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs text-teal-600 hover:text-teal-700"
            >
              查看来源
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function MetricValue({ point }: { point: DataPoint }) {
  const raw = point.current_value;

  if (raw === null || raw === undefined || raw === "") {
    return <span className="text-sm text-slate-500">—</span>;
  }

  const isPercent = point.type === "ratio" || point.type === "price_change";
  const numeric = typeof raw === "number" ? raw : Number(raw);
  const text = isPercent ? `${raw}%` : String(raw);
  const tone = !Number.isNaN(numeric) && isPercent ? (numeric >= 0 ? "text-rose-600" : "text-teal-600") : "text-slate-900";

  return <span className={["text-sm font-semibold", tone].join(" ")}>{text}</span>;
}

function EmptyHint({ text }: { text: string }) {
  return <p className="surface-muted p-4 text-sm text-slate-500">{text}</p>;
}

function Badge({ text, tone }: { text: string; tone: "good" | "info" | "warn" | "muted" }) {
  const styles = {
    good: "border-teal-200 bg-teal-50 text-teal-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
    warn: "border-amber-200 bg-amber-50 text-amber-700",
    muted: "border-slate-200 bg-white/82 text-slate-600",
  };
  return <span className={["rounded-full border px-2.5 py-1", styles[tone]].join(" ")}>{text}</span>;
}

function tierTone(tier?: string) {
  if (tier === "official") {
    return "good";
  }
  if (tier === "authoritative") {
    return "info";
  }
  if (tier === "secondary") {
    return "warn";
  }
  return "muted";
}

function confidenceTone(confidence?: number) {
  if ((confidence ?? 0) >= 4) {
    return "good";
  }
  if ((confidence ?? 0) === 3) {
    return "info";
  }
  if ((confidence ?? 0) > 0) {
    return "warn";
  }
  return "muted";
}
