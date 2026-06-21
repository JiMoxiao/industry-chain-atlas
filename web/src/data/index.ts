import type { ChainPayload } from "@/types/chain";

const chainPayloadImporters = {
  semiconductor: () => import("./semiconductor.json"),
  electronic_chemicals: () => import("./electronic_chemicals.json"),
  nonferrous_metals: () => import("./nonferrous_metals.json"),
  silicon_materials: () => import("./silicon_materials.json"),
  pcb_materials: () => import("./pcb_materials.json"),
  fusion: () => import("./fusion.json"),
} as const;

type ChainSlug = keyof typeof chainPayloadImporters;

const chainPayloadCache = new Map<ChainSlug, Promise<ChainPayload>>();
const resolvedChainPayloadCache = new Map<ChainSlug, ChainPayload>();

async function fetchChainFromApi(slug: ChainSlug) {
  const endpoint = slug === "fusion" ? "/api/fusion" : `/api/chains/${slug}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`API ${endpoint} returned ${response.status}`);
  }
  return (await response.json()) as ChainPayload;
}

export function isChainSlug(slug: string): slug is ChainSlug {
  return slug in chainPayloadImporters;
}

export function getCachedChainPayload(slug: string) {
  if (!isChainSlug(slug)) {
    return null;
  }

  return resolvedChainPayloadCache.get(slug) ?? null;
}

export function loadChainPayload(slug: string) {
  if (!isChainSlug(slug)) {
    return Promise.resolve(null);
  }

  const resolved = resolvedChainPayloadCache.get(slug);
  if (resolved) {
    return Promise.resolve(resolved);
  }

  const cached = chainPayloadCache.get(slug);
  if (cached) {
    return cached;
  }

  const pending = fetchChainFromApi(slug)
    .catch(() => chainPayloadImporters[slug]().then((module) => module.default as ChainPayload))
    .then((payload) => {
      resolvedChainPayloadCache.set(slug, payload);
      return payload;
    })
    .catch((reason) => {
      chainPayloadCache.delete(slug);
      throw reason;
    });

  chainPayloadCache.set(slug, pending);
  return pending;
}

export function warmChainPayloads(slugs: ChainSlug[]) {
  void Promise.allSettled(slugs.map((slug) => loadChainPayload(slug)));
}
