"""DB가 비어 있으면 Notion에서 내려받은 471행 계획을 그대로 시딩한다."""
import json
from datetime import date
from pathlib import Path

from sqlalchemy import select, func

from .db import SessionLocal
from .models import Meta, Task

DATA_DIR = Path(__file__).parent / "data"
SEED_FILE = DATA_DIR / "seed_plan.json"
MASTER_FILE = DATA_DIR / "item_master.json"
QUOTES_FILE = DATA_DIR / "quotes.json"

_master_cache = None
_quotes_cache = None


def master() -> dict:
    global _master_cache
    if _master_cache is None:
        _master_cache = json.loads(MASTER_FILE.read_text(encoding="utf-8"))
    return _master_cache


def quotes() -> list[dict]:
    global _quotes_cache
    if _quotes_cache is None:
        _quotes_cache = json.loads(QUOTES_FILE.read_text(encoding="utf-8"))["quotes"]
    return _quotes_cache


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


SORT_FLAG = "sort_order_normalized_v1"


def normalize_sort_order() -> int:
    """기존 데이터의 sort_order 를 화면 표시 순서(과목 순 → 분량 많은 순)로 한 번 정규화한다.

    수동 순서 변경 기능이 생기기 전에는 조회할 때마다 정렬했기 때문에 sort_order 값이
    노션에서 가져온 임의의 순서로 남아 있다. 한 번만 다시 매겨두면 화면은 그대로면서
    사용자가 바꾼 순서가 유지된다.
    """
    db = SessionLocal()
    try:
        if db.get(Meta, SORT_FLAG):
            return 0
        order = master()["subject_order"]
        rows = db.scalars(select(Task)).all()
        byday: dict = {}
        for t in rows:
            byday.setdefault(t.date, []).append(t)
        n = 0
        for _, group in byday.items():
            group.sort(
                key=lambda t: (
                    order.index(t.subject) if t.subject in order else 99,
                    -(t.plan_min or 0),
                    t.id,
                )
            )
            for i, t in enumerate(group):
                t.sort_order = i
                n += 1
        db.add(Meta(key=SORT_FLAG, value="1"))
        db.commit()
        return n
    finally:
        db.close()
