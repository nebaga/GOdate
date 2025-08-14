from __future__ import annotations

from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field

from .models import RequestType, RequestStatus


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    nickname: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    nickname: str
    avatar_url: Optional[str] = None
    rating: int

    class Config:
        from_attributes = True


class Profile(BaseModel):
    id: int
    email: EmailStr
    nickname: str
    avatar_url: Optional[str]
    rating: int
    soulmate: Optional[UserPublic] = None
    friends: List[UserPublic] = []


class SimpleOk(BaseModel):
    ok: bool = True


class RequestCreate(BaseModel):
    login_or_id: str
    type: RequestType


class RequestAct(BaseModel):
    request_id: int
    action: str


class RequestItem(BaseModel):
    id: int
    from_user: UserPublic
    to_user: UserPublic
    type: RequestType
    status: RequestStatus
    created_at: datetime


class MessagesResponse(BaseModel):
    incoming: List[RequestItem]
    outgoing: List[RequestItem]


class DailyTaskPublic(BaseModel):
    code: str
    title: str
    description: str
    reward_points: int


class DailyTodayResponse(BaseModel):
    date: date
    task: DailyTaskPublic
    completed: bool


class DailyCompleteResponse(BaseModel):
    awarded_points: int
    new_rating: int


class RoutePoint(BaseModel):
    name: str
    description: Optional[str] = None
    lat: float
    lon: float


class RoutePublic(BaseModel):
    id: int
    title: str
    description: str
    city: str
    time_minutes: int
    budget: int
    likes: int = 0
    points: List[RoutePoint] = []

    class Config:
        from_attributes = True


class RatingItem(BaseModel):
    user_id: int
    nickname: str
    rating: int


class AvatarUpdate(BaseModel):
    avatar_url: str


class LikeAction(BaseModel):
    route_id: int


class RouteCreate(BaseModel):
    title: str
    description: str
    city: str
    time_minutes: int
    budget: int
    points: List[RoutePoint] = []


class RecommendationRequest(BaseModel):
    city: str
    description: str
    places: int


class Coordinate(BaseModel):
    lat: float
    lon: float


class RecommendationStep(BaseModel):
    name: str
    coordinate: Coordinate
    hint: Optional[str] = None


class RecommendationResponse(BaseModel):
    city: str
    description: str
    places: int
    steps: List[RecommendationStep]



# AI generation (external LLM-backed route text + parsed coordinates)
class AIGenerateRequest(BaseModel):
    city: str
    budget: int
    people: int
    time: int
    places: int
    transport: str
    whatai: str


class AIGenerateResponse(BaseModel):
    route: str
    coordinates: dict
    used_words: int
    
    # Дополнительно: структурированные места (если модель вернула COORDS_JSON)
    class AIPlace(BaseModel):
        name: str
        address: Optional[str] = None
        lat: Optional[float] = None
        lon: Optional[float] = None

    places: List[AIPlace] = []
