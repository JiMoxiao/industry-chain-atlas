"""
市场热度数据获取 — 同花顺 API
  realhead → d (199112) / d5 (1149395)
  kline 前复权 → d20 (计算)
  旧缓存兜底
用法: python update_heat.py
"""

import json
import os
import re
import time
import urllib.request
from datetime import date

import yaml

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, "data")
CACHE_PATH = os.path.join(DATA_DIR, "market_heat.json")

THS_REALHEAD = "http://d.10jqka.com.cn/v2/realhead/hs_{code}/last.js"
THS_KLINE = "http://d.10jqka.com.cn/v2/line/hs_{code}/02/last.js"  # 02=前复权日线

THS_D = "199112"     # 日涨跌幅%
THS_D5 = "1149395"   # 5日涨跌幅%


def collect_stocks():
    """扫描 data/ 下所有 YAML，收集唯一股票代码 → segment 映射."""
    stocks = {}
    segments = {}
    for fn in os.listdir(DATA_DIR):
        if not fn.endswith(".yaml"):
            continue
        path = os.path.join(DATA_DIR, fn)
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if not data or "segments" not in data:
            continue
        for seg in data["segments"]:
            seg_codes = []
            for co in seg.get("key_companies", []):
                code = str(co["code"])
                if code not in stocks:
                    stocks[code] = []
                stocks[code].append(seg["id"])
                seg_codes.append(code)
            segments[seg["id"]] = seg_codes
    return stocks, segments


def fetch_realhead(codes):
    """同花顺 realhead → {code: {d, d5}}."""
    result = {}
    for code in codes:
        url = THS_REALHEAD.format(code=code)
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://www.10jqka.com.cn/"
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read().decode("utf-8")
            m = re.search(r"quotebridge[^(]*\((.*)\)", raw, re.DOTALL)
            if not m:
                continue
            items = json.loads(m.group(1)).get("items", {})
            d_val = float(items.get(THS_D, 0) or 0)
            d5_val = float(items.get(THS_D5, 0) or 0)
            result[code] = {"d": round(d_val, 2), "d5": round(d5_val, 2)}
        except Exception:
            continue
    return result


def fetch_d20(codes):
    """同花顺 kline 前复权 → {code: d20}."""
    result = {}
    for code in codes:
        url = THS_KLINE.format(code=code)
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://www.10jqka.com.cn/"
            })
            with urllib.request.urlopen(req, timeout=10) as resp:
                raw = resp.read().decode("utf-8")
            m = re.search(r"quotebridge[^(]*\((.*)\)", raw, re.DOTALL)
            if not m:
                continue
            data = json.loads(m.group(1))
            lines = data.get("data", "").split(";")
            closes = []
            for line in lines:
                if not line.strip():
                    continue
                parts = line.split(",")
                if len(parts) >= 5:
                    closes.append(float(parts[4]))
            if len(closes) >= 21:
                d20 = round((closes[-1] - closes[-21]) / closes[-21] * 100, 2)
                result[code] = d20
        except Exception:
            continue
    return result


def compute_segment_heat(segments, stocks_heat):
    seg_heat = {}
    for seg_id, codes in segments.items():
        d_vals, d5_vals, d20_vals = [], [], []
        for code in codes:
            h = stocks_heat.get(code, {})
            d_vals.append(h.get("d", 0))
            d5_vals.append(h.get("d5", 0))
            d20_vals.append(h.get("d20", 0))
        n = len(d_vals)
        seg_heat[seg_id] = {
            "d": round(sum(d_vals) / n, 2) if n else 0,
            "d5": round(sum(d5_vals) / n, 2) if n else 0,
            "d20": round(sum(d20_vals) / n, 2) if n else 0,
        }
    return seg_heat


def main():
    print("Collecting stock codes from YAMLs...")
    stocks, segments = collect_stocks()
    all_codes = sorted(stocks.keys())
    print(f"  {len(all_codes)} unique stocks across {len(segments)} segments")

    old_stocks = {}
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            old_stocks = json.load(f).get("stocks", {})

    # 1. realhead → d/d5
    print("Fetching d/d5 from 同花顺 realhead...")
    t0 = time.time()
    rh_result = fetch_realhead(all_codes)
    print(f"  {len(rh_result)}/{len(all_codes)} fetched ({time.time()-t0:.1f}s)")

    # 2. kline → d20
    print("Fetching d20 from 同花顺 kline (前复权)...")
    t0 = time.time()
    d20_result = fetch_d20(all_codes)
    print(f"  {len(d20_result)}/{len(all_codes)} fetched ({time.time()-t0:.1f}s)")

    # 3. 合并 + 旧缓存兜底
    stocks_heat = {}
    missing_d = 0
    missing_d20 = 0
    for code in all_codes:
        rh = rh_result.get(code, {})
        old = old_stocks.get(code, {})
        d = rh.get("d", old.get("d", 0))
        d5 = rh.get("d5", old.get("d5", 0))
        d20 = d20_result.get(code, old.get("d20", 0))
        if code not in rh_result:
            missing_d += 1
        if code not in d20_result:
            missing_d20 += 1
        stocks_heat[code] = {"d": d, "d5": d5, "d20": d20}

    if missing_d:
        print(f"  WARNING: {missing_d} stocks missing d/d5 (cache fallback)")
    if missing_d20:
        print(f"  WARNING: {missing_d20} stocks missing d20 (cache fallback)")

    seg_heat = compute_segment_heat(segments, stocks_heat)

    cache = {
        "timestamp": date.today().isoformat(),
        "segments": seg_heat,
        "stocks": stocks_heat,
    }
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    print(f"Written: {CACHE_PATH}")
    print(f"  {len(seg_heat)} segments, {len(stocks_heat)} stocks")


if __name__ == "__main__":
    main()
