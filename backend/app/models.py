from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    subject: Mapped[str | None] = mapped_column(String(16), nullable=True)
    item: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    type: Mapped[str | None] = mapped_column(String(16), nullable=True)
    plan_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goal_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actual_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    count_plan: Mapped[int | None] = mapped_column(Integer, nullable=True)
    count_actual: Mapped[int | None] = mapped_column(Integer, nullable=True)
    count_unit: Mapped[str | None] = mapped_column(String(16), nullable=True)
    done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    extra: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    origin_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    carried: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Meta(Base):
    __tablename__ = "meta"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text)


class ItemOverride(Base):
    """항목 마스터(JSON)를 사용자가 앱에서 수정한 값. 파일 대신 DB에 남긴다.

    Render 는 배포할 때마다 파일시스템이 초기화되므로, 마스터 JSON 은 기본값으로만 쓰고
    사용자가 바꾼 값은 여기에 쌓아 읽을 때 덮어씌운다.
    """

    __tablename__ = "item_overrides"

    item: Mapped[str] = mapped_column(String(64), primary_key=True)
    minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    goal_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
