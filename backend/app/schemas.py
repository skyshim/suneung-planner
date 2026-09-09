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
    sort_order: int = 0
    origin_date: Optional[date] = None
    carried: int = 0


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
    sort_order: Optional[int] = None


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


class BulkItem(BaseModel):
    id: int
    done: Optional[bool] = None
    actual_min: Optional[int] = None
    count_actual: Optional[int] = None


class BulkSave(BaseModel):
    items: list[BulkItem]


class CarryReq(BaseModel):
    ids: Optional[list[int]] = None
    to: Optional[date] = None


class ImportPayload(BaseModel):
    version: Optional[int] = 1
    tasks: list[dict]
