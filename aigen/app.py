from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import requests
import os

app = FastAPI()

# Настройка путей
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

# Подключение статических файлов
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Шаблоны
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# API ключ
CHAD_API_KEY = "chad-9d49bd1f14804ee7ad4961df0f7700efia29maug"

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("gpt.html", {"request": request})

@app.post("/", response_class=HTMLResponse)
async def generate_route(
    request: Request,
    city: str = Form(...),
    budget: str = Form(...),
    people: str = Form(...),
    time: str = Form(...),
    places: str = Form(...),
    transport: str = Form(...),
    whatai: str = Form(...)
):
    if not city or not budget:
        return templates.TemplateResponse(
            "gpt.html",
            {
                "request": request,
                "error": "Пожалуйста, заполните все поля"
            }
        )
    
    # Формируем более конкретный запрос к API
    transport_mapping = {
        "onfoot": "пешком",
        "trans": "общественный транспорт",
        "car": "машина",
        "rental": "аренда самоката/велика",
        "own": "свой велик/самокат",
        "taxi": "такси",
        "boat": "лодка"
    }
    whatai_list={
        "gemini": "gemini-2.0-flash",
        "deepseek": "deepseek-v3",
        "gpt": "gpt-4o-mini",
        "claude": "claude-3-haiku",
    }
    what_ai=whatai_list.get(whatai, whatai)
    prompt = (
        f"Составь ОДИН оптимальный маршрут для свидания в городе {city} с бюджетом {budget} рублей на {time} часов"
        f"для {people} человек. Включи {places} (+- 1 место) точек с примерными ценами на момент 2025 года (примерные!). "
        f"Учитывай предпочтения по транспорту: {transport_mapping.get(transport, transport)} и в зависимости от выбора меняй расстояние от места до места. "
        f"Оформи ответ в формате: "
        f"1. **Название места** (тип: кафе/парк/кино и т.д.) - описание\n"
        f"2. **Название места** (тип) - описание\n"
        f"3. **Название места** (тип) - описание\n"
        f"Общая стоимость: X рублей\n\n"
        f"После списка добавь координаты всех мест в формате:\n"
        f"КООРДИНАТЫ:\n"
        f"Название места 1: 00.000000,00.000000\n"
        f"Название места 2: 00.000000,00.000000\n"
        f"Название места 3: 00.000000,00.000000"
    )
    
    request_json = {
        "message": prompt,
        "api_key": CHAD_API_KEY
    }
    
    try:
        
        response = requests.post(
            url=f'https://ask.chadgpt.ru/api/public/{what_ai}',
            json=request_json,
            timeout=45
        )
        response.raise_for_status()
        
        resp_json = response.json()
        
        if resp_json['is_success']:
            route_text = resp_json['response']
            coordinates = {}
            
            if "КООРДИНАТЫ:" in route_text:
                route_part, coords_part = route_text.split("КООРДИНАТЫ:")
                for line in coords_part.split("\n"):
                    if ":" in line:
                        place, coords = line.split(":", 1)
                        coordinates[place.strip()] = coords.strip()
            else:
                route_part = route_text
            
            return templates.TemplateResponse(
                "gpt.html",
                {
                    "request": request,
                    "route": route_part.strip(),
                    "city": city,
                    "budget": budget,
                    "people": people,
                    "time": time,
                    "places": places,
                    "transport": transport,
                    "coordinates": coordinates,
                    "used_words": resp_json['used_words_count']
                }
            )
        else:
            return templates.TemplateResponse(
                "gpt.html",
                {
                    "request": request,
                    "error": resp_json['error_message']
                }
            )
    
    except Exception as e:
        return templates.TemplateResponse(
            "gpt.html",
            {
                "request": request,
                "error": f"Произошла ошибка: {str(e)}"
            }
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8877)