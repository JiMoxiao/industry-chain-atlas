"""
产业链交互式图谱生成器
读取 data/<industry>.yaml → 生成分层有向图 HTML
用法: python generate.py <industry>
示例: python generate.py semiconductor
"""

import os
import sys
from collections import defaultdict

import yaml

from lib.data_loader import flatten_data
from lib.renderer import gen_html

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def main():
    if len(sys.argv) < 2:
        print("Usage: python generate.py <industry>")
        print("Example: python generate.py semiconductor")
        sys.exit(1)

    industry = sys.argv[1]
    yaml_path = os.path.join(SCRIPT_DIR, "data", f"{industry}.yaml")
    output_path = os.path.join(SCRIPT_DIR, f"{industry}_chain.html")

    if not os.path.exists(yaml_path):
        print(f"Error: {yaml_path} not found")
        sys.exit(1)

    print(f"Reading {yaml_path}...")
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    print(f"  {len(data['segments'])} segments, {len(data.get('supply_relationships', []))} relationships")

    flat = flatten_data(data)
    group_order = flat["group_order"]
    print(f"  Nodes: {len(flat['nodes'])}, Edges: {len(flat['edges'])}")

    layers = defaultdict(list)
    for n in flat["nodes"]:
        layers[n["layer"]].append((n["group"], n["name"]))
    for lyr in sorted(layers.keys()):
        names = ", ".join(
            f"{g}/{nm}"
            for g, nm in sorted(layers[lyr], key=lambda x: (group_order.index(x[0]) if x[0] in group_order else 99, x[1]))
        )
        print(f"  L{lyr}: {names}")

    html = gen_html(flat)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"Written: {output_path} ({len(html):,} bytes)")


if __name__ == "__main__":
    main()
