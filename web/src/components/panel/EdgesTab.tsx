import type { ChainEdge, ChainNode, OrphanRelationship } from "@/types/chain";

interface EdgesTabProps {
  node: ChainNode;
  edges: ChainEdge[];
  orphanRelationships: OrphanRelationship[];
  nodeMap: Map<string, ChainNode>;
}

export function EdgesTab({ node, edges, orphanRelationships, nodeMap }: EdgesTabProps) {
  const relatedEdges = edges.filter((edge) => edge.from === node.id || edge.to === node.id);
  const companyCodes = new Set(
    node.node_kind === "shadow"
      ? [node.shadow_company_code].filter((code): code is string => Boolean(code))
      : node.companies.map((company) => company.code)
  );
  const relatedOrphans = orphanRelationships.filter(
    (edge) => companyCodes.has(edge.supplier_code) || companyCodes.has(edge.buyer_code)
  );

  if (relatedEdges.length === 0 && relatedOrphans.length === 0) {
    return <EmptyHint text="暂无该环节的供应关系数据。" />;
  }

  return (
    <div className="space-y-3">
      {relatedEdges.map((edge, index) => {
        const source = nodeMap.get(edge.from);
        const target = nodeMap.get(edge.to);
        const direction = edge.from === node.id ? "下游" : "上游";
        const isCandidate = edge.relationship_status === "candidate";
        return (
          <article
            key={`${edge.from}-${edge.to}-${index}`}
            className={[
              "rounded-2xl p-4 shadow-[0_10px_26px_rgba(148,163,184,0.10)]",
              isCandidate
                ? "border border-fuchsia-200 bg-fuchsia-50/75"
                : "border border-slate-200 bg-white/78",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={[
                  "rounded-full px-2.5 py-1 text-[11px]",
                  isCandidate
                    ? "border border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700"
                    : edge.from === node.id
                      ? "border border-amber-200 bg-amber-50 text-amber-700"
                      : "border border-sky-200 bg-sky-50 text-sky-700",
                ].join(" ")}
              >
                {isCandidate ? "候选关系" : direction}
              </span>
              <span className="text-xs text-slate-500">
                {edge.rel_type}
                {isCandidate && edge.candidate_count && edge.candidate_count > 1
                  ? ` · 聚合 ${edge.candidate_count} 条`
                  : ""}
              </span>
            </div>
            <h4 className="mt-3 text-sm font-medium text-slate-900">{edge.product || "未命名关系"}</h4>
            <p className="mt-2 text-xs leading-6 text-slate-600">
              {source?.name ?? edge.from} → {target?.name ?? edge.to}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <Badge text={`可信度 ${edge.source_confidence_label || "待定"}${edge.source_confidence ? ` · ${edge.source_confidence}/5` : ""}`} tone={confidenceTone(edge.source_confidence)} />
              <Badge text={edge.source_tier_label || "待校验"} tone={tierTone(edge.source_tier)} />
              {edge.estimated ? <Badge text="含估算" tone="warn" /> : null}
            </div>
            {isCandidate ? (
              <p className="mt-2 text-xs leading-6 text-slate-500">
                候选关系表示该线索尚未完全沉淀为正式主链关系，当前先以虚线或影子节点形式保留研究上下文。
              </p>
            ) : null}
            {edge.notes ? <p className="mt-2 text-xs leading-6 text-slate-500">{edge.notes}</p> : null}
            {edge.source_url ? (
              <a
                href={edge.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-xs text-teal-600 hover:text-teal-700"
              >
                查看关系来源
              </a>
            ) : null}
          </article>
        );
      })}

      {relatedOrphans.length > 0 ? (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-medium text-slate-900">候选关系原始线索</h4>
            <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
              {relatedOrphans.length} 条
            </span>
          </div>

          {relatedOrphans.map((edge, index) => (
            <article
              key={`orphan-${edge.supplier_code}-${edge.buyer_code}-${index}`}
              className="rounded-2xl border border-dashed border-slate-300 bg-white/74 p-4 shadow-[0_10px_24px_rgba(148,163,184,0.10)]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2.5 py-1 text-[11px] text-fuchsia-700">
                  未入图
                </span>
                <span className="text-xs text-slate-500">{edge.rel_type}</span>
              </div>
              <h4 className="mt-3 text-sm font-medium text-slate-900">{edge.product || "未命名关系"}</h4>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                {edge.supplier_name || edge.supplier_code} → {edge.buyer_name || edge.buyer_code || "待映射买方"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <Badge
                  text={`可信度 ${edge.source_confidence_label || "待定"}${edge.source_confidence ? ` · ${edge.source_confidence}/5` : ""}`}
                  tone={confidenceTone(edge.source_confidence)}
                />
                <Badge text={edge.source_tier_label || "待校验"} tone={tierTone(edge.source_tier)} />
                {edge.estimated ? <Badge text="含估算" tone="warn" /> : null}
              </div>
              {edge.notes ? <p className="mt-2 text-xs leading-6 text-slate-500">{edge.notes}</p> : null}
              {edge.source_url ? (
                <a
                  href={edge.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs text-teal-600 hover:text-teal-700"
                >
                  查看关系来源
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
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
