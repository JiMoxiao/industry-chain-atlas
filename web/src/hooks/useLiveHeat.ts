import { useEffect, useMemo, useState } from "react";
import type { BackendHeatResponse } from "@/types/backend";
import type { StockHeatSnapshot } from "@/types/chain";

interface UseLiveHeatResult {
  heatMap: Record<string, StockHeatSnapshot>;
  isLoading: boolean;
  progressText: string;
  updatedAt: string | null;
}

const LIVE_CACHE_KEY = "semiconductor_live_heat";
const LIVE_CACHE_DATE_KEY = "semiconductor_live_heat_date";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function readCache() {
  try {
    if (localStorage.getItem(LIVE_CACHE_DATE_KEY) !== todayKey()) {
      return null;
    }
    const raw = localStorage.getItem(LIVE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, StockHeatSnapshot>) : null;
  } catch {
    return null;
  }
}

function saveCache(data: Record<string, StockHeatSnapshot>) {
  try {
    localStorage.setItem(LIVE_CACHE_DATE_KEY, todayKey());
    localStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore cache errors
  }
}

async function fetchAllHeat(
  codes: string[],
  refresh: boolean,
  onProgress: (done: number, total: number) => void
) {
  const result: Record<string, StockHeatSnapshot> = {};
  const batchSize = 40;
  let latestTimestamp = "";
  let cacheStatus: BackendHeatResponse["cache_status"] = "empty";
  let cacheAgeSeconds: number | null = null;
  let refreshedCount = 0;
  let missingCount = 0;

  for (let index = 0; index < codes.length; index += batchSize) {
    const batch = codes.slice(index, index + batchSize);
    const response = await fetch(`/api/heat?codes=${batch.join(",")}&refresh=${refresh ? "true" : "false"}`);
    if (!response.ok) {
      throw new Error(`API /api/heat returned ${response.status}`);
    }
    const payload = (await response.json()) as BackendHeatResponse;
    Object.assign(result, payload.stocks);
    latestTimestamp = payload.timestamp || latestTimestamp;
    cacheStatus = payload.cache_status ?? cacheStatus;
    cacheAgeSeconds = payload.cache_age_seconds ?? cacheAgeSeconds;
    refreshedCount += payload.refreshed_count;
    missingCount += payload.missing_codes.length;
    onProgress(Math.min(index + batch.length, codes.length), codes.length);
  }

  return {
    stocks: result,
    timestamp: latestTimestamp,
    cacheStatus,
    cacheAgeSeconds,
    refreshedCount,
    missingCount,
  };
}

function formatServerTimestamp(timestamp: string) {
  if (!timestamp) {
    return "服务缓存";
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "服务缓存";
  }

  return parsed.toLocaleTimeString("zh-CN", { hour12: false });
}

export function useLiveHeat(stockCodes: string[]): UseLiveHeatResult {
  const [heatMap, setHeatMap] = useState<Record<string, StockHeatSnapshot>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const stableCodes = useMemo(() => [...stockCodes].sort(), [stockCodes]);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      setHeatMap(cached);
      setUpdatedAt("缓存");
    }
  }, [stableCodes]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (stableCodes.length === 0) {
        return;
      }

      setIsLoading(true);
      setProgressText(`同步服务缓存 0/${stableCodes.length}...`);

      let serverResult:
        | {
            stocks: Record<string, StockHeatSnapshot>;
            timestamp: string;
            cacheStatus: BackendHeatResponse["cache_status"];
            cacheAgeSeconds: number | null;
            refreshedCount: number;
            missingCount: number;
          }
        | null = null;
      try {
        serverResult = await fetchAllHeat(stableCodes, false, (done, total) => {
          if (!cancelled) {
            setProgressText(`同步服务缓存 ${done}/${total}...`);
          }
        });
      } catch {
        serverResult = null;
      }

      if (cancelled) {
        return;
      }

      const needsLiveRefresh =
        !serverResult ||
        serverResult.cacheStatus === "empty" ||
        (serverResult.missingCount > 0 && Object.keys(serverResult.stocks).length === 0);

      let liveResult = serverResult;
      if (needsLiveRefresh) {
        setProgressText(`初始化服务热度缓存 0/${stableCodes.length}...`);
        try {
          liveResult = await fetchAllHeat(stableCodes, true, (done, total) => {
            if (!cancelled) {
              setProgressText(`初始化服务热度缓存 ${done}/${total}...`);
            }
          });
        } catch {
          liveResult = serverResult;
        }
      }

      if (cancelled) {
        return;
      }

      const nextMap = liveResult?.stocks ?? {};
      if (Object.keys(nextMap).length > 0) {
        setHeatMap((prev) => {
          const merged = { ...prev, ...nextMap };
          saveCache(merged);
          return merged;
        });
        setUpdatedAt(formatServerTimestamp(liveResult?.timestamp ?? ""));
        if (needsLiveRefresh && liveResult?.refreshedCount) {
          setProgressText(`已初始化服务缓存 ${liveResult.refreshedCount}/${stableCodes.length}`);
        } else if (liveResult?.cacheStatus === "stale") {
          setProgressText(`已加载服务缓存 ${Object.keys(nextMap).length}/${stableCodes.length} · 缓存稍旧`);
        } else {
          setProgressText(`已加载服务缓存 ${Object.keys(nextMap).length}/${stableCodes.length}`);
        }
      } else {
        setProgressText("热度刷新失败，已回退静态数据");
      }

      setIsLoading(false);
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [stableCodes]);

  return { heatMap, isLoading, progressText, updatedAt };
}
