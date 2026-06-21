export interface ChainMeta {
  slug: string;
  label: string;
  shortLabel: string;
  icon: string;
  description: string;
}

export const chainMetas: ChainMeta[] = [
  {
    slug: "fusion",
    label: "融合总览",
    shortLabel: "融合",
    icon: "🌐",
    description: "查看跨产业链的融合总图谱、共享企业关系与交叉链路。",
  },
  {
    slug: "semiconductor",
    label: "半导体",
    shortLabel: "半导体",
    icon: "🔬",
    description: "核心半导体制造产业链，覆盖上游材料、中游制造和下游应用。",
  },
  {
    slug: "electronic_chemicals",
    label: "电子化学品",
    shortLabel: "电子化学品",
    icon: "🧪",
    description: "聚焦湿电子化学品、光刻胶、电子特气等关键耗材。",
  },
  {
    slug: "nonferrous_metals",
    label: "有色金属",
    shortLabel: "有色金属",
    icon: "⛏",
    description: "覆盖半导体相关有色金属与关键冶炼加工环节。",
  },
  {
    slug: "silicon_materials",
    label: "硅材料",
    shortLabel: "硅材料",
    icon: "💎",
    description: "聚焦工业硅、硅片、石英等基础材料链路。",
  },
  {
    slug: "pcb_materials",
    label: "PCB 材料",
    shortLabel: "PCB材料",
    icon: "📗",
    description: "查看覆铜板、铜箔、树脂等 PCB 基础材料环节。",
  },
];

export function getChainMeta(slug: string) {
  return chainMetas.find((item) => item.slug === slug);
}
