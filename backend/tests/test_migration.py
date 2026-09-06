from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from pathlib import Path


def test_alembic_upgrade_is_repeatable(tmp_path: Path):
    backend_root = Path(__file__).resolve().parents[1]
    database_path = tmp_path / "migration.db"
    environment = os.environ.copy()
    environment["NEIGHBOR_CARE_DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"

    command = [sys.executable, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"]
    first = subprocess.run(command, cwd=backend_root, env=environment, capture_output=True, text=True)
    assert first.returncode == 0, first.stderr
    second = subprocess.run(command, cwd=backend_root, env=environment, capture_output=True, text=True)
    assert second.returncode == 0, second.stderr

    with sqlite3.connect(database_path) as connection:
        tables = {row[0] for row in connection.execute("select name from sqlite_master where type = 'table'")}
    assert {"users", "care_subjects", "care_events", "notifications", "alembic_version"} <= tables


def test_alembic_upgrade_adopts_legacy_create_all_schema(tmp_path: Path):
    backend_root = Path(__file__).resolve().parents[1]
    database_path = tmp_path / "legacy.db"
    environment = os.environ.copy()
    environment["NEIGHBOR_CARE_DATABASE_URL"] = f"sqlite:///{database_path.as_posix()}"

    bootstrap = subprocess.run(
        [sys.executable, "-c", "from app.db import create_tables; create_tables()"],
        cwd=backend_root,
        env=environment,
        capture_output=True,
        text=True,
    )
    assert bootstrap.returncode == 0, bootstrap.stderr

    command = [sys.executable, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"]
    migrated = subprocess.run(command, cwd=backend_root, env=environment, capture_output=True, text=True)
    assert migrated.returncode == 0, migrated.stderr

    with sqlite3.connect(database_path) as connection:
        revision = connection.execute("select version_num from alembic_version").fetchone()
    assert revision == ("0001_initial",)
