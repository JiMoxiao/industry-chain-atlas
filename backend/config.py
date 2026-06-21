from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
WEB_DATA_DIR = PROJECT_ROOT / "web" / "src" / "data"
HEAT_CACHE_PATH = DATA_DIR / "market_heat.json"
SNAPSHOT_DIR = DATA_DIR / "capacity_snapshots"

BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 8001

HEAT_REFRESH_CRON = {"hour": "9,12,15", "minute": 30}
FULL_REFRESH_CRON = {"hour": 20, "minute": 0}
