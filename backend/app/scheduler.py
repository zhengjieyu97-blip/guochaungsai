from __future__ import annotations

import asyncio

from sqlalchemy import select

from .db import SessionLocal
from .domain import ensure_utc, utcnow
from .models import CareEvent, User
from .services import simulate_timeout


async def timeout_loop() -> None:
    """Scan due events in one process; the command remains idempotent."""
    while True:
        await asyncio.sleep(15)
        db = SessionLocal()
        try:
            worker = db.scalar(select(User).where(User.role == "COMMUNITY_WORKER", User.active).order_by(User.id))
            if not worker:
                continue
            now = utcnow()
            due_events = list(db.scalars(select(CareEvent).where(CareEvent.status.in_(["ASSIGNED", "IN_PROGRESS"]), CareEvent.escalation_level < 2)))
            for event in due_events:
                due_at = ensure_utc(event.first_response_due_at if event.status == "ASSIGNED" else event.escalation_due_at)
                if due_at and now >= due_at:
                    try:
                        simulate_timeout(db, worker, event.id)
                    except Exception:
                        db.rollback()
        finally:
            db.close()
