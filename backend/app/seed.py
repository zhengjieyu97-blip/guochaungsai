from __future__ import annotations

from datetime import timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from .domain import calculate_risk, due_times, utcnow
from .models import (
    ActionLog,
    Assignment,
    CareEvent,
    CareSubject,
    Household,
    Notification,
    Relationship,
    RiskProfile,
    User,
)


COMMUNITY_ID = "COMMUNITY-DEMO"
USER_IDS = {
    "family": "USER-FAMILY-LI",
    "worker": "USER-WORKER-ZHAO",
    "responder": "USER-RESPONDER-ZHANG",
    "admin": "USER-ADMIN-DEMO",
    "guardian_child": "USER-GUARDIAN-CHEN",
    "guardian_child_2": "USER-GUARDIAN-ZHOU",
    "pickup_teacher": "USER-PICKUP-ZHAO",
}


def _clear(db: Session) -> None:
    # Delete children first so this also works when SQLite foreign keys are enabled.
    for model in (Notification, ActionLog, Assignment, CareEvent, RiskProfile, Relationship, CareSubject, Household, User):
        db.execute(delete(model))
    db.commit()


def seed_database(db: Session, *, reset: bool = False) -> None:
    if reset:
        _clear(db)
    elif db.query(User).first() is not None:
        return

    now = utcnow()
    users = [
        User(
            id=USER_IDS["family"],
            name="李晨",
            role="FAMILY",
            title="家属 / 照护联系人",
            phone_masked="138****2088",
            community_id=COMMUNITY_ID,
        ),
        User(
            id=USER_IDS["worker"],
            name="赵敏",
            role="COMMUNITY_WORKER",
            title="社区工作人员",
            phone_masked="139****4612",
            community_id=COMMUNITY_ID,
        ),
        User(
            id=USER_IDS["responder"],
            name="张师傅",
            role="RESPONDER",
            title="社区响应人 · 邻里服务队",
            phone_masked="137****8931",
            community_id=COMMUNITY_ID,
        ),
        User(
            id=USER_IDS["admin"],
            name="社区管理员",
            role="ADMIN",
            title="演示数据管理员",
            phone_masked="136****7724",
            community_id=COMMUNITY_ID,
        ),
        User(
            id=USER_IDS["guardian_child"],
            name="陈琳",
            role="FAMILY",
            title="儿童监护人",
            phone_masked="135****1406",
            community_id=COMMUNITY_ID,
        ),
        User(
            id=USER_IDS["guardian_child_2"],
            name="周明",
            role="FAMILY",
            title="儿童监护人",
            phone_masked="133****5819",
            community_id=COMMUNITY_ID,
        ),
        User(
            id=USER_IDS["pickup_teacher"],
            name="赵老师",
            role="RESPONDER",
            title="接送授权人 · 阳光托管班",
            phone_masked="135****7421",
            community_id=COMMUNITY_ID,
        ),
    ]
    db.add_all(users)

    households = [
        Household(id="HOUSEHOLD-001", name="秀梅家庭", building_text="春和里 3 栋", community_id=COMMUNITY_ID),
        Household(id="HOUSEHOLD-002", name="建国家庭", building_text="春和里 5 栋", community_id=COMMUNITY_ID),
        Household(id="HOUSEHOLD-003", name="小雨家庭", building_text="春和里 8 栋", community_id=COMMUNITY_ID),
        Household(id="HOUSEHOLD-004", name="子涵家庭", building_text="春和里 8 栋", community_id=COMMUNITY_ID),
    ]
    db.add_all(households)

    subjects = [
        CareSubject(
            id="SUBJECT-001", name="李秀梅", subject_type="ELDER", age=78, gender="女",
            household_id="HOUSEHOLD-001", location_text="3 栋 · 2 单元（模糊位置）",
            last_check_in_at=now - timedelta(hours=5),
        ),
        CareSubject(
            id="SUBJECT-002", name="王建国", subject_type="ELDER", age=82, gender="男",
            household_id="HOUSEHOLD-002", location_text="5 栋 · 1 单元（模糊位置）",
            last_check_in_at=now - timedelta(hours=1),
        ),
        CareSubject(
            id="SUBJECT-003", name="陈小雨", subject_type="CHILD", age=8, gender="女",
            household_id="HOUSEHOLD-003", location_text="8 栋 · 社区托管点（模糊位置）",
            last_check_in_at=now - timedelta(hours=2),
        ),
        CareSubject(
            id="SUBJECT-004", name="周子涵", subject_type="CHILD", age=6, gender="男",
            household_id="HOUSEHOLD-004", location_text="8 栋 · 阳光托管班（模糊位置）",
            last_check_in_at=now - timedelta(hours=2),
        ),
    ]
    db.add_all(subjects)

    profiles = [
        RiskProfile(id="RISK-001", subject_id="SUBJECT-001", tags=["独居", "高龄"], check_in_interval_hours=4, notes_safe="仅保留照护相关安全备注。"),
        RiskProfile(id="RISK-002", subject_id="SUBJECT-002", tags=["高龄"], check_in_interval_hours=8, notes_safe="日常助餐需求可由社区资源协助。"),
        RiskProfile(id="RISK-003", subject_id="SUBJECT-003", tags=["无人监护"], check_in_interval_hours=4, pickup_plan_text="工作日 17:30 前由监护人或授权人接送", notes_safe="接送确认优先联系监护人。"),
        RiskProfile(id="RISK-004", subject_id="SUBJECT-004", tags=[], check_in_interval_hours=4, pickup_plan_text="工作日 18:00 前由监护人接送", notes_safe="托管签到异常时联系监护人。"),
    ]
    db.add_all(profiles)

    relationships = [
        Relationship(id="REL-001", subject_id="SUBJECT-001", user_id=USER_IDS["family"], relationship_type="FAMILY", can_confirm=True, can_view=True, can_pickup=False),
        Relationship(id="REL-002", subject_id="SUBJECT-002", user_id=USER_IDS["family"], relationship_type="FAMILY", can_confirm=True, can_view=True, can_pickup=False),
        Relationship(id="REL-003", subject_id="SUBJECT-003", user_id=USER_IDS["guardian_child"], relationship_type="GUARDIAN", can_confirm=True, can_view=True, can_pickup=True),
        Relationship(id="REL-004", subject_id="SUBJECT-004", user_id=USER_IDS["guardian_child_2"], relationship_type="GUARDIAN", can_confirm=True, can_view=True, can_pickup=True),
        Relationship(id="REL-005", subject_id="SUBJECT-003", user_id="USER-PICKUP-ZHAO", relationship_type="PICKUP_AUTHORIZED", can_confirm=False, can_view=False, can_pickup=True),
        # 李晨作为统一演示家属视角，可在比赛现场复用儿童闭环；真实部署
        # 时应按实际家庭关系配置，而不是共享演示账号。
        Relationship(id="REL-006", subject_id="SUBJECT-003", user_id=USER_IDS["family"], relationship_type="GUARDIAN", can_confirm=True, can_view=True, can_pickup=True),
        Relationship(id="REL-007", subject_id="SUBJECT-004", user_id=USER_IDS["family"], relationship_type="GUARDIAN", can_confirm=True, can_view=True, can_pickup=True),
    ]
    db.add_all(relationships)
    db.flush()

    _seed_event(
        db,
        event_id="EVENT-001",
        event_no="NC-001",
        subject_id="SUBJECT-001",
        event_type="ELDER_MISSED_CHECKIN",
        description="老人连续 4 小时未提交平安签到，建议家属先确认当前平安。",
        created_at=now - timedelta(minutes=7),
        assignee_id=USER_IDS["family"],
        status="ASSIGNED",
        source="SCHEDULED_CHECKIN",
    )
    _seed_event(
        db,
        event_id="EVENT-002",
        event_no="NC-002",
        subject_id="SUBJECT-003",
        event_type="CHILD_PICKUP_TIMEOUT",
        description="约定接送时间已过，暂未收到监护人确认。",
        created_at=now - timedelta(minutes=12),
        assignee_id=USER_IDS["guardian_child"],
        status="ASSIGNED",
        source="SCHEDULED_CHECKIN",
    )
    _seed_event(
        db,
        event_id="EVENT-003",
        event_no="NC-003",
        subject_id="SUBJECT-002",
        event_type="ELDER_HELP",
        description="已安排今日助餐服务，老人反馈当前安全。",
        created_at=now - timedelta(hours=3),
        assignee_id=USER_IDS["worker"],
        status="CLOSED",
        source="MANUAL",
        closed=True,
    )
    db.commit()


def _seed_event(
    db: Session,
    *,
    event_id: str,
    event_no: str,
    subject_id: str,
    event_type: str,
    description: str,
    created_at,
    assignee_id: str,
    status: str,
    source: str,
    closed: bool = False,
) -> None:
    profile = db.get(RiskProfile, f"RISK-{subject_id.split('-')[-1]}")
    risk = calculate_risk(event_type, tags=profile.tags if profile else [])
    first_due, escalation_due = due_times(created_at, risk.level)
    event = CareEvent(
        id=event_id,
        event_no=event_no,
        subject_id=subject_id,
        event_type=event_type,
        source=source,
        risk_level=risk.level,
        risk_score=risk.score,
        risk_reasons=risk.reasons,
        status=status,
        description=description,
        occurred_at=created_at,
        created_at=created_at,
        first_response_due_at=first_due,
        escalation_due_at=escalation_due,
        current_assignee_id=assignee_id,
        escalation_level=0,
        closed_at=created_at + timedelta(minutes=20) if closed else None,
        closed_by=assignee_id if closed else None,
        close_reason="已完成助餐协助，家属确认当前安全。" if closed else None,
    )
    db.add(event)
    db.add(Assignment(
        id=f"ASSIGN-{event_id}", event_id=event_id, assignee_id=assignee_id,
        assignment_level=1, status="ACCEPTED" if closed else "ACTIVE", assigned_at=created_at,
        accepted_at=created_at + timedelta(minutes=2) if closed else None,
    ))
    db.add(ActionLog(id=f"LOG-{event_id}-CREATE", event_id=event_id, actor_id=assignee_id, action_type="EVENT_CREATED", content="事件已创建，进入照护事件闭环。", created_at=created_at))
    db.add(ActionLog(id=f"LOG-{event_id}-RISK", event_id=event_id, actor_id=assignee_id, action_type="RISK_CLASSIFIED", content=f"风险分级为 {risk.level}，风险分 {risk.score}。", created_at=created_at + timedelta(seconds=2)))
    db.add(ActionLog(id=f"LOG-{event_id}-ASSIGN", event_id=event_id, actor_id=assignee_id, action_type="ASSIGNED", content=f"已派给 {assignee_id} 继续跟进。", created_at=created_at + timedelta(seconds=4)))
    if closed:
        db.add(ActionLog(id=f"LOG-{event_id}-ACTION", event_id=event_id, actor_id=assignee_id, action_type="ASSIST_SERVICE", content="已完成助餐协助并确认老人当前安全。", created_at=created_at + timedelta(minutes=12)))
        db.add(ActionLog(id=f"LOG-{event_id}-CLOSE", event_id=event_id, actor_id=assignee_id, action_type="CONFIRMED_CLOSE", content="家属确认已解决，事件关闭。", created_at=created_at + timedelta(minutes=20)))
