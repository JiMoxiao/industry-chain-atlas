export interface CompanyHeat {
  code: string;
  name: string;
  role: string;
  d: number;
  d5: number;
  d20?: number;
}

export interface CapacityItem {
  company: string;
  scale: string;
  expected_online: string;
  status: string;
}

export interface DataPoint {
  name: string;
  type: string;
  unit?: string | null;
  current_value?: string | number | null;
  source_name?: string;
  source_url?: string;
  last_updated?: string;
  source_tier?: "official" | "authoritative" | "secondary" | "unknown";
  source_tier_label?: string;
  source_confidence?: number;
  source_confidence_label?: string;
  estimated?: boolean;
}

export interface ChainNode {
  id: string;
  name: string;
  position: string;
  tier: number;
  description: string;
  companies: CompanyHeat[];
  data_points: DataPoint[];
  new_capacity: CapacityItem[];
  group: string;
  layer: number;
  x: number;
  y: number;
  heat_d: number;
  heat_d5: number;
  heat_d20: number;
  industry?: string;
  node_kind?: "segment" | "shadow";
  shadow_company_code?: string;
  shadow_company_name?: string;
  shadow_role?: "supplier" | "buyer" | "counterparty";
  orphan_count?: number;
}

export interface ChainEdge {
  from: string;
  to: string;
  product: string;
  notes: string;
  rel_type: string;
  industry?: string;
  confidence?: number;
  source_name?: string;
  source_url?: string;
  source_tier?: "official" | "authoritative" | "secondary" | "unknown";
  source_tier_label?: string;
  source_confidence?: number;
  source_confidence_label?: string;
  estimated?: boolean;
  relationship_status?: "formal" | "candidate";
  orphan_indices?: number[];
  candidate_count?: number;
}

export interface OrphanRelationship {
  supplier_code: string;
  supplier_name?: string;
  buyer_code: string;
  buyer_name?: string;
  product: string;
  notes: string;
  rel_type: string;
  confidence?: number;
  source_name?: string;
  source_url?: string;
  source_tier?: "official" | "authoritative" | "secondary" | "unknown";
  source_tier_label?: string;
  source_confidence?: number;
  source_confidence_label?: string;
  estimated?: boolean;
}

export interface ChainStats {
  node_count: number;
  edge_count: number;
  group_count: number;
  stock_count: number;
}

export interface ChainCanvas {
  width: number;
  height: number;
}

export interface ChainPayload {
  kind: "chain" | "fusion";
  slug: string;
  title: string;
  generated_at: string;
  canvas: ChainCanvas;
  stats: ChainStats;
  group_labels: Record<string, string[]>;
  group_order: string[];
  stock_codes: string[];
  nodes: ChainNode[];
  edges: ChainEdge[];
  icon?: string;
  industry?: string;
  flow_description?: string;
  orphan_relationships?: OrphanRelationship[];
}

export type PanelTab = "overview" | "companies" | "metrics" | "edges";

export interface GroupOption {
  key: string;
  label: string;
  color?: string;
}

export interface StockHeatSnapshot {
  d: number;
  d5: number;
  d20?: number;
}
