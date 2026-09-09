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
    origin_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    carried: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Meta(Base):
    __tablename__ = "meta"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
