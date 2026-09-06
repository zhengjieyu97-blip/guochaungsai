from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware

from .config import ENABLE_SCHEDULER, FRONTEND_ORIGINS, SESSION_SECRET
from .db import create_tables, SessionLocal
from .routes import router
from .seed import seed_database
from .services import DomainError
from .scheduler import timeout_loop


@asynccontextmanager
async def lifespan(_: FastAPI):
    create_tables()
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    task = asyncio.create_task(timeout_loop()) if ENABLE_SCHEDULER else None
    try:
        yield
    finally:
        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


app = FastAPI(title="邻里智护 API", version="1.0.0", description="面向完整社区一老一小的照护事件闭环与应急协同平台", lifespan=lifespan)
app.add_middleware(SessionMiddleware, secret_key=SESSION_SECRET, same_site="lax", https_only=False, max_age=60 * 60 * 8)
app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DomainError)
async def domain_error_handler(_: Request, exc: DomainError):
    return JSONResponse(status_code=exc.status_code, content={"code": exc.code, "message": exc.message, "details": exc.details})


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "neighbor-care"}


app.include_router(router)


# When a production build exists, FastAPI can serve it as a single local process.
frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.exists():
    from fastapi.staticfiles import StaticFiles

    class SPAStaticFiles(StaticFiles):
        async def get_response(self, path: str, scope):  # type: ignore[no-untyped-def]
            try:
                return await super().get_response(path, scope)
            except StarletteHTTPException as exc:
                if exc.status_code == 404:
                    return await super().get_response("index.html", scope)
                raise

    app.mount("/", SPAStaticFiles(directory=frontend_dist, html=True), name="frontend")
