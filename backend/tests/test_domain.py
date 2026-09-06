from app.domain import calculate_risk


def test_risk_calculation_is_explainable_and_respects_minimum_level():
    result = calculate_risk(
        "ELDER_MISSED_CHECKIN",
        tags=["独居", "高龄", "失能"],
        unresponsive=True,
        timed_out=True,
    )
    assert result.level == "P0"
    assert result.score == 105
    assert [reason["label"] for reason in result.reasons] == [
        "老人长时间未签到",
        "独居",
        "高龄",
        "家属 / 监护人未响应",
        "超过响应时限",
    ]


def test_safe_confirmation_reduces_score_but_cannot_break_event_minimum():
    result = calculate_risk("CHILD_HELP", safe_confirmed=True)
    assert result.score == 70
    assert result.level == "P0"


def test_urgent_elder_help_becomes_p0():
    result = calculate_risk("ELDER_HELP", urgency="URGENT")
    assert result.level == "P0"
    assert result.score == 90
