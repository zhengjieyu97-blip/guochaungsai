from __future__ import annotations

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from .db import get_db
from .models import User
from .services import DomainError


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user_id = request.session.get("user_id")
    if not user_id:
        raise DomainError("AUTH_REQUIRED", "请先选择一个演示角色登录。", 401)
    user = db.get(User, user_id)
    if not user or not user.active:
        request.session.clear()
        raise DomainError("AUTH_REQUIRED", "演示会话已失效，请重新登录。", 401)
    return user
