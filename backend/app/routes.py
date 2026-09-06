from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from .dependencies import current_user
from .db import get_db
from .domain import EVENT_TYPES, ROLE_LABELS, ensure_utc
from .models import Notification, User
from .schemas import (
    ActionRequest,
    AssignRequest,
    CloseRequest,
    CreateEventRequest,
    DashboardSummary,
    DemoLoginRequest,
    EventOut,
    NotificationOut,
    SessionOut,
    SubjectOut,
    UserOut,
)
from .seed import USER_IDS, seed_database
from .services import (
    DomainError,
    accept_event,
    can_view_event,
    can_view_subject,
    cancel_event,
    close_event,
    create_event,
    dashboard_summary,
    event_to_dict,
    get_event,
    get_subject,
    list_events,
    list_subjects,
    record_action,
    record_check_in,
    simulate_timeout,
    subject_to_dict,
    transfer_event,
)


router = APIRouter(prefix="/api")


def permissions_for(user: User) -> list[str]:
    common = ["view_events", "view_people"]
    by_role = {
        "FAMILY": ["check_in", "create_event", "add_note", "confirm_close"],
        "COMMUNITY_WORKER": ["assign", "accept", "transfer", "record_action", "simulate_timeout", "force_close", "cancel", "reset_demo"],
        "RESPONDER": ["accept", "record_action", "request_transfer"],
        "ADMIN": ["assign", "accept", "transfer", "record_action", "simulate_timeout", "force_close", "cancel", "reset_demo"],
    }
    return common + by_role.get(user.role, [])


@router.post("/demo-login", response_model=SessionOut)
def demo_login(payload: DemoLoginRequest, request: Request, db: Session = Depends(get_db)):
    # Keep role switching deterministic: auxiliary family/responders are seeded for
    # relationship data but are not the four primary demo perspectives.
    demo_user_id = {
        "FAMILY": USER_IDS["family"],
        "COMMUNITY_WORKER": USER_IDS["worker"],
        "RESPONDER": USER_IDS["responder"],
        "ADMIN": USER_IDS["admin"],
    }[payload.role]
    user = db.scalar(select(User).where(User.id == demo_user_id, User.active))
    if not user:
        raise DomainError("DEMO_ROLE_UNAVAILABLE", "该演示角色暂不可用。", 404)
    request.session.clear()
    request.session["user_id"] = user.id
    return {"user": user, "permissions": permissions_for(user)}


@router.post("/demo-logout")
def demo_logout(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/me", response_model=SessionOut)
def me(user: User = Depends(current_user)):
    return {"user": user, "permissions": permissions_for(user)}


@router.get("/event-types")
def event_types(user: User = Depends(current_user)):
    return [{"value": key, **{field: value for field, value in meta.items() if field in {"label", "subject_type", "default_level", "min_level"}}} for key, meta in EVENT_TYPES.items()]


@router.get("/resources")
def resources(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role not in {"COMMUNITY_WORKER", "ADMIN", "RESPONDER"}:
        # Family views only need their own relationship data, not a directory.
        return {"items": []}
    items = list(db.scalars(select(User).where(User.community_id == user.community_id, User.active, User.role != "ADMIN").order_by(User.role, User.name)))
    return {"items": [{"id": item.id, "name": item.name, "role": item.role, "title": item.title, "phone_masked": item.phone_masked} for item in items]}


@router.get("/people", response_model=dict)
def people(
    search: str = Query(""),
    subject_type: str = Query("ALL"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    items = list_subjects(db, user, search=search, subject_type=subject_type)
    return {"items": items, "total": len(items)}


@router.get("/people/{subject_id}", response_model=SubjectOut)
def person(subject_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    subject = get_subject(db, subject_id)
    if not can_view_subject(db, user, subject.id):
        raise DomainError("FORBIDDEN", "当前角色无法查看该照护对象。", 403)
    return subject_to_dict(db, user, subject)


@router.post("/people/{subject_id}/check-in", response_model=SubjectOut)
def person_check_in(subject_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    subject = record_check_in(db, user, subject_id)
    return subject_to_dict(db, user, subject)


@router.get("/events", response_model=dict)
def events(
    search: str = Query(""),
    status: str = Query("ALL"),
    risk: str = Query("ALL"),
    subject_type: str = Query("ALL"),
    event_type: str = Query("ALL"),
    assignee: str = Query("ALL"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    all_items = list_events(db, user, search=search, status=status, risk=risk, subject_type=subject_type, event_type=event_type, assignee=assignee)
    start = (page - 1) * page_size
    return {"items": all_items[start : start + page_size], "total": len(all_items), "page": page, "page_size": page_size}


@router.post("/events", response_model=EventOut)
def create_event_route(payload: CreateEventRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    event = create_event(db, user, payload)
    return event_to_dict(db, user, event)


@router.get("/events/{event_id}", response_model=EventOut)
def event_detail(event_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    event = get_event(db, event_id)
    if not can_view_event(db, user, event):
        raise DomainError("FORBIDDEN", "当前角色无法查看这条照护事件。", 403)
    return event_to_dict(db, user, event)


@router.post("/events/{event_id}/assign", response_model=EventOut)
def assign_event(event_id: str, payload: AssignRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    event = transfer_event(db, user, event_id, payload.assignee_id, payload.reason)
    return event_to_dict(db, user, event)


@router.post("/events/{event_id}/accept", response_model=EventOut)
def accept(event_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    event = accept_event(db, user, event_id)
    return event_to_dict(db, user, event)


@router.post("/events/{event_id}/actions", response_model=EventOut)
def action(event_id: str, payload: ActionRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    event = record_action(db, user, event_id, payload.action_type, payload.content, payload.complete)
    return event_to_dict(db, user, event)


@router.post("/events/{event_id}/check-in", response_model=EventOut)
def event_check_in(event_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    event = get_event(db, event_id)
    record_check_in(db, user, event.subject_id, event.id)
    return event_to_dict(db, user, get_event(db, event.id))


@router.post("/events/{event_id}/simulate-timeout", response_model=EventOut)
def timeout(event_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    event = simulate_timeout(db, user, event_id)
    return event_to_dict(db, user, event)


@router.post("/events/{event_id}/confirm-close", response_model=EventOut)
def confirm_close(event_id: str, payload: CloseRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    event = close_event(db, user, event_id, payload.reason, family_confirm=True)
    return event_to_dict(db, user, event)


@router.post("/events/{event_id}/close", response_model=EventOut)
def force_close(event_id: str, payload: CloseRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    event = close_event(db, user, event_id, payload.reason, family_confirm=False)
    return event_to_dict(db, user, event)


@router.post("/events/{event_id}/cancel", response_model=EventOut)
def cancel(event_id: str, payload: CloseRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    event = cancel_event(db, user, event_id, payload.reason)
    return event_to_dict(db, user, event)


@router.get("/notifications", response_model=dict)
def notifications(
    unread_only: bool = Query(False),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = select(Notification).where(Notification.recipient_id == user.id).order_by(Notification.created_at.desc())
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    items = list(db.scalars(query.limit(100)))
    serialized = [
        {
            "id": item.id,
            "event_id": item.event_id,
            "notification_type": item.notification_type,
            "title": item.title,
            "content": item.content,
            "read_at": ensure_utc(item.read_at),
            "created_at": ensure_utc(item.created_at),
        }
        for item in items
    ]
    return {"items": serialized, "total": len(serialized), "unread": sum(1 for item in serialized if item["read_at"] is None)}


@router.patch("/notifications/{notification_id}/read", response_model=NotificationOut)
def mark_notification_read(notification_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    notification = db.get(Notification, notification_id)
    if not notification or notification.recipient_id != user.id:
        raise DomainError("NOTIFICATION_NOT_FOUND", "通知不存在。", 404)
    notification.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notification)
    return {
        "id": notification.id,
        "event_id": notification.event_id,
        "notification_type": notification.notification_type,
        "title": notification.title,
        "content": notification.content,
        "read_at": ensure_utc(notification.read_at),
        "created_at": ensure_utc(notification.created_at),
    }


@router.post("/notifications/read-all")
def mark_all_notifications(user: User = Depends(current_user), db: Session = Depends(get_db)):
    items = list(db.scalars(select(Notification).where(Notification.recipient_id == user.id, Notification.read_at.is_(None))))
    now = datetime.now(timezone.utc)
    for item in items:
        item.read_at = now
    db.commit()
    return {"updated": len(items)}


@router.get("/dashboard/summary", response_model=DashboardSummary)
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return dashboard_summary(db, user)


@router.post("/demo/reset")
def reset_demo(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role not in {"COMMUNITY_WORKER", "ADMIN"}:
        raise DomainError("FORBIDDEN", "只有社区工作人员或管理员可以重置演示数据。", 403)
    seed_database(db, reset=True)
    return {"ok": True}
