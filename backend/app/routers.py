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
    ItemEdit,
    ReorderReq,
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
            it["edited"] = True
        out.append(it)
    return out


def _master_index(db: Session | None = None) -> dict:
    if db is None:
        return {i["name"]: i for i in master()["items"]}
    return {i["name"]: i for i in effective_items(db)}


def dday(d: date) -> int:
    return (exam_date() - d).days


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
    overdue_rows = db.scalars(
        select(Task).where(Task.date < d, Task.done.is_(False)).order_by(Task.date, Task.sort_order)
    ).all()

    prog = _item_progress(db)
    return {
        "date": d.isoformat(),
        "weekday": WD[d.weekday()],
        "dday": dday(d),
        "tasks": [_serialize(t) for t in today_rows],
        "overdue": [_serialize(t) for t in overdue_rows],
        "item_progress": prog,
        "plan_min_total": sum(t.plan_min or 0 for t in today_rows if not t.extra),
        "extra_min_total": sum(t.actual_min or 0 for t in today_rows if t.extra),
        "actual_min_total": sum(t.actual_min or 0 for t in today_rows),
        "done_count": sum(1 for t in today_rows if t.done),
    }


@router.get("/range")
def get_range(start: date, end: date, db: Session = Depends(get_db)):
    rows = db.execute(
        select(
            Task.date,
            func.count(Task.id),
            func.sum(case((Task.extra.is_(True), 0), else_=func.coalesce(Task.plan_min, 0))),
            func.sum(func.coalesce(Task.actual_min, 0)),
        ).where(Task.date >= start, Task.date <= end).group_by(Task.date)
    ).all()
    done = dict(
        db.execute(
            select(Task.date, func.count(Task.id))
            .where(Task.date >= start, Task.date <= end, Task.done.is_(True))
            .group_by(Task.date)
        ).all()
    )
    return {
        "days": [
            {
                "date": d.isoformat(),
                "count": int(c),
                "done": int(done.get(d, 0)),
                "plan_min": int(p or 0),
                "actual_min": int(a or 0),
                "dday": dday(d),
            }
            for d, c, p, a in rows
        ]
    }


@router.patch("/tasks/{task_id}")
def patch_task(task_id: int, body: TaskPatch, db: Session = Depends(get_db)):
    t = db.get(Task, task_id)
    if not t:
        raise HTTPException(404, "task not found")
    for k, v in body.model_dump(exclude_unset=True).items():
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
        for k, v in i.model_dump(exclude_unset=True, exclude={"id"}).items():
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
        label = f"{target.month}/{target.day}({WD[target.weekday()]})"
        name = t.item or (t.title.split(") ", 1)[-1] if ") " in t.title else t.title)
        t.title = f"{label} {name}"
        moved += 1
    db.commit()
    return {"moved": moved}


@router.get("/export")
def export_all(db: Session = Depends(get_db)):
    """전체 데이터 백업(JSON). Render 무료 DB는 30일 후 만료되므로 주기적으로 내려받아 둘 것."""
    rows = db.scalars(select(Task).order_by(Task.date, Task.sort_order, Task.id)).all()
    return {
        "version": 1,
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
                "sort_order": t.sort_order,
                "origin_date": t.origin_date.isoformat() if t.origin_date else None,
                "carried": t.carried,
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
                sort_order=r.get("sort_order") or 0,
                origin_date=date.fromisoformat(r["origin_date"]) if r.get("origin_date") else None,
                carried=r.get("carried") or 0,
            )
        )
    db.commit()
    return {"restored": len(body.tasks)}


@router.patch("/items/{name}")
def edit_item(name: str, body: ItemEdit, db: Session = Depends(get_db)):
    """항목의 회당 분량·상한을 바꾸고, scope 에 따라 기존 항목에도 일괄 적용한다.

    scope: future = 오늘 이후 항목만, all = 전체, none = 마스터 값만 변경.
    """
    base = {i["name"]: i for i in master()["items"]}
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
        "changed": changed,
    }


@router.get("/stats/items")
def stats_items(db: Session = Depends(get_db)):
    prog = _item_progress(db)
    order = master()["subject_order"]
    rows = sorted(
        prog.values(),
        key=lambda r: (order.index(r["subject"]) if r["subject"] in order else 99, -(r["cap"] or 0)),
    )
    return {"items": rows}


@router.get("/stats/subjects")
def stats_subjects(db: Session = Depends(get_db)):
    rows = db.execute(
        select(
            Task.subject,
            Task.date,
            func.sum(case((Task.extra.is_(True), 0), else_=func.coalesce(Task.plan_min, 0))),
            func.sum(func.coalesce(Task.actual_min, 0)),
        ).group_by(Task.subject, Task.date).order_by(Task.date)
    ).all()
    byday: dict[str, list] = defaultdict(list)
    totals: dict[str, dict] = defaultdict(lambda: {"plan_min": 0, "actual_min": 0})
    for subj, d, p, a in rows:
        subj = subj or "기타"
        byday[subj].append({"date": d.isoformat(), "plan_min": int(p or 0), "actual_min": int(a or 0)})
        totals[subj]["plan_min"] += int(p or 0)
        totals[subj]["actual_min"] += int(a or 0)
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
