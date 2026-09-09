import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .db import Base, engine
from .routers import router
from .seed import seed_if_empty

app = FastAPI(title="수능 D-70 플래너", docs_url="/api/docs", openapi_url="/api/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    n = seed_if_empty()
    if n:
        print(f"[seed] inserted {n} rows from Notion export")


@app.get("/api/health")
def health():
    return {"ok": True}


if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
