import type {
  ResearchAuditPayload,
  ResearchOverviewPayload,
  ResearchTrendsPayload,
} from "@/types/research";

export interface ResearchBundle {
  researchAuditPayload: ResearchAuditPayload;
  researchOverviewPayload: ResearchOverviewPayload;
  researchTrendsPayload: ResearchTrendsPayload;
}

let researchBundlePromise: Promise<ResearchBundle> | null = null;
let researchTrendsPromise: Promise<ResearchTrendsPayload> | null = null;

async function fetchResearchBundleFromApi() {
  const response = await fetch("/api/research/bundle");
  if (!response.ok) {
    throw new Error(`API /api/research/bundle returned ${response.status}`);
  }
  return (await response.json()) as ResearchBundle;
}

async function fetchResearchTrendsFromApi() {
  const response = await fetch("/api/research/trends");
  if (!response.ok) {
    throw new Error(`API /api/research/trends returned ${response.status}`);
  }
  return (await response.json()) as ResearchTrendsPayload;
}

export function loadResearchBundle() {
  if (!researchBundlePromise) {
    researchBundlePromise = fetchResearchBundleFromApi().catch(() =>
      Promise.all([
        import("./research_audit.json"),
        import("./research_overview.json"),
        import("./research_trends.json"),
      ]).then(([auditModule, overviewModule, trendsModule]) => ({
        researchAuditPayload: auditModule.default as ResearchAuditPayload,
        researchOverviewPayload: overviewModule.default as ResearchOverviewPayload,
        researchTrendsPayload: trendsModule.default as ResearchTrendsPayload,
      }))
    );
  }

  return researchBundlePromise;
}

export function loadResearchTrendsPayload() {
  if (!researchTrendsPromise) {
    researchTrendsPromise = fetchResearchTrendsFromApi().catch(() =>
      import("./research_trends.json").then((module) => module.default as ResearchTrendsPayload)
    );
  }

  return researchTrendsPromise;
}
