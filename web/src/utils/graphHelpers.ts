import type {
  ChainEdge,
  ChainNode,
  ChainPayload,
  GroupOption,
  OrphanRelationship,
  StockHeatSnapshot,
} from "@/types/chain";

const SHADOW_X_OFFSET = 240;
const SHADOW_Y_STEP = 92;

export function getPositionLabel(position: string) {
  return (
    {
      upstream: "上游",
      midstream: "中游",
      downstream: "下游",
      equipment: "设备",
    }[position] ?? position
  );
}

export function getGroupOptions(payload: ChainPayload): GroupOption[] {
  return payload.group_order
    .filter((key) => Boolean(payload.group_labels[key]))
    .map((key) => ({
      key,
      label: payload.group_labels[key]?.[0] ?? key,
      color: payload.group_labels[key]?.[1],
    }));
}

export function computeVisibleNodeIds(
  nodes: ChainNode[],
  selectedGroups: string[],
  searchQuery: string
) {
  const query = searchQuery.trim().toLowerCase();
  const selectedGroupSet = new Set(selectedGroups);
  const visibleIds = new Set<string>();

  nodes.forEach((node) => {
    const matchesGroup =
      selectedGroupSet.size === 0 || selectedGroupSet.has(node.group);

    const matchesQuery =
      query.length === 0 ||
      node.name.toLowerCase().includes(query) ||
      node.id.toLowerCase().includes(query) ||
      node.description.toLowerCase().includes(query) ||
      node.companies.some(
        (company) =>
          company.name.toLowerCase().includes(query) ||
          company.code.toLowerCase().includes(query)
      );

    if (matchesGroup && matchesQuery) {
      visibleIds.add(node.id);
    }
  });

  return visibleIds;
}

export function filterGraphData(
  payload: ChainPayload,
  selectedGroups: string[],
  searchQuery: string
) {
  const visibleNodeIds = computeVisibleNodeIds(
    payload.nodes,
    selectedGroups,
    searchQuery
  );

  const baseNodes = payload.nodes
    .filter((node) => visibleNodeIds.has(node.id))
    .map((node) => ({
      ...node,
      node_kind: "segment" as const,
    }));

  const nodes: ChainNode[] = [...baseNodes];
  const shadowPlacementCounter = new Map<string, number>();
  const shadowNodesByKey = new Map<string, ChainNode>();
  const companyNodeIndex = buildCompanyNodeIndex(payload.nodes);
  const candidateEdges = new Map<string, ChainEdge>();
  let hiddenOrphanCount = 0;

  (payload.orphan_relationships ?? []).forEach((relationship, index) => {
    const supplierNodeIds = (companyNodeIndex.get(relationship.supplier_code) ?? []).filter((id) =>
      visibleNodeIds.has(id)
    );
    const buyerNodeIds = (companyNodeIndex.get(relationship.buyer_code) ?? []).filter((id) =>
      visibleNodeIds.has(id)
    );

    const mappedPairs = supplierNodeIds.flatMap((supplierId) =>
      buyerNodeIds
        .filter((buyerId) => buyerId !== supplierId)
        .map((buyerId) => [supplierId, buyerId] as const)
    );

    if (mappedPairs.length > 0) {
      mappedPairs.forEach(([from, to]) => {
        const edgeKey = `${from}::${to}::${relationship.rel_type}`;
        upsertCandidateEdge(candidateEdges, edgeKey, from, to, relationship, index);
      });
      return;
    }

    if (supplierNodeIds.length > 0) {
      supplierNodeIds.forEach((supplierId) => {
        const shadowNode = ensureShadowNode(
          nodes,
          shadowPlacementCounter,
          shadowNodesByKey,
          baseNodes,
          supplierId,
          "buyer",
          relationship,
          index
        );
        const edgeKey = `${supplierId}::${shadowNode.id}::${relationship.rel_type}`;
        upsertCandidateEdge(candidateEdges, edgeKey, supplierId, shadowNode.id, relationship, index);
      });
      return;
    }

    if (buyerNodeIds.length > 0) {
      buyerNodeIds.forEach((buyerId) => {
        const shadowNode = ensureShadowNode(
          nodes,
          shadowPlacementCounter,
          shadowNodesByKey,
          baseNodes,
          buyerId,
          "supplier",
          relationship,
          index
        );
        const edgeKey = `${shadowNode.id}::${buyerId}::${relationship.rel_type}`;
        upsertCandidateEdge(candidateEdges, edgeKey, shadowNode.id, buyerId, relationship, index);
      });
      return;
    }

    hiddenOrphanCount += 1;
  });

  const edges = [
    ...payload.edges
      .filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to))
      .map((edge) => ({
        ...edge,
        relationship_status: "formal" as const,
      })),
    ...Array.from(candidateEdges.values()),
  ];

  nodes.forEach((node) => visibleNodeIds.add(node.id));

  return {
    nodes,
    edges,
    visibleNodeIds,
    formalNodeCount: baseNodes.length,
    candidateEdgeCount: edges.filter((edge) => edge.relationship_status === "candidate").length,
    shadowNodeCount: nodes.filter((node) => node.node_kind === "shadow").length,
    hiddenOrphanCount,
  };
}

export function buildAdjacency(edges: ChainEdge[]) {
  const upstreamOf = new Map<string, Set<string>>();
  const downstreamOf = new Map<string, Set<string>>();

  edges.forEach((edge) => {
    if (!upstreamOf.has(edge.to)) {
      upstreamOf.set(edge.to, new Set<string>());
    }
    if (!downstreamOf.has(edge.from)) {
      downstreamOf.set(edge.from, new Set<string>());
    }
    upstreamOf.get(edge.to)?.add(edge.from);
    downstreamOf.get(edge.from)?.add(edge.to);
  });

  return { upstreamOf, downstreamOf };
}

export function collectConnectedNodeIds(
  selectedNodeId: string | null,
  edges: ChainEdge[]
) {
  if (!selectedNodeId) {
    return new Set<string>();
  }

  const { upstreamOf, downstreamOf } = buildAdjacency(edges);
  const connected = new Set<string>([selectedNodeId]);

  upstreamOf.get(selectedNodeId)?.forEach((id) => connected.add(id));
  downstreamOf.get(selectedNodeId)?.forEach((id) => connected.add(id));

  return connected;
}

export function mergePayloadHeat(
  payload: ChainPayload,
  heatMap: Record<string, StockHeatSnapshot>
) {
  if (Object.keys(heatMap).length === 0) {
    return payload;
  }

  const nodes = payload.nodes.map((node) => {
    let sumD = 0;
    let sumD5 = 0;
    let count = 0;

    const companies = node.companies.map((company) => {
      const heat = heatMap[company.code];
      if (!heat) {
        return company;
      }

      sumD += heat.d;
      sumD5 += heat.d5;
      count += 1;

      return {
        ...company,
        d: heat.d,
        d5: heat.d5,
        d20: heat.d20 ?? company.d20,
      };
    });

    if (count === 0) {
      return node;
    }

    return {
      ...node,
      companies,
      heat_d: sumD / count,
      heat_d5: sumD5 / count,
    };
  });

  return {
    ...payload,
    nodes,
  };
}

export function getNodeMap(nodes: ChainNode[]) {
  return new Map(nodes.map((node) => [node.id, node] as const));
}

function buildCompanyNodeIndex(nodes: ChainNode[]) {
  const index = new Map<string, string[]>();

  nodes.forEach((node) => {
    node.companies.forEach((company) => {
      if (!company.code) {
        return;
      }

      const current = index.get(company.code) ?? [];
      current.push(node.id);
      index.set(company.code, current);
    });
  });

  return index;
}

function ensureShadowNode(
  nodes: ChainNode[],
  shadowPlacementCounter: Map<string, number>,
  shadowNodesByKey: Map<string, ChainNode>,
  baseNodes: ChainNode[],
  anchorId: string,
  side: "supplier" | "buyer",
  relationship: OrphanRelationship,
  index: number
) {
  const counterpartyCode = side === "buyer" ? relationship.buyer_code : relationship.supplier_code;
  const counterpartyName =
    side === "buyer"
      ? relationship.buyer_name || relationship.buyer_code || "待映射买方"
      : relationship.supplier_name || relationship.supplier_code || "待映射供方";
  const nodeKey = `${anchorId}::${side}::${counterpartyCode || counterpartyName}`;
  const existing = shadowNodesByKey.get(nodeKey);

  if (existing) {
    existing.orphan_count = (existing.orphan_count ?? 1) + 1;
    return existing;
  }

  const anchorNode = baseNodes.find((node) => node.id === anchorId);
  const placementKey = `${anchorId}:${side}`;
  const placementIndex = shadowPlacementCounter.get(placementKey) ?? 0;
  shadowPlacementCounter.set(placementKey, placementIndex + 1);

  const rowOffset = (placementIndex % 3) - 1;
  const laneOffset = Math.floor(placementIndex / 3);
  const xDirection = side === "buyer" ? 1 : -1;
  const x = (anchorNode?.x ?? 0) + xDirection * (SHADOW_X_OFFSET + laneOffset * 36);
  const y = (anchorNode?.y ?? 0) + rowOffset * SHADOW_Y_STEP + laneOffset * 18;

  const shadowNode: ChainNode = {
    id: `shadow:${anchorId}:${side}:${index}`,
    name: counterpartyName,
    position: anchorNode?.position ?? "midstream",
    tier: anchorNode?.tier ?? 0,
    description:
      side === "buyer"
        ? "影子节点表示当前存在公司级买方线索，但尚未完整映射为正式产业链环节。"
        : "影子节点表示当前存在公司级供方线索，但尚未完整映射为正式产业链环节。",
    companies: [],
    data_points: [],
    new_capacity: [],
    group: anchorNode?.group ?? "shadow",
    layer: anchorNode?.layer ?? 0,
    x,
    y,
    heat_d: 0,
    heat_d5: 0,
    heat_d20: 0,
    industry: anchorNode?.industry,
    node_kind: "shadow",
    shadow_company_code: counterpartyCode,
    shadow_company_name: counterpartyName,
    shadow_role: side,
    orphan_count: 1,
  };

  nodes.push(shadowNode);
  shadowNodesByKey.set(nodeKey, shadowNode);
  return shadowNode;
}

function upsertCandidateEdge(
  candidateEdges: Map<string, ChainEdge>,
  key: string,
  from: string,
  to: string,
  relationship: OrphanRelationship,
  orphanIndex: number
) {
  const existing = candidateEdges.get(key);

  if (!existing) {
    candidateEdges.set(key, {
      from,
      to,
      product: relationship.product || "候选关系",
      notes: relationship.notes || "",
      rel_type: relationship.rel_type,
      confidence: relationship.confidence,
      source_name: relationship.source_name,
      source_url: relationship.source_url,
      source_tier: relationship.source_tier,
      source_tier_label: relationship.source_tier_label,
      source_confidence: relationship.source_confidence,
      source_confidence_label: relationship.source_confidence_label,
      estimated: relationship.estimated,
      relationship_status: "candidate",
      orphan_indices: [orphanIndex],
      candidate_count: 1,
    });
    return;
  }

  const nextCount = (existing.candidate_count ?? 1) + 1;
  existing.candidate_count = nextCount;
  existing.orphan_indices = [...(existing.orphan_indices ?? []), orphanIndex];
  existing.product = summarizeCandidateProduct(existing.product, relationship.product, nextCount);
  existing.source_confidence = Math.max(existing.source_confidence ?? 0, relationship.source_confidence ?? 0);
  existing.confidence = Math.max(existing.confidence ?? 0, relationship.confidence ?? 0);
  existing.estimated = existing.estimated || relationship.estimated;
  existing.notes = existing.notes || relationship.notes;
}

function summarizeCandidateProduct(current: string, incoming: string, count: number) {
  const normalizedCurrent = current || "候选关系";
  const normalizedIncoming = incoming || "候选关系";

  if (normalizedCurrent === normalizedIncoming) {
    return count > 1 ? `${normalizedCurrent} 等${count}条` : normalizedCurrent;
  }

  const baseLabel = normalizedCurrent.replace(/ 等\d+条$/, "");
  return `${baseLabel} 等${count}条`;
}
