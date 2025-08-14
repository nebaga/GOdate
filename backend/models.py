from __future__ import annotations

from datetime import datetime, date
from enum import Enum
from typing import Optional

from sqlalchemy import (
    Integer,
    String,
    DateTime,
    ForeignKey,
    Enum as SAEnum,
    UniqueConstraint,
    Date,
    Text,
)
from sqlalchemy.orm import relationship, Mapped, mapped_column

from .database import Base


class RequestType(str, Enum):
    friend = "friend"
    soulmate = "soulmate"


class RequestStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    nickname: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    rating: Mapped[int] = mapped_column(Integer, default=0)
    soulmate_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    soulmate: Mapped[Optional["User"]] = relationship("User", remote_side=[id], uselist=False)


class FriendRequest(Base):
    __tablename__ = "friend_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    from_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    to_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[RequestType] = mapped_column(SAEnum(RequestType), nullable=False)
    status: Mapped[RequestStatus] = mapped_column(SAEnum(RequestStatus), default=RequestStatus.pending)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("from_user_id", "to_user_id", "type", name="uq_request_unique"),
    )


class DailyTask(Base):
    __tablename__ = "daily_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    reward_points: Mapped[int] = mapped_column(Integer, default=0)


class GlobalDaily(Base):
    __tablename__ = "global_daily"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    date: Mapped[date] = mapped_column(Date, unique=True, index=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("daily_tasks.id"), nullable=False)

    task: Mapped[DailyTask] = relationship("DailyTask")


class DailyCompletion(Base):
    __tablename__ = "daily_completion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("daily_tasks.id"))

    __table_args__ = (
        UniqueConstraint("user_id", "date", "task_id", name="uq_user_daily_once"),
    )


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    creator_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    city: Mapped[str] = mapped_column(String(50), nullable=False)
    time_minutes: Mapped[int] = mapped_column(Integer, default=0)
    budget: Mapped[int] = mapped_column(Integer, default=0)
    points_json: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RouteLike(Base):
    __tablename__ = "route_likes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    route_id: Mapped[int] = mapped_column(Integer, ForeignKey("routes.id"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("route_id", "user_id", name="uq_route_like_unique"),
    )


class LikesAward(Base):
    __tablename__ = "likes_award"

    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), primary_key=True)
    awarded_count: Mapped[int] = mapped_column(Integer, default=0)


class FavoriteRoute(Base):
    __tablename__ = "favorite_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    route_id: Mapped[int] = mapped_column(Integer, ForeignKey("routes.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "route_id", name="uq_favorite_route_unique"),
    )


