from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_start_script_is_foreground_only():
    script = (PROJECT_ROOT / "start.ps1").read_text(encoding="utf-8")

    assert "-NoNewWindow" in script
    assert "-WindowStyle Hidden" not in script
    assert "Wait-Endpoint" in script
    assert "'--log-level', 'info'" in script


def test_double_click_wrappers_delegate_to_visible_scripts():
    start_wrapper = (PROJECT_ROOT / "start.cmd").read_text(encoding="utf-8")
    stop_wrapper = (PROJECT_ROOT / "stop.cmd").read_text(encoding="utf-8")

    assert "start.ps1" in start_wrapper
    assert "stop.ps1" in stop_wrapper
    assert "pause" in start_wrapper.lower()
    assert "pause" in stop_wrapper.lower()
