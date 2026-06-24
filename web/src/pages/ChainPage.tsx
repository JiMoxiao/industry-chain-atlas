import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { AtlasPage } from "@/components/AtlasPage";
import { StatePanel } from "@/components/StatePanel";
import { getCachedChainPayload, isChainSlug, loadChainPayload, refreshChainPayloadInBackground } from "@/data";
import type { ChainPayload } from "@/types/chain";

export default function ChainPage() {
  const { slug } = useParams<{ slug: string }>();
  const [payload, setPayload] = useState<ChainPayload | null>(() =>
    slug && isChainSlug(slug) && slug !== "fusion" ? getCachedChainPayload(slug) : null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !isChainSlug(slug) || slug === "fusion") {
      return;
    }

    const cachedPayload = getCachedChainPayload(slug);
    if (cachedPayload) {
      setPayload(cachedPayload);
      setError(null);
    }

    let cancelled = false;
    if (!cachedPayload) {
      setPayload(null);
    }
    setError(null);

    loadChainPayload(slug, { force: true })
      .then((nextPayload) => {
        if (!cancelled) {
          setPayload(nextPayload);
        }
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "图谱数据加载失败");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug || !isChainSlug(slug) || slug === "fusion") {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void refreshChainPayloadInBackground(slug).then((nextPayload) => {
        if (!cancelled && nextPayload) {
          setPayload(nextPayload);
          setError(null);
        }
      });
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [slug]);

  if (!slug || !isChainSlug(slug) || slug === "fusion") {
    return <Navigate to="/" replace />;
  }

  if (error) {
    return (
      <StatePanel
        title="图谱页暂时不可用"
        description={`子链图谱数据加载失败：${error}。可以刷新重试，或先返回其他页面继续查看。`}
        className="min-h-[320px]"
        tone="warn"
      />
    );
  }

  if (!payload) {
    return (
      <StatePanel
        title="子链图谱加载中"
        description="正在按需读取当前子链的图谱 JSON，并初始化画布与详情面板。"
        className="min-h-[320px]"
      />
    );
  }

  return <AtlasPage payload={payload} />;
}
