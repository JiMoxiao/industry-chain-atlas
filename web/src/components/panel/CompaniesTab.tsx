import type { ChainNode } from "@/types/chain";
import { formatSignedPercent } from "@/utils/heatColor";

export function CompaniesTab({ node }: { node: ChainNode }) {
  if (node.node_kind === "shadow") {
    return <EmptyHint text="影子节点不对应正式环节公司池，仅用于承载候选关系线索。" />;
  }

  if (node.companies.length === 0) {
    return <EmptyHint text="暂无公司数据。" />;
  }

  return (
    <div className="space-y-3">
      {node.companies.map((company) => (
        <div
          key={company.code}
          className="panel-soft flex items-center justify-between px-4 py-4"
        >
          <div>
            <p className="font-medium text-slate-900">
              <span className="mr-2 font-mono text-xs text-slate-500">{company.code}</span>
              {company.name}
            </p>
            <p className="mt-1 text-xs text-slate-500">{company.role}</p>
          </div>
          <span className={company.d >= 0 ? "text-rose-600" : "text-teal-600"}>
            {formatSignedPercent(company.d)}
          </span>
        </div>
      ))}
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="surface-muted p-4 text-sm text-slate-500">{text}</p>;
}
