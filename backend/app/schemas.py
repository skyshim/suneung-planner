from datetime import date
from typing import Optional

from pydantic import BaseModel, ConfigDict


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    title: str
    subject: Optional[str] = None
    item: Optional[str] = None
    type: Optional[str] = None
    plan_min: Optional[int] = None
    goal_min: Optional[int] = None
    actual_min: Optional[int] = None
    count_plan: Optional[int] = None
    count_actual: Optional[int] = None
    count_unit: Optional[str] = None
    done: bool = False
    extra: bool = False
    slots: Optional[str] = None
    sort_order: int = 0
    origin_date: Optional[date] = None
    carried: int = 0
    skipped: bool = False


class TaskPatch(BaseModel):
    date: Optional[date] = None
    title: Optional[str] = None
    subject: Optional[str] = None
    item: Optional[str] = None
    type: Optional[str] = None
    plan_min: Optional[int] = None
    goal_min: Optional[int] = None
    actual_min: Optional[int] = None
    count_plan: Optional[int] = None
    count_actual: Optional[int] = None
    count_unit: Optional[str] = None
    done: Optional[bool] = None
    extra: Optional[bool] = None
    sort_order: Optional[int] = None
    skipped: Optional[bool] = None


class TaskCreate(BaseModel):
    date: date
    item: Optional[str] = None
    title: Optional[str] = None
    subject: Optional[str] = None
    type: Optional[str] = None
    plan_min: Optional[int] = None
    goal_min: Optional[int] = None
    count_plan: Optional[int] = None
    count_unit: Optional[str] = None
    actual_min: Optional[int] = None
    count_actual: Optional[int] = None
    done: bool = False
    extra: bool = False


class BulkItem(BaseModel):
    id: int
    done: Optional[bool] = None
    actual_min: Optional[int] = None
    count_actual: Optional[int] = None


class BulkSave(BaseModel):
    items: list[BulkItem]


class ReorderReq(BaseModel):
    ids: list[int]


class CarryReq(BaseModel):
    ids: Optional[list[int]] = None
    to: Optional[date] = None


class SkipReq(BaseModel):
    """밀린 항목을 '그날 못 한 것'으로 확정하거나(True) 되돌린다(False)."""

    ids: list[int]
    value: bool = True


class ImportPayload(BaseModel):
    version: Optional[int] = 1
    tasks: list[dict]
    items: Optional[list[dict]] = None  # v2 부터: 항목 설정·직접 만든 항목


class ItemCreate(BaseModel):
    """앱에서 새 항목을 등록한다. 등록된 항목은 기존 항목과 똑같이 색·진행률·상한이 잡힌다."""

    name: str
    subject: str
    type: str = "고정세트"
    minutes: Optional[int] = None
    cap: Optional[int] = None
    unit: str = "회"
    progress_by: str = "count"
    unit_goal: Optional[int] = None
    note: Optional[str] = None


class RepeatCreate(BaseModel):
    """기간 + 패턴으로 한 항목을 여러 날에 한 번에 넣는다.

    weekdays 는 JS 규칙(0=일 … 6=토). preview=True 면 저장하지 않고 날짜만 계산한다.
    """

    item: str
    start: date
    end: date
    mode: str = "daily"  # daily | weekdays | every
    weekdays: list[int] = []
    every: int = 1
    plan_min: Optional[int] = None
    count_plan: Optional[int] = None
    skip_existing: bool = True
    preview: bool = False


class ItemClear(BaseModel):
    """이 항목의 남은 일정(기록 없는 미완료)을 from_date 이후로 지운다."""

    from_date: Optional[date] = None


class ItemEdit(BaseModel):
    """항목 마스터 일괄 수정. scope 로 기존 항목에 어디까지 적용할지 정한다."""

    minutes: Optional[int] = None
    cap: Optional[int] = None
    scope: str = "future"  # future | all | none
    progress_by: Optional[str] = None  # count | unit | minutes
    unit_goal: Optional[int] = None
    unit: Optional[str] = None  # 회 / 지문 / 문제 / 강 / 페이지 …


class SlotPaint(BaseModel):
    """타임테이블에서 칸을 칠하거나 지운다."""

    task_id: Optional[int] = None  # None + mode=remove 이면 지우개(누구 칸이든 지움)
    slots: list[int]
    mode: str = "add"  # add | remove
