from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from .domain import (
    ACTION_LABELS,
    DISPOSITION_TYPES,
    EVENT_TYPES,
    ROLE_LABELS,
    STATUS_LABELS,
    SUBJECT_TYPE_LABELS,
    calculate_risk,
    china_date,
    due_times,
    ensure_utc,
    utcnow,
)
from .models import ActionLog, Assignment, CareEvent, CareSubject, Household, Notification, Relationship, RiskProfile, User


class DomainError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 409, details: dict | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


def uid(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:12]}"


def require_role(user: User, roles: set[str]) -> None:
    if user.role not in roles:
        raise DomainError("FORBIDDEN", "当前角色没有执行此操作的权限。", 403)


def get_subject(db: Session, subject_id: str) -> CareSubject:
    subject = db.get(CareSubject, subject_id)
    if not subject or not subject.active:
        raise DomainError("SUBJECT_NOT_FOUND", "照护对象不存在或已停用。", 404)
    return subject


def get_event(db: Session, event_id: str) -> CareEvent:
    event = db.get(CareEvent, event_id)
    if not event:
        raise DomainError("EVENT_NOT_FOUND", "照护事件不存在。", 404)
    return event


def relationship_for(db: Session, user_id: str, subject_id: str) -> Relationship | None:
    return db.scalar(select(Relationship).where(Relationship.user_id == user_id, Relationship.subject_id == subject_id))


def can_view_subject(db: Session, user: User, subject_id: str) -> bool:
    if user.role in {"COMMUNITY_WORKER", "ADMIN"}:
        return True
    if user.role == "RESPONDER":
        return db.scalar(select(CareEvent.id).where(CareEvent.subject_id == subject_id, CareEvent.current_assignee_id == user.id)) is not None
    relation = relationship_for(db, user.id, subject_id)
    return bool(relation and relation.can_view)


def can_view_event(db: Session, user: User, event: CareEvent) -> bool:
    if user.role in {"COMMUNITY_WORKER", "ADMIN"}:
        return True
    if user.role == "RESPONDER":
        return event.current_assignee_id == user.id
    relation = relationship_for(db, user.id, event.subject_id)
    return bool(relation and relation.can_view)


def require_event_visible(db: Session, user: User, event: CareEvent) -> None:
    if not can_view_event(db, user, event):
        raise DomainError("FORBIDDEN", "当前角色无法查看这条照护事件。", 403)


def event_actions(db: Session, event_id: str) -> list[ActionLog]:
    return list(db.scalars(select(ActionLog).where(ActionLog.event_id == event_id).order_by(ActionLog.created_at, ActionLog.id)))


def event_assignments(db: Session, event_id: str) -> list[Assignment]:
    return list(db.scalars(select(Assignment).where(Assignment.event_id == event_id).order_by(Assignment.assigned_at, Assignment.id)))


def create_notification(db: Session, recipient_id: str, event_id: str | None, notification_type: str, title: str, content: str) -> Notification:
    notification = Notification(
        id=uid("NOTICE"), recipient_id=recipient_id, event_id=event_id,
        notification_type=notification_type, title=title, content=content, created_at=utcnow(),
    )
    db.add(notification)
    return notification


def community_workers(db: Session, community_id: str) -> list[User]:
    return list(db.scalars(select(User).where(User.community_id == community_id, User.role == "COMMUNITY_WORKER", User.active).order_by(User.id)))


def responders(db: Session, community_id: str) -> list[User]:
    return list(db.scalars(select(User).where(User.community_id == community_id, User.role == "RESPONDER", User.active).order_by(User.id)))


def initial_assignee(db: Session, subject: CareSubject, event_type: str) -> User | None:
    relation_types = ["FAMILY", "GUARDIAN"] if event_type != "CHILD_HELP" else ["GUARDIAN", "FAMILY"]
    relations = list(db.scalars(select(Relationship).where(Relationship.subject_id == subject.id, Relationship.relationship_type.in_(relation_types), Relationship.can_view).order_by(Relationship.id)))
    for relation in relations:
        user = db.get(User, relation.user_id)
        if user and user.active:
            return user
    workers = community_workers(db, db.get(Household, subject.household_id).community_id)
    return workers[0] if workers else None


def next_event_no(db: Session) -> str:
    prefix = f"NC-{utcnow().strftime('%Y%m%d')}"
    count = db.scalar(select(CareEvent.id).where(CareEvent.event_no.like(f"{prefix}-%")).order_by(CareEvent.event_no.desc()).limit(1))
    if not count:
        return f"{prefix}-001"
    latest = db.scalar(select(CareEvent.event_no).where(CareEvent.event_no.like(f"{prefix}-%")).order_by(CareEvent.event_no.desc()).limit(1))
    try:
        number = int(str(latest).split("-")[-1]) + 1
    except (TypeError, ValueError):
        number = 1
    return f"{prefix}-{number:03d}"


def create_event(db: Session, user: User, payload) -> CareEvent:
    if payload.event_type not in EVENT_TYPES:
        raise DomainError("INVALID_EVENT_TYPE", "暂不支持该事件类型。", 422)
    subject = get_subject(db, payload.subject_id)
    meta = EVENT_TYPES[payload.event_type]
    if subject.subject_type != meta["subject_type"]:
        raise DomainError("EVENT_SUBJECT_MISMATCH", "事件类型与照护对象类型不匹配。", 422)
    if user.role == "RESPONDER":
        raise DomainError("FORBIDDEN", "社区响应人不能直接创建事件。", 403)
    if user.role == "FAMILY" and not can_view_subject(db, user, subject.id):
        raise DomainError("FORBIDDEN", "家属只能为已授权的照护对象发起事件。", 403)
    profile = db.scalar(select(RiskProfile).where(RiskProfile.subject_id == subject.id))
    risk = calculate_risk(payload.event_type, tags=(profile.tags if profile else []), urgency=payload.urgency)
    created_at = utcnow()
    first_due, escalation_due = due_times(created_at, risk.level)
    assignee = initial_assignee(db, subject, payload.event_type)
    event = CareEvent(
        id=uid("EVENT"), event_no=next_event_no(db), subject_id=subject.id,
        event_type=payload.event_type, source=payload.source, risk_level=risk.level,
        risk_score=risk.score, risk_reasons=risk.reasons, status="ASSIGNED" if assignee else "PENDING",
        description=payload.description.strip(), occurred_at=payload.occurred_at or created_at,
        created_at=created_at, first_response_due_at=first_due, escalation_due_at=escalation_due,
        current_assignee_id=assignee.id if assignee else None,
    )
    db.add(event)
    db.flush()
    db.add(ActionLog(id=uid("LOG"), event_id=event.id, actor_id=user.id, action_type="EVENT_CREATED", content="事件已创建，进入照护事件闭环。", created_at=created_at))
    db.add(ActionLog(id=uid("LOG"), event_id=event.id, actor_id=user.id, action_type="RISK_CLASSIFIED", content=f"风险分级为 {risk.level}，风险分 {risk.score}。", created_at=created_at + timedelta(seconds=1)))

    recipients: set[str] = set()
    relations = list(db.scalars(select(Relationship).where(Relationship.subject_id == subject.id, Relationship.can_view)))
    recipients.update(relation.user_id for relation in relations)
    recipients.update(worker.id for worker in community_workers(db, db.get(Household, subject.household_id).community_id))
    if assignee:
        db.add(Assignment(id=uid("ASSIGN"), event_id=event.id, assignee_id=assignee.id, assignment_level=1, status="ACTIVE", assigned_at=created_at))
        db.add(ActionLog(id=uid("LOG"), event_id=event.id, actor_id=user.id, action_type="ASSIGNED", content=f"已派给 {assignee.name} 跟进。", created_at=created_at + timedelta(seconds=2)))
        recipients.add(assignee.id)
    for recipient_id in recipients:
        recipient = db.get(User, recipient_id)
        if recipient:
            create_notification(db, recipient_id, event.id, "EVENT_CREATED", f"新的{meta['label']}事件", f"{subject.name} · {event.event_no}，风险等级 {risk.level}，请按时跟进。")
    db.commit()
    db.refresh(event)
    return event


def accept_event(db: Session, user: User, event_id: str) -> CareEvent:
    event = get_event(db, event_id)
    require_event_visible(db, user, event)
    if event.status in {"CLOSED", "CANCELLED"}:
        raise DomainError("EVENT_STATE_CONFLICT", "事件已关闭，不能继续接单。")
    if user.role not in {"COMMUNITY_WORKER", "ADMIN"} and event.current_assignee_id != user.id:
        raise DomainError("FORBIDDEN", "只有当前责任人或社区工作人员可以接单。", 403)
    if event.status == "IN_PROGRESS":
        return event
    now = utcnow()
    event.status = "IN_PROGRESS"
    event.version += 1
    assignment = db.scalar(select(Assignment).where(Assignment.event_id == event.id, Assignment.assignee_id == event.current_assignee_id, Assignment.status == "ACTIVE").order_by(Assignment.assigned_at.desc()))
    if assignment:
        assignment.status = "ACCEPTED"
        assignment.accepted_at = now
    db.add(ActionLog(id=uid("LOG"), event_id=event.id, actor_id=user.id, action_type="ACCEPTED", content=f"{user.name} 已接单，开始处理。", created_at=now))
    db.commit()
    db.refresh(event)
    return event


def transfer_event(db: Session, user: User, event_id: str, assignee_id: str, reason: str) -> CareEvent:
    event = get_event(db, event_id)
    require_event_visible(db, user, event)
    if event.status in {"CLOSED", "CANCELLED"}:
        raise DomainError("EVENT_STATE_CONFLICT", "事件已关闭，不能转派。")
    if user.role not in {"COMMUNITY_WORKER", "ADMIN"} and event.current_assignee_id != user.id:
        raise DomainError("FORBIDDEN", "只有当前责任人或社区工作人员可以转派。", 403)
    if not reason.strip():
        raise DomainError("VALIDATION_ERROR", "转派原因不能为空。", 422)
    assignee = db.get(User, assignee_id)
    if not assignee or not assignee.active or assignee.role == "ADMIN":
        raise DomainError("ASSIGNEE_NOT_FOUND", "请选择有效的社区响应人或家属。", 422)
    if assignee.id == event.current_assignee_id:
        raise DomainError("VALIDATION_ERROR", "新的责任人不能与当前责任人相同。", 422)
    now = utcnow()
    old_id = event.current_assignee_id
    old_assignment = db.scalar(select(Assignment).where(Assignment.event_id == event.id, Assignment.assignee_id == old_id, Assignment.status.in_(["ACTIVE", "ACCEPTED"])).order_by(Assignment.assigned_at.desc())) if old_id else None
    if old_assignment:
        old_assignment.status = "TRANSFERRED"
        old_assignment.transferred_at = now
        old_assignment.transfer_reason = reason.strip()
    level = len(event_assignments(db, event.id)) + 1
    event.current_assignee_id = assignee.id
    event.status = "ASSIGNED"
    event.version += 1
    db.add(Assignment(id=uid("ASSIGN"), event_id=event.id, assignee_id=assignee.id, assignment_level=level, status="ACTIVE", assigned_at=now, transfer_reason=reason.strip()))
    db.add(ActionLog(id=uid("LOG"), event_id=event.id, actor_id=user.id, action_type="TRANSFERRED", content=f"已从 {old_id or '待处理'} 转派给 {assignee.name}：{reason.strip()}", created_at=now))
    create_notification(db, assignee.id, event.id, "ASSIGNED", "照护任务已转派给你", f"{event.event_no} · {reason.strip()}")
    db.commit()
    db.refresh(event)
    return event


def record_action(db: Session, user: User, event_id: str, action_type: str, content: str, complete: bool = False) -> CareEvent:
    event = get_event(db, event_id)
    require_event_visible(db, user, event)
    if event.status in {"CLOSED", "CANCELLED"}:
        raise DomainError("EVENT_STATE_CONFLICT", "事件已关闭，时间线只读。")
    if action_type not in ACTION_LABELS:
        raise DomainError("VALIDATION_ERROR", "处置类型不受支持。", 422)
    if not content.strip():
        raise DomainError("VALIDATION_ERROR", "处置说明不能为空。", 422)
    if user.role == "FAMILY":
        relation = relationship_for(db, user.id, event.subject_id)
        if not relation or not relation.can_view:
            raise DomainError("FORBIDDEN", "当前家属没有这条事件的操作权限。", 403)
        complete = False
    now = utcnow()
    db.add(ActionLog(id=uid("LOG"), event_id=event.id, actor_id=user.id, action_type=action_type, content=content.strip(), created_at=now))
    if event.status in {"PENDING", "ASSIGNED"} and user.role in {"COMMUNITY_WORKER", "ADMIN", "RESPONDER"}:
        event.status = "IN_PROGRESS"
    if complete:
        event.status = "WAITING_CONFIRM"
    event.version += 1
    db.commit()
    db.refresh(event)
    return event


def record_check_in(db: Session, user: User, subject_id: str, event_id: str | None = None) -> CareSubject:
    subject = get_subject(db, subject_id)
    if not can_view_subject(db, user, subject.id):
        raise DomainError("FORBIDDEN", "当前角色无法为该照护对象签到。", 403)
    now = utcnow()
    subject.last_check_in_at = now
    if event_id:
        event = get_event(db, event_id)
        if event.subject_id != subject.id or not can_view_event(db, user, event):
            raise DomainError("FORBIDDEN", "当前角色无法为这条照护事件签到。", 403)
        events = [event]
    else:
        events = [
            event
            for event in db.scalars(
                select(CareEvent).where(
                    CareEvent.subject_id == subject.id,
                    CareEvent.status.not_in(["CLOSED", "CANCELLED"]),
                )
            )
            if can_view_event(db, user, event)
        ]
    for event in events:
        db.add(ActionLog(id=uid("LOG"), event_id=event.id, actor_id=user.id, action_type="CHECK_IN", content=f"{user.name} 记录平安签到，建议人工确认当前安全。", created_at=now))
        profile = db.scalar(select(RiskProfile).where(RiskProfile.subject_id == subject.id))
        risk = calculate_risk(
            event.event_type,
            tags=(profile.tags if profile else []),
            timed_out=event.escalation_level > 0,
            unresponsive=event.escalation_level > 0,
            safe_confirmed=True,
        )
        event.risk_level, event.risk_score, event.risk_reasons = risk.level, risk.score, risk.reasons
        if event.status not in {"CLOSED", "CANCELLED"}:
            event.status = "WAITING_CONFIRM"
        event.version += 1
    db.commit()
    db.refresh(subject)
    return subject


def simulate_timeout(db: Session, user: User, event_id: str) -> CareEvent:
    require_role(user, {"COMMUNITY_WORKER", "ADMIN"})
    event = get_event(db, event_id)
    require_event_visible(db, user, event)
    if event.status in {"CLOSED", "CANCELLED"}:
        raise DomainError("EVENT_STATE_CONFLICT", "已关闭事件不能模拟超时。")
    if event.escalation_level >= 2:
        return event
    now = utcnow()
    old_id = event.current_assignee_id
    if event.escalation_level == 0:
        candidates = community_workers(db, user.community_id)
    else:
        candidates = responders(db, user.community_id)
    candidates = [candidate for candidate in candidates if candidate.id != old_id] or candidates
    assignee = candidates[0] if candidates else None
    event.escalation_level += 1
    event.first_response_due_at = now - timedelta(seconds=1)
    event.escalation_due_at = now - timedelta(seconds=1)
    event.version += 1
    if assignee and assignee.id != old_id:
        old_assignment = db.scalar(select(Assignment).where(Assignment.event_id == event.id, Assignment.assignee_id == old_id, Assignment.status.in_(["ACTIVE", "ACCEPTED"])).order_by(Assignment.assigned_at.desc())) if old_id else None
        if old_assignment:
            old_assignment.status = "TRANSFERRED"
            old_assignment.transferred_at = now
            old_assignment.transfer_reason = "超过响应时限，系统自动升级。"
        event.current_assignee_id = assignee.id
        event.status = "ASSIGNED"
        db.add(Assignment(id=uid("ASSIGN"), event_id=event.id, assignee_id=assignee.id, assignment_level=event.escalation_level + 1, status="ACTIVE", assigned_at=now, transfer_reason="超过响应时限，系统自动升级。"))
        create_notification(db, assignee.id, event.id, "ESCALATED", "照护事件已升级", f"{event.event_no} 已超过响应时限，请立即跟进。")
    profile = db.scalar(select(RiskProfile).where(RiskProfile.subject_id == event.subject_id))
    risk = calculate_risk(event.event_type, tags=(profile.tags if profile else []), timed_out=True, unresponsive=True)
    event.risk_level, event.risk_score, event.risk_reasons = risk.level, risk.score, risk.reasons
    db.add(ActionLog(id=uid("LOG"), event_id=event.id, actor_id=user.id, action_type="ESCALATED", content=f"超过响应时限，已升级第 {event.escalation_level} 级并通知新的责任人。", created_at=now))
    db.commit()
    db.refresh(event)
    return event


def close_event(db: Session, user: User, event_id: str, reason: str, *, family_confirm: bool) -> CareEvent:
    event = get_event(db, event_id)
    require_event_visible(db, user, event)
    if event.status in {"CLOSED", "CANCELLED"}:
        raise DomainError("EVENT_STATE_CONFLICT", "事件已经结束。")
    if family_confirm:
        relation = relationship_for(db, user.id, event.subject_id)
        if user.role != "FAMILY" or not relation or not relation.can_confirm:
            raise DomainError("FORBIDDEN", "只有被授权的家属 / 监护人可以确认关闭。", 403)
    else:
        require_role(user, {"COMMUNITY_WORKER", "ADMIN"})
    if not any(log.action_type in DISPOSITION_TYPES for log in event_actions(db, event.id)):
        raise DomainError("CLOSE_REQUIRES_ACTION", "关闭前至少需要一条处置反馈。")
    if not reason.strip():
        raise DomainError("VALIDATION_ERROR", "关闭说明不能为空。", 422)
    now = utcnow()
    event.status = "CLOSED"
    event.closed_at = now
    event.closed_by = user.id
    event.close_reason = reason.strip()
    event.version += 1
    db.add(ActionLog(id=uid("LOG"), event_id=event.id, actor_id=user.id, action_type="CONFIRMED_CLOSE" if family_confirm else "FORCE_CLOSED", content=reason.strip(), created_at=now))
    db.commit()
    db.refresh(event)
    return event


def cancel_event(db: Session, user: User, event_id: str, reason: str) -> CareEvent:
    require_role(user, {"COMMUNITY_WORKER", "ADMIN"})
    event = get_event(db, event_id)
    require_event_visible(db, user, event)
    if event.status in {"CLOSED", "CANCELLED"}:
        raise DomainError("EVENT_STATE_CONFLICT", "事件已经结束。")
    if not reason.strip():
        raise DomainError("VALIDATION_ERROR", "取消说明不能为空。", 422)
    now = utcnow()
    event.status = "CANCELLED"
    event.closed_at = now
    event.closed_by = user.id
    event.close_reason = reason.strip()
    event.version += 1
    db.add(ActionLog(id=uid("LOG"), event_id=event.id, actor_id=user.id, action_type="CANCELLED", content=reason.strip(), created_at=now))
    db.commit()
    db.refresh(event)
    return event


def subject_to_dict(db: Session, user: User, subject: CareSubject) -> dict:
    household = db.get(Household, subject.household_id)
    profile = db.scalar(select(RiskProfile).where(RiskProfile.subject_id == subject.id))
    relations = list(db.scalars(select(Relationship).where(Relationship.subject_id == subject.id)))
    relation_out = []
    phone_masked = None
    for relation in relations:
        related_user = db.get(User, relation.user_id)
        if not related_user:
            continue
        relation_visible = relation.can_view or (relation.relationship_type == "PICKUP_AUTHORIZED" and user.role in {"COMMUNITY_WORKER", "ADMIN"})
        if relation_visible and (user.role in {"COMMUNITY_WORKER", "ADMIN"} or relation.user_id == user.id or user.role == "RESPONDER"):
            relation_out.append({"name": related_user.name, "role": ROLE_LABELS.get(related_user.role, related_user.role), "relationship_type": relation.relationship_type, "can_confirm": relation.can_confirm, "can_pickup": relation.can_pickup})
            if phone_masked is None and (user.role in {"COMMUNITY_WORKER", "ADMIN"} or relation.user_id == user.id):
                phone_masked = related_user.phone_masked
    open_events = len(list(db.scalars(select(CareEvent.id).where(CareEvent.subject_id == subject.id, CareEvent.status.not_in(["CLOSED", "CANCELLED"])))) )
    return {
        "id": subject.id, "name": subject.name, "subject_type": subject.subject_type,
        "subject_type_label": SUBJECT_TYPE_LABELS[subject.subject_type], "age": subject.age, "gender": subject.gender,
        "household_id": subject.household_id, "household_name": household.name if household else "演示家庭",
        "building_text": household.building_text if household else "社区内", "location_text": subject.location_text,
        "phone_masked": phone_masked, "risk_tags": profile.tags if profile else [],
        "last_check_in_at": ensure_utc(subject.last_check_in_at), "open_event_count": open_events,
        "relationships": relation_out, "check_in_interval_hours": profile.check_in_interval_hours if profile else None,
        "pickup_plan_text": profile.pickup_plan_text if profile else None, "notes_safe": profile.notes_safe if profile else None,
    }


def event_to_dict(db: Session, user: User, event: CareEvent, include_timeline: bool = True) -> dict:
    subject = db.get(CareSubject, event.subject_id)
    household = db.get(Household, subject.household_id) if subject else None
    assignee = db.get(User, event.current_assignee_id) if event.current_assignee_id else None
    now = utcnow()
    due_at = ensure_utc(event.first_response_due_at if event.status == "ASSIGNED" else event.escalation_due_at)
    timed_out = event.status not in {"CLOSED", "CANCELLED"} and (
        event.escalation_level > 0 or (due_at is not None and now > due_at)
    )
    logs = event_actions(db, event.id)
    assignments = event_assignments(db, event.id)
    timeline = []
    if include_timeline:
        for log in logs:
            actor = db.get(User, log.actor_id)
            timeline.append({"id": log.id, "action_type": log.action_type, "action_label": ACTION_LABELS.get(log.action_type, log.action_type.replace("_", " ")), "content": log.content, "actor_name": actor.name if actor else "系统", "created_at": ensure_utc(log.created_at)})
    assignment_out = []
    for assignment in assignments:
        assignment_user = db.get(User, assignment.assignee_id)
        assignment_out.append({"id": assignment.id, "assignee_id": assignment.assignee_id, "assignee_name": assignment_user.name if assignment_user else "未知", "status": assignment.status, "assignment_level": assignment.assignment_level, "assigned_at": ensure_utc(assignment.assigned_at), "accepted_at": ensure_utc(assignment.accepted_at), "transferred_at": ensure_utc(assignment.transferred_at), "transfer_reason": assignment.transfer_reason})
    return {
        "id": event.id, "event_no": event.event_no, "subject_id": event.subject_id,
        "subject_name": subject.name if subject else "未知对象", "subject_type": subject.subject_type if subject else "",
        "subject_type_label": SUBJECT_TYPE_LABELS.get(subject.subject_type if subject else "", "照护对象"), "subject_age": subject.age if subject else 0,
        "event_type": event.event_type, "event_type_label": EVENT_TYPES.get(event.event_type, {}).get("label", event.event_type),
        "source": event.source, "risk_level": event.risk_level, "risk_level_label": {"P0": "紧急", "P1": "高风险", "P2": "常规"}.get(event.risk_level, event.risk_level),
        "risk_score": event.risk_score, "risk_reasons": event.risk_reasons, "status": event.status, "status_label": STATUS_LABELS.get(event.status, event.status),
        "description": event.description, "occurred_at": ensure_utc(event.occurred_at), "created_at": ensure_utc(event.created_at),
        "first_response_due_at": ensure_utc(event.first_response_due_at), "escalation_due_at": ensure_utc(event.escalation_due_at),
        "current_assignee_id": event.current_assignee_id, "current_assignee_name": assignee.name if assignee else None,
        "current_assignee_title": assignee.title if assignee else None, "escalation_level": event.escalation_level,
        "closed_at": ensure_utc(event.closed_at), "closed_by": event.closed_by, "close_reason": event.close_reason,
        "timed_out": timed_out, "actions_count": len(logs), "timeline": timeline, "assignments": assignment_out,
    }


def list_subjects(db: Session, user: User, search: str = "", subject_type: str = "ALL") -> list[dict]:
    subjects = list(db.scalars(select(CareSubject).where(CareSubject.active).order_by(CareSubject.name)))
    result = []
    for subject in subjects:
        if not can_view_subject(db, user, subject.id):
            continue
        if subject_type != "ALL" and subject.subject_type != subject_type:
            continue
        if search and search.lower() not in subject.name.lower() and search.lower() not in subject.id.lower():
            continue
        result.append(subject_to_dict(db, user, subject))
    return result


def list_events(db: Session, user: User, *, search: str = "", status: str = "ALL", risk: str = "ALL", subject_type: str = "ALL", event_type: str = "ALL", assignee: str = "ALL") -> list[dict]:
    events = list(db.scalars(select(CareEvent).order_by(CareEvent.created_at.desc())))
    result = []
    for event in events:
        if not can_view_event(db, user, event):
            continue
        subject = db.get(CareSubject, event.subject_id)
        if status != "ALL" and event.status != status:
            continue
        if risk != "ALL" and event.risk_level != risk:
            continue
        if subject_type != "ALL" and (subject is None or subject.subject_type != subject_type):
            continue
        if event_type != "ALL" and event.event_type != event_type:
            continue
        if assignee != "ALL" and event.current_assignee_id != assignee:
            continue
        if search:
            haystack = f"{event.event_no} {event.description} {subject.name if subject else ''}".lower()
            if search.lower() not in haystack:
                continue
        result.append(event_to_dict(db, user, event, include_timeline=False))
    return result


def dashboard_summary(db: Session, user: User) -> dict:
    events = [event for event in db.scalars(select(CareEvent).order_by(CareEvent.created_at)).all() if can_view_event(db, user, event)]
    now = utcnow()
    today = china_date(now)
    open_events = [event for event in events if event.status not in {"CLOSED", "CANCELLED"}]
    overdue = [
        event
        for event in open_events
        if event.escalation_level > 0
        or (ensure_utc(event.first_response_due_at if event.status == "ASSIGNED" else event.escalation_due_at) is not None and now > ensure_utc(event.first_response_due_at if event.status == "ASSIGNED" else event.escalation_due_at))
    ]
    closed_today = [event for event in events if event.closed_at and china_date(event.closed_at) == today and event.status == "CLOSED"]
    accepted_durations = []
    for event in events:
        for assignment in event_assignments(db, event.id):
            if assignment.accepted_at:
                accepted_durations.append((assignment.accepted_at - assignment.assigned_at).total_seconds() / 60)
                break
    close_trend = []
    for offset in range(6, -1, -1):
        date_value = (now.astimezone(ZoneInfo("Asia/Shanghai")) - timedelta(days=offset)).date()
        close_trend.append({"date": date_value.isoformat(), "label": date_value.strftime("%m/%d"), "closed": sum(1 for event in events if event.closed_at and china_date(event.closed_at) == date_value and event.status == "CLOSED")})
    risk_counts = {level: sum(1 for event in events if event.risk_level == level) for level in ("P0", "P1", "P2")}
    subject_type_counts = {
        kind: sum(
            1
            for event in events
            if (subject := db.get(CareSubject, event.subject_id)) is not None and subject.subject_type == kind
        )
        for kind in ("ELDER", "CHILD")
    }
    event_type_counts = {key: sum(1 for event in events if event.event_type == key) for key in EVENT_TYPES}
    return {
        "today_total": sum(1 for event in events if china_date(event.created_at) == today),
        "open_total": len(open_events), "pending_total": sum(1 for event in events if event.status in {"PENDING", "ASSIGNED"}),
        "in_progress_total": sum(1 for event in events if event.status in {"IN_PROGRESS", "WAITING_CONFIRM"}),
        "overdue_total": len(overdue), "closed_today": len(closed_today), "risk_counts": risk_counts,
        "subject_type_counts": subject_type_counts, "event_type_counts": event_type_counts,
        "average_first_response_minutes": round(sum(accepted_durations) / len(accepted_durations), 1) if accepted_durations else 0,
        "overdue_rate": round(len(overdue) / len(open_events), 3) if open_events else 0,
        "close_trend": close_trend,
    }
