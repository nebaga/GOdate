### GOdate — приложение для свиданий и маршрутов  
🇷🇺 RU: GOdate — это веб‑приложение с готовыми маршрутами, избранным, «дейликами», уведомлениями, конструктором маршрутов (Яндекс.Карты) и генерацией маршрутов с помощью ИИ.  
🇺🇸 EN: GOdate is a web application with pre-made routes, favorites, "dailies", notifications, route builder (Yandex Maps) and AI-powered route generation.

---

### Стек / Tech Stack  
🇷🇺 RU:  
- Backend: FastAPI (Python), SQLite (файл `backend/godate.db`)  
- Frontend: статические HTML/CSS/JS (без сборщика)  
- Карты: Яндекс.Карты JS API  

🇺🇸 EN:  
- Backend: FastAPI (Python), SQLite (file `backend/godate.db`)  
- Frontend: Static HTML/CSS/JS (no bundler)  
- Maps: Yandex Maps JS API  

---

### Быстрый старт / Quick Start (Windows, PowerShell)  
🇷🇺 RU:  
1) Установите Python 3.10+ и pip  
2) Установите зависимости backend  
```
py -m pip install -r backend/requirements.txt
```  
3) Запустите сервер (порт фронта/АПИ: 8876)  
```
py -m uvicorn backend.main:app --port 8876
```  
4) Откройте приложение  
```
http://127.0.0.1:8876
```  

🇺🇸 EN:  
1) Install Python 3.10+ and pip  
2) Install backend dependencies  
```
py -m pip install -r backend/requirements.txt
```  
3) Start the server (frontend/API port: 8876)  
```
py -m uvicorn backend.main:app --port 8876
```  
4) Open the application  
```
http://127.0.0.1:8876
```  

🇷🇺 RU: Backend сам раздаёт статические файлы из корня проекта. В HTML уже прописан `BASE_URL: 'http://localhost:8876/api'`. БД создаётся и инициализируется автоматически (демо‑маршруты/дейлики) при первом старте.  

🇺🇸 EN: The backend serves static files from the project root automatically. HTML files already have `BASE_URL: 'http://localhost:8876/api'` configured. The database is created and initialized automatically (demo routes/dailies) on first launch.

---

### Основные возможности / Key Features
🇷🇺 RU:
- Готовые маршруты с «свайпами»:
  - Вправо → добавить в избранное
  - Влево → пропустить (скрыто до 00:00 МСК)
- Избранные маршруты с мини-картами
- Уведомления о друзьях/парах
- Ежедневные задания («дейлики»)
- Конструктор маршрутов с Яндекс.Картами
- Личные маршруты (создание/редактирование)
- ИИ-генерация маршрутов по описанию

🇺🇸 EN:
- Pre-made routes with swiping:
  - Right swipe → add to favorites
  - Left swipe → skip (hidden until 00:00 UTC+3)
- Favorite routes with mini-maps
- Notifications for friends/matches
- Daily challenges ("dailies")
- Route builder with Yandex Maps
- Personal routes (create/edit)
- AI-powered route generation from description

---

### Структура проекта / Project Structure
🇷🇺 RU:
```
GOdate/
  backend/               # Серверная часть
    main.py              # API и статика
    models.py            # Модели БД
    schemas.py           # Валидация данных
    auth.py              # Аутентификация
    utils.py             # Вспомогательные функции
  js/                    # Клиентские скрипты
    api.js               # Работа с API
    home.js              # Главная страница
    routes.js            # Маршруты и карты
  uploads/               # Загруженные файлы
```

🇺🇸 EN:
```
GOdate/
  backend/               # Server-side
    main.py              # API and static files
    models.py            # Database models
    schemas.py           # Data validation
    auth.py              # Authentication
    utils.py             # Helper functions
  js/                    # Client scripts
    api.js               # API interactions
    home.js              # Home page
    routes.js            # Routes and maps
  uploads/               # Uploaded files
```

---

### Конфигурация карт / Maps Configuration  
🇷🇺 RU: На страницах `index.html`, `routes.html`, `ai.html`, `create-route.html` подключён скрипт:  
```
<script src="https://api-maps.yandex.ru/2.1/?apikey=ВАШ_API_КЛЮЧ&lang=ru_RU"></script>
```  

🇺🇸 EN: The following pages include the map script:  
```
<script src="https://api-maps.yandex.ru/2.1/?apikey=YOUR_API_KEY&lang=ru_RU"></script>
```  

---

### Конфигурация ИИ / AI Configuration  
🇷🇺 RU: В `backend/main.py` используется внешний сервис `ask.chadgpt.ru`. Ключ `CHAD_API_KEY` захардкожен. При необходимости замените его и/или источник API.  
🇺🇸 EN: The `backend/main.py` uses external service `ask.chadgpt.ru`. The `CHAD_API_KEY` is hardcoded. Replace it and/or API source if needed.

---

### API (кратко) / API (Summary)  
🇷🇺 RU:  
Базовый путь: `/api`  
- Auth  
  - `POST /auth/register`, `POST /auth/login`  
- Пользователь  
  - `GET /users/me`, `POST /users/logout`  

🇺🇸 EN:  
Base path: `/api`  
- Auth  
  - `POST /auth/register`, `POST /auth/login`  
- User  
  - `GET /users/me`, `POST /users/logout`  

[Full API list continues in the same pattern...]

---

### Настройки фронтенда / Frontend Configuration  
🇷🇺 RU: В каждой странице есть блок конфигурации API:  
```javascript
window.API_CONFIG = {
  BASE_URL: 'http://localhost:8876/api'
}
```  
🇺🇸 EN: Each page contains API configuration block:  
```javascript
window.API_CONFIG = {
  BASE_URL: 'http://localhost:8876/api'
}
```

---

### Частые вопросы / FAQ  
🇷🇺 RU:  
- «Статика не открывается через файл»: используйте `http://127.0.0.1:8876`  
- «Карта не показывает маршрут»: проверьте ≥2 точки с координатами  

🇺🇸 EN:  
- "Static files won't open directly": Use `http://127.0.0.1:8876`  
- "Map doesn't show route": Verify ≥2 points with coordinates  

---

### Разработка / Development  
🇷🇺 RU:  
- Код стиля: читаемые имена, ранний выход из функций  
- Линтер: базовая проверка в IDE  

🇺🇸 EN:  
- Code style: Readable names, early function returns  
- Linter: Basic IDE checks  