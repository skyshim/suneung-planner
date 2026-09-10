import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./planner.db")
# Render supplies postgres:// ; SQLAlchemy 2 wants postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, pool_pre_ping=True, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_columns() -> list[str]:
    """모델에는 있는데 실제 테이블에 없는 컬럼을 ALTER TABLE 로 채운다.

    이미 배포된 DB 에 컬럼을 추가할 때 쓴다. SQLite/PostgreSQL 둘 다 동작한다.
    """
    from sqlalchemy import inspect, text

    added: list[str] = []
    insp = inspect(engine)
    wanted = {
        "tasks": {"extra": "BOOLEAN NOT NULL DEFAULT FALSE"},
    }
    with engine.begin() as conn:
        for table, cols in wanted.items():
            if not insp.has_table(table):
                continue
            have = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in cols.items():
                if name not in have:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
                    added.append(f"{table}.{name}")
    return added
