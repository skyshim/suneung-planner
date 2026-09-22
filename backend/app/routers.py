from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import ItemOverride, Meta, Task
from .schemas import (
    BulkSave,
    CarryReq,
    ImportPayload,
    ItemClear,
    ItemCreate,
    ItemEdit,
    ReorderReq,
    RepeatCreate,
    SkipReq,
    SlotPaint,
    TaskCreate,
    TaskOut,
    TaskPatch,
)
from .seed import exam_date, master, quotes

router = APIRouter(prefix="/api")

WD = ["월", "화", "수", "목", "금", "토", "일"]


def effective_items(db: Session) -> list[dict]:
    """마스터 JSON 에 사용자가 앱에서 바꾼 값(DB)을 덮어씌운 항목 목록."""
    ov = {o.item: o for o in db.scalars(select(ItemOverride)).all()}
    out = []
    for i in master()["items"]:
        it = dict(i)
        o = ov.get(it["name"])
        if o:
            if o.minutes is not None:
                it["minutes"] = o.minutes
            if o.cap is not None:
                it["cap"] = o.cap
            if o.goal_min is not None:
                it["goal"] = o.goal_min
            if o.progress_by:
                it["progress_by"] = o.progress_by
            if o.unit_goal is not None:
                it["unit_goal"] = o.unit_goal
            if o.unit:
                it["unit"] = o.unit
            it["edited"] = True
        out.append(it)
    # 앱에서 직접 만든 항목
    names = {i["name"] for i in out}
    for o in ov.values():
        if not o.custom or o.item in names:
            continue
        out.append(_custom_item_dict(o))
    return out


def _custom_item_dict(o: ItemOverride) -> dict:
    return {
        "name": o.item,
        "subject": o.subject or "전과목",
        "type": o.type or "고정세트",
        "minutes": o.minutes,
        "goal": o.goal_min,
        "cap": o.cap,
        "unit": o.unit or "회",
        "progress_by": o.progress_by or "count",
        "unit_goal": o.unit_goal,
        "note": o.note or "",
        "custom": True,
    }


def _master_index(db: Session | None = None) -> dict:
    if db is None:
        return {i["name"]: i for i in master()["items"]}
    return {i["name"]: i for i in effective_items(db)}


def dday(d: date) -> int:
    return (exam_date() - d).days


def _relabel(t: Task, d: date) -> None:
    """제목 앞의 날짜 표기를 옮겨간 날짜에 맞춰 다시 쓴다."""
    label = f"{d.month}/{d.day}({WD[d.weekday()]})"
    name = t.item or (t.title.split(") ", 1)[-1] if ") " in t.title else t.title)
    t.title = f"{label} {name}"


def _item_progress(db: Session) -> dict:
    """항목별 누적 진행(완료 횟수 / 실제 분 / 카운트실제 합) + 마스터 상한."""
    mi = _master_index(db)
    rows = db.execute(
        select(
            Task.item,
            func.count(Task.id),
            func.sum(func.coalesce(Task.plan_min, 0)),
            func.sum(func.coalesce(Task.actual_min, 0)),
            func.sum(func.coalesce(Task.count_actual, 0)),
        ).where(Task.item.isnot(None)).group_by(Task.item)
    ).all()
    done_rows = dict(
        db.execute(
            select(Task.item, func.count(Task.id))
            .where(Task.item.isnot(None), Task.done.is_(True))
            .group_by(Task.item)
        ).all()
    )
    out = {}
    for item, planned_cnt, plan_sum, actual_sum, cnt_sum in rows:
        m = mi.get(item, {})
        cap = m.get("cap")
        done_cnt = int(done_rows.get(item, 0))
        mode = m.get("progress_by") or "count"
        unit_goal = m.get("unit_goal")
        goal_min = m.get("goal")

        if mode == "unit" and unit_goal:
            num, den = int(cnt_sum or 0), unit_goal
        elif mode == "minutes" and goal_min:
            num, den = int(actual_sum or 0), goal_min
        else:
            mode = "count"
            num, den = done_cnt, (cap or planned_cnt or 1)

        out[item] = {
            "item": item,
            "subject": m.get("subject"),
            "type": m.get("type"),
            "unit": m.get("unit"),
            "next": m.get("next"),
            "pair": m.get("pair"),
            "note": m.get("note", ""),
            "cap": cap,
            "planned_count": int(planned_cnt),
            "done_count": done_cnt,
            "progress_by": mode,
            "unit_goal": unit_goal,
            "progress_num": num,
            "progress_den": den,
            "ratio": round(num / den, 4) if den else 0.0,
            "plan_min": int(plan_sum or 0),
            "actual_min": int(actual_sum or 0),
            "goal_min": m.get("goal"),
            "count_actual": int(cnt_sum or 0),
            "reached": bool(cap and done_cnt >= cap),
            "near_cap": bool(cap and done_cnt / cap >= 0.9),
        }
    return out


@router.get("/meta")
def get_meta(db: Session = Depends(get_db)):
    m = master()
    today = date.today()
    total = db.scalar(select(func.count()).select_from(Task)) or 0
    return {
        "exam_date": m["exam_date"],
        "plan_start": m["plan_start"],
        "today": today.isoformat(),
        "dday": dday(today),
        "subject_order": m["subject_order"],
        "rules": m["rules"],
        "mindset": m["mindset"],
        "items": effective_items(db),
        "banner": m.get("banner"),
        "quotes": quotes(),
        "task_count": total,
    }


def _serialize(t: Task) -> dict:
    d = TaskOut.model_validate(t).model_dump()
    d["dday"] = dday(t.date)
    d["weekday"] = WD[t.date.weekday()]
    return d


@router.get("/day/{d}")
def get_day(d: date, db: Session = Depends(get_db)):
    today_rows = db.scalars(
        select(Task).where(Task.date == d).order_by(Task.sort_order, Task.id)
    ).all()
    # '그날 못 한 것'으로 확정(skipped)한 항목은 밀린 것 목록에 더는 따라오지 않는다.
    overdue_rows = db.scalars(
        select(Task)
        .where(
            Task.date < d,
            Task.done.is_(False),
            func.coalesce(Task.skipped, False).is_(False),
        )
        .order_by(Task.date, Task.sort_order)
    ).all()

    # 이 날 하기로 했다가 다른 날로 미룬 항목. 행을 복제하지 않고 읽을 때만 찾아서
    # 흐린 자국으로 보여준다. 캘린더가 origin_date 로 집계하는 것과 같은 기준이라
    # '그날 화면'과 '캘린더'의 개수·계획 시간이 항상 맞는다.
    moved_rows = db.scalars(
        select(Task)
        .where(Task.origin_date == d, Task.date != d)
        .order_by(Task.sort_order, Task.id)
    ).all()

    prog = _item_progress(db)
    planned = [t for t in today_rows if not t.extra] + list(moved_rows)
    return {
        "date": d.isoformat(),
        "weekday": WD[d.weekday()],
        "dday": dday(d),
        "tasks": [_serialize(t) for t in today_rows],
        "overdue": [_serialize(t) for t in overdue_rows],
        "moved_away": [_serialize(t) for t in moved_rows],
        "item_progress": prog,
        "plan_min_total": sum(t.plan_min or 0 for t in planned),
        "extra_min_total": sum(t.actual_min or 0 for t in today_rows if t.extra),
        "actual_min_total": sum(t.actual_min or 0 for t in today_rows),
        "done_count": sum(1 for t in today_rows if t.done),
        # 그날 하기로 했던 항목 수(미룬 것 포함). 캘린더의 분모와 같은 값.
        "planned_count": len(today_rows) + len(moved_rows),
    }


@router.get("/range")
def get_range(start: date, end: date, db: Session = Depends(get_db)):
    """캘린더용 날짜별 요약.

    '하기로 했던 것'(항목 수·계획 시간·완료 수)은 이월 전 원래 날짜로 집계하고,
    '실제로 공부한 시간'만 실제 수행한 날짜로 집계한다. 그래야 미룬 날의 계획이
    비어 보이지 않고, 공부한 시간은 실제로 한 날에 남는다.
    """
    plan_day = func.coalesce(Task.origin_date, Task.date)

    plan_rows = db.execute(
        select(
            plan_day.label("d"),
            func.count(Task.id),
            func.sum(case((Task.extra.is_(True), 0), else_=func.coalesce(Task.plan_min, 0))),
        )
        .where(plan_day >= start, plan_day <= end)
        .group_by(plan_day)
    ).all()

    # 완료 개수는 '그날 계획된 것 중 그날 안에 해낸 것'만 센다.
    # 다른 날로 미룬 항목(carried > 0)은 나중에 끝냈더라도 원래 날짜에서는 못 한 것으로 둔다.
    done = dict(
        db.execute(
            select(plan_day.label("d"), func.count(Task.id))
            .where(plan_day >= start, plan_day <= end, Task.done.is_(True), Task.carried == 0)
            .group_by(plan_day)
        ).all()
    )

    actual = dict(
        db.execute(
            select(Task.date, func.sum(func.coalesce(Task.actual_min, 0)))
            .where(Task.date >= start, Task.date <= end)
            .group_by(Task.date)
        ).all()
    )

    # 두 기준의 날짜를 합집합으로 모은다(계획만 있는 날, 실적만 있는 날 모두 나오도록).
    by_day: dict[date, dict] = {}
    for d, c, p in plan_rows:
        by_day[d] = {"count": int(c), "plan_min": int(p or 0)}
    for d in actual:
        by_day.setdefault(d, {"count": 0, "plan_min": 0})

    return {
        "days": [
            {
                "date": d.isoformat(),
                "count": v["count"],
                "done": int(done.get(d, 0)),
                "plan_min": v["plan_min"],
                "actual_min": int(actual.get(d, 0) or 0),
                "dday": dday(d),
            }
            for d, v in sorted(by_day.items())
        ]
    }


@router.patch("/tasks/{task_id}")
def patch_task(task_id: int, body: TaskPatch, db: Session = Depends(get_db)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "task not found")
    patch = body.model_dump(exclude_unset=True)
    # 완료로 체크하면 '그날 못 한 것' 확정은 자동으로 풀린다.
    if patch.get("done") is True:
        patch.setdefault("skipped", False)
    for k, v in patch.items():
        setattr(t, k, v)
    db.commit()
    db.refresh(t)
    return _serialize(t)


@router.post("/tasks")
def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    mi = _master_index(db)
    m = mi.get(body.item or "", {})
    label = f"{body.date.month}/{body.date.day}({WD[body.date.weekday()]})"
    name = body.item or body.title or "자유 항목"
    maxo = db.scalar(select(func.max(Task.sort_order)).where(Task.date == body.date)) or 0
    t = Task(
        date=body.date,
        title=body.title or f"{label} {name}",
        subject=body.subject or m.get("subject"),
        item=body.item,
        type=body.type or m.get("type") or "고정세트",
        plan_min=None if body.extra else (body.plan_min if body.plan_min is not None else m.get("minutes")),
        goal_min=None if body.extra else (body.goal_min if body.goal_min is not None else m.get("goal")),
        count_plan=body.count_plan,
        count_actual=body.count_actual,
        actual_min=body.actual_min,
        done=bool(body.done),
        count_unit=body.count_unit or m.get("unit"),
        extra=bool(body.extra),
        sort_order=maxo + 1,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return _serialize(t)


@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "task not found")
    db.delete(t)
    db.commit()
    return {"ok": True}


@router.post("/day/{d}/bulk")
def bulk_save(d: date, body: BulkSave, db: Session = Depends(get_db)):
    ids = [i.id for i in body.items]
    found = {t.id: t for t in db.scalars(select(Task).where(Task.id.in_(ids))).all()}
    for i in body.items:
        t = found.get(i.id)
        if not t:
            continue
        patch = i.model_dump(exclude_unset=True, exclude={"id"})
        if patch.get("done") is True:
            t.skipped = False
        for k, v in patch.items():
            setattr(t, k, v)
    db.commit()
    return get_day(d, db)


@router.post("/day/{d}/reorder")
def reorder_day(d: date, body: ReorderReq, db: Session = Depends(get_db)):
    """해당 날짜 항목들의 표시 순서를 통째로 다시 매긴다."""
    rows = {t.id: t for t in db.scalars(select(Task).where(Task.date == d)).all()}
    for i, tid in enumerate(body.ids):
        t = rows.get(tid)
        if t is not None:
            t.sort_order = i
    db.commit()
    return get_day(d, db)


SLOT_COUNT = 144  # 05:00 부터 10분 × 144 = 24시간


def _parse_slots(raw: str | None) -> set[int]:
    if not raw:
        return set()
    return {int(x) for x in raw.split(",") if x.strip().isdigit()}


def _write_slots(t: Task, slots: set[int]) -> None:
    """칸 목록을 저장하고, 실제(분)을 칸 수 × 10 으로 맞춘다."""
    t.slots = ",".join(str(x) for x in sorted(slots)) if slots else None
    t.actual_min = len(slots) * 10 if slots else None


@router.post("/day/{d}/slots")
def paint_slots(d: date, body: SlotPaint, db: Session = Depends(get_db)):
    """타임테이블에서 칸을 칠하거나 지운다.

    한 칸은 한 항목만 가질 수 있으므로, 칠할 때 다른 항목이 쥐고 있던 칸은 빼앗는다.
    칸을 바꾼 항목은 실제(분)이 칸 수 × 10 으로 다시 계산된다.
    """
    if body.mode not in ("add", "remove"):
        raise HTTPException(400, "mode must be add|remove")
    want = {x for x in body.slots if 0 <= x < SLOT_COUNT}
    if not want:
        return get_day(d, db)

    rows = db.scalars(select(Task).where(Task.date == d)).all()
    by_id = {t.id: t for t in rows}

    if body.mode == "remove" and body.task_id is None:
        # 지우개: 그 칸을 쥐고 있는 항목이 누구든 지운다
        for t in rows:
            cur = _parse_slots(t.slots)
            if cur & want:
                _write_slots(t, cur - want)
        db.commit()
        return get_day(d, db)

    target = by_id.get(body.task_id)
    if target is None:
        raise HTTPException(404, "task not found on this date")

    if body.mode == "remove":
        _write_slots(target, _parse_slots(target.slots) - want)
    else:
        for t in rows:
            if t.id == target.id:
                continue
            cur = _parse_slots(t.slots)
            if cur & want:
                _write_slots(t, cur - want)
        _write_slots(target, _parse_slots(target.slots) | want)
        if not target.done:
            target.done = True

    db.commit()
    return get_day(d, db)


@router.post("/carry")
def carry(body: CarryReq, db: Session = Depends(get_db)):
    """미완료 항목을 지정일(기본: 원래 날짜 +1일)로 이월한다."""
    if body.ids:
        rows = db.scalars(select(Task).where(Task.id.in_(body.ids))).all()
    else:
        rows = db.scalars(
            select(Task).where(Task.date < date.today(), Task.done.is_(False))
        ).all()
    moved = 0
    for t in rows:
        if t.done:
            continue
        target = body.to or (t.date + timedelta(days=1))
        if target == t.date:
            continue
        if t.origin_date is None:
            t.origin_date = t.date
        t.date = target
        t.carried = (t.carried or 0) + 1
        _write_slots(t, set())
        _relabel(t, target)
        moved += 1
    db.commit()
    return {"moved": moved}


@router.post("/skip")
def skip(body: SkipReq, db: Session = Depends(get_db)):
    """밀린 항목을 '그날 못 한 것'으로 확정한다(또는 확정을 취소한다).

    확정하면 이월도 함께 되돌려 원래 계획 날짜에 미완으로 남긴다. 그래야 캘린더·항목별
    현황이 '원래 하기로 한 날 못 했다'로 읽히고, '밀린 것' 목록에서도 사라진다.
    """
    if not body.ids:
        raise HTTPException(400, "ids is required")
    rows = db.scalars(select(Task).where(Task.id.in_(body.ids))).all()
    n = 0
    for t in rows:
        if body.value:
            if t.done:
                continue
            if t.origin_date and t.origin_date != t.date:
                t.date = t.origin_date
                t.carried = 0
                _write_slots(t, set())
                _relabel(t, t.date)
            t.origin_date = None
            t.skipped = True
        else:
            t.skipped = False
        n += 1
    db.commit()
    return {"changed": n}


@router.post("/uncarry")
def uncarry(body: CarryReq, db: Session = Depends(get_db)):
    """이월을 취소하고 원래 날짜로 되돌린다. 그날 못 한 것으로 기록이 남는다."""
    if not body.ids:
        raise HTTPException(400, "ids is required")
    rows = db.scalars(select(Task).where(Task.id.in_(body.ids))).all()
    moved = 0
    for t in rows:
        if not t.origin_date or t.origin_date == t.date:
            continue
        t.date = t.origin_date
        t.origin_date = None
        t.carried = 0
        _relabel(t, t.date)
        moved += 1
    db.commit()
    return {"moved": moved}


@router.get("/export")
def export_all(db: Session = Depends(get_db)):
    """전체 데이터 백업(JSON). Render 무료 DB는 30일 후 만료되므로 주기적으로 내려받아 둘 것."""
    rows = db.scalars(select(Task).order_by(Task.date, Task.sort_order, Task.id)).all()
    overrides = db.scalars(select(ItemOverride)).all()
    return {
        "version": 2,
        "items": [
            {
                "item": o.item, "minutes": o.minutes, "cap": o.cap, "goal_min": o.goal_min,
                "progress_by": o.progress_by, "unit_goal": o.unit_goal, "unit": o.unit,
                "custom": bool(o.custom), "subject": o.subject, "type": o.type, "note": o.note,
            }
            for o in overrides
        ],
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "exam_date": master()["exam_date"],
        "count": len(rows),
        "tasks": [
            {
                "date": t.date.isoformat(),
                "title": t.title,
                "subject": t.subject,
                "item": t.item,
                "type": t.type,
                "plan_min": t.plan_min,
                "goal_min": t.goal_min,
                "actual_min": t.actual_min,
                "count_plan": t.count_plan,
                "count_actual": t.count_actual,
                "count_unit": t.count_unit,
                "done": t.done,
                "extra": t.extra,
                "slots": t.slots,
                "sort_order": t.sort_order,
                "origin_date": t.origin_date.isoformat() if t.origin_date else None,
                "carried": t.carried,
                "skipped": bool(t.skipped),
            }
            for t in rows
        ],
    }


@router.post("/import")
def import_all(body: ImportPayload, db: Session = Depends(get_db)):
    """백업 JSON으로 전체 복원(기존 데이터는 모두 대체)."""
    if not body.tasks:
        raise HTTPException(400, "tasks is empty")
    db.query(Task).delete()
    if body.items is not None:
        db.query(ItemOverride).delete()
        for r in body.items:
            if not r.get("item"):
                continue
            db.add(
                ItemOverride(
                    item=r["item"], minutes=r.get("minutes"), cap=r.get("cap"),
                    goal_min=r.get("goal_min"), progress_by=r.get("progress_by"),
                    unit_goal=r.get("unit_goal"), unit=r.get("unit"),
                    custom=bool(r.get("custom")), subject=r.get("subject"),
                    type=r.get("type"), note=r.get("note"),
                )
            )
    for r in body.tasks:
        db.add(
            Task(
                date=date.fromisoformat(r["date"]),
                title=r.get("title") or "",
                subject=r.get("subject"),
                item=r.get("item"),
                type=r.get("type"),
                plan_min=r.get("plan_min"),
                goal_min=r.get("goal_min"),
                actual_min=r.get("actual_min"),
                count_plan=r.get("count_plan"),
                count_actual=r.get("count_actual"),
                count_unit=r.get("count_unit"),
                done=bool(r.get("done")),
                extra=bool(r.get("extra")),
                slots=r.get("slots"),
                sort_order=r.get("sort_order") or 0,
                origin_date=date.fromisoformat(r["origin_date"]) if r.get("origin_date") else None,
                carried=r.get("carried") or 0,
                skipped=bool(r.get("skipped")),
            )
        )
    db.commit()
    return {"restored": len(body.tasks)}


@router.patch("/items/{name}")
def edit_item(name: str, body: ItemEdit, db: Session = Depends(get_db)):
    """항목의 회당 분량·상한을 바꾸고, scope 에 따라 기존 항목에도 일괄 적용한다.

    scope: future = 오늘 이후 항목만, all = 전체, none = 마스터 값만 변경.
    """
    base = _master_index(db)  # 마스터 + 직접 만든 항목
    if name not in base:
        raise HTTPException(404, "unknown item")
    if body.scope not in ("future", "all", "none"):
        raise HTTPException(400, "scope must be future|all|none")

    o = db.get(ItemOverride, name)
    prev_minutes = (o.minutes if o and o.minutes is not None else base[name].get("minutes"))
    if o is None:
        o = ItemOverride(item=name)
        db.add(o)
    if body.minutes is not None:
        o.minutes = body.minutes
    if body.cap is not None:
        o.cap = body.cap
    if body.progress_by is not None:
        if body.progress_by not in ("count", "unit", "minutes"):
            raise HTTPException(400, "progress_by must be count|unit|minutes")
        o.progress_by = body.progress_by
    if body.unit_goal is not None:
        o.unit_goal = body.unit_goal
    if body.unit is not None:
        o.unit = body.unit.strip() or None

    minutes = o.minutes if o.minutes is not None else base[name].get("minutes")
    cap = o.cap if o.cap is not None else base[name].get("cap")
    o.goal_min = (cap * minutes) if (cap and minutes) else base[name].get("goal")

    # 회당 분량이 실제로 바뀐 경우에만 기존 항목을 다시 쓴다.
    # (진행률 기준만 바꾸려고 버튼을 눌렀을 때 계획값이 덮이는 것을 막는다)
    changed = 0
    if body.scope != "none" and minutes is not None and minutes != prev_minutes:
        q = select(Task).where(Task.item == name)
        if body.scope == "future":
            q = q.where(Task.date >= date.today())
        for t in db.scalars(q).all():
            t.plan_min = minutes
            t.goal_min = o.goal_min
            changed += 1

    db.commit()
    return {
        "item": name,
        "minutes": minutes,
        "cap": cap,
        "goal_min": o.goal_min,
        "progress_by": o.progress_by or "count",
        "unit_goal": o.unit_goal,
        "unit": o.unit,
        "changed": changed,
    }


def _repeat_dates(body: RepeatCreate) -> list[date]:
    if body.end < body.start:
        raise HTTPException(400, "end must be on or after start")
    if (body.end - body.start).days > 120:
        raise HTTPException(400, "range too long (max 120 days)")
    if body.mode not in ("daily", "weekdays", "every"):
        raise HTTPException(400, "mode must be daily|weekdays|every")
    step = max(1, int(body.every or 1))
    # JS(0=일) → Python(0=월)
    py_wd = {(w + 6) % 7 for w in body.weekdays if 0 <= w <= 6}
    if body.mode == "weekdays" and not py_wd:
        raise HTTPException(400, "pick at least one weekday")
    out, d, i = [], body.start, 0
    while d <= body.end:
        if body.mode == "daily" or (body.mode == "weekdays" and d.weekday() in py_wd) or (
            body.mode == "every" and i % step == 0
        ):
            out.append(d)
        d += timedelta(days=1)
        i += 1
    return out


@router.post("/items")
def create_item(body: ItemCreate, db: Session = Depends(get_db)):
    """새 항목 등록. 이후 항목별 현황·진행률·과목 색·과목별 통계에 기존 항목처럼 잡힌다."""
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "name is required")
    if name in _master_index(db):
        raise HTTPException(409, "이미 있는 항목 이름입니다")
    if body.subject not in master()["subject_order"]:
        raise HTTPException(400, "unknown subject")
    if body.progress_by not in ("count", "unit", "minutes"):
        raise HTTPException(400, "progress_by must be count|unit|minutes")
    o = db.get(ItemOverride, name) or ItemOverride(item=name)
    o.custom = True
    o.subject = body.subject
    o.type = (body.type or "고정세트").strip()
    o.minutes = body.minutes
    o.cap = body.cap
    o.unit = (body.unit or "회").strip()
    o.progress_by = body.progress_by
    o.unit_goal = body.unit_goal
    o.note = body.note
    o.goal_min = (body.cap * body.minutes) if (body.cap and body.minutes) else None
    db.add(o)
    db.commit()
    return _custom_item_dict(o)


@router.post("/tasks/repeat")
def create_repeat(body: RepeatCreate, db: Session = Depends(get_db)):
    """기간·패턴으로 한 항목을 여러 날짜에 추가한다. 같은 날 같은 항목이 이미 있으면 건너뛴다."""
    m = _master_index(db).get(body.item)
    if m is None:
        raise HTTPException(404, "unknown item — 먼저 항목을 등록하세요")
    dates = _repeat_dates(body)
    existing = set()
    if body.skip_existing and dates:
        existing = set(
            db.scalars(
                select(Task.date).where(
                    Task.item == body.item, Task.date >= dates[0], Task.date <= dates[-1]
                )
            ).all()
        )
    todo = [d for d in dates if d not in existing]
    minutes = body.plan_min if body.plan_min is not None else m.get("minutes")
    if body.preview:
        return {
            "dates": [d.isoformat() for d in todo],
            "skipped": [d.isoformat() for d in dates if d in existing],
            "plan_min_total": (minutes or 0) * len(todo),
        }
    maxo = dict(
        db.execute(
            select(Task.date, func.max(Task.sort_order))
            .where(Task.date.in_(todo))
            .group_by(Task.date)
        ).all()
    ) if todo else {}
    for d in todo:
        db.add(
            Task(
                date=d,
                title=f"{d.month}/{d.day}({WD[d.weekday()]}) {body.item}",
                subject=m.get("subject"),
                item=body.item,
                type=m.get("type") or "고정세트",
                plan_min=minutes,
                goal_min=m.get("goal"),
                count_plan=body.count_plan,
                count_unit=m.get("unit"),
                sort_order=(maxo.get(d) or 0) + 1,
            )
        )
    db.commit()
    return {
        "created": len(todo),
        "skipped": len(dates) - len(todo),
        "plan_min_total": (minutes or 0) * len(todo),
    }


@router.post("/items/{name}/clear")
def clear_item_tasks(name: str, body: ItemClear, db: Session = Depends(get_db)):
    """이 항목의 남은 일정을 지운다. 완료했거나 시간·카운트를 적은 기록은 건드리지 않는다."""
    start = body.from_date or date.today()
    rows = db.scalars(
        select(Task).where(Task.item == name, Task.date >= start, Task.done.is_(False))
    ).all()
    n = 0
    for t in rows:
        if t.actual_min or t.count_actual or t.slots:
            continue
        db.delete(t)
        n += 1
    db.commit()
    return {"deleted": n}


@router.delete("/items/{name}")
def delete_item(name: str, db: Session = Depends(get_db)):
    """직접 만든 항목을 지운다. 기록이 하나라도 있으면 지우지 않는다(통계가 깨지므로)."""
    o = db.get(ItemOverride, name)
    if o is None or not o.custom:
        raise HTTPException(400, "직접 만든 항목만 삭제할 수 있습니다")
    rows = db.scalars(select(Task).where(Task.item == name)).all()
    if any(t.done or t.actual_min or t.count_actual or t.slots for t in rows):
        raise HTTPException(409, "이미 기록이 있는 항목은 삭제할 수 없습니다. 남은 일정만 지우세요.")
    for t in rows:
        db.delete(t)
    db.delete(o)
    db.commit()
    return {"deleted_tasks": len(rows)}


@router.get("/stats/items")
def stats_items(db: Session = Depends(get_db)):
    prog = _item_progress(db)
    for it in effective_items(db):
        if it["name"] in prog or not it.get("custom"):
            continue
        prog[it["name"]] = {
            "item": it["name"], "subject": it["subject"], "type": it["type"], "unit": it["unit"],
            "next": None, "pair": None, "note": it.get("note", ""), "cap": it.get("cap"),
            "planned_count": 0, "done_count": 0, "progress_by": it.get("progress_by") or "count",
            "unit_goal": it.get("unit_goal"), "progress_num": 0, "progress_den": it.get("cap") or 0,
            "ratio": 0.0, "plan_min": 0, "actual_min": 0, "goal_min": it.get("goal"),
            "count_actual": 0, "reached": False, "near_cap": False,
        }
    mi = _master_index(db)
    for k, r in prog.items():
        r["custom"] = bool(mi.get(k, {}).get("custom"))
        r["remaining_future"] = 0
    fut = db.execute(
        select(Task.item, func.count(Task.id))
        .where(Task.item.isnot(None), Task.date >= date.today(), Task.done.is_(False))
        .group_by(Task.item)
    ).all()
    for k, c in fut:
        if k in prog:
            prog[k]["remaining_future"] = int(c)
    order = master()["subject_order"]
    rows = sorted(
        prog.values(),
        key=lambda r: (order.index(r["subject"]) if r["subject"] in order else 99, -(r["cap"] or 0)),
    )
    return {"items": rows}


@router.get("/stats/subjects")
def stats_subjects(db: Session = Depends(get_db)):
    # 캘린더와 같은 규칙: 계획은 이월 전 원래 날짜, 실제 시간은 공부한 날짜에 쌓는다.
    plan_day = func.coalesce(Task.origin_date, Task.date)

    plan_rows = db.execute(
        select(
            Task.subject,
            plan_day.label("d"),
            func.sum(case((Task.extra.is_(True), 0), else_=func.coalesce(Task.plan_min, 0))),
        ).group_by(Task.subject, plan_day)
    ).all()
    actual_rows = db.execute(
        select(
            Task.subject,
            Task.date,
            func.sum(func.coalesce(Task.actual_min, 0)),
        ).group_by(Task.subject, Task.date)
    ).all()

    merged: dict[str, dict] = defaultdict(dict)
    for subj, d, v in plan_rows:
        merged[subj or "기타"].setdefault(d, {"plan_min": 0, "actual_min": 0})["plan_min"] = int(v or 0)
    for subj, d, v in actual_rows:
        merged[subj or "기타"].setdefault(d, {"plan_min": 0, "actual_min": 0})["actual_min"] = int(v or 0)

    byday: dict[str, list] = defaultdict(list)
    totals: dict[str, dict] = defaultdict(lambda: {"plan_min": 0, "actual_min": 0})
    for subj, days in merged.items():
        for d in sorted(days):
            v = days[d]
            byday[subj].append({"date": d.isoformat(), **v})
            totals[subj]["plan_min"] += v["plan_min"]
            totals[subj]["actual_min"] += v["actual_min"]
    order = master()["subject_order"]
    keys = sorted(byday, key=lambda s: order.index(s) if s in order else 99)
    return {
        "subjects": [
            {
                "subject": s,
                "plan_min": totals[s]["plan_min"],
                "actual_min": totals[s]["actual_min"],
                "series": byday[s],
            }
            for s in keys
        ]
    }
