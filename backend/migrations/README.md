# 邻里智护数据库迁移

第一阶段启动时会调用 SQLAlchemy `create_all`，保证比赛现场零配置可运行。`versions/0001_initial.py` 保留了与 Alembic 兼容的首个迁移入口；后续表结构变化应新增版本文件，不要直接修改已运行的表。
