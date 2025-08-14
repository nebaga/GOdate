from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from .models import User


def find_user_by_login_or_id(db: Session, login_or_id: str) -> Optional[User]:
    user: Optional[User] = None
    if login_or_id.isdigit():
        user = db.get(User, int(login_or_id))
    if user is None:
        user = db.query(User).filter(User.nickname == login_or_id).first()
    if user is None:
        user = db.query(User).filter(User.email == login_or_id).first()
    return user

