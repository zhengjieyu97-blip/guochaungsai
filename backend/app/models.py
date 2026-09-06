from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(80), nullable=False, default="社区响应人")
    phone_masked: Mapped[str] = mapped_column(String(32), nullable=False)
    community_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Household(Base):
    __tablename__ = "households"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    building_text: Mapped[str] = mapped_column(String(120), nullable=False)
    community_id: Mapped[str] = mapped_column(String(40), nullable=False, index=True)


class CareSubject(Base):
    __tablename__ = "care_subjects"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    subject_type: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    age: Mapped[int] = mapped_column(Integer, nullable=False)
    gender: Mapped[str] = mapped_column(String(16), nullable=False)
    household_id: Mapped[str] = mapped_column(ForeignKey("households.id"), nullable=False, index=True)
    location_text: Mapped[str] = mapped_column(String(120), nullable=False)
    last_check_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class Relationship(Base):
    __tablename__ = "relationships"
    __table_args__ = (UniqueConstraint("subject_id", "user_id", "relationship_type"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    subject_id: Mapped[str] = mapped_column(ForeignKey("care_subjects.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    relationship_type: Mapped[str] = mapped_column(String(32), nullable=False)
    can_confirm: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_view: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    can_pickup: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class RiskProfile(Base):
    __tablename__ = "risk_profiles"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    subject_id: Mapped[str] = mapped_column(ForeignKey("care_subjects.id"), nullable=False, unique=True)
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    check_in_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    check_in_interval_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    pickup_plan_text: Mapped[str | None] = mapped_column(String(160), nullable=True)
    notes_safe: Mapped[str | None] = mapped_column(Text, nullable=True)


class CareEvent(Base):
    __tablename__ = "care_events"
    __table_args__ = (
        Index("ix_care_events_status_created", "status", "created_at"),
        Index("ix_care_events_risk_status", "risk_level", "status"),
        Index("ix_care_events_assignee_status", "current_assignee_id", "status"),
    )

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    event_no: Mapped[str] = mapped_column(String(40), nullable=False, unique=True)
    subject_id: Mapped[str] = mapped_column(ForeignKey("care_subjects.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(24), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(4), nullable=False, index=True)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_reasons: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(24), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    first_response_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    escalation_due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_assignee_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    escalation_level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    close_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("care_events.id"), nullable=False, index=True)
    assignee_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    resource_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    assignment_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="ACTIVE")
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    transferred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    transfer_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class ActionLog(Base):
    __tablename__ = "action_logs"
    __table_args__ = (Index("ix_action_logs_event_created", "event_id", "created_at"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("care_events.id"), nullable=False, index=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    action_type: Mapped[str] = mapped_column(String(40), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_recipient_read_created", "recipient_id", "read_at", "created_at"),)

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    recipient_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    event_id: Mapped[str | None] = mapped_column(ForeignKey("care_events.id"), nullable=True, index=True)
    notification_type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
