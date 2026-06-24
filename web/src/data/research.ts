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

interface LoadResearchOptions {
  force?: boolean;
  allowStaticFallback?: boolean;
}

let researchBundlePromise: Promise<ResearchBundle> | null = null;
let researchTrendsPromise: Promise<ResearchTrendsPayload> | null = null;
let resolvedResearchBundle: ResearchBundle | null = null;
let resolvedResearchTrends: ResearchTrendsPayload | null = null;

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

async function loadStaticResearchBundle() {
  return Promise.all([
    import("./research_audit.json"),
    import("./research_overview.json"),
    import("./research_trends.json"),
  ]).then(([auditModule, overviewModule, trendsModule]) => ({
    researchAuditPayload: auditModule.default as ResearchAuditPayload,
    researchOverviewPayload: overviewModule.default as ResearchOverviewPayload,
    researchTrendsPayload: trendsModule.default as ResearchTrendsPayload,
  }));
}

export function clearResearchCaches() {
  researchBundlePromise = null;
  researchTrendsPromise = null;
  resolvedResearchBundle = null;
  resolvedResearchTrends = null;
}

export function getCachedResearchBundle() {
  return resolvedResearchBundle;
}

export function loadResearchBundle(options: LoadResearchOptions = {}) {
  const { force = false, allowStaticFallback = true } = options;
  if (force) {
    researchBundlePromise = null;
    resolvedResearchBundle = null;
  }

  if (researchBundlePromise) {
    return researchBundlePromise;
  }

  researchBundlePromise = fetchResearchBundleFromApi()
    .catch((error) => {
      if (!allowStaticFallback) {
        throw error;
      }
      return loadStaticResearchBundle();
    })
    .then((payload) => {
      resolvedResearchBundle = payload;
      return payload;
    })
    .catch((reason) => {
      researchBundlePromise = null;
      throw reason;
    });

  return researchBundlePromise;
}

export function loadResearchTrendsPayload(options: LoadResearchOptions = {}) {
  const { force = false, allowStaticFallback = true } = options;
  if (force) {
    researchTrendsPromise = null;
    resolvedResearchTrends = null;
  }

  if (researchTrendsPromise) {
    return researchTrendsPromise;
  }

  researchTrendsPromise = fetchResearchTrendsFromApi()
    .catch((error) => {
      if (!allowStaticFallback) {
        throw error;
      }
      return import("./research_trends.json").then((module) => module.default as ResearchTrendsPayload);
    })
    .then((payload) => {
      resolvedResearchTrends = payload;
      return payload;
    })
    .catch((reason) => {
      researchTrendsPromise = null;
      throw reason;
    });

  return researchTrendsPromise;
}

export function refreshResearchBundleInBackground() {
  return fetchResearchBundleFromApi()
    .then((payload) => {
      resolvedResearchBundle = payload;
      researchBundlePromise = Promise.resolve(payload);
      return payload;
    })
    .catch(() => null);
}
