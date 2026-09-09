"""DB가 비어 있으면 Notion에서 내려받은 471행 계획을 그대로 시딩한다."""
import json
from datetime import date
from pathlib import Path

from sqlalchemy import select, func

from .db import SessionLocal
from .models import Task

DATA_DIR = Path(__file__).parent / "data"
SEED_FILE = DATA_DIR / "seed_plan.json"
MASTER_FILE = DATA_DIR / "item_master.json"

_master_cache = None


def master() -> dict:
    global _master_cache
    if _master_cache is None:
        _master_cache = json.loads(MASTER_FILE.read_text(encoding="utf-8"))
    return _master_cache


def exam_date() -> date:
    return date.fromisoformat(master()["exam_date"])


def seed_if_empty() -> int:
    db = SessionLocal()
    try:
        count = db.scalar(select(func.count()).select_from(Task)) or 0
        if count:
            return 0
        rows = json.loads(SEED_FILE.read_text(encoding="utf-8"))
        db.add_all(
            Task(
                date=date.fromisoformat(r["date"]),
                title=r["title"],
                subject=r.get("subject"),
                item=r.get("item"),
                type=r.get("type"),
                plan_min=r.get("plan_min"),
                goal_min=r.get("goal_min"),
                count_unit=r.get("count_unit"),
                sort_order=r.get("sort_order", 0),
                done=False,
            )
            for r in rows
        )
        db.commit()
        return len(rows)
    finally:
        db.close()
