export interface HeatColorTokens {
  fill: string;
  stroke: string;
  tagBg: string;
  tagText: string;
  text: string;
  heatText: string;
}

export function heatToColor(value: number): HeatColorTokens {
  if (value >= 20) {
    return {
      fill: "#fff1f2",
      stroke: "#e2556b",
      tagBg: "#e2556b",
      tagText: "#ffffff",
      text: "#9f1239",
      heatText: "#be123c",
    };
  }
  if (value >= 10) {
    return {
      fill: "#fff5f5",
      stroke: "#eb6f86",
      tagBg: "#f08aa0",
      tagText: "#ffffff",
      text: "#9f1239",
      heatText: "#be123c",
    };
  }
  if (value >= 5) {
    return {
      fill: "#fff8f8",
      stroke: "#f2a1af",
      tagBg: "#f7c7d0",
      tagText: "#9f1239",
      text: "#334155",
      heatText: "#be123c",
    };
  }
  if (value >= 2) {
    return {
      fill: "#fffafb",
      stroke: "#f5c3ce",
      tagBg: "#fbe0e6",
      tagText: "#9f1239",
      text: "#334155",
      heatText: "#be123c",
    };
  }
  if (value >= 0) {
    return {
      fill: "#ffffff",
      stroke: "#cbd5e1",
      tagBg: "#e2e8f0",
      tagText: "#475569",
      text: "#334155",
      heatText: "#64748b",
    };
  }
  if (value >= -2) {
    return {
      fill: "#f3fbf8",
      stroke: "#8ccfbe",
      tagBg: "#d3f2e8",
      tagText: "#0f766e",
      text: "#334155",
      heatText: "#0f766e",
    };
  }
  if (value >= -5) {
    return {
      fill: "#effaf6",
      stroke: "#5bbfa6",
      tagBg: "#7ad7bf",
      tagText: "#0f4c46",
      text: "#0f4c46",
      heatText: "#0f766e",
    };
  }
  if (value >= -10) {
    return {
      fill: "#e7f8f2",
      stroke: "#2da58b",
      tagBg: "#2da58b",
      tagText: "#ffffff",
      text: "#115e59",
      heatText: "#0f766e",
    };
  }
  return {
    fill: "#ddf5ee",
    stroke: "#0f8f76",
    tagBg: "#0f8f76",
    tagText: "#ffffff",
    text: "#115e59",
    heatText: "#0f766e",
  };
}

export function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
