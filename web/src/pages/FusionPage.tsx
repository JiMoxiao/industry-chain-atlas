import { useEffect, useState } from "react";
import { AtlasPage } from "@/components/AtlasPage";
import { StatePanel } from "@/components/StatePanel";
import { getCachedChainPayload, loadChainPayload } from "@/data";
import type { ChainPayload } from "@/types/chain";

export default function FusionPage() {
  const [payload, setPayload] = useState<ChainPayload | null>(() => getCachedChainPayload("fusion"));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cachedPayload = getCachedChainPayload("fusion");
    if (cachedPayload) {
      setPayload(cachedPayload);
      setError(null);
      return;
    }

    let cancelled = false;
    setError(null);

    loadChainPayload("fusion")
      .then((nextPayload) => {
        if (!cancelled) {
          setPayload(nextPayload);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "融合图谱加载失败");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <StatePanel
        title="融合图谱暂时不可用"
        description={`融合图谱数据加载失败：${error}。可以刷新后重试，或先浏览其他页面。`}
        className="min-h-[320px]"
        tone="warn"
      />
    );
  }

  if (!payload) {
    return (
      <StatePanel
        title="融合图谱加载中"
        description="正在按需读取融合总图谱 JSON，并准备图谱交互能力。"
        className="min-h-[320px]"
      />
    );
  }

  return <AtlasPage payload={payload} />;
}
