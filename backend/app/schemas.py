from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class DemoLoginRequest(BaseModel):
    role: Literal["FAMILY", "COMMUNITY_WORKER", "RESPONDER", "ADMIN"]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    role: str
    title: str
    phone_masked: str
    community_id: str


class SessionOut(BaseModel):
    user: UserOut
    permissions: list[str]


class SubjectOut(BaseModel):
    id: str
    name: str
    subject_type: str
    subject_type_label: str
    age: int
    gender: str
    household_id: str
    household_name: str
    building_text: str
    location_text: str
    phone_masked: str | None = None
    risk_tags: list[str]
    last_check_in_at: datetime | None
    open_event_count: int
    relationships: list[dict[str, Any]] = Field(default_factory=list)
    check_in_interval_hours: int | None = None
    pickup_plan_text: str | None = None
    notes_safe: str | None = None


class CreateEventRequest(BaseModel):
    subject_id: str
    event_type: str
    source: Literal["MANUAL", "SCHEDULED_CHECKIN", "SIMULATOR"] = "MANUAL"
    description: str = Field(min_length=1, max_length=1000)
    urgency: Literal["NORMAL", "URGENT"] = "NORMAL"
    occurred_at: datetime | None = None


class AssignRequest(BaseModel):
    assignee_id: str
    reason: str = Field(min_length=1, max_length=500)


class ActionRequest(BaseModel):
    action_type: Literal[
        "CALL",
        "ARRIVE_CHECK",
        "ASSIST_SERVICE",
        "CONTACT_GUARDIAN",
        "FALSE_REPORT",
        "OTHER",
    ]
    content: str = Field(min_length=1, max_length=2000)
    complete: bool = False


class CloseRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=1000)


class EventOut(BaseModel):
    id: str
    event_no: str
    subject_id: str
    subject_name: str
    subject_type: str
    subject_type_label: str
    subject_age: int
    event_type: str
    event_type_label: str
    source: str
    risk_level: str
    risk_level_label: str
    risk_score: int
    risk_reasons: list[dict[str, Any]]
    status: str
    status_label: str
    description: str
    occurred_at: datetime
    created_at: datetime
    first_response_due_at: datetime
    escalation_due_at: datetime
    current_assignee_id: str | None
    current_assignee_name: str | None
    current_assignee_title: str | None
    escalation_level: int
    closed_at: datetime | None
    closed_by: str | None
    close_reason: str | None
    timed_out: bool = False
    actions_count: int = 0
    timeline: list[dict[str, Any]] = Field(default_factory=list)
    assignments: list[dict[str, Any]] = Field(default_factory=list)


class NotificationOut(BaseModel):
    id: str
    event_id: str | None
    notification_type: str
    title: str
    content: str
    read_at: datetime | None
    created_at: datetime


class DashboardSummary(BaseModel):
    today_total: int
    open_total: int
    pending_total: int
    in_progress_total: int
    overdue_total: int
    closed_today: int
    risk_counts: dict[str, int]
    subject_type_counts: dict[str, int]
    event_type_counts: dict[str, int]
    average_first_response_minutes: float
    overdue_rate: float
    close_trend: list[dict[str, Any]]
