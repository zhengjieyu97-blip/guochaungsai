from __future__ import annotations

import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = Path(os.getenv("NEIGHBOR_CARE_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv(
    "NEIGHBOR_CARE_DATABASE_URL",
    f"sqlite:///{(DATA_DIR / 'neighbor_care.db').as_posix()}",
)
SESSION_SECRET = os.getenv(
    "NEIGHBOR_CARE_SESSION_SECRET",
    "neighbor-care-demo-secret-change-me",
)
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "NEIGHBOR_CARE_FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]
ENABLE_SCHEDULER = os.getenv("NEIGHBOR_CARE_ENABLE_SCHEDULER", "0") == "1"
