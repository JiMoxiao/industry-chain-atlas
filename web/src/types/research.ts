export interface ResearchOverviewChainCard {
  slug: string;
  title: string;
  route: string;
  description: string;
  stats: {
    node_count: number;
    edge_count: number;
    group_count: number;
    stock_count: number;
  };
  data_point_count: number;
  relationship_count: number;
  quality_score: number;
  average_data_point_confidence: number;
  estimated_ratio: number;
  missing_source_url_count: number;
  orphan_relationship_count: number;
  snapshot_count: number;
  latest_snapshot_date: string;
  tracked_segment_count: number;
  tracked_metric_count: number;
  tier_distribution: Record<string, number>;
  top_segments: Array<{
    id: string;
    name: string;
    company_count: number;
    data_point_count: number;
    heat_d20: number;
  }>;
}

export interface ResearchOverviewPayload {
  kind: "research_overview";
  generated_at: string;
  summary: {
    chain_count: number;
    fusion_node_count: number;
    fusion_edge_count: number;
    fusion_stock_count: number;
    total_node_count: number;
    total_edge_count: number;
    total_stock_count: number;
    average_quality_score: number;
    missing_source_url_count: number;
    estimated_data_point_count: number;
    chains_with_snapshots: number;
    total_snapshot_count: number;
    tracked_series_count: number;
    latest_snapshot_date: string;
    orphan_relationship_count: number;
  };
  fusion: {
    title: string;
    route: string;
    stats: {
      node_count: number;
      edge_count: number;
      group_count: number;
      stock_count: number;
    };
    description: string;
  };
  chains: ResearchOverviewChainCard[];
  focus: {
    highest_quality_chain: string;
    most_missing_source_chain: string;
    most_estimated_chain: string;
  };
  highlights: string[];
}

export interface ResearchRiskItem {
  kind: "data_point" | "relationship";
  chain_slug: string;
  segment_name?: string;
  name?: string;
  product?: string;
  from_name?: string;
  to_name?: string;
  source_name?: string;
  source_tier: string;
  source_tier_label: string;
  source_confidence: number;
  source_confidence_label: string;
  estimated: boolean;
}

export interface ResearchAuditChainSummary {
  slug: string;
  title: string;
  kind: string;
  generated_at: string;
  description: string;
  stats: {
    node_count: number;
    edge_count: number;
    group_count: number;
    stock_count: number;
  };
  data_point_count: number;
  relationship_count: number;
  orphan_relationship_count?: number;
  estimated_data_point_count: number;
  estimated_relationship_count: number;
  missing_source_name_count: number;
  missing_source_url_count: number;
  missing_buyer_count: number;
  data_point_tier_distribution: Record<string, number>;
  relationship_tier_distribution: Record<string, number>;
  data_point_confidence_distribution: Record<string, number>;
  relationship_confidence_distribution: Record<string, number>;
  average_data_point_confidence: number;
  quality_score: number;
  top_segments: Array<{
    id: string;
    name: string;
    company_count: number;
    data_point_count: number;
    heat_d20: number;
  }>;
  low_confidence: {
    data_points: ResearchRiskItem[];
    relationships: ResearchRiskItem[];
  };
}

export interface ResearchAuditPayload {
  kind: "research_audit";
  generated_at: string;
  summary: {
    chain_count: number;
    data_point_count: number;
    relationship_count: number;
    missing_source_name_count: number;
    missing_source_url_count: number;
    missing_buyer_count: number;
    estimated_data_point_count: number;
    average_quality_score: number;
  };
  chains: ResearchAuditChainSummary[];
  fusion: ResearchAuditChainSummary;
  global_top_risks: ResearchRiskItem[];
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface ResearchTrendMetricSeries {
  key: string;
  segment_id: string;
  segment_name: string;
  metric_name: string;
  metric_type: string;
  unit?: string | null;
  sample_count: number;
  latest_value: number;
  previous_value?: number | null;
  delta_value?: number | null;
  delta_ratio?: number | null;
  points: TrendPoint[];
}

export interface ResearchTrendSegment {
  id: string;
  name: string;
  metric_count: number;
  metrics: ResearchTrendMetricSeries[];
}

export interface ResearchTrendChain {
  slug: string;
  title: string;
  snapshot_count: number;
  earliest_snapshot_date: string;
  latest_snapshot_date: string;
  tracked_segment_count: number;
  tracked_metric_count: number;
  orphan_relationship_count: number;
  segments: ResearchTrendSegment[];
  top_series: ResearchTrendMetricSeries[];
}

export interface ResearchTrendsPayload {
  kind: "research_trends";
  generated_at: string;
  summary: {
    chain_count: number;
    chains_with_snapshots: number;
    total_snapshot_count: number;
    tracked_series_count: number;
    earliest_snapshot_date: string;
    latest_snapshot_date: string;
  };
  chains: ResearchTrendChain[];
}
