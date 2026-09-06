from __future__ import annotations

import os
import sys
from pathlib import Path
from tempfile import mkdtemp

import pytest


os.environ["NEIGHBOR_CARE_DATA_DIR"] = mkdtemp(prefix="neighbor-care-test-")
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def logged_client(client):
    response = client.post("/api/demo-login", json={"role": "COMMUNITY_WORKER"})
    assert response.status_code == 200
    return client
