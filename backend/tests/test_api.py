from __future__ import annotations


def test_login_people_and_event_visibility(client):
    response = client.get("/api/events")
    assert response.status_code == 401

    login = client.post("/api/demo-login", json={"role": "FAMILY"})
    assert login.status_code == 200
    assert login.json()["user"]["name"] == "李晨"

    people = client.get("/api/people")
    assert people.status_code == 200
    assert {item["name"] for item in people.json()["items"]} >= {"李秀梅", "陈小雨"}

    events = client.get("/api/events")
    assert events.status_code == 200
    assert all(item["subject_name"] in {"李秀梅", "王建国", "陈小雨", "周子涵"} for item in events.json()["items"])


def test_production_spa_serves_history_routes(client):
    response = client.get("/login")
    assert response.status_code == 200
    assert "<div id=\"app\"></div>" in response.text


def test_demo_role_switch_uses_primary_accounts(client):
    expected = {
        "FAMILY": "李晨",
        "COMMUNITY_WORKER": "赵敏",
        "RESPONDER": "张师傅",
        "ADMIN": "社区管理员",
    }
    for role, name in expected.items():
        response = client.post("/api/demo-login", json={"role": role})
        assert response.status_code == 200
        assert response.json()["user"]["name"] == name


def test_notification_read_commands_write_utc_timestamps(logged_client):
    created = logged_client.post(
        "/api/events",
        json={
            "subject_id": "SUBJECT-001",
            "event_type": "ELDER_MISSED_CHECKIN",
            "source": "SIMULATOR",
            "description": "验证通知已读命令。",
        },
    )
    assert created.status_code == 200

    notifications = logged_client.get("/api/notifications").json()["items"]
    assert notifications
    first = logged_client.patch(f"/api/notifications/{notifications[0]['id']}/read")
    assert first.status_code == 200
    assert first.json()["read_at"]

    all_read = logged_client.post("/api/notifications/read-all")
    assert all_read.status_code == 200
    remaining = logged_client.get("/api/notifications").json()["items"]
    assert all(item["read_at"] for item in remaining)


def test_create_event_creates_timeline_assignment_and_notifications(logged_client):
    response = logged_client.post(
        "/api/events",
        json={
            "subject_id": "SUBJECT-001",
            "event_type": "ELDER_SUSPECTED_FALL",
            "source": "SIMULATOR",
            "description": "疑似在卧室发生跌倒，需要人工确认。",
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["risk_reasons"]
    assert {item["action_type"] for item in payload["timeline"]} >= {"EVENT_CREATED", "RISK_CLASSIFIED", "ASSIGNED"}
    assert payload["current_assignee_name"]
    notifications = logged_client.get("/api/notifications")
    assert notifications.status_code == 200
    assert notifications.json()["total"] >= 1


def test_elder_flow_timeout_accept_action_and_family_close(logged_client):
    created = logged_client.post(
        "/api/events",
        json={
            "subject_id": "SUBJECT-001",
            "event_type": "ELDER_MISSED_CHECKIN",
            "source": "SIMULATOR",
            "description": "演示老人未签到闭环。",
        },
    ).json()
    event_id = created["id"]

    escalated = logged_client.post(f"/api/events/{event_id}/simulate-timeout")
    assert escalated.status_code == 200
    assert escalated.json()["escalation_level"] == 1

    accepted = logged_client.post(f"/api/events/{event_id}/accept")
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "IN_PROGRESS"

    action = logged_client.post(
        f"/api/events/{event_id}/actions",
        json={"action_type": "CALL", "content": "已电话联系家属，确认老人当前平安。", "complete": True},
    )
    assert action.status_code == 200
    assert action.json()["status"] == "WAITING_CONFIRM"

    login_family = logged_client.post("/api/demo-login", json={"role": "FAMILY"})
    assert login_family.status_code == 200
    closed = logged_client.post(f"/api/events/{event_id}/confirm-close", json={"reason": "家属确认老人已安全。"})
    assert closed.status_code == 200
    assert closed.json()["status"] == "CLOSED"

    readonly = logged_client.post(f"/api/events/{event_id}/actions", json={"action_type": "OTHER", "content": "不应写入", "complete": False})
    assert readonly.status_code == 409
    assert readonly.json()["code"] == "EVENT_STATE_CONFLICT"


def test_family_check_in_is_valid_close_evidence(client):
    assert client.post("/api/demo-login", json={"role": "COMMUNITY_WORKER"}).status_code == 200
    assert client.post("/api/demo/reset").status_code == 200
    assert client.post("/api/demo-login", json={"role": "FAMILY"}).status_code == 200

    created = client.post(
        "/api/events",
        json={
            "subject_id": "SUBJECT-001",
            "event_type": "ELDER_MISSED_CHECKIN",
            "source": "SIMULATOR",
            "description": "家属确认老人当前平安。",
        },
    ).json()
    checked_in = client.post(f"/api/events/{created['id']}/check-in")
    assert checked_in.status_code == 200
    assert checked_in.json()["status"] == "WAITING_CONFIRM"

    closed = client.post(f"/api/events/{created['id']}/confirm-close", json={"reason": "已完成平安确认。"})
    assert closed.status_code == 200
    assert closed.json()["status"] == "CLOSED"


def test_responder_cannot_check_in_an_unassigned_event(client):
    assert client.post("/api/demo-login", json={"role": "COMMUNITY_WORKER"}).status_code == 200
    assert client.post("/api/demo/reset").status_code == 200
    assert client.post("/api/demo-login", json={"role": "RESPONDER"}).status_code == 200

    response = client.post("/api/events/EVENT-001/check-in")
    assert response.status_code == 403


def test_timeout_is_idempotent_after_second_escalation(logged_client):
    created = logged_client.post(
        "/api/events",
        json={
            "subject_id": "SUBJECT-004",
            "event_type": "CHILD_CARE_CHECKIN_ABNORMAL",
            "source": "SIMULATOR",
            "description": "儿童托管签到异常演示。",
        },
    ).json()
    event_id = created["id"]
    first = logged_client.post(f"/api/events/{event_id}/simulate-timeout").json()
    second = logged_client.post(f"/api/events/{event_id}/simulate-timeout").json()
    third = logged_client.post(f"/api/events/{event_id}/simulate-timeout").json()
    assert first["escalation_level"] == 1
    assert second["escalation_level"] == 2
    assert third["escalation_level"] == 2


def test_family_cannot_force_close_or_view_unrelated_resource(client):
    client.post("/api/demo-login", json={"role": "FAMILY"})
    close = client.post("/api/events/EVENT-001/close", json={"reason": "越权关闭"})
    assert close.status_code == 403
    resources = client.get("/api/resources")
    assert resources.status_code == 200
    assert resources.json()["items"] == []
