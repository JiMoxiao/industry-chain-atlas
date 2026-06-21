"""
来源分级与可信度推断。

目标：
1. 为 data_points 与 supply_relationships 统一补齐来源分级字段；
2. 将可展示的可信度信息写入导出 JSON；
3. 为后续审计脚本提供稳定的分类基础。
"""

from __future__ import annotations

import re
from typing import Any, Dict
from urllib.parse import urlparse

SOURCE_LABELS = {
    "official": "官方公告/财报",
    "authoritative": "协会/权威机构",
    "secondary": "券商/媒体",
    "unknown": "待校验",
}

CONFIDENCE_LABELS = {
    1: "低",
    2: "较低",
    3: "中",
    4: "较高",
    5: "高",
}

OFFICIAL_KEYWORDS = (
    "年报",
    "季报",
    "半年报",
    "公告",
    "招股书",
    "招股说明书",
    "公司官网",
    "财报",
)

AUTHORITATIVE_KEYWORDS = (
    "semi",
    "wsts",
    "idc",
    "trendforce",
    "gartner",
    "yole",
    "prismark",
    "techcet",
    "ic insights",
    "cpca",
    "ggii",
    "smm",
    "协会",
    "研究院",
    "统计局",
    "工信部",
    "海关",
    "百川盈孚",
    "观研天下",
    "华经产业研究院",
    "沙利文",
    "富士经济",
    "cemia",
    "qyresearch",
    "yh research",
    "bernstein research",
)

SECONDARY_KEYWORDS = (
    "券商",
    "证券",
    "研报",
    "中信",
    "华泰",
    "国金",
    "天风",
    "东吴",
    "中金",
    "招商",
    "申万",
    "国泰君安",
    "媒体",
    "雪球",
    "知乎",
    "新浪",
    "东方财富",
    "eastmoney",
    "stockstar",
    "ofweek",
    "21ic",
    "tmtpost",
    "盖世汽车",
    "智通",
    "pconline",
    "c114",
)

OFFICIAL_DOMAINS = (
    "cninfo.com.cn",
    "sse.com.cn",
    "szse.cn",
    "static.sse.com.cn",
)

AUTHORITATIVE_DOMAINS = (
    "semi.org",
    "wsts.org",
    "idc.com",
    "trendforce.com",
    "yolegroup.com",
    "yole.fr",
    "prismark.com",
    "techcet.com",
    "cpca.org.cn",
    "smm.cn",
    "gov.cn",
)

COMMUNITY_DOMAINS = (
    "xueqiu.com",
    "zhihu.com",
    "weixin.qq.com",
)

SECONDARY_DOMAINS = (
    "eastmoney.com",
    "stockstar.com",
    "sina.com.cn",
    "21ic.com",
    "ofweek.com",
    "tmtpost.com",
    "zhitongcaijing.com",
    "pconline.com.cn",
    "c114.com.cn",
)

ESTIMATED_PATTERN = re.compile(r"估算|测算|推算|推断|预估|预测|综合估算|[\d]{4}e", re.IGNORECASE)


def _normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _extract_host(url: str) -> str:
    text = _normalize_text(url)
    if not text:
        return ""
    parsed = urlparse(text if "://" in text else f"https://{text}")
    return (parsed.netloc or "").lower().replace("www.", "")


def _contains_any(text: str, keywords: tuple[str, ...]) -> bool:
    lowered = text.lower()
    return any(keyword.lower() in lowered for keyword in keywords)


def clamp_confidence(value: Any, fallback: int = 2) -> int:
    try:
        numeric = int(float(value))
    except (TypeError, ValueError):
        numeric = fallback
    return max(1, min(5, numeric))


def is_estimated(*values: Any) -> bool:
    text = " ".join(_normalize_text(value) for value in values if value is not None)
    return bool(text and ESTIMATED_PATTERN.search(text))


def classify_source(source_name: Any = "", source_url: Any = "", fallback_text: Any = "") -> Dict[str, str]:
    name = _normalize_text(source_name)
    url = _normalize_text(source_url)
    fallback = _normalize_text(fallback_text)
    joined = " ".join(part for part in (name, fallback, url) if part).strip()
    host = _extract_host(url)

    if host.endswith(OFFICIAL_DOMAINS) or _contains_any(joined, OFFICIAL_KEYWORDS):
        tier = "official"
    elif host.endswith(AUTHORITATIVE_DOMAINS) or _contains_any(joined, AUTHORITATIVE_KEYWORDS):
        tier = "authoritative"
    elif host.endswith(COMMUNITY_DOMAINS):
        tier = "secondary"
    elif host.endswith(SECONDARY_DOMAINS) or _contains_any(joined, SECONDARY_KEYWORDS):
        tier = "secondary"
    else:
        tier = "unknown"

    return {
        "source_tier": tier,
        "source_tier_label": SOURCE_LABELS[tier],
        "source_host": host,
    }


def infer_data_point_confidence(
    source_tier: str,
    estimated: bool,
    source_name: Any = "",
    source_url: Any = "",
    current_value: Any = None,
) -> int:
    base_map = {
        "official": 5,
        "authoritative": 4,
        "secondary": 3,
        "unknown": 2,
    }
    confidence = base_map.get(source_tier, 2)

    if not _normalize_text(source_name) and not _normalize_text(source_url):
        confidence = min(confidence, 1)
    elif not _normalize_text(source_url):
        confidence = min(confidence, 3)

    if current_value in ("", None):
        confidence = min(confidence, 2)

    if estimated:
        confidence -= 1

    return max(1, min(5, confidence))


def infer_relationship_tier(rel: Dict[str, Any], confidence: int) -> str:
    source_name = _normalize_text(rel.get("source_name"))
    source_url = _normalize_text(rel.get("source_url"))
    fallback_text = " ".join(
        _normalize_text(rel.get(key))
        for key in ("notes", "product", "evidence", "relationship_type")
    )
    classified = classify_source(source_name, source_url, fallback_text)
    if classified["source_tier"] != "unknown":
        return classified["source_tier"]
    if confidence >= 5:
        return "authoritative"
    return "secondary"


def enrich_data_point(point: Dict[str, Any]) -> Dict[str, Any]:
    source_name = point.get("source_name", "")
    source_url = point.get("source_url", "")
    estimated = is_estimated(source_name, source_url, point.get("name"))
    classified = classify_source(source_name, source_url, point.get("name"))
    confidence = infer_data_point_confidence(
        classified["source_tier"],
        estimated,
        source_name=source_name,
        source_url=source_url,
        current_value=point.get("current_value"),
    )

    enriched = dict(point)
    enriched.update(classified)
    enriched["estimated"] = estimated
    enriched["source_confidence"] = confidence
    enriched["source_confidence_label"] = CONFIDENCE_LABELS[confidence]
    return enriched


def enrich_relationship(rel: Dict[str, Any]) -> Dict[str, Any]:
    confidence = clamp_confidence(rel.get("confidence"), fallback=2)
    estimated = is_estimated(rel.get("notes"), rel.get("product"), rel.get("source_name"))
    source_name = rel.get("source_name", "")
    source_url = rel.get("source_url", "")
    source_tier = infer_relationship_tier(rel, confidence)
    classified = classify_source(source_name, source_url, rel.get("notes"))
    if classified["source_tier"] == "unknown":
        classified["source_tier"] = source_tier
        classified["source_tier_label"] = SOURCE_LABELS[source_tier]

    enriched = dict(rel)
    enriched.update(classified)
    enriched["estimated"] = estimated
    enriched["source_confidence"] = confidence
    enriched["source_confidence_label"] = CONFIDENCE_LABELS[confidence]
    enriched["confidence"] = confidence
    return enriched
