from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Any


ROLE_LABELS = {
    "FAMILY": "家属 / 监护人",
    "COMMUNITY_WORKER": "社区工作人员",
    "RESPONDER": "社区响应人",
    "ADMIN": "社区管理员",
}

SUBJECT_TYPE_LABELS = {"ELDER": "老人", "CHILD": "儿童"}
STATUS_LABELS = {
    "PENDING": "待处理",
    "ASSIGNED": "已派单",
    "IN_PROGRESS": "处理中",
    "WAITING_CONFIRM": "待确认",
    "CLOSED": "已关闭",
    "CANCELLED": "已取消",
}
RISK_LABELS = {"P0": "紧急", "P1": "高风险", "P2": "常规"}
RISK_COLORS = {"P0": "coral", "P1": "amber", "P2": "sky"}
ACTION_LABELS = {
    "EVENT_CREATED": "事件创建",
    "RISK_CLASSIFIED": "风险分级",
    "ASSIGNED": "派单",
    "ACCEPTED": "接单",
    "TRANSFERRED": "转派",
    "ESCALATED": "超时升级",
    "CHECK_IN": "平安签到",
    "CONFIRMED_CLOSE": "确认关闭",
    "FORCE_CLOSED": "授权关闭",
    "CANCELLED": "取消事件",
    "CALL": "电话联系",
    "ARRIVE_CHECK": "到场查看",
    "ASSIST_SERVICE": "协助服务",
    "CONTACT_GUARDIAN": "联系家属 / 监护人",
    "FALSE_REPORT": "误报说明",
    "OTHER": "其他",
}
# A safety check-in is a factual disposition that can support family closure.
DISPOSITION_TYPES = {"CALL", "ARRIVE_CHECK", "ASSIST_SERVICE", "CONTACT_GUARDIAN", "FALSE_REPORT", "OTHER", "CHECK_IN"}
EVENT_TYPES: dict[str, dict[str, Any]] = {
    "ELDER_MISSED_CHECKIN": {
        "label": "老人长时间未签到",
        "subject_type": "ELDER",
        "default_level": "P1",
        "min_level": "P1",
    },
    "ELDER_HELP": {
        "label": "老人主动求助",
        "subject_type": "ELDER",
        "default_level": "P1",
        "min_level": "P1",
    },
    "ELDER_SUSPECTED_FALL": {
        "label": "疑似老人跌倒或突发异常",
        "subject_type": "ELDER",
        "default_level": "P1",
        "min_level": "P1",
    },
    "CHILD_PICKUP_TIMEOUT": {
        "label": "儿童接送未确认",
        "subject_type": "CHILD",
        "default_level": "P1",
        "min_level": "P1",
    },
    "CHILD_CARE_CHECKIN_ABNORMAL": {
        "label": "儿童托管签到异常",
        "subject_type": "CHILD",
        "default_level": "P1",
        "min_level": "P1",
    },
    "CHILD_HELP": {
        "label": "儿童主动求助",
        "subject_type": "CHILD",
        "default_level": "P0",
        "min_level": "P0",
    },
}
BASE_SCORE = {"P0": 90, "P1": 60, "P2": 30}
DEADLINES_MINUTES = {"P0": (1, 3), "P1": (5, 10), "P2": (30, 60)}
LEVEL_ORDER = {"P2": 0, "P1": 1, "P0": 2}
CHINA_TZ = ZoneInfo("Asia/Shanghai")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def china_date(value: datetime | None):
    normalized = ensure_utc(value)
    return normalized.astimezone(CHINA_TZ).date() if normalized else None


@dataclass(frozen=True)
class RiskResult:
    level: str
    score: int
    reasons: list[dict[str, Any]]


def calculate_risk(
    event_type: str,
    *,
    tags: list[str] | None = None,
    unresponsive: bool = False,
    timed_out: bool = False,
    safe_confirmed: bool = False,
    urgency: str = "NORMAL",
) -> RiskResult:
    meta = EVENT_TYPES[event_type]
    base_level = meta["default_level"]
    if event_type == "ELDER_HELP" and urgency == "URGENT":
        base_level = "P0"

    reasons: list[dict[str, Any]] = [
        {"label": meta["label"], "delta": BASE_SCORE[base_level], "kind": "base"},
    ]
    score = BASE_SCORE[base_level]
    high_risk_tags = [tag for tag in (tags or []) if tag in {"独居", "高龄", "失能", "无人监护"}]
    for tag in high_risk_tags[:2]:
        score += 10
        reasons.append({"label": tag, "delta": 10, "kind": "tag"})
    if unresponsive:
        score += 15
        reasons.append({"label": "家属 / 监护人未响应", "delta": 15, "kind": "unresponsive"})
    if timed_out:
        score += 10
        reasons.append({"label": "超过响应时限", "delta": 10, "kind": "timeout"})
    if safe_confirmed:
        score -= 20
        reasons.append({"label": "已完成平安签到或人工确认安全", "delta": -20, "kind": "safe"})

    if score >= 80:
        computed = "P0"
    elif score >= 50:
        computed = "P1"
    else:
        computed = "P2"
    level = computed if LEVEL_ORDER[computed] >= LEVEL_ORDER[meta["min_level"]] else meta["min_level"]
    return RiskResult(level=level, score=max(score, 0), reasons=reasons)


def due_times(created_at: datetime, level: str) -> tuple[datetime, datetime]:
    first, escalation = DEADLINES_MINUTES[level]
    return created_at + timedelta(minutes=first), created_at + timedelta(minutes=escalation)


def can_see_role(role: str, event_assignee_id: str | None, user_id: str) -> bool:
    return role in {"COMMUNITY_WORKER", "ADMIN"} or (
        role == "RESPONDER" and event_assignee_id == user_id
    )
