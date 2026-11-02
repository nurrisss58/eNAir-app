import json
import os
import re
import urllib.request
from datetime import datetime, timedelta

from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS
import psycopg2
from werkzeug.security import generate_password_hash, check_password_hash

# static_folder=None: встроенная раздача файлов из корня отключена,
# иначе Flask отдаёт по прямой ссылке app.py и Procfile в обход проверок ниже.
app = Flask(__name__, static_folder=None)
CORS(app)

# Разрешаем раздавать только файлы сайта. Иначе Flask отдаёт по прямой ссылке
# app.py, requirements.txt и Procfile — вместе с кодом и паролями.
PUBLIC_EXTENSIONS = {
    ".html", ".css", ".js", ".mjs",
    ".jpg", ".jpeg", ".png", ".svg", ".webp", ".gif", ".ico",
    ".json", ".woff", ".woff2", ".ttf",
}


def is_public_path(path):
    """True, если путь можно отдавать посетителю сайта."""
    if not path or path.startswith("/") or ".." in path:
        return False
    parts = path.replace("\\", "/").split("/")
    if any(part.startswith(".") for part in parts):
        return False
    return os.path.splitext(path)[1].lower() in PUBLIC_EXTENSIONS


# ---------------------------------------------------------------------------
# ИИ-ассистент
# ---------------------------------------------------------------------------
# Режим ИИ включается переменной окружения AI_API_KEY на Render.
# Без ключа (или если модель недоступна) отвечает движок правил ниже —
# сайт никогда не остаётся без ответа.
AI_API_KEY = os.environ.get("AI_API_KEY", "").strip()
AI_BASE_URL = os.environ.get("AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
AI_MODEL = os.environ.get("AI_MODEL", "gpt-4o-mini")

# Цены в базе хранятся в долларах: на сайте все суммы в тенге по тому же курсу,
# что и переключатель валют в шапке. PRICE_CURRENCY=KZT отключает пересчёт.
PRICE_CURRENCY = os.environ.get("PRICE_CURRENCY", "USD").upper()
USD_TO_KZT = 490


def get_db():
    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url, sslmode="require", connect_timeout=10)

    # Локальная разработка. На хостинге всегда используется DATABASE_URL (Neon).
    return psycopg2.connect(
        dbname="airline",
        user="postgres",
        password="2726259012",
        host="localhost",
        port="5432",
        connect_timeout=10
    )


def init_db():
    """Создаёт таблицы, если их нет, и убирает случайные дубли рейсов.

    Вызывается при импорте модуля, поэтому работает и под gunicorn на Render,
    а не только при `python app.py`.
    """
    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()

        # Блокировка, чтобы несколько воркеров gunicorn не создавали данные одновременно
        cur.execute("SELECT pg_advisory_lock(918273645);")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255) UNIQUE NOT NULL,
                password VARCHAR(255),
                password_hash VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        cur.execute("""
            CREATE TABLE IF NOT EXISTS flights (
                id SERIAL PRIMARY KEY,
                flight_number VARCHAR(50) NOT NULL,
                departure_city VARCHAR(120) NOT NULL,
                arrival_city VARCHAR(120) NOT NULL,
                departure_time TIMESTAMP NOT NULL,
                arrival_time TIMESTAMP NOT NULL,
                price NUMERIC(10,2) NOT NULL DEFAULT 0,
                seats_available INTEGER NOT NULL DEFAULT 0
            );
        """)

        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);")
        cur.execute("ALTER TABLE users ALTER COLUMN name DROP NOT NULL;")
        cur.execute("ALTER TABLE users ALTER COLUMN password DROP NOT NULL;")

        # Демо-рейсы добавляем только в пустую таблицу, иначе при каждом деплое
        # появлялись новые копии одних и тех же рейсов.
        cur.execute("SELECT COUNT(*) FROM flights;")
        if cur.fetchone()[0] == 0:
            now = datetime.utcnow()
            demo_flights = [
                ("EN-101", "New York", "London", now + timedelta(days=14), now + timedelta(days=14, hours=8), 2450.00, 120),
                ("EN-108", "New York", "London", now + timedelta(days=15), now + timedelta(days=15, hours=8, minutes=30), 2548.00, 98),
                ("EN-214", "New York", "Paris", now + timedelta(days=18), now + timedelta(days=18, hours=7), 2352.00, 85),
                ("EN-305", "London", "Athens", now + timedelta(days=12), now + timedelta(days=12, hours=5, minutes=20), 420.00, 64),
            ]
            for flight_number, dep_city, arr_city, dep_time, arr_time, price, seats in demo_flights:
                cur.execute("""
                    INSERT INTO flights (
                        flight_number, departure_city, arrival_city,
                        departure_time, arrival_time, price, seats_available
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s);
                """, (flight_number, dep_city, arr_city, dep_time, arr_time, price, seats))

        # Чистим полные дубли, оставляя запись с наименьшим id.
        # Удаляет только строки, у которых совпадают номер, маршрут и оба времени.
        cur.execute("""
            DELETE FROM flights
            WHERE id NOT IN (
                SELECT MIN(id) FROM flights
                GROUP BY flight_number, departure_city, arrival_city,
                         departure_time, arrival_time, price, seats_available
            );
        """)

        conn.commit()
        cur.execute("SELECT pg_advisory_unlock(918273645);")
        conn.commit()
        print("Database initialized successfully.")
    except Exception:
        if conn:
            conn.rollback()
        app.logger.exception("Unable to initialize the database tables")
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@app.route("/")
def home():
    return send_from_directory(".", "enair-homepage.html")


@app.route("/images/<path:filename>")
def serve_images(filename):
    # В репозитории картинки лежат в корне (CSS ссылается на images/<файл>),
    # а в локальной папке — в подкаталоге images/. Поддерживаем оба варианта.
    if not is_public_path(filename):
        abort(404)
    nested = os.path.join(".", "images", filename)
    if os.path.isfile(nested):
        return send_from_directory(os.path.join(".", "images"), filename)
    if os.path.isfile(os.path.join(".", filename)):
        return send_from_directory(".", filename)
    abort(404)


@app.route("/<path:path>")
def send_static(path):
    if path.startswith("api/"):
        abort(404)

    if not is_public_path(path):
        abort(404)

    full_path = os.path.join(".", path)
    if os.path.isfile(full_path):
        return send_from_directory(".", path)

    abort(404)


@app.route("/api/flights")
def flights():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, flight_number, departure_city, arrival_city,
               departure_time, arrival_time, price, seats_available
        FROM flights
        ORDER BY departure_time
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    result = []
    for row in rows:
        result.append({
            "id": row[0],
            "flight_number": row[1],
            "departure_city": row[2],
            "arrival_city": row[3],
            "departure_time": row[4].strftime("%d.%m.%Y %H:%M"),
            "arrival_time": row[5].strftime("%d.%m.%Y %H:%M"),
            "price": round(_price_kzt(row[6]), 2),
            "seats_available": row[7],
        })

    return jsonify(result)


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Укажите email и пароль"}), 400

    password_hash = generate_password_hash(password)

    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE email = %s;", (email,))
        if cur.fetchone():
            return jsonify({"error": "Пользователь с таким email уже существует"}), 400

        cur.execute(
            "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id, email;",
            (email, password_hash)
        )
        new_user = cur.fetchone()
        conn.commit()
        return jsonify({
            "message": "Регистрация прошла успешно!",
            "user": {"id": new_user[0], "email": new_user[1]},
        }), 201
    except Exception:
        if conn:
            conn.rollback()
        app.logger.exception("User registration failed")
        return jsonify({"error": "Сервис регистрации временно недоступен"}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Укажите email и пароль"}), 400

    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id, email, password_hash FROM users WHERE email = %s;", (email,))
        user = cur.fetchone()

        if not user or not user[2]:
            return jsonify({"error": "Неверный email или пароль"}), 401

        if check_password_hash(user[2], password):
            return jsonify({
                "message": "Успешный вход!",
                "user": {"id": user[0], "email": user[1]},
            }), 200

        return jsonify({"error": "Неверный email или пароль"}), 401
    except Exception:
        if conn:
            conn.rollback()
        app.logger.exception("User login failed")
        return jsonify({"error": "Сервис авторизации временно недоступен"}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@app.route("/api/book", methods=["POST"])
def book_flight():
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    flight_id = data.get("flight_id")

    if not user_id:
        return jsonify({"error": "Доступ запрещен. Пожалуйста, войдите в систему."}), 401

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE id = %s;", (user_id,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "Недействительный пользователь"}), 401

        cur.close()
        conn.close()
        return jsonify({"message": "Билет успешно забронирован!"}), 200
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


@app.route("/healthz")
def healthz():
    return jsonify({"status": "ok"})


def _price_kzt(value):
    amount = float(value or 0)
    return amount * USD_TO_KZT if PRICE_CURRENCY == "USD" else amount


def _money(amount):
    return "{:,}".format(int(round(amount))).replace(",", " ")


def _flights_snapshot(limit=8):
    """Актуальные рейсы из базы — для ответов ассистента и контекста модели."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT flight_number, departure_city, arrival_city,
                   departure_time, price, seats_available
            FROM flights ORDER BY departure_time LIMIT %s;
        """, (limit,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
    except Exception:
        app.logger.exception("Assistant could not read flights")
        return []

    return [{
        "number": row[0],
        "from": row[1],
        "to": row[2],
        "departure": row[3].strftime("%d.%m.%Y %H:%M"),
        "price": round(_price_kzt(row[4])),
        "seats": row[5],
    } for row in rows]


def _suggestions(message):
    if re.search(r"[а-яё]", message, re.IGNORECASE):
        return ["Сколько стоит билет до Лондона?", "Что входит в тариф Flex?", "Как зарегистрироваться?"]
    return ["How much is a flight to London?", "What is included in Flex?", "How do I sign up?"]


# Русские названия городов -> как они записаны в базе.
CITY_ALIASES = {
    "лондон": "london", "нью-йорк": "new york", "нью йорк": "new york",
    "дубай": "dubai", "париж": "paris", "токио": "tokyo", "алматы": "almaty",
    "москва": "moscow", "стамбул": "istanbul", "рим": "rome", "барселона": "barcelona",
    "сингапур": "singapore", "сидней": "sydney", "рейкьявик": "reykjavik",
    "афины": "athens", "остров": "bali", "бали": "bali",
}


def _mentioned_city(text, flights):
    """Ищет в вопросе город из расписания (в том числе по русскому названию).

    Сравниваем по первым четырём буквам, чтобы «до Дубая» находило «Дубай»,
    а «в Лондон» — «London».
    """
    normalized = text
    for alias, english in CITY_ALIASES.items():
        if alias[:4] in normalized:
            normalized = normalized + " " + english
    for flight in flights:
        for city in (flight["from"], flight["to"]):
            if city and city.lower()[:4] in normalized:
                return city
    return None


def _rule_reply(message, flights):
    """Движок правил: работает без внешнего API и без ключей."""
    text = message.lower()
    ru = bool(re.search(r"[а-яё]", text))

    def has(*words):
        return any(word in text for word in words)

    cheapest = min(flights, key=lambda item: item["price"]) if flights else None

    if has("привет", "здравств", "hello", "hi ", "добрый"):
        if ru:
            return ("Здравствуйте! Я ассистент eNAir. Подскажу по рейсам, тарифам, багажу, "
                    "регистрации и милям. О чём рассказать?"), _suggestions(message)
        return ("Hello! I am the eNAir assistant. I can help with flights, fares, baggage, "
                "sign-up and miles. What would you like to know?"), _suggestions(message)

    if has("сколько стоит", "цена", "стоимость", "почём", "price", "cost", "how much"):
        city = _mentioned_city(text, flights)
        matches = [f for f in flights
                   if city and city.lower() in (f["from"].lower(), f["to"].lower())][:3]

        if matches:
            lines = ["{no}: {a} → {b}, {d}, {p} ₸".format(
                no=f["number"], a=f["from"], b=f["to"], d=f["departure"], p=_money(f["price"]))
                for f in matches]
            if ru:
                return ("Рейсы по запросу:\n" + "\n".join(lines) +
                        "\nТарифы (Lite, Flex, Business) выбираются на следующем шаге бронирования."
                        ), _suggestions(message)
            return ("Flights matching your request:\n" + "\n".join(lines) +
                    "\nFares (Lite, Flex, Business) are chosen on the next booking step."
                    ), _suggestions(message)

        if not cheapest:
            return ("Сейчас в расписании нет рейсов, поэтому назвать цену не могу. "
                    "Попробуйте страницу Booking."), _suggestions(message)
        if ru:
            return ("Самый доступный рейс в расписании: {no} {a} → {b}, вылет {d}, "
                    "от {p} ₸ за пассажира. Полное расписание и выбор тарифа — на странице Booking."
                    ).format(no=cheapest["number"], a=cheapest["from"], b=cheapest["to"],
                             d=cheapest["departure"], p=_money(cheapest["price"])), _suggestions(message)
        return ("The cheapest flight in the schedule is {no} {a} -> {b}, departing {d}, "
                "from {p} KZT per passenger. The full list is on the Booking page."
                ).format(no=cheapest["number"], a=cheapest["from"], b=cheapest["to"],
                         d=cheapest["departure"], p=_money(cheapest["price"])), _suggestions(message)

    if has("рейс", "расписан", "куда лет", "направлен", "flights", "routes", "schedule", "where do you fly"):
        if not flights:
            return ("Расписание сейчас пустое." if ru else "The schedule is empty right now."), _suggestions(message)
        lines = ["{no}: {a} → {b}, {d}, {p} ₸".format(no=f["number"], a=f["from"], b=f["to"],
                                                      d=f["departure"], p=_money(f["price"]))
                 for f in flights[:5]]
        head = "Сейчас в расписании:" if ru else "Current schedule:"
        tail = ("\nВыбрать рейс можно на странице Booking." if ru
                else "\nYou can pick a flight on the Booking page.")
        return head + "\n" + "\n".join(lines) + tail, _suggestions(message)

    if has("багаж", "чемодан", "ручная кладь", "baggage", "luggage", "bags"):
        if ru:
            return ("Багаж зависит от тарифа: Lite — только ручная кладь 8 кг, "
                    "Flex — 12 кг плюс одно место, Business — два места. "
                    "Полный список — в блоке «Choose Your Fare Tier» на странице бронирования."), _suggestions(message)
        return ("Baggage depends on the fare: Lite is 8 kg cabin bag only, Flex adds a 12 kg bag "
                "plus one checked bag, Business includes two checked bags. "
                "See the fare cards on the booking page."), _suggestions(message)

    if has("тариф", "fare", "lite", "flex", "business", "что входит", "включено", "what is included"):
        if ru:
            return ("Тарифов три. Lite — ручная кладь 8 кг, выбор места, экологичные снеки. "
                    "Flex — 12 кг плюс одно место багажа, изменения без штрафа, питание. "
                    "Business — два места багажа, приватная капсула и лаунж. "
                    "Надбавка за тариф прибавляется к цене рейса и видна в разбивке на странице оплаты."), _suggestions(message)
        return ("There are three fares. Lite: 8 kg cabin bag, seat selection, eco snacks. "
                "Flex: 12 kg plus one checked bag, free changes, meals. "
                "Business: two checked bags, a private pod and lounge access. "
                "The fare surcharge is added to the flight price and shown in the payment breakdown."), _suggestions(message)

    if has("забронир", "купить билет", "как купить", "book a flight", "booking", "how to book"):
        if ru:
            return ("Путь такой: главная → выберите маршрут и нажмите Search → выберите рейс → "
                    "тариф → данные пассажиров → оплата. Для брони нужен вход в аккаунт: "
                    "гостя сайт попросит зарегистрироваться."), _suggestions(message)
        return ("The flow is: home page -> choose route and press Search -> pick a flight -> "
                "choose a fare -> passenger details -> payment. Booking requires an account, "
                "so guests are asked to sign in first."), _suggestions(message)

    if has("регистрац", "регистр", "зарегистр", "войти", "аккаунт", "register", "sign up", "sign in", "login", "log in") or re.search(r"\bвход\b", text):
        if ru:
            return ("Кнопка «Войти / Регистрация» в правом верхнем углу. Аккаунт хранится в "
                    "PostgreSQL (Neon), пароль — только в виде хеша. После входа можно бронировать."), _suggestions(message)
        return ("Use the Sign in / Register button in the header. Accounts live in PostgreSQL (Neon) "
                "and passwords are stored only as hashes. Once signed in you can book."), _suggestions(message)

    if has("мили", "миля", "бонус", "лояльн", "miles", "loyalty", "rewards", "tier"):
        if ru:
            return ("Четыре уровня: Silver — 15 000 миль, Gold — 40 000, Platinum — 85 000, "
                    "Diamond — 150 000. На странице Loyalty есть калькулятор: он считает расстояние "
                    "по формуле гаверсинуса и добавляет бонус за уровень и класс."), _suggestions(message)
        return ("There are four tiers: Silver at 15,000 miles, Gold at 40,000, Platinum at 85,000 "
                "and Diamond at 150,000. The Loyalty page has a calculator that uses the haversine "
                "formula plus tier and cabin bonuses."), _suggestions(message)

    if has("оплат", "платёж", "платеж", "карта", "payment", "pay", "card"):
        if ru:
            return ("Оплата в проекте демонстрационная: форма работает, но реальные деньги не "
                    "списываются — на экране подтверждения это прямо написано."), _suggestions(message)
        return ("Payment here is a demo: the form works, but no real money is charged. "
                "The confirmation screen says so explicitly."), _suggestions(message)

    if has("возврат", "обмен", "отмен", "refund", "cancel", "change my flight"):
        if ru:
            return ("Условия зависят от тарифа: Lite — возврат с удержанием, Flex — изменения без "
                    "штрафа, Business — самые гибкие условия. Точные правила указаны в карточках тарифов."), _suggestions(message)
        return ("It depends on the fare: Lite allows refunds with a fee, Flex changes are free, "
                "Business has the most flexible terms. Exact rules are on the fare cards."), _suggestions(message)

    if has("контакт", "поддержк", "телефон", "почта", "contact", "support", "phone", "email"):
        if ru:
            return ("Почта консьержа — concierge@enair.aero, а форма обратной связи есть на странице "
                    "About & Contact. Отвечаем в течение дня."), _suggestions(message)
        return ("The concierge email is concierge@enair.aero, and there is a contact form on the "
                "About & Contact page."), _suggestions(message)

    if has("валют", "тенге", "доллар", "currency", "tenge", "kzt", "usd"):
        if ru:
            return ("В шапке есть переключатель ₸ / $. Курс — 490 ₸ за 1 $, цены в базе хранятся "
                    "в долларах и показываются в тенге."), _suggestions(message)
        return ("The header has a KZT / USD switcher. The rate is 490 KZT per USD; prices are stored "
                "in USD and shown in tenge."), _suggestions(message)

    if has("кто ты", "ты бот", "что умеешь", "что умеет", "who are you", "are you a bot", "what can you do"):
        if ru:
            return ("Я ассистент eNAir. Отвечаю про рейсы, тарифы, багаж, регистрацию, мили и оплату. "
                    "Работаю на движке правил и читаю расписание из базы; если на сервере задан "
                    "ключ ИИ, отвечаю через языковую модель."), _suggestions(message)
        return ("I am the eNAir assistant. I answer questions about flights, fares, baggage, sign-up, "
                "miles and payment. I run on a rules engine and read the schedule from the database; "
                "if an AI key is configured, I answer through a language model."), _suggestions(message)

    if ru:
        return ("Могу рассказать про рейсы и цены, тарифы, багаж, регистрацию, мили и оплату. "
                "Например: «сколько стоит билет до Лондона?»"), _suggestions(message)
    return ("I can help with flights and prices, fares, baggage, sign-up, miles and payment. "
            "Try: \"how much is a flight to London?\""), _suggestions(message)


def _ask_ai(message, flights):
    """Запрос к языковой модели. Любая ошибка — повод вернуться к правилам."""
    schedule = "\n".join(
        "{no}: {a} -> {b}, {d}, {p} KZT, seats {s}".format(
            no=f["number"], a=f["from"], b=f["to"], d=f["departure"], p=f["price"], s=f["seats"])
        for f in flights
    ) or "no data"

    system = (
        "Ты — вежливый ассистент авиакомпании eNAir на демонстрационном сайте. "
        "Отвечай кратко, 2-4 предложения, на языке пользователя. "
        "Не выдумывай рейсы, цены и даты — используй только данные ниже. "
        "Оплата на сайте демонстрационная, деньги не списываются. "
        "Актуальные рейсы (цены в тенге):\n" + schedule
    )

    payload = {
        "model": AI_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": message},
        ],
        "temperature": 0.3,
        "max_tokens": 350,
    }

    request_obj = urllib.request.Request(
        AI_BASE_URL + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + AI_API_KEY,
        },
        method="POST",
    )

    with urllib.request.urlopen(request_obj, timeout=15) as response:
        data = json.loads(response.read().decode("utf-8"))

    return (data["choices"][0]["message"]["content"] or "").strip()


@app.route("/api/assistant", methods=["POST"])
def assistant():
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", ""))[:400].strip()

    if not message:
        return jsonify({"error": "Пустой запрос"}), 400

    flights = _flights_snapshot()

    if AI_API_KEY:
        try:
            reply = _ask_ai(message, flights)
            if reply:
                return jsonify({"reply": reply, "source": "ai", "suggestions": _suggestions(message)})
        except Exception:
            app.logger.exception("AI assistant failed, falling back to rules")

    reply, suggestions = _rule_reply(message, flights)
    return jsonify({"reply": reply, "source": "rules", "suggestions": suggestions})


# Важно: инициализация на уровне модуля, чтобы срабатывала и под gunicorn на Render.
init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
