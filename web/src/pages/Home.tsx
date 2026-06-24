import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  Network,
  Radar,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { StatePanel } from "@/components/StatePanel";
import { clearChainPayloadCaches, warmChainPayloads } from "@/data";
import { TrendSparkline } from "@/components/TrendSparkline";
import { clearResearchCaches, getCachedResearchBundle, loadResearchBundle, refreshResearchBundleInBackground, type ResearchBundle } from "@/data/research";
import { loadBackendHealth, loadJobStatus, triggerFullRefresh, triggerHeatRefresh } from "@/data/system";
import type { BackendHealth, BackendJobState } from "@/types/backend";
import type { ResearchOverviewChainCard, ResearchRiskItem, ResearchTrendChain } from "@/types/research";

type BackendConnectionState = "checking" | "online" | "reconnecting" | "offline";

export default function Home() {
  const [researchData, setResearchData] = useState<ResearchBundle | null>(() => getCachedResearchBundle());
  const [error, setError] = useState<string | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);
  const [jobState, setJobState] = useState<BackendJobState | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [backendConnectionState, setBackendConnectionState] = useState<BackendConnectionState>("checking");
  const [jobActionMessage, setJobActionMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"heat" | "full" | null>(null);
  const lastAppliedRefreshRef = useRef<string | null>(null);

  const reloadResearchData = async (force = false) => {
    const payload = await loadResearchBundle({ force });
    setResearchData(payload);
    setError(null);
  };

  useEffect(() => {
    let cancelled = false;

    loadResearchBundle()
      .then((payload) => {
        if (!cancelled) {
          setResearchData(payload);
          setError(null);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "研究总览数据加载失败");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      warmChainPayloads(["fusion", "silicon_materials", "pcb_materials"]);
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!jobState?.running) {
      setPendingAction(null);
    }
  }, [jobState?.running]);

  useEffect(() => {
    if (backendConnectionState !== "online") {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void refreshResearchBundleInBackground().then((payload) => {
        if (!cancelled && payload) {
          setResearchData(payload);
          setError(null);
        }
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [backendConnectionState]);

  useEffect(() => {
    const finishedAt = jobState?.last_finished_at;
    if (!finishedAt || jobState?.running || jobState?.last_status !== "success") {
      return;
    }
    if (lastAppliedRefreshRef.current === finishedAt) {
      return;
    }

    lastAppliedRefreshRef.current = finishedAt;
    clearResearchCaches();
    clearChainPayloadCaches();
    void reloadResearchData(true).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "研究总览数据刷新失败");
    });
  }, [jobState?.last_finished_at, jobState?.last_status, jobState?.running]);

  useEffect(() => {
    let cancelled = false;

    async function requestBackendState() {
      const [health, status] = await Promise.all([loadBackendHealth(), loadJobStatus()]);
      return { health, status };
    }

    async function syncBackendState(trigger: "initial" | "interval" | "focus") {
      setBackendConnectionState((current) => {
        if (trigger === "interval" && current === "online") {
          return current;
        }
        return current === "online" ? "reconnecting" : "checking";
      });
      setBackendError(null);

      try {
        const { health, status } = await requestBackendState();
        if (!cancelled) {
          setBackendHealth(health);
          setJobState(status);
          setBackendConnectionState("online");
          setBackendError(null);
        }
        return;
      } catch {
        if (!cancelled) {
          setBackendConnectionState("reconnecting");
        }
      }

      await delay(800);
      if (cancelled) {
        return;
      }

      try {
        const { health, status } = await requestBackendState();
        if (!cancelled) {
          setBackendHealth(health);
          setJobState(status);
          setBackendConnectionState("online");
          setBackendError(null);
        }
      } catch (reason) {
        if (!cancelled) {
          setBackendConnectionState("offline");
          setBackendError(reason instanceof Error ? reason.message : "后端服务不可用");
        }
      }
    }

    const handleFocusRefresh = () => {
      void syncBackendState("focus");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncBackendState("focus");
      }
    };

    void syncBackendState("initial");
    const timer = window.setInterval(() => {
      void syncBackendState("interval");
    }, 5000);
    window.addEventListener("focus", handleFocusRefresh);
    window.addEventListener("online", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocusRefresh);
      window.removeEventListener("online", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (error) {
    return (
      <StatePanel
        title="研究总览暂时不可用"
        description={`研究页的数据资源加载失败：${error}。可以刷新页面重试，或先进入图谱页继续浏览。`}
        className="min-h-[320px]"
        tone="warn"
      />
    );
  }

  if (!researchData) {
    return (
      <StatePanel
        title="研究总览加载中"
        description="正在按需读取研究总览、质量审计和趋势快照 JSON，用于渲染首页驾驶舱。"
        className="min-h-[320px]"
      />
    );
  }

  return (
    <HomeContent
      data={researchData}
      backendHealth={backendHealth}
      backendConnectionState={backendConnectionState}
      jobState={jobState}
      backendError={backendError}
      jobActionMessage={jobActionMessage}
      onFullRefresh={async () => {
        if (pendingAction) {
          return;
        }
        setPendingAction("full");
        try {
          const result = await triggerFullRefresh();
          setJobState(result.state);
          setJobActionMessage(result.message);
        } catch (reason) {
          setPendingAction(null);
          setJobActionMessage(reason instanceof Error ? reason.message : "更新研究数据失败");
        }
      }}
      onHeatRefresh={async () => {
        if (pendingAction) {
          return;
        }
        setPendingAction("heat");
        try {
          const result = await triggerHeatRefresh();
          setJobState(result.state);
          setJobActionMessage(result.message);
        } catch (reason) {
          setPendingAction(null);
          setJobActionMessage(reason instanceof Error ? reason.message : "刷新热度缓存失败");
        }
      }}
      pendingAction={pendingAction}
    />
  );
}

function HomeContent({
  data,
  backendHealth,
  backendConnectionState,
  jobState,
  backendError,
  jobActionMessage,
  onFullRefresh,
  onHeatRefresh,
  pendingAction,
}: {
  data: ResearchBundle;
  backendHealth: BackendHealth | null;
  backendConnectionState: BackendConnectionState;
  jobState: BackendJobState | null;
  backendError: string | null;
  jobActionMessage: string | null;
  onFullRefresh: () => Promise<void>;
  onHeatRefresh: () => Promise<void>;
  pendingAction: "heat" | "full" | null;
}) {
  const { researchAuditPayload, researchOverviewPayload, researchTrendsPayload } = data;
  const summaryCards = [
    { label: "主链环节", value: researchOverviewPayload.summary.total_node_count, icon: Radar },
    { label: "主链关系", value: researchOverviewPayload.summary.total_edge_count, icon: Network },
    { label: "覆盖公司", value: researchOverviewPayload.summary.total_stock_count, icon: Database },
    { label: "趋势快照", value: researchOverviewPayload.summary.total_snapshot_count, icon: Activity },
    { label: "平均质量分", value: researchOverviewPayload.summary.average_quality_score, icon: ShieldCheck },
  ];

  const controlsLocked = backendConnectionState !== "online" || Boolean(jobState?.running) || pendingAction !== null;
  const connectionBadge = getConnectionBadge(backendConnectionState, backendHealth);
  const backendStatusMessage =
    backendError ||
    connectionBadge.description ||
    jobState?.last_message ||
    "后端已接管定时刷新与手动更新入口。";

  return (
    <div className="space-y-6">
      <section className="panel-elevated p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-4xl space-y-4">
            <p className="text-xs uppercase tracking-[0.36em] text-teal-700/70">
              Research Overview
            </p>
            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-900 lg:text-4xl">
                半导体研究总览深挖
              </h2>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                首页聚合主链覆盖范围、数据质量审计与高风险条目，作为进入各子链与融合图谱前的研究驾驶舱。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              {researchOverviewPayload.highlights.map((item) => (
                <span key={item} className="chip-neutral px-3 py-1.5">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <Link
            to={researchOverviewPayload.fusion.route}
            className="btn-primary px-5"
          >
            打开融合图谱
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map(({ label, value, icon: Icon }) => (
            <article key={label} className="panel-soft p-5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{label}</span>
                <Icon className="h-4 w-4 text-teal-600" />
              </div>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{formatNumber(value)}</p>
            </article>
          ))}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div className="panel-soft p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Server className="h-4 w-4 text-teal-600" />
              数据服务状态
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className={connectionBadge.className}>{connectionBadge.label}</span>
              {jobState ? (
                <span className={jobState.last_status === "failed" ? warnBadgeClass() : okBadgeClass()}>
                  最近任务 {jobState.last_status}
                </span>
              ) : null}
              {jobState?.running ? <span className={okBadgeClass()}>任务运行中</span> : null}
            </div>
            <div className="mt-3 min-h-[72px] space-y-1 text-sm text-slate-600">
              <p>{backendStatusMessage}</p>
              {jobState?.last_finished_at ? (
                <p className="text-xs text-slate-500">
                  上次完成 {jobState.last_finished_at} · 耗时 {jobState.last_duration_seconds ?? "—"}s
                </p>
              ) : null}
              {jobActionMessage ? <p className="text-xs text-teal-600">{jobActionMessage}</p> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 xl:justify-end xl:self-start">
            <ActionButton
              label="刷新热度缓存"
              onClick={onHeatRefresh}
              disabled={controlsLocked}
            />
            <ActionButton
              label="更新研究数据"
              onClick={onFullRefresh}
              disabled={controlsLocked}
            />
          </div>
        </div>
      </section>

      <section className="panel-elevated p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">产能趋势监控</h3>
            <p className="mt-1 text-sm text-slate-500">
              聚合 `capacity_snapshots` 后的前端趋势 JSON，当前覆盖 {researchTrendsPayload.summary.chains_with_snapshots}/
              {researchTrendsPayload.summary.chain_count} 条子链。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="chip-neutral">
              总快照 {formatNumber(researchTrendsPayload.summary.total_snapshot_count)}
            </span>
            <span className="chip-neutral">
              已跟踪序列 {formatNumber(researchTrendsPayload.summary.tracked_series_count)}
            </span>
            <span className="chip-neutral">
              最新快照 {researchTrendsPayload.summary.latest_snapshot_date || "—"}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {researchTrendsPayload.chains.map((chain) => (
            <TrendChainCard key={chain.slug} chain={chain} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.85fr)]">
        <article className="panel-elevated p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">子链研究面板</h3>
              <p className="mt-1 text-sm text-slate-500">按质量评分、可追溯性与覆盖范围筛选优先深挖对象。</p>
            </div>
            <span className="chip-neutral">
              generated {researchOverviewPayload.generated_at}
            </span>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {researchOverviewPayload.chains.map((chain) => (
              <ChainCard key={chain.slug} chain={chain} />
            ))}
          </div>
        </article>

        <article className="panel-elevated p-6">
          <h3 className="text-xl font-semibold text-slate-900">质量审计摘要</h3>
          <div className="mt-5 grid gap-3">
            <AuditCard
              label="缺失来源名称"
              value={researchAuditPayload.summary.missing_source_name_count}
              tone="warn"
            />
            <AuditCard
              label="缺失来源链接"
              value={researchAuditPayload.summary.missing_source_url_count}
              tone="warn"
            />
            <AuditCard
              label="缺失买方映射"
              value={researchAuditPayload.summary.missing_buyer_count}
              tone="warn"
            />
            <AuditCard
              label="孤立关系"
              value={researchOverviewPayload.summary.orphan_relationship_count}
              tone="info"
            />
            <AuditCard
              label="估算类数据点"
              value={researchAuditPayload.summary.estimated_data_point_count}
              tone="info"
            />
          </div>

          <div className="panel-soft mt-6 p-4">
            <p className="text-sm font-medium text-slate-900">当前焦点</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <p>最高质量子链：{researchOverviewPayload.focus.highest_quality_chain || "—"}</p>
              <p>最缺外链来源子链：{researchOverviewPayload.focus.most_missing_source_chain || "—"}</p>
              <p>估算占比最高子链：{researchOverviewPayload.focus.most_estimated_chain || "—"}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <RiskPanel
          title="低可信度数据点"
          items={researchAuditPayload.global_top_risks.filter((item) => item.kind === "data_point").slice(0, 6)}
        />
        <RiskPanel
          title="低可信度关系"
          items={researchAuditPayload.global_top_risks.filter((item) => item.kind === "relationship").slice(0, 6)}
        />
      </section>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => Promise<void>;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
      disabled={disabled}
      className="btn-secondary disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50/85 disabled:text-slate-500"
    >
      <RefreshCw className="h-4 w-4" />
      {label}
    </button>
  );
}

function okBadgeClass() {
  return "chip-accent";
}

function warnBadgeClass() {
  return "chip-warn";
}

function infoBadgeClass() {
  return "chip-info";
}

function getConnectionBadge(state: BackendConnectionState, health: BackendHealth | null) {
  if (state === "online" && health) {
    return {
      label: `后端在线 :${health.port}`,
      description: "后端已接管定时刷新与手动更新入口。",
      className: okBadgeClass(),
    };
  }

  if (state === "reconnecting") {
    return {
      label: "后端重连中",
      description: "刚刚有一次状态同步失败，正在自动重试。",
      className: infoBadgeClass(),
    };
  }

  if (state === "checking") {
    return {
      label: "检查后端中",
      description: "正在确认健康检查与任务状态接口。",
      className: infoBadgeClass(),
    };
  }

  return {
    label: "后端未连接",
    description: "暂时无法连接本地后端，页面会继续自动重试。",
    className: warnBadgeClass(),
  };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function ChainCard({ chain }: { chain: ResearchOverviewChainCard }) {
  return (
    <article className="panel-soft rounded-[24px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h4 className="text-lg font-medium text-slate-900">{chain.title}</h4>
          <p className="text-sm leading-6 text-slate-600">{chain.description}</p>
        </div>
        <span className={badgeTone(chain.quality_score)}>{chain.quality_score} 分</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="环节" value={chain.stats.node_count} />
        <MiniStat label="关系" value={chain.relationship_count} />
        <MiniStat label="数据点" value={chain.data_point_count} />
        <MiniStat label="缺失链接" value={chain.missing_source_url_count} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="快照" value={chain.snapshot_count} />
        <MiniStat label="孤立关系" value={chain.orphan_relationship_count} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs">
        <TierBadge label="官方" value={chain.tier_distribution.official ?? 0} />
        <TierBadge label="权威" value={chain.tier_distribution.authoritative ?? 0} />
        <TierBadge label="二手" value={chain.tier_distribution.secondary ?? 0} />
        <TierBadge label="待校验" value={chain.tier_distribution.unknown ?? 0} />
      </div>

      <p className="mt-4 text-xs text-slate-500">
        最新快照 {chain.latest_snapshot_date || "—"} · 跟踪 {chain.tracked_segment_count} 个环节 / {chain.tracked_metric_count} 个指标
      </p>

      <div className="mt-5 space-y-2">
        {chain.top_segments.map((segment) => (
          <div key={segment.id} className="surface-subtle flex items-center justify-between px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{segment.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {segment.company_count} 家公司 · {segment.data_point_count} 个数据点
              </p>
            </div>
            <span className={segment.heat_d20 >= 0 ? "text-xs text-rose-600" : "text-xs text-teal-600"}>
              {segment.heat_d20.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>

      <Link
        to={chain.route}
        className="mt-5 inline-flex items-center gap-2 text-sm text-teal-600 transition hover:text-teal-700"
      >
        进入子链
        <ArrowRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function TrendChainCard({ chain }: { chain: ResearchTrendChain }) {
  const primarySeries = chain.top_series[0];

  return (
    <article className="panel-soft rounded-[24px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="text-lg font-medium text-slate-900">{chain.title}</h4>
          <p className="mt-1 text-sm text-slate-500">
            最新快照 {chain.latest_snapshot_date || "—"} · {chain.snapshot_count} 个样本 · {chain.orphan_relationship_count} 条孤立关系
          </p>
        </div>
        <span className="chip-neutral">
          {chain.tracked_metric_count} 指标
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3">
          {chain.top_series.length > 0 ? (
            chain.top_series.slice(0, 3).map((series) => (
              <div key={series.key} className="surface-subtle px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium text-slate-900">
                    {series.segment_name} · {series.metric_name}
                  </p>
                  <span className={deltaTone(series.delta_value ?? null)}>
                    {formatTrendDelta(series.delta_value, series.delta_ratio)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  最新值 {formatMetricValue(series.latest_value, series.unit)} · 样本 {series.sample_count}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white/68 px-4 py-6 text-sm text-slate-500">
              当前还没有可展示的趋势样本。
            </div>
          )}
        </div>

        <div>
          <TrendSparkline points={primarySeries?.points ?? []} />
          <p className="mt-2 text-xs text-slate-500">
            {primarySeries
              ? `主序列：${primarySeries.segment_name} · ${primarySeries.metric_name}`
              : "待积累更多快照后观察趋势斜率"}
          </p>
        </div>
      </div>
    </article>
  );
}

function RiskPanel({ title, items }: { title: string; items: ResearchRiskItem[] }) {
  return (
    <article className="panel-elevated p-6">
      <div className="flex items-center gap-3">
        <span className="rounded-2xl border border-amber-200 bg-amber-50 p-2 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">优先补来源链接、明确定义口径或降低估算依赖。</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item, index) => (
          <div key={`${item.kind}-${item.chain_slug}-${index}`} className="panel-soft p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-slate-900">
                {item.kind === "data_point"
                  ? `${item.segment_name} · ${item.name}`
                  : `${item.from_name} → ${item.to_name}`}
              </span>
              <span className={confidenceTone(item.source_confidence)}>{item.source_confidence_label}</span>
            </div>
            <p className="mt-2 text-xs leading-6 text-slate-600">
              {item.kind === "data_point" ? item.source_name || "缺失来源名称" : item.product || "未命名关系"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-500">
              <span className="chip-neutral px-2.5 py-1">
                {item.chain_slug}
              </span>
              <span className="chip-neutral px-2.5 py-1">
                {item.source_tier_label}
              </span>
              {item.estimated ? (
                <span className="chip-warn px-2.5 py-1">
                  含估算
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function AuditCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warn" | "info";
}) {
  return (
    <div
      className={[
        "rounded-2xl border px-4 py-3",
        tone === "warn" ? "border-amber-200 bg-amber-50/72" : "border-sky-200 bg-sky-50/72",
      ].join(" ")}
    >
      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(value)}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-subtle px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{formatNumber(value)}</p>
    </div>
  );
}

function TierBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="chip-neutral px-3 py-1.5">
      {label} {formatNumber(value)}
    </span>
  );
}

function formatNumber(value: number) {
  return Number(value).toLocaleString();
}

function formatMetricValue(value: number, unit?: string | null) {
  const normalized = Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
  return unit ? `${normalized} ${unit}` : normalized;
}

function formatTrendDelta(deltaValue?: number | null, deltaRatio?: number | null) {
  if (deltaValue == null) {
    return "样本不足";
  }
  const prefix = deltaValue > 0 ? "+" : "";
  const value = `${prefix}${Number.isInteger(deltaValue) ? deltaValue.toLocaleString() : deltaValue.toFixed(2)}`;
  if (deltaRatio == null) {
    return value;
  }
  return `${value} (${prefix}${deltaRatio.toFixed(2)}%)`;
}

function badgeTone(score: number) {
  if (score >= 75) {
    return "chip-accent";
  }
  if (score >= 60) {
    return "chip-info";
  }
  return "chip-warn";
}

function deltaTone(deltaValue?: number | null) {
  if (deltaValue == null) {
    return "chip-neutral";
  }
  if (deltaValue > 0) {
    return "chip-danger";
  }
  if (deltaValue < 0) {
    return "chip-accent";
  }
  return "chip-neutral";
}

function confidenceTone(confidence: number) {
  if (confidence >= 4) {
    return "chip-accent";
  }
  if (confidence === 3) {
    return "chip-info";
  }
  return "chip-warn";
}
