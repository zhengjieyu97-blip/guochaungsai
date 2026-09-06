# 邻里智护

面向完整社区“一老一小”的照护事件闭环与应急协同平台。

## 本地启动

环境要求：Python 3.11+、Node.js 20+。

```powershell
cd "C:\VScode项目\guochaungsai\guochaungsai"
pip install -r backend/requirements.txt
cd backend
alembic upgrade head
cd ..
cd frontend
npm install
cd ..
.\start.ps1
```

打开 [http://127.0.0.1:5173/login](http://127.0.0.1:5173/login)，选择四个预置演示角色之一。后端 API 文档位于 [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)。

应用启动时会自动执行 `alembic upgrade head`。已有旧版演示数据库会被自动登记为当前迁移版本，不会删除其中的数据；无需在启动后再次执行迁移命令。

## 目录

- `backend/app/`：FastAPI、SQLAlchemy、SQLite、风险策略和照护事件命令。
- `backend/tests/`：风险规则、权限与事件闭环 API 测试。
- `frontend/src/`：Vue 3 + TypeScript + Vite 正式前端，包含事件中心、对象档案、模拟台、详情时间线和看板。
- `frontend/tests/`：Vitest API 客户端测试与 Playwright 核心流程。
- `prototype/`：原始交互参考，未作为正式前端代码复用。

## 演示路径

1. 社区工作人员登录，进入“模拟事件台”，点击“老人 4 小时未签到”。
2. 在事件详情查看 P0/P1 风险原因、责任人和时间线，点击“模拟超时”验证升级通知。
3. 接单后记录电话联系或到场查看，并勾选“本次处置已完成”。
4. 切换到家属视角，点击“确认已解决”，事件进入只读关闭状态。
5. 儿童接送超时场景复用同一套派单、处置和确认闭环。

## 验证命令

```powershell
cd backend; pytest -q
cd ..\frontend; npm test; npm run build
```

Playwright 首次运行需要准备浏览器：`npx playwright install chromium`，然后执行 `npm run test:e2e`。
