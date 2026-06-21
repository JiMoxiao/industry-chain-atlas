export interface EdgeVisualStyle {
  stroke: string;
  lineWidth: number;
  arrowSize: number;
  lineDash?: number[];
}

export const EDGE_STYLE: Record<string, EdgeVisualStyle> = {
  primary: { stroke: "#69bea9", lineWidth: 1.6, arrowSize: 7 },
  secondary: { stroke: "#8ea9c8", lineWidth: 1.2, arrowSize: 6 },
  exclusive: { stroke: "#f2a064", lineWidth: 1.4, arrowSize: 7, lineDash: [8, 4] },
};

export const EDGE_FOCUS_STYLE: Record<string, EdgeVisualStyle> = {
  primary: { stroke: "#0f766e", lineWidth: 2.8, arrowSize: 10 },
  secondary: { stroke: "#2563eb", lineWidth: 2.2, arrowSize: 8 },
  exclusive: { stroke: "#ea580c", lineWidth: 2.6, arrowSize: 10, lineDash: [8, 4] },
};
