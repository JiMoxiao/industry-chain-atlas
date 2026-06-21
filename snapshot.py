"""
产能数据快照生成器。

读取 <industry>.yaml 中所有 data_points 的 current_value，按子链写入日期戳 JSON，
便于后续聚合成可消费的时间序列。

用法:
  python snapshot.py <industry>
  python snapshot.py --all
"""

import json
import os
import sys
from datetime import date

import yaml

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
SNAPSHOT_DIR = os.path.join(DATA_DIR, "capacity_snapshots")
CHAIN_SLUGS = [
    "semiconductor",
    "electronic_chemicals",
    "nonferrous_metals",
    "silicon_materials",
    "pcb_materials",
]


def build_snapshot(industry):
    yaml_path = os.path.join(DATA_DIR, f"{industry}.yaml")
    if not os.path.exists(yaml_path):
        raise FileNotFoundError(f"{yaml_path} not found")

    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    today = date.today().isoformat()
    metrics = {}

    for seg in data["segments"]:
        seg_metrics = {}
        for dp in seg.get("data_points", []):
            val = dp.get("current_value")
            if val is not None:
                seg_metrics[dp["name"]] = val
        if seg_metrics:
            metrics[seg["id"]] = seg_metrics

    return {
        "kind": "capacity_trend_snapshot",
        "industry": industry,
        "date": today,
        "metrics": metrics,
    }


def write_snapshot(industry):
    snapshot = build_snapshot(industry)
    today = snapshot["date"]
    metrics = snapshot["metrics"]
    industry_dir = os.path.join(SNAPSHOT_DIR, industry)
    os.makedirs(industry_dir, exist_ok=True)
    out_path = os.path.join(industry_dir, f"{today}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)

    total_metrics = sum(len(m) for m in metrics.values())
    return out_path, len(metrics), total_metrics


def main():
    if len(sys.argv) < 2:
        print("Usage: python snapshot.py <industry> | --all")
        print("Example: python snapshot.py semiconductor")
        sys.exit(1)

    target = sys.argv[1]
    industries = CHAIN_SLUGS if target == "--all" else [target]

    for industry in industries:
        try:
            out_path, segment_count, total_metrics = write_snapshot(industry)
        except FileNotFoundError as exc:
            print(f"Error: {exc}")
            sys.exit(1)
        print(
            f"Snapshot {industry}: {segment_count} segments, "
            f"{total_metrics} metrics → {out_path}"
        )


if __name__ == "__main__":
    main()
