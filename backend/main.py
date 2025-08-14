from __future__ import annotations

import json
import random
from datetime import date, timedelta
from typing import List, Optional
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from .database import Base, engine, get_db, SessionLocal
from .models import User, FriendRequest, RequestType, RequestStatus, DailyTask, GlobalDaily, DailyCompletion, Route, RouteLike, LikesAward, FavoriteRoute
from .schemas import (
    Token,
    UserCreate,
    UserLogin,
    UserPublic,
    Profile,
    SimpleOk,
    RequestCreate,
    RequestAct,
    MessagesResponse,
    RequestItem,
    DailyTodayResponse,
    DailyTaskPublic,
    DailyCompleteResponse,
    RoutePublic,
    RouteCreate,
    RoutePoint,
    RatingItem,
    RecommendationRequest,
    RecommendationResponse,
    RecommendationStep,
    Coordinate,
    AIGenerateRequest,
    AIGenerateResponse,
    AvatarUpdate,
    LikeAction,
)
from .auth import get_password_hash, verify_password, create_access_token, get_current_user
from .utils import find_user_by_login_or_id
import requests


app = FastAPI(title="GOdate API", openapi_url="/api/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(DailyTask).count() == 0:
            tasks = [
                DailyTask(
                    code="add_friend",
                    title="Добавить нового друга",
                    description="Добавьте нового друга сегодня",
                    reward_points=20,
                ),
                DailyTask(
                    code="date_out",
                    title="Сходить на свидание",
                    description="Кино/ресторан/парк — засчитывается по кнопке",
                    reward_points=40,
                ),
                DailyTask(
                    code="create_route",
                    title="Создать свой маршрут",
                    description="Создайте маршрут и поделитесь с другими",
                    reward_points=30,
                ),
            ]
            db.add_all(tasks)
            db.commit()
        # Убрано автосоздание демо-маршрутов
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    init_db()


# Auth endpoints
@app.post("/api/auth/register", response_model=UserPublic)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter((User.email == payload.email) | (User.nickname == payload.nickname)).first():
        raise HTTPException(status_code=400, detail="Email или ник уже заняты")
    user = User(
        email=payload.email,
        nickname=payload.nickname,
        password_hash=get_password_hash(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверные учетные данные")
    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token)


# Users & profile
@app.get("/api/users/me", response_model=Profile)
def get_me(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    soulmate = db.get(User, current.soulmate_id) if current.soulmate_id else None
    # Friends are accepted friend requests involving current user
    friend_ids = set()
    accepted = db.query(FriendRequest).filter(
        FriendRequest.status == RequestStatus.accepted,
        ((FriendRequest.from_user_id == current.id) | (FriendRequest.to_user_id == current.id)),
        FriendRequest.type == RequestType.friend,
    ).all()
    for fr in accepted:
        friend_ids.add(fr.from_user_id if fr.from_user_id != current.id else fr.to_user_id)
    friends = db.query(User).filter(User.id.in_(friend_ids)).all() if friend_ids else []
    return Profile(
        id=current.id,
        email=current.email,
        nickname=current.nickname,
        avatar_url=current.avatar_url,
        rating=current.rating,
        soulmate=soulmate,
        friends=friends,
    )


@app.post("/api/users/logout", response_model=SimpleOk)
def logout():
    # Токен хранится на клиенте; серверного состояния нет
    return SimpleOk()


@app.post("/api/users/avatar", response_model=SimpleOk)
def update_avatar(file: UploadFile = File(...), current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # сохраняем файл в /uploads с уникальным именем
    uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    ext = Path(file.filename).suffix or ".jpg"
    filename = f"avatar_{current.id}{ext}"
    target = uploads_dir / filename
    with target.open("wb") as f:
        f.write(file.file.read())
    # публичный путь
    public_url = f"/uploads/{filename}"
    current.avatar_url = public_url
    db.add(current)
    db.commit()
    return SimpleOk()


@app.post("/api/users/request", response_model=SimpleOk)
def send_request(payload: RequestCreate, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    target = find_user_by_login_or_id(db, payload.login_or_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if target.id == current.id:
        raise HTTPException(status_code=400, detail="Нельзя отправить запрос самому себе")
    if payload.type == RequestType.soulmate:
        # must be unique: neither has a soulmate yet
        if current.soulmate_id or target.soulmate_id:
            raise HTTPException(status_code=400, detail="У одного из пользователей уже есть половинка")
    req = FriendRequest(from_user_id=current.id, to_user_id=target.id, type=payload.type)
    db.add(req)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=400, detail="Запрос уже существует")
    return SimpleOk()


@app.delete("/api/users/soulmate", response_model=SimpleOk)
def remove_soulmate(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current.soulmate_id:
        raise HTTPException(status_code=400, detail="У вас нет второй половинки")
    
    # Находим вторую половинку
    soulmate = db.get(User, current.soulmate_id)
    if soulmate:
        # Удаляем связь с обеих сторон
        current.soulmate_id = None
        soulmate.soulmate_id = None
        db.add(current)
        db.add(soulmate)
        db.commit()
    
    return SimpleOk()


@app.delete("/api/users/friend", response_model=SimpleOk)
def remove_friend(payload: dict, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    friend_id = payload.get('friend_id')
    if not friend_id:
        raise HTTPException(status_code=400, detail="ID друга не указан")
    
    # Находим запрос дружбы между пользователями
    friend_request = db.query(FriendRequest).filter(
        FriendRequest.status == RequestStatus.accepted,
        FriendRequest.type == RequestType.friend,
        ((FriendRequest.from_user_id == current.id) & (FriendRequest.to_user_id == friend_id)) |
        ((FriendRequest.from_user_id == friend_id) & (FriendRequest.to_user_id == current.id))
    ).first()
    
    if not friend_request:
        raise HTTPException(status_code=404, detail="Дружба не найдена")
    
    # Удаляем запрос дружбы
    db.delete(friend_request)
    db.commit()
    
    return SimpleOk()


@app.get("/api/messages", response_model=MessagesResponse)
def get_messages(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    incoming = db.query(FriendRequest).filter(FriendRequest.to_user_id == current.id, FriendRequest.status == RequestStatus.pending).all()
    outgoing = db.query(FriendRequest).filter(FriendRequest.from_user_id == current.id, FriendRequest.status == RequestStatus.pending).all()

    def to_item(fr: FriendRequest) -> RequestItem:
        return RequestItem(
            id=fr.id,
            from_user=db.get(User, fr.from_user_id),
            to_user=db.get(User, fr.to_user_id),
            type=fr.type,
            status=fr.status,
            created_at=fr.created_at,
        )

    return MessagesResponse(
        incoming=[to_item(fr) for fr in incoming],
        outgoing=[to_item(fr) for fr in outgoing],
    )


@app.post("/api/messages/act", response_model=SimpleOk)
def act_on_request(payload: RequestAct, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fr = db.get(FriendRequest, payload.request_id)
    if not fr or fr.to_user_id != current.id or fr.status != RequestStatus.pending:
        raise HTTPException(status_code=404, detail="Заявка не найдена")
    if payload.action not in {"accept", "decline"}:
        raise HTTPException(status_code=400, detail="Некорректное действие")
    if payload.action == "decline":
        fr.status = RequestStatus.declined
        db.commit()
        return SimpleOk()

    # accept
    fr.status = RequestStatus.accepted
    if fr.type == RequestType.soulmate:
        # link both users if none set
        a = db.get(User, fr.from_user_id)
        b = db.get(User, fr.to_user_id)
        if a.soulmate_id or b.soulmate_id:
            raise HTTPException(status_code=400, detail="Половинка уже установлена")
        a.soulmate_id = b.id
        b.soulmate_id = a.id
        db.add(a)
        db.add(b)
    db.add(fr)
    db.commit()
    return SimpleOk()


# Dailies
def ensure_global_daily(db: Session) -> GlobalDaily:
    today = date.today()
    gd = db.query(GlobalDaily).filter(GlobalDaily.date == today).first()
    if gd:
        return gd
    tasks: List[DailyTask] = db.query(DailyTask).all()
    task = random.choice(tasks)
    gd = GlobalDaily(date=today, task_id=task.id)
    db.add(gd)
    db.commit()
    db.refresh(gd)
    return gd


@app.get("/api/dailies/today", response_model=DailyTodayResponse)
def get_daily_today(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    gd = ensure_global_daily(db)
    completed = db.query(DailyCompletion).filter(
        DailyCompletion.user_id == current.id, DailyCompletion.date == gd.date, DailyCompletion.task_id == gd.task_id
    ).first() is not None
    return DailyTodayResponse(
        date=gd.date,
        task=DailyTaskPublic(
            code=gd.task.code, title=gd.task.title, description=gd.task.description, reward_points=gd.task.reward_points
        ),
        completed=completed,
    )


@app.post("/api/dailies/complete", response_model=DailyCompleteResponse)
def complete_daily(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    gd = ensure_global_daily(db)
    existing = db.query(DailyCompletion).filter(
        DailyCompletion.user_id == current.id, DailyCompletion.date == gd.date, DailyCompletion.task_id == gd.task_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Дейлик уже выполнен сегодня")
    comp = DailyCompletion(user_id=current.id, date=gd.date, task_id=gd.task_id)
    db.add(comp)
    current.rating += gd.task.reward_points
    db.add(current)
    db.commit()
    db.refresh(current)
    return DailyCompleteResponse(awarded_points=gd.task.reward_points, new_rating=current.rating)


# Routes listing (no creation per request)
@app.get("/api/routes", response_model=List[RoutePublic])
def list_routes(city: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Route)
    if city:
        q = q.filter(Route.city == city)
    routes = q.order_by(Route.created_at.desc()).all()
    # добавить количество лайков
    result: List[RoutePublic] = []
    for r in routes:
        likes = db.query(RouteLike).filter(RouteLike.route_id == r.id).count()
        points = []
        try:
            raw = json.loads(r.points_json) if r.points_json else []
            for p in raw:
                if 'lat' in p and 'lon' in p and 'name' in p:
                    points.append({'name': p.get('name'), 'description': p.get('description'), 'lat': float(p.get('lat')), 'lon': float(p.get('lon'))})
        except Exception:
            points = []
        result.append(RoutePublic(**{
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "city": r.city,
            "time_minutes": r.time_minutes,
            "budget": r.budget,
            "likes": likes,
            "points": points,
        }))
    return result


def _award_rating_for_likes(db: Session, route_owner: User):
    # каждый полный блок из 10 лайков => +1 рейтинг, считаем совокупно по всем маршрутам пользователя
    total_likes = db.query(RouteLike).join(Route, Route.id == RouteLike.route_id).filter(Route.creator_user_id == route_owner.id).count()
    la = db.get(LikesAward, route_owner.id)
    if not la:
        la = LikesAward(user_id=route_owner.id, awarded_count=0)
        db.add(la)
        db.commit()
        db.refresh(la)
    eligible = total_likes // 10
    if eligible > la.awarded_count:
        delta = eligible - la.awarded_count
        route_owner.rating += delta
        la.awarded_count = eligible
        db.add(route_owner)
        db.add(la)
        db.commit()
@app.post("/api/routes/like", response_model=SimpleOk)
def like_route(payload: LikeAction, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    route = db.get(Route, payload.route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")    
    # запретить лайкать свой маршрут — опционально
    if route.creator_user_id and route.creator_user_id == current.id:
        raise HTTPException(status_code=400, detail="Нельзя лайкать свой маршрут")
    existing = db.query(RouteLike).filter(RouteLike.route_id == route.id, RouteLike.user_id == current.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Уже лайкнуто")
    like = RouteLike(route_id=route.id, user_id=current.id)
    db.add(like)
    db.commit()
    # награда автору
    if route.creator_user_id:
        owner = db.get(User, route.creator_user_id)
        if owner:
            _award_rating_for_likes(db, owner)
    return SimpleOk()


# Favorite routes
@app.post("/api/routes/favorite", response_model=SimpleOk)
def add_to_favorites(payload: LikeAction, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    route = db.get(Route, payload.route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Маршрут не найден")    
    
    existing = db.query(FavoriteRoute).filter(FavoriteRoute.route_id == route.id, FavoriteRoute.user_id == current.id).first()
    if existing:
        # Возвращаем OK, чтобы не показывать сообщение «уже в избранном» на фронте
        return SimpleOk()
    
    favorite = FavoriteRoute(route_id=route.id, user_id=current.id)
    db.add(favorite)
    db.commit()
    return SimpleOk()


@app.get("/api/routes/favorites", response_model=List[RoutePublic])
def get_favorites(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    favorites = db.query(FavoriteRoute).filter(FavoriteRoute.user_id == current.id).all()
    result: List[RoutePublic] = []
    for fav in favorites:
        route = db.get(Route, fav.route_id)
        if route:
            likes = db.query(RouteLike).filter(RouteLike.route_id == route.id).count()
            points = []
            try:
                raw = json.loads(route.points_json) if route.points_json else []
                for p in raw:
                    if 'lat' in p and 'lon' in p and 'name' in p:
                        points.append({'name': p.get('name'), 'description': p.get('description'), 'lat': float(p.get('lat')), 'lon': float(p.get('lon'))})
            except Exception:
                points = []
            result.append(RoutePublic(**{
                "id": route.id,
                "title": route.title,
                "description": route.description,
                "city": route.city,
                "time_minutes": route.time_minutes,
                "budget": route.budget,
                "likes": likes,
                "points": points,
            }))
    return result


@app.delete("/api/routes/favorite/{route_id}", response_model=SimpleOk)
def remove_favorite(route_id: int, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    fav = db.query(FavoriteRoute).filter(FavoriteRoute.route_id == route_id, FavoriteRoute.user_id == current.id).first()
    if not fav:
        # Идемпотентность
        return SimpleOk()
    db.delete(fav)
    db.commit()
    return SimpleOk()


# Create route
@app.post("/api/routes", response_model=SimpleOk)
def create_route(payload: RouteCreate, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not payload.title or not payload.city:
        raise HTTPException(status_code=400, detail="Некорректные данные маршрута")
    r = Route(
        creator_user_id=current.id,
        title=payload.title,
        description=payload.description,
        city=payload.city,
        time_minutes=payload.time_minutes,
        budget=payload.budget,
        points_json=json.dumps([{
            "name": p.name,
            "description": p.description,
            "lat": p.lat,
            "lon": p.lon,
        } for p in payload.points])
    )
    db.add(r)
    db.commit()
    return SimpleOk()


@app.delete("/api/routes/all", response_model=SimpleOk)
def delete_all_routes(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # ADMIN: очистка всех маршрутов и связанных записей (лайки/избранное)
    # Простейшая защита: разрешим только пользователю с id=1 (можно заменить на роль)
    if current.id != 1:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    db.query(RouteLike).delete()
    db.query(FavoriteRoute).delete()
    db.query(Route).delete()
    db.commit()
    return SimpleOk()


# My routes
@app.get("/api/routes/mine", response_model=List[RoutePublic])
def my_routes(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_routes = db.query(Route).filter(Route.creator_user_id == current.id).order_by(Route.created_at.desc()).all()
    result: List[RoutePublic] = []
    for r in user_routes:
        likes = db.query(RouteLike).filter(RouteLike.route_id == r.id).count()
        points = []
        try:
            raw = json.loads(r.points_json) if r.points_json else []
            for p in raw:
                if 'lat' in p and 'lon' in p and 'name' in p:
                    points.append({
                        'name': p.get('name'),
                        'description': p.get('description'),
                        'lat': float(p.get('lat')),
                        'lon': float(p.get('lon')),
                    })
        except Exception:
            points = []
        result.append(RoutePublic(**{
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "city": r.city,
            "time_minutes": r.time_minutes,
            "budget": r.budget,
            "likes": likes,
            "points": points,
        }))
    return result


@app.get("/api/routes/{route_id}", response_model=RoutePublic)
def get_route(route_id: int, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.get(Route, route_id)
    if not r or r.creator_user_id != current.id:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    likes = db.query(RouteLike).filter(RouteLike.route_id == r.id).count()
    points = []
    try:
        raw = json.loads(r.points_json) if r.points_json else []
        for p in raw:
            if 'lat' in p and 'lon' in p and 'name' in p:
                points.append({
                    'name': p.get('name'),
                    'description': p.get('description'),
                    'lat': float(p.get('lat')),
                    'lon': float(p.get('lon')),
                })
    except Exception:
        points = []
    return RoutePublic(**{
        "id": r.id,
        "title": r.title,
        "description": r.description,
        "city": r.city,
        "time_minutes": r.time_minutes,
        "budget": r.budget,
        "likes": likes,
        "points": points,
    })


@app.put("/api/routes/{route_id}", response_model=SimpleOk)
def update_route(route_id: int, payload: RouteCreate, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.get(Route, route_id)
    if not r or r.creator_user_id != current.id:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    r.title = payload.title
    r.description = payload.description
    r.city = payload.city
    r.time_minutes = payload.time_minutes
    r.budget = payload.budget
    r.points_json = json.dumps([
        {"name": p.name, "description": p.description, "lat": p.lat, "lon": p.lon}
        for p in payload.points
    ])
    db.add(r)
    db.commit()
    return SimpleOk()


@app.delete("/api/routes/{route_id}", response_model=SimpleOk)
def delete_route(route_id: int, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    r = db.get(Route, route_id)
    if not r or r.creator_user_id != current.id:
        raise HTTPException(status_code=404, detail="Маршрут не найден")
    # каскадное удаление привязок
    db.query(RouteLike).filter(RouteLike.route_id == r.id).delete()
    db.query(FavoriteRoute).filter(FavoriteRoute.route_id == r.id).delete()
    db.delete(r)
    db.commit()
    return SimpleOk()


# Rating
@app.get("/api/rating", response_model=List[RatingItem])
def rating(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.rating.desc()).all()
    return [RatingItem(user_id=u.id, nickname=u.nickname, rating=u.rating) for u in users]


# Recommendations: fake stub that returns random points; client shows steps
@app.post("/api/recommendations", response_model=RecommendationResponse)
def recommend(req: RecommendationRequest, current: User = Depends(get_current_user)):
    random.seed(req.city + req.description + str(req.places))
    steps: List[RecommendationStep] = []
    base_lat = 55.75 if req.city == "moscow" else 59.93
    base_lon = 37.62 if req.city == "moscow" else 30.33
    for i in range(req.places):
        steps.append(
            RecommendationStep(
                name=f"Место {i+1}",
                coordinate=Coordinate(lat=base_lat + random.uniform(-0.02, 0.02), lon=base_lon + random.uniform(-0.02, 0.02)),
                hint="",
            )
        )
    return RecommendationResponse(city=req.city, description=req.description, places=req.places, steps=steps)


CHAD_API_KEY = "chad-9d49bd1f14804ee7ad4961df0f7700efia29maug"


@app.post("/api/ai/generate", response_model=AIGenerateResponse)
def ai_generate(payload: AIGenerateRequest):
    transport_mapping = {
        "onfoot": "пешком",
        "trans": "общественный транспорт",
        "car": "машина",    
        "rental": "аренда самоката/велика",
        "own": "свой велик/самокат",
        "taxi": "такси",
        "boat": "лодка",
    }
    model_mapping = {
        "gemini": "gemini-2.0-flash",
        "deepseek": "deepseek-v3",
        "gpt": "gpt-4o-mini",
        "claude": "claude-3-haiku",
    }
    model = model_mapping.get(payload.whatai, payload.whatai)

    prompt = (
        f"Составь ОДИН оптимальный маршрут для свидания в городе {payload.city} с бюджетом {payload.budget} рублей на {payload.time} часов "
        f"для {payload.people} человек. Включи {payload.places}  точек с примерными ценами на момент 2025 года (примерные!). "
        f"Учитывай предпочтения по транспорту: {transport_mapping.get(payload.transport, payload.transport)} и в зависимости от выбора меняй расстояние от места до места. "
        f"Оформи ответ в формате: \n"
        f"1. **Название места** (тип: кафе/парк/кино и т.д.) (адрес) - описание\n"
        f"2. **Название места** (тип) (адрес) - описание\n"
        f"3. **Название места** (тип) (адрес) - описание\n"
        f"Общая стоимость: X рублей\n\n"
        f"После списка добавь координаты всех мест в формате:\n"
        f"КООРДИНАТЫ:\n"
        f"Название места 1: 00.000000,00.000000\n"
        f"Название места 2: 00.000000,00.000000\n"
        f"Название места 3: 00.000000,00.000000" 
    )

    request_json = {"message": prompt, "api_key": CHAD_API_KEY}

    try:
        resp = requests.post(
            url=f"https://ask.chadgpt.ru/api/public/{model}", json=request_json, timeout=45
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI сервис недоступен: {e}")

    if not data.get("is_success"):
        raise HTTPException(status_code=400, detail=data.get("error_message", "AI ошибка"))

    route_text: str = data.get("response", "")
    used_words: int = int(data.get("used_words_count", 0))

    coordinates: dict[str, str] = {}
    if "КООРДИНАТЫ:" in route_text:
        try:
            route_part, coords_part = route_text.split("КООРДИНАТЫ:", 1)
        except ValueError:
            route_part, coords_part = route_text, ""
        for line in coords_part.splitlines():
            if ":" in line:
                place, coords = line.split(":", 1)
                coordinates[place.strip()] = coords.strip()
        route_text = route_part.strip()

    return AIGenerateResponse(route=route_text.strip(), coordinates=coordinates, used_words=used_words)


@app.get("/api/health")
def health():
    return {"status": "ok"}

ROOT_DIR = Path(__file__).resolve().parent.parent
app.mount("/", StaticFiles(directory=str(ROOT_DIR), html=True), name="static")
uploads_dir = ROOT_DIR / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8877)