"""
研究总览深挖审计脚本。

输出：
- web/src/data/research_audit.json
- web/src/data/research_overview.json
"""

from __future__ import annotations

import os

from generate_data import (
    CHAIN_SLUGS,
    DATA_DIR,
    WEB_DATA_DIR,
    build_chain_payload,
    build_fusion_payload,
    ensure_output_dir,
)
from lib.capacity_trends import build_trend_payload, write_trend_payload
from lib.research_audit import write_research_reports


def main():
    ensure_output_dir()
    chain_payloads = [build_chain_payload(slug) for slug in CHAIN_SLUGS]
    fusion_payload = build_fusion_payload()
    trend_payload = build_trend_payload(chain_payloads, os.path.join(DATA_DIR, "capacity_snapshots"))
    results = [write_trend_payload(WEB_DATA_DIR, trend_payload)]
    results.extend(write_research_reports(WEB_DATA_DIR, chain_payloads, fusion_payload, trend_payload))

    for path, payload in results:
        summary = payload.get("summary", {})
        print(f"Written: {path}")
        if summary:
            print(f"  summary: {summary}")


if __name__ == "__main__":
    main()
