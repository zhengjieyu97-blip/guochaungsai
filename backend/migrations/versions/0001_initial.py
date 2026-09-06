"""Create the first-stage neighbor-care schema."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("phone_masked", sa.String(length=32), nullable=False),
        sa.Column("community_id", sa.String(length=40), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_community_id", "users", ["community_id"])

    op.create_table(
        "households",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("building_text", sa.String(length=120), nullable=False),
        sa.Column("community_id", sa.String(length=40), nullable=False),
    )
    op.create_index("ix_households_community_id", "households", ["community_id"])

    op.create_table(
        "care_subjects",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("subject_type", sa.String(length=16), nullable=False),
        sa.Column("age", sa.Integer(), nullable=False),
        sa.Column("gender", sa.String(length=16), nullable=False),
        sa.Column("household_id", sa.String(length=40), sa.ForeignKey("households.id"), nullable=False),
        sa.Column("location_text", sa.String(length=120), nullable=False),
        sa.Column("last_check_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_care_subjects_subject_type", "care_subjects", ["subject_type"])
    op.create_index("ix_care_subjects_household_id", "care_subjects", ["household_id"])

    op.create_table(
        "relationships",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("subject_id", sa.String(length=40), sa.ForeignKey("care_subjects.id"), nullable=False),
        sa.Column("user_id", sa.String(length=40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("relationship_type", sa.String(length=32), nullable=False),
        sa.Column("can_confirm", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("can_view", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("can_pickup", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("subject_id", "user_id", "relationship_type"),
    )
    op.create_index("ix_relationships_subject_id", "relationships", ["subject_id"])
    op.create_index("ix_relationships_user_id", "relationships", ["user_id"])

    op.create_table(
        "risk_profiles",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("subject_id", sa.String(length=40), sa.ForeignKey("care_subjects.id"), nullable=False),
        sa.Column("tags", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("check_in_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("check_in_interval_hours", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("pickup_plan_text", sa.String(length=160), nullable=True),
        sa.Column("notes_safe", sa.Text(), nullable=True),
        sa.UniqueConstraint("subject_id"),
    )

    op.create_table(
        "care_events",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("event_no", sa.String(length=40), nullable=False),
        sa.Column("subject_id", sa.String(length=40), sa.ForeignKey("care_subjects.id"), nullable=False),
        sa.Column("event_type", sa.String(length=48), nullable=False),
        sa.Column("source", sa.String(length=24), nullable=False),
        sa.Column("risk_level", sa.String(length=4), nullable=False),
        sa.Column("risk_score", sa.Integer(), nullable=False),
        sa.Column("risk_reasons", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("first_response_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("escalation_due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("current_assignee_id", sa.String(length=40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("escalation_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_by", sa.String(length=40), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("close_reason", sa.Text(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("event_no"),
    )
    op.create_index("ix_care_events_event_no", "care_events", ["event_no"], unique=True)
    op.create_index("ix_care_events_subject_id", "care_events", ["subject_id"])
    op.create_index("ix_care_events_event_type", "care_events", ["event_type"])
    op.create_index("ix_care_events_risk_level", "care_events", ["risk_level"])
    op.create_index("ix_care_events_status", "care_events", ["status"])
    op.create_index("ix_care_events_current_assignee_id", "care_events", ["current_assignee_id"])
    op.create_index("ix_care_events_status_created", "care_events", ["status", "created_at"])
    op.create_index("ix_care_events_risk_status", "care_events", ["risk_level", "status"])
    op.create_index("ix_care_events_assignee_status", "care_events", ["current_assignee_id", "status"])

    op.create_table(
        "assignments",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("event_id", sa.String(length=40), sa.ForeignKey("care_events.id"), nullable=False),
        sa.Column("assignee_id", sa.String(length=40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("resource_id", sa.String(length=40), nullable=True),
        sa.Column("assignment_level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(length=24), nullable=False, server_default="ACTIVE"),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transferred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transfer_reason", sa.Text(), nullable=True),
    )
    op.create_index("ix_assignments_event_id", "assignments", ["event_id"])
    op.create_index("ix_assignments_assignee_id", "assignments", ["assignee_id"])

    op.create_table(
        "action_logs",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("event_id", sa.String(length=40), sa.ForeignKey("care_events.id"), nullable=False),
        sa.Column("actor_id", sa.String(length=40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("action_type", sa.String(length=40), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_action_logs_event_id", "action_logs", ["event_id"])
    op.create_index("ix_action_logs_event_created", "action_logs", ["event_id", "created_at"])

    op.create_table(
        "notifications",
        sa.Column("id", sa.String(length=40), primary_key=True),
        sa.Column("recipient_id", sa.String(length=40), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("event_id", sa.String(length=40), sa.ForeignKey("care_events.id"), nullable=True),
        sa.Column("notification_type", sa.String(length=40), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_notifications_recipient_id", "notifications", ["recipient_id"])
    op.create_index("ix_notifications_event_id", "notifications", ["event_id"])
    op.create_index("ix_notifications_recipient_read_created", "notifications", ["recipient_id", "read_at", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_notifications_recipient_read_created", table_name="notifications")
    op.drop_index("ix_notifications_event_id", table_name="notifications")
    op.drop_index("ix_notifications_recipient_id", table_name="notifications")
    op.drop_table("notifications")

    op.drop_index("ix_action_logs_event_created", table_name="action_logs")
    op.drop_index("ix_action_logs_event_id", table_name="action_logs")
    op.drop_table("action_logs")

    op.drop_index("ix_assignments_assignee_id", table_name="assignments")
    op.drop_index("ix_assignments_event_id", table_name="assignments")
    op.drop_table("assignments")

    op.drop_index("ix_care_events_assignee_status", table_name="care_events")
    op.drop_index("ix_care_events_risk_status", table_name="care_events")
    op.drop_index("ix_care_events_status_created", table_name="care_events")
    op.drop_index("ix_care_events_current_assignee_id", table_name="care_events")
    op.drop_index("ix_care_events_status", table_name="care_events")
    op.drop_index("ix_care_events_risk_level", table_name="care_events")
    op.drop_index("ix_care_events_event_type", table_name="care_events")
    op.drop_index("ix_care_events_subject_id", table_name="care_events")
    op.drop_index("ix_care_events_event_no", table_name="care_events")
    op.drop_table("care_events")

    op.drop_table("risk_profiles")

    op.drop_index("ix_relationships_user_id", table_name="relationships")
    op.drop_index("ix_relationships_subject_id", table_name="relationships")
    op.drop_table("relationships")

    op.drop_index("ix_care_subjects_household_id", table_name="care_subjects")
    op.drop_index("ix_care_subjects_subject_type", table_name="care_subjects")
    op.drop_table("care_subjects")

    op.drop_index("ix_households_community_id", table_name="households")
    op.drop_table("households")

    op.drop_index("ix_users_community_id", table_name="users")
    op.drop_index("ix_users_role", table_name="users")
    op.drop_table("users")
