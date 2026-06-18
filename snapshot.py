"""
产能数据快照生成器
读取 <industry>.yaml 中所有 data_points 的 current_value，写入日期戳 JSON。
用法: python snapshot.py <industry>
示例: python snapshot.py semiconductor
"""

import json
import os
import sys
from datetime import date

import yaml

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def main():
    if len(sys.argv) < 2:
        print("Usage: python snapshot.py <industry>")
        print("Example: python snapshot.py semiconductor")
        sys.exit(1)

    industry = sys.argv[1]
    yaml_path = os.path.join(SCRIPT_DIR, "data", f"{industry}.yaml")
    snapshot_dir = os.path.join(SCRIPT_DIR, "data", "capacity_snapshots")

    if not os.path.exists(yaml_path):
        print(f"Error: {yaml_path} not found")
        sys.exit(1)

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

    snapshot = {"date": today, "metrics": metrics}

    os.makedirs(snapshot_dir, exist_ok=True)
    out_path = os.path.join(snapshot_dir, f"{today}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=2)

    total_metrics = sum(len(m) for m in metrics.values())
    print(f"Snapshot {today}: {len(metrics)} segments, {total_metrics} metrics → {out_path}")


if __name__ == "__main__":
    main()
