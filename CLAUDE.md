# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"邻里智护" (Neighbor Care) is an event loop and emergency coordination platform designed for elderly and child care in communities ("一老一小").
- **Architecture**: Modular Monolith, decoupled frontend and backend.
- **Backend**: Python 3.11+ / FastAPI / SQLAlchemy 2.0 / Alembic / SQLite.
- **Frontend**: Vue 3 / TypeScript / Vite / Pinia / Vue Router / Lucide Icons / ECharts.
- **Key Domain Context**: Follow standard terminology defined in `CONTEXT.md` (e.g. 照护对象, 家属/监护人, 社区响应人, 照护事件, 照护任务, 平安签到). Avoid generic terms like "user", "patient", "order", "alarm".

---

## Development Commands

### Full-Stack Local Run
- **Start both backend & frontend**: `powershell -ExecutionPolicy Bypass -File .\start.ps1` (or specify `-BackendPort 8000 -FrontendPort 5173`)
- **Stop running services**: `powershell -ExecutionPolicy Bypass -File .\stop.ps1`

### Backend (Python / FastAPI)
*Run inside `./backend` directory with `PYTHONPATH=.`*
- **Run server**: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload`
- **Run all tests**: `pytest`
- **Run single test file**: `pytest tests/test_api.py`
- **Run single test function**: `pytest tests/test_api.py -k test_login_people_and_event_visibility`
- **Database migrations**:
  - Apply migrations: `alembic upgrade head`
  - Generate migration: `alembic revision --autogenerate -m "<message>"`

### Frontend (Vue 3 / TypeScript)
*Run inside `./frontend` directory*
- **Dev server**: `npm run dev` (proxies `/api` to `http://127.0.0.1:8000`)
- **Type check & Build**: `npm run build`
- **Run unit/component tests**: `npm run test` (Vitest)
- **Run single test file**: `npx vitest run tests/components/Navbar.spec.ts`
- **Run E2E tests**: `npm run test:e2e` (Playwright)

---

## High-Level Architecture & Core Rules

### 1. State Machine & Event Loop
- All care event state transitions (`PENDING` -> `ASSIGNED` -> `IN_PROGRESS` -> `WAITING_CONFIRM` -> `CLOSED` / `CANCELLED`) **must** be processed through backend domain services (`backend/app/services.py`).
- Frontend components must **never** mutate business statuses directly; all operations must go through API endpoints.
- Every state change or action (creation, assignment, accept, transfer, escalate, check-in, close) **must** write a corresponding timeline item (`Timeline`) and notification (`Notification`).

### 2. Risk Classification & Escalation
- Risk levels (`P0`, `P1`, `P2`) are calculated dynamically based on event types, subject risk tags (e.g. 独居, 高龄, 慢病), time windows, and response delays.
- Calculations must produce explainable reasons (`risk_reasons` array with labels and deltas) for frontend display.
- Timeout scheduler (`backend/app/scheduler.py`) runs periodically in the background to handle automatic escalation when responses or handling exceed SLA limits.

### 3. Authentication & Roles
- Demo authentication using session cookies (`/api/demo-login` with roles: `FAMILY`, `COMMUNITY_WORKER`, `RESPONDER`, `ADMIN`).
- Data access and event visibility are filtered per role (e.g. family members only see events related to their bound subjects).

### 4. Git & Delivery Workflow (from `AGENTS.md`)
- Create a dedicated Git commit after completing any feature or bug fix.
- Ensure all tests and type checks pass prior to delivery.
- Push changes to GitHub (`origin main` at `https://github.com/zhengjieyu97-blip/guochaungsai.git`) and verify local/remote consistency.
