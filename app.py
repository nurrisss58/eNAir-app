import json
import os
import random
import re
import urllib.error
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
# Режим ИИ включается переменной окружения с ключом.
# Без ключа (или если модель недоступна) отвечает движок правил ниже —
# сайт никогда не остаётся без ответа.
KEY_ENV_NAMES = (
    "AI_API_KEY", "GROQ_API_KEY", "OPENAI_API_KEY",
    "DEEPSEEK_API_KEY", "OPENROUTER_API_KEY", "API_KEY",
)


def _find_ai_key():
    """Ищет ключ под любым из привычных имён, чтобы не зависеть от названия переменной."""
    for name in KEY_ENV_NAMES:
        value = (os.environ.get(name) or "").strip()
        if value:
            return value
    # Последний шанс: любая переменная, значение которой похоже на ключ.
    for name, value in os.environ.items():
        text = (value or "").strip()
        if text.startswith("gsk_") or text.startswith("sk-"):
            return text
    return ""


def _resolve_ai():
    """Определяет провайдера по префиксу ключа, если адрес и модель не заданы вручную."""
    key = _find_ai_key()
    base = (os.environ.get("AI_BASE_URL") or "").strip().rstrip("/")
    model = (os.environ.get("AI_MODEL") or "").strip()

    if key.startswith("gsk_"):            # Groq
        base = base or "https://api.groq.com/openai/v1"
        # llama-3.3-70b-versatile у Groq сняли с поддержки — актуальная замена ниже.
        model = model or "openai/gpt-oss-120b"
    elif key.startswith("sk-or-"):        # OpenRouter
        base = base or "https://openrouter.ai/api/v1"
        model = model or "meta-llama/llama-3.3-70b-instruct:free"
    else:                                 # любой OpenAI-совместимый сервис
        base = base or "https://api.openai.com/v1"
        model = model or "gpt-4o-mini"

    return key, base, model


AI_API_KEY, AI_BASE_URL, AI_MODEL = _resolve_ai()

# Запасная модель: если основную переименовали или сняли с поддержки,
# ассистент пробует её, а не падает в шаблонные ответы.
if AI_API_KEY.startswith("gsk_"):
    AI_MODEL_FALLBACK = "llama-3.1-8b-instant"
elif AI_API_KEY.startswith("sk-or-"):
    AI_MODEL_FALLBACK = "meta-llama/llama-3.1-8b-instruct:free"
else:
    AI_MODEL_FALLBACK = "gpt-4o-mini"

app.logger.info(
    "AI assistant: %s (model=%s, base=%s)",
    "включён" if AI_API_KEY else "выключен, работают правила",
    AI_MODEL,
    AI_BASE_URL,
)

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

        # Новые колонки расписания: тип борта для карточек и ключ засева,
        # чтобы повторный деплой не добавлял те же рейсы второй раз.
        cur.execute("ALTER TABLE flights ADD COLUMN IF NOT EXISTS aircraft VARCHAR(60);")
        cur.execute("ALTER TABLE flights ADD COLUMN IF NOT EXISTS seed_key VARCHAR(60);")
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS flights_seed_key_key ON flights (seed_key);")

        # Бронь: снимок рейса хранится рядом, чтобы чек не менялся, даже если
        # рейс потом отредактируют или удалят из расписания.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bookings (
                id SERIAL PRIMARY KEY,
                reference VARCHAR(16) UNIQUE,
                user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                flight_id INTEGER REFERENCES flights(id) ON DELETE SET NULL,
                flight_number VARCHAR(50),
                departure_city VARCHAR(120),
                arrival_city VARCHAR(120),
                departure_time TIMESTAMP,
                arrival_time TIMESTAMP,
                cabin VARCHAR(40),
                fare VARCHAR(40),
                passengers INTEGER NOT NULL DEFAULT 1,
                passenger_names TEXT,
                total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
                card_last4 VARCHAR(4),
                status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # На Neon таблица bookings могла остаться от прошлой версии сайта
        # (id, user_id, flight_id, booked_at). Тогда CREATE TABLE IF NOT EXISTS
        # ничего не меняет, поэтому каждую недостающую колонку добавляем отдельно.
        booking_columns = [
            ("reference", "VARCHAR(16)"),
            ("flight_number", "VARCHAR(50)"),
            ("departure_city", "VARCHAR(120)"),
            ("arrival_city", "VARCHAR(120)"),
            ("departure_time", "TIMESTAMP"),
            ("arrival_time", "TIMESTAMP"),
            ("cabin", "VARCHAR(40)"),
            ("fare", "VARCHAR(40)"),
            ("passengers", "INTEGER NOT NULL DEFAULT 1"),
            ("passenger_names", "TEXT"),
            ("total_price", "NUMERIC(12,2) NOT NULL DEFAULT 0"),
            ("card_last4", "VARCHAR(4)"),
            ("status", "VARCHAR(20) NOT NULL DEFAULT 'confirmed'"),
            ("created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ]
        for column, definition in booking_columns:
            cur.execute("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS {} {};".format(column, definition))
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS bookings_reference_key ON bookings (reference);")

        # Демо-рейсы. Список вставляется по одному и только если такого рейса ещё
        # нет — ни по seed_key, ни по номеру. Поэтому деплой не плодит копии,
        # а новые рейсы достаточно дописать в этот список.
        now = datetime.utcnow()
        start = now.replace(minute=0, second=0, microsecond=0)
        demo_flights = [
            # (номер, откуда, куда, дней до вылета, время вылета, время прилёта, цена $, мест, борт)
            ("EN-101", "New York", "London", 14, 8, 1, 2450.00, 120, "A350-H2 (Hydrogen)"),
            ("EN-108", "New York", "London", 15, 11, 3, 2548.00, 98, "A350-H2 (Hydrogen)"),
            ("EN-214", "New York", "Paris", 18, 7, 2, 2352.00, 85, "787 Dreamliner-E"),
            ("EN-305", "London", "Athens", 12, 5, 8, 420.00, 64, "A320neo-E"),
            ("EN-301", "New York", "Moscow", 11, 9, 2, 1890.00, 25, "A350-H2 (Hydrogen)"),
            ("EN-302", "Moscow", "New York", 20, 6, 1, 1890.00, 25, "A350-H2 (Hydrogen)"),
            ("EN-410", "London", "Dubai", 9, 10, 5, 760.00, 48, "787 Dreamliner-E"),
            ("EN-411", "Dubai", "London", 16, 12, 6, 760.00, 48, "787 Dreamliner-E"),
            ("EN-512", "Almaty", "Dubai", 7, 4, 7, 310.00, 25, "A320neo-E"),
            ("EN-513", "Dubai", "Almaty", 13, 8, 9, 310.00, 25, "A320neo-E"),
            ("EN-620", "Singapore", "Tokyo", 10, 9, 1, 540.00, 72, "787 Dreamliner-E"),
            ("EN-621", "Tokyo", "Singapore", 17, 14, 3, 540.00, 72, "787 Dreamliner-E"),
            ("EN-700", "New York", "Tokyo", 21, 11, 4, 1980.00, 36, "A380 Superjumbo-X"),
            ("EN-801", "Paris", "Rome", 8, 7, 9, 210.00, 56, "A320neo-E"),
            ("EN-802", "Rome", "Paris", 19, 15, 2, 210.00, 56, "A320neo-E"),
            ("EN-906", "Sydney", "Auckland", 6, 8, 6, 260.00, 40, "787 Dreamliner-E"),
        ]

        def flight_time(days, hour):
            return (start + timedelta(days=days)).replace(hour=hour)

        for number, dep_city, arr_city, days, dep_hour, arr_hour, price, seats, aircraft in demo_flights:
            cur.execute(
                "SELECT 1 FROM flights WHERE seed_key = %s OR flight_number = %s LIMIT 1;",
                ("demo-" + number, number),
            )
            if cur.fetchone():
                continue
            departure = flight_time(days, dep_hour)
            arrival = flight_time(days, arr_hour)
            if arrival <= departure:
                arrival += timedelta(days=1)
            cur.execute("""
                INSERT INTO flights (
                    flight_number, departure_city, arrival_city,
                    departure_time, arrival_time, price, seats_available, aircraft, seed_key
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s);
            """, (number, dep_city, arr_city, departure, arrival, price, seats, aircraft, "demo-" + number))

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
               departure_time, arrival_time, price, seats_available, aircraft
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
            "aircraft": row[8] or "Scheduled flight",
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


class BookingError(Exception):
    """Ошибка оформления брони с кодом ответа для клиента."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def _new_reference(cur):
    """Номер брони вида EN123456, которого ещё нет в таблице."""
    for _ in range(20):
        reference = "EN" + "".join(random.choice("0123456789") for _ in range(6))
        cur.execute("SELECT 1 FROM bookings WHERE reference = %s;", (reference,))
        if not cur.fetchone():
            return reference
    raise BookingError("Не удалось создать номер брони, попробуйте ещё раз", 500)


def _clean_passenger_names(raw, limit=9):
    if isinstance(raw, str):
        raw = [part for part in raw.split(",") if part.strip()]
    if not isinstance(raw, list):
        return []
    names = []
    for item in raw[:limit]:
        text = str(item or "").strip()[:120]
        if text:
            names.append(text)
    return names


@app.route("/api/book", methods=["POST"])
def book_flight():
    """Оформление брони: списывает места с рейса и сохраняет чек в базе.

    Места списываются в той же транзакции, что и создание брони, а строка рейса
    блокируется (SELECT ... FOR UPDATE). Поэтому два одновременных заказа не
    могут продать одно и то же последнее место.
    """
    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    flight_id = data.get("flight_id")
    card_last4 = re.sub(r"\D", "", str(data.get("card_last4") or ""))[-4:]

    if not user_id:
        return jsonify({"error": "Доступ запрещен. Пожалуйста, войдите в систему."}), 401

    try:
        passengers = int(data.get("passengers") or 1)
    except (TypeError, ValueError):
        passengers = 1
    passengers = max(1, min(passengers, 9))

    try:
        total_price = float(data.get("total") or 0)
    except (TypeError, ValueError):
        total_price = 0.0
    total_price = max(0.0, min(total_price, 100_000_000))

    cabin = str(data.get("cabin") or "Economy").strip()[:40]
    fare = str(data.get("fare") or "Flex").strip()[:40]
    passenger_names = _clean_passenger_names(data.get("passenger_names"))

    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()

        cur.execute("SELECT email FROM users WHERE id = %s;", (user_id,))
        user = cur.fetchone()
        if not user:
            raise BookingError("Недействительный пользователь", 401)
        user_email = user[0]

        cur.execute("""
            SELECT flight_number, departure_city, arrival_city,
                   departure_time, arrival_time, seats_available
            FROM flights
            WHERE id = %s
            FOR UPDATE;
        """, (flight_id,))
        flight = cur.fetchone()
        if not flight:
            raise BookingError("Рейс не найден — возможно, он уже улетел", 404)

        seats_available = int(flight[5] or 0)
        if seats_available < passengers:
            if seats_available <= 0:
                raise BookingError("На этот рейс не осталось свободных мест", 409)
            raise BookingError(
                "Свободных мест осталось всего {} — уменьшите число пассажиров".format(seats_available),
                409,
            )

        cur.execute(
            "UPDATE flights SET seats_available = seats_available - %s WHERE id = %s;",
            (passengers, flight_id),
        )

        reference = _new_reference(cur)
        cur.execute("""
            INSERT INTO bookings (
                reference, user_id, flight_id, flight_number, departure_city,
                arrival_city, departure_time, arrival_time, cabin, fare, passengers,
                passenger_names, total_price, card_last4, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'confirmed')
            RETURNING id, created_at;
        """, (
            reference, user_id, flight_id, flight[0], flight[1], flight[2],
            flight[3], flight[4], cabin, fare, passengers,
            json.dumps(passenger_names, ensure_ascii=False), round(total_price, 2),
            card_last4 or None,
        ))
        booking_id, created_at = cur.fetchone()
        conn.commit()

        return jsonify({
            "message": "Билет оформлен",
            "booking": {
                "id": booking_id,
                "reference": reference,
                "email": user_email,
                "flight_number": flight[0],
                "departure_city": flight[1],
                "arrival_city": flight[2],
                "departure_time": flight[3].strftime("%d.%m.%Y %H:%M"),
                "arrival_time": flight[4].strftime("%d.%m.%Y %H:%M"),
                "cabin": cabin,
                "fare": fare,
                "passengers": passengers,
                "passenger_names": passenger_names,
                "total_price": round(total_price, 2),
                "card_last4": card_last4,
                "seats_left": seats_available - passengers,
                "status": "confirmed",
                "created_at": created_at.strftime("%d.%m.%Y %H:%M"),
            },
        }), 201

    except BookingError as exc:
        if conn:
            conn.rollback()
        return jsonify({"error": exc.message}), exc.status
    except Exception:
        if conn:
            conn.rollback()
        app.logger.exception("Flight booking failed")
        return jsonify({"error": "Сервис бронирования временно недоступен"}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


@app.route("/api/bookings/<reference>")
def booking_receipt(reference):
    """Чек по номеру брони — пригодится, если страницу оплаты закрыли."""
    reference = str(reference or "").strip().upper()[:16]
    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT reference, flight_number, departure_city, arrival_city,
                   departure_time, arrival_time, cabin, fare, passengers,
                   passenger_names, total_price, card_last4, status, created_at
            FROM bookings WHERE reference = %s;
        """, (reference,))
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "Бронь с таким номером не найдена"}), 404

        try:
            names = json.loads(row[9] or "[]")
        except ValueError:
            names = []

        return jsonify({
            "reference": row[0],
            "flight_number": row[1],
            "departure_city": row[2],
            "arrival_city": row[3],
            "departure_time": row[4].strftime("%d.%m.%Y %H:%M") if row[4] else "",
            "arrival_time": row[5].strftime("%d.%m.%Y %H:%M") if row[5] else "",
            "cabin": row[6],
            "fare": row[7],
            "passengers": row[8],
            "passenger_names": names,
            "total_price": float(row[10] or 0),
            "card_last4": row[11],
            "status": row[12],
            "created_at": row[13].strftime("%d.%m.%Y %H:%M") if row[13] else "",
        })
    except Exception:
        app.logger.exception("Unable to read the booking receipt")
        return jsonify({"error": "Сервис бронирования временно недоступен"}), 500
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


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
    return _all_flights()[:limit]


def _all_flights():
    """Всё расписание: ассистент должен знать не первые 8 рейсов, а весь список."""
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            SELECT flight_number, departure_city, arrival_city,
                   departure_time, price, seats_available
            FROM flights ORDER BY departure_time;
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()
    except Exception:
        app.logger.exception("Assistant could not read the schedule")
        return []

    return [{
        "number": row[0],
        "from": row[1],
        "to": row[2],
        "departure": row[3].strftime("%d.%m.%Y %H:%M"),
        "when": row[3],
        "price": round(_price_kzt(row[4])),
        "seats": row[5],
    } for row in rows]


# ---------------------------------------------------------------------------
# Что ассистент знает о продукте. Один источник правды и для модели, и для
# движка правил, чтобы ответы не расходились между режимами.
# ---------------------------------------------------------------------------
FACTS = {
    "fares_ru": (
        "Тарифов три. Lite — ручная кладь 8 кг, выбор места, лёгкие снеки. "
        "Flex — 12 кг в салон плюс одно место багажа, бесплатные изменения даты, питание. "
        "Business — два места багажа, приватная капсула и лаунж."
    ),
    "fares_en": (
        "There are three fares. Lite: an 8 kg cabin bag, seat selection, light snacks. "
        "Flex: a 12 kg cabin bag plus one checked bag, free date changes, meals. "
        "Business: two checked bags, a private pod and lounge access."
    ),
    "baggage_ru": (
        "Багаж зависит от тарифа: Lite — только ручная кладь 8 кг, Flex — 12 кг плюс одно место, "
        "Business — два места по 32 кг."
    ),
    "baggage_en": (
        "Baggage depends on the fare: Lite is an 8 kg cabin bag only, Flex adds a 12 kg bag plus "
        "one checked bag, Business includes two 32 kg checked bags."
    ),
    "loyalty_ru": (
        "Четыре уровня: Silver — 15 000 миль, Gold — 40 000, Platinum — 85 000, Diamond — 150 000. "
        "На странице Loyalty есть калькулятор: он считает мили по расстоянию, уровню и классу."
    ),
    "loyalty_en": (
        "Four tiers: Silver at 15,000 miles, Gold at 40,000, Platinum at 85,000 and Diamond at 150,000. "
        "The Loyalty page has a calculator that uses distance, tier and cabin."
    ),
    "refund_ru": (
        "Условия зависят от тарифа: Lite — возврат с удержанием, Flex — изменения без штрафа, "
        "Business — самые гибкие условия. Точные правила есть в карточках тарифов на шаге выбора тарифа."
    ),
    "refund_en": (
        "It depends on the fare: Lite allows refunds with a fee, Flex changes are free, Business has "
        "the most flexible terms. The exact rules are on the fare cards."
    ),
    "payment_ru": (
        "Оплата на сайте демонстрационная: форма работает, бронь и списание мест сохраняются в базе, "
        "но реальные деньги не списываются — на чеке это написано прямо."
    ),
    "payment_en": (
        "Payment here is a demo: the form works, the booking and the seat count are stored in the "
        "database, but no real money is charged — the receipt says so."
    ),
    "contacts_ru": "Почта консьержа — concierge@enair.aero, форма обратной связи на странице About & Contact.",
    "contacts_en": "The concierge email is concierge@enair.aero; there is a contact form on About & Contact.",
}

CITY_ALIASES = {
    "лондон": "london", "нью-йорк": "new york", "нью йорк": "new york",
    "дубай": "dubai", "париж": "paris", "токио": "tokyo", "алматы": "almaty",
    "алма-ата": "almaty", "москва": "moscow", "москву": "moscow", "москвы": "moscow",
    "стамбул": "istanbul", "рим": "rome", "рима": "rome", "барселона": "barcelona",
    "сингапур": "singapore", "сидней": "sydney", "рейкьявик": "reykjavik",
    "афины": "athens", "бали": "bali", "каир": "cairo", "доха": "doha",
    "ханой": "hanoi", "киото": "kyoto", "окленд": "auckland", "осака": "osaka",
    "сан-паулу": "sao paulo", "рио": "rio de janeiro",
}


def _schedule_cities(flights):
    names = []
    for flight in flights:
        for city in (flight["from"], flight["to"]):
            if city and city not in names:
                names.append(city)
    return names


# Русские названия для ответов: база хранит английские, а отвечаем по-русски.
CITY_RU = {
    "london": "Лондон", "new york": "Нью-Йорк", "paris": "Париж", "dubai": "Дубай",
    "moscow": "Москва", "almaty": "Алматы", "tokyo": "Токио", "singapore": "Сингапур",
    "sydney": "Сидней", "rome": "Рим", "athens": "Афины", "barcelona": "Барселона",
    "reykjavik": "Рейкьявик", "bali": "Бали", "hanoi": "Ханой", "kyoto": "Киото",
    "auckland": "Окленд", "sao paulo": "Сан-Паулу", "rio de janeiro": "Рио-де-Жанейро",
    "istanbul": "Стамбул", "doha": "Доха", "cairo": "Каир", "osaka": "Осака",
}

# Винительный падеж для оборотов «билет в …», «рейсы в …».
CITY_RU_ACC = {
    "moscow": "Москву", "barcelona": "Барселону", "doha": "Доху", "osaka": "Осаку",
    "athens": "Афины", "bali": "Бали", "almaty": "Алматы", "tokyo": "Токио",
    "singapore": "Сингапур", "sydney": "Сидней", "london": "Лондон", "new york": "Нью-Йорк",
    "paris": "Париж", "dubai": "Дубай", "rome": "Рим", "reykjavik": "Рейкьявик",
    "hanoi": "Ханой", "kyoto": "Киото", "auckland": "Окленд", "sao paulo": "Сан-Паулу",
    "rio de janeiro": "Рио-де-Жанейро", "istanbul": "Стамбул", "cairo": "Каир",
}


def _city_label(city, ru, form="nom"):
    if not city:
        return ""
    if not ru:
        return city
    key = city.lower()
    if form == "acc":
        return CITY_RU_ACC.get(key, CITY_RU.get(key, city))
    return CITY_RU.get(key, city)


def _direction(text, city):
    """«в Москву» — прилёт, «из Москвы» — вылет. None — оба направления."""
    if not city:
        return None
    lowered = (text or "").lower()
    aliases = [alias for alias, english in CITY_ALIASES.items() if english == city.lower()]
    aliases.append(city.lower())
    for alias in aliases:
        if re.search(r"(в|во|до|to)\s+" + re.escape(alias), lowered):
            return "to"
        if re.search(r"(из|от|from)\s+" + re.escape(alias), lowered):
            return "from"
    return None


def _find_city(text, flights):
    """Город из вопроса: сначала русские названия, потом английские из базы."""
    lowered = " " + (text or "").lower() + " "
    for alias, english in CITY_ALIASES.items():
        if alias in lowered:
            for city in _schedule_cities(flights):
                if city.lower() == english:
                    return city
    for city in _schedule_cities(flights):
        if city.lower()[:4] in lowered:
            return city
    return None


def _find_flight(text, flights):
    """Рейс по номеру: «EN-301», «en301», «EN 301»."""
    match = re.search(r"\b(e?n)[-\s]?(\d{2,4})\b", text or "", re.IGNORECASE)
    if not match:
        return None
    wanted = "en" + match.group(2)
    for flight in flights:
        if re.sub(r"[^a-z0-9]", "", str(flight["number"]).lower()) == wanted:
            return flight
    return None


def _flight_line(flight):
    seats = flight.get("seats")
    tail = ""
    if isinstance(seats, int):
        tail = ", свободно {} мест".format(seats) if seats > 0 else ", мест нет"
    return "{no}: {a} → {b}, {d}, от {p} ₸{tail}".format(
        no=flight["number"], a=flight["from"], b=flight["to"],
        d=flight["departure"], p=_money(flight["price"]), tail=tail)


def _history_city(history, flights):
    """Если в вопросе города нет, смотрим, о каком городе говорили раньше."""
    for item in reversed((history or [])[-6:]):
        if item.get("role") != "user":
            continue
        city = _find_city(str(item.get("content") or ""), flights)
        if city:
            return city
    return None


def _route_flights(city, flights, direction=None):
    if not city:
        return []
    key = city.lower()
    if direction == "to":
        pool = [f for f in flights if f["to"].lower() == key]
    elif direction == "from":
        pool = [f for f in flights if f["from"].lower() == key]
    else:
        pool = [f for f in flights if f["from"].lower() == key or f["to"].lower() == key]
    return pool or [f for f in flights if f["from"].lower() == key or f["to"].lower() == key]


def _suggestions(message="", city=None, ru=True, page=""):
    lowered = (message or "").lower()
    label = _city_label(city, ru)
    label_acc = _city_label(city, ru, "acc")
    if city:
        if ru:
            return ["Сколько стоит билет в {}?".format(_city_label(city, ru, "acc")), "Есть ли места на эти рейсы?", "Что входит в тариф Flex?"]
        return ["How much is a flight to {}?".format(city), "Are there seats left?", "What is included in Flex?"]
    if "оплат" in lowered or "payment" in lowered:
        return ["Как проходит оплата?", "Где посмотреть чек?", "Что входит в тариф Flex?"]
    if "мил" in lowered or "miles" in lowered or "loyalty" in lowered:
        return ["Как получить Silver?", "Сколько миль даёт Business?", "Куда летает eNAir?"]
    if ru:
        return ["Сколько стоит билет до Лондона?", "Какие рейсы в Дубай?", "Что входит в тариф Flex?"]
    return ["How much is a flight to London?", "Which flights go to Dubai?", "What is included in Flex?"]


# Намерения разбираем по ключевым словам. Порядок в списке = приоритет:
# конкретное («сколько мест») должно проверяться раньше общего («рейсы»).
def _rule_reply(message, flights, history=None):
    text = " " + re.sub(r"\s+", " ", (message or "").lower()).strip() + " "
    ru = bool(re.search(r"[а-яё]", text))
    city = _find_city(text, flights)
    flight = _find_flight(message, flights)
    if not city and not flight:
        city = _history_city(history, flights)
    direction = _direction(text, city) if city else None
    label = _city_label(city, ru)
    label_acc = _city_label(city, ru, "acc")

    def has(*words):
        return any(word in text for word in words)

    def money(value):
        return "{:,}".format(int(value)).replace(",", " ")

    # --- приветствие / благодарность / прощание -------------------------
    if has("привет", "здравств", "добрый день", "добрый вечер", "hello", "hi ", "hey"):
        if ru:
            return ("Здравствуйте! Я ассистент eNAir: подскажу по рейсам и местам, тарифам, багажу, "
                    "милям, оплате и возврату. С чего начнём?"), _suggestions(message, city, ru)
        return ("Hello! I am the eNAir assistant. I can help with flights and seats, fares, baggage, "
                "miles, payment and refunds. Where would you like to start?"), _suggestions(message, city, ru)

    if has("спасибо", "благодар", "thanks", "thank you"):
        return (("Рад помочь! Если что-то ещё понадобится — я здесь." if ru
                 else "Happy to help! I am here if you need anything else."),
                _suggestions(message, city, ru))

    if has("пока", "до свидания", "bye", "goodbye"):
        return (("Хорошего полёта! Возвращайтесь с вопросами." if ru
                 else "Have a good flight! Come back any time."),
                _suggestions(message, city, ru))

    # --- кто ты / что умеешь --------------------------------------------
    if has("кто ты", "ты бот", "что умеешь", "что ты можешь", "who are you", "are you a bot", "what can you do"):
        if ru:
            return ("Я ассистент eNAir. Знаю расписание из базы (номера, даты, цены и остаток мест), "
                    "тарифы и багаж, мили, оплату, возврат и как пройти бронирование. "
                    "Могу найти рейс по номеру или городу — просто спросите."), _suggestions(message, city, ru)
        return ("I am the eNAir assistant. I know the live schedule (numbers, dates, prices and seats left), "
                "fares and baggage, miles, payment, refunds and the booking flow. "
                "Ask about a city or a flight number and I will look it up."), _suggestions(message, city, ru)

    # --- конкретный рейс по номеру ---------------------------------------
    if flight:
        seats = flight.get("seats")
        seat_text = ("свободно {} мест".format(seats) if isinstance(seats, int) and seats > 0
                     else "свободных мест нет" if seats == 0 else "остаток мест уточняется")
        if ru:
            return ("{no}: {a} → {b}, вылет {d}, от {p} ₸ за пассажира, {seats}. "
                    "Выбрать тариф и оформить билет можно на странице Book Flights.").format(
                no=flight["number"], a=flight["from"], b=flight["to"], d=flight["departure"],
                p=money(flight["price"]), seats=seat_text), _suggestions(message, city, ru)
        return ("{no}: {a} -> {b}, departs {d}, from {p} KZT per passenger, {seats}. "
                "Pick a fare and book it on the Book Flights page.").format(
            no=flight["number"], a=flight["from"], b=flight["to"], d=flight["departure"],
            p=money(flight["price"]), seats=seat_text), _suggestions(message, city, ru)

    # --- остаток мест -----------------------------------------------------
    if has("мест", "свободн", "sold out", "seats", "available seat"):
        pool = _route_flights(city, flights, direction) if city else flights[:3]
        if pool:
            lines = ["{no} → {b}: {s}".format(no=f["number"], b=f["to"],
                                              s=(("{} мест".format(f["seats"])) if f["seats"] else "мест нет"))
                     for f in pool[:4]]
            head = ("По рейсу в {}:".format(label_acc) if city else "Свободные места по ближайшим рейсам:")
            tail = ("\nЕсли мест 0, рейс помечен как Sold out и купить его нельзя. "
                    "Остаток уменьшается сразу после покупки." if ru else "")
            if ru:
                return head + "\n" + "\n".join(lines) + tail, _suggestions(message, city, ru)
            return ("Seats left:\n" + "\n".join(lines), _suggestions(message, city, ru))
        if ru:
            return ("Свободных мест сейчас нет ни на одном рейсе — расписание пустое."), _suggestions(message, city, ru)
        return ("There are no seats available right now — the schedule is empty."), _suggestions(message, city, ru)

    # --- самый дешёвый ----------------------------------------------------
    if has("дешёв", "дешев", "недорог", "выгодн", "cheapest", "lowest price", "budget"):
        pool = _route_flights(city, flights, direction) if city else flights
        bookable = [f for f in pool if (f.get("seats") or 0) > 0]
        cheapest = min(bookable or pool, key=lambda item: item["price"]) if pool else None
        if cheapest:
            if ru:
                return ("Самый доступный вариант: " + _flight_line(cheapest) +
                        ". Тариф выбирается на следующем шаге бронирования."), _suggestions(message, city, ru)
            return ("The cheapest option is " + _flight_line(cheapest) + "."), _suggestions(message, city, ru)
        if ru:
            return ("Сейчас в расписании нет рейсов, поэтому назвать цену не могу."), _suggestions(message, city, ru)
        return ("There are no flights in the schedule right now."), _suggestions(message, city, ru)

    # --- цена -------------------------------------------------------------
    if has("сколько стоит", "цена", "стоимость", "почём", "price", "cost", "how much"):
        pool = _route_flights(city, flights, direction) if city else []
        if pool:
            lines = [_flight_line(f) for f in pool[:4]]
            head = ("Рейсы в {}:".format(label_acc) if ru else "Flights to {}:".format(city))
            tail = ("\nНадбавка за тариф прибавляется к цене и видна в разбивке на странице оплаты."
                    if ru else "\nThe fare surcharge is added and shown on the payment page.")
            return head + "\n" + "\n".join(lines) + tail, _suggestions(message, city, ru)
        cheapest = min(flights, key=lambda item: item["price"]) if flights else None
        if cheapest and (cheapest.get("seats") or 0) == 0:
            bookable = [f for f in flights if (f.get("seats") or 0) > 0]
            if bookable:
                cheapest = min(bookable, key=lambda item: item["price"])
        if not cheapest:
            return (("Сейчас в расписании нет рейсов, поэтому назвать цену не могу." if ru
                     else "There are no flights in the schedule right now."), _suggestions(message, city, ru))
        if ru:
            return ("Самый доступный рейс: " + _flight_line(cheapest) +
                    ". Полное расписание — на странице Book Flights."), _suggestions(message, city, ru)
        return ("The cheapest flight is " + _flight_line(cheapest) +
                ". The full list is on the Book Flights page."), _suggestions(message, city, ru)

    # --- куда вообще летаем ----------------------------------------------
    if has("какие город", "куда вы лета", "куда летаете", "города", "destinations", "which cities", "where do you fly"):
        cities = _schedule_cities(flights)
        if cities:
            if ru:
                return ("Сейчас eNAir летает в {} городов: {}.".format(
                    len(cities), ", ".join(_city_label(c, True) for c in cities)) +
                    " Расписание с датами и местами — на странице Book Flights."), _suggestions(message, city, ru)
            return ("eNAir currently flies to {} cities: {}.".format(len(cities), ", ".join(cities)) +
                    " The schedule with dates and seats is on the Book Flights page."), _suggestions(message, city, ru)
        if ru:
            return ("Расписание сейчас пустое."), _suggestions(message, city, ru)
        return ("The schedule is empty right now."), _suggestions(message, city, ru)

    # --- расписание / куда летаем ----------------------------------------
    if has("рейс", "расписан", "куда лет", "направлен", "когда лет", "flights", "routes", "schedule"):
        if has("ближайш", "следующ", "next", "soonest"):
            upcoming = flights[:1]
            if upcoming:
                if ru:
                    return ("Ближайший рейс: " + _flight_line(upcoming[0]) +
                            ". Дальше по расписанию — на странице Book Flights."), _suggestions(message, city, ru)
                return ("The next flight is " + _flight_line(upcoming[0]) + "."), _suggestions(message, city, ru)
        pool = _route_flights(city, flights, direction) if city else flights[:5]
        if not pool:
            if ru:
                message_empty = ("По этому городу рейсов в расписании пока нет." if city else
                                 "Не вижу рейсов в расписании: база не отвечает или список пуст. Загляните на страницу Book Flights.")
                return message_empty, _suggestions(message, city, ru)
            return (("There are no flights to that city yet." if city else
                     "I cannot see any flights right now — the schedule may be empty or the database is not responding."),
                    _suggestions(message, city, ru))
        lines = [_flight_line(f) for f in pool[:5]]
        head = ("Рейсы в {}:".format(label_acc) if city else ("Сейчас в расписании:" if ru else "Current schedule:"))
        tail = ("\nВыбрать рейс можно на странице Book Flights." if ru else "\nYou can pick one on Book Flights.")
        return head + "\n" + "\n".join(lines) + tail, _suggestions(message, city, ru)

    # --- тарифы (но не путать с вопросом про мили) ------------------------
    if has("тариф", "fare", "lite", "flex", "business", "что входит", "включено", "what is included") \
            and not has("мил", "миля", "лояльн", "miles", "loyalty", "tier"):
        return ((FACTS["fares_ru"] + " Надбавка за тариф видна в разбивке на странице оплаты.") if ru
                else FACTS["fares_en"]), _suggestions(message, city, ru)

    # --- багаж ------------------------------------------------------------
    if has("багаж", "чемодан", "ручная кладь", "baggage", "luggage", "bags"):
        return (FACTS["baggage_ru"] if ru else FACTS["baggage_en"]), _suggestions(message, city, ru)

    # --- возврат и изменения ---------------------------------------------
    if has("возврат", "верн", "обмен", "отмен", "деньги за билет", "refund", "cancel", "change my flight"):
        return (FACTS["refund_ru"] if ru else FACTS["refund_en"]), _suggestions(message, city, ru)

    # --- оплата -----------------------------------------------------------
    if has("оплат", "платёж", "платеж", "карта", "payment", "pay", "card"):
        return (FACTS["payment_ru"] if ru else FACTS["payment_en"]), _suggestions(message, city, ru)

    # --- бронирование -----------------------------------------------------
    if has("забронир", "купить билет", "как купить", "оформ", "book a flight", "booking", "how to book"):
        if ru:
            return ("Путь такой: главная → маршрут и Search → выберите рейс → тариф → данные пассажиров → "
                    "оплата. В конце открывается чек с номером брони. Для брони нужен вход в аккаунт: "
                    "гостя сайт попросит зарегистрироваться."), _suggestions(message, city, ru)
        return ("The flow is: home -> route and Search -> pick a flight -> fare -> passenger details -> "
                "payment. A receipt with the booking reference opens at the end. Booking requires an "
                "account, so guests are asked to sign in first."), _suggestions(message, city, ru)

    # --- регистрация ------------------------------------------------------
    if has("регистрац", "регистр", "зарегистр", "войти", "аккаунт", "register", "sign up", "sign in", "login", "log in"):
        if ru:
            return ("Кнопка «Войти / Регистрация» в правом верхнем углу. Аккаунт хранится в PostgreSQL (Neon), "
                    "пароль — только в виде хеша. После входа можно бронировать."), _suggestions(message, city, ru)
        return ("Use the Sign in / Register button in the header. Accounts live in PostgreSQL (Neon) and "
                "passwords are stored only as hashes. Once signed in you can book."), _suggestions(message, city, ru)

    # --- мили -------------------------------------------------------------
    if has("мили", "миль", "миля", "милях", "бонус", "лояльн", "miles", "loyalty", "rewards", "tier"):
        return (FACTS["loyalty_ru"] if ru else FACTS["loyalty_en"]), _suggestions(message, city, ru)

    # --- регистрация на рейс, документы, виза ----------------------------
    if has("check-in", "чек-ин", "чек ин", "регистрация на рейс", "паспорт", "виза", "документ", "visa", "passport"):
        if ru:
            return ("Регистрация на рейс проходит в приложении: биометрический проход и посадочный талон "
                    "появляются в профиле заранее. Для международных рейсов нужен паспорт, а визовые "
                    "требования зависят от страны — их стоит уточнить до покупки."), _suggestions(message, city, ru)
        return ("Check-in happens in the app: biometric boarding and the boarding pass appear in your "
                "profile ahead of time. International flights need a passport, and visa rules depend on "
                "the country, so check them before booking."), _suggestions(message, city, ru)

    # --- животные, дети, помощь ------------------------------------------
    if has("животн", "питом", "собак", "кот", "pet", "dog", "cat"):
        if ru:
            return ("Питомцев можно перевозить в салоне в переноске до 8 кг или в багаже — по правилам "
                    "тарифа. Точные условия зависят от страны въезда; напишите в консьерж, и вам подберут вариант."), _suggestions(message, city, ru)
        return ("Pets can travel in the cabin in a carrier up to 8 kg or in the hold, depending on the fare. "
                "Rules vary by destination — ask the concierge and they will find the right option."), _suggestions(message, city, ru)

    if has("ребен", "ребён", "дети", "child", "kids", "infant"):
        if ru:
            return ("Дети летят по детскому тарифу, младенцы до двух лет — на руках у взрослого. "
                    "Количество пассажиров задаётся в поле Passengers на главной или на странице поиска."), _suggestions(message, city, ru)
        return ("Children travel on a child fare; infants under two travel on an adult's lap. "
                "The passenger count is set in the Passengers field on the home or search page."), _suggestions(message, city, ru)

    # --- задержки и погода ------------------------------------------------
    if has("задерж", "опозда", "погод", "delay", "weather", "canceled", "cancelled"):
        if ru:
            return ("Статус рейса в этом прототипе не подключён к реальным данным авиакомпании. "
                    "О расписании и местах я знаю из базы, а по фактическим задержкам лучше смотреть табло аэропорта."), _suggestions(message, city, ru)
        return ("Live flight status is not connected to airline data in this prototype. I can tell you the "
                "schedule and seats from the database; for real delays check the airport board."), _suggestions(message, city, ru)

    # --- контакты ---------------------------------------------------------
    if has("контакт", "поддержк", "телефон", "почта", "contact", "support", "phone", "email"):
        return (FACTS["contacts_ru"] if ru else FACTS["contacts_en"]), _suggestions(message, city, ru)

    # --- валюта -----------------------------------------------------------
    if has("валют", "тенге", "доллар", "currency", "tenge", "kzt", "usd"):
        if ru:
            return ("В шапке есть переключатель ₸ / $. Курс — 490 ₸ за 1 $, цены в базе хранятся "
                    "в долларах и показываются в тенге."), _suggestions(message, city, ru)
        return ("The header has a KZT / USD switcher. The rate is 490 KZT per USD; prices are stored in USD "
                "and shown in tenge."), _suggestions(message, city, ru)

    # --- город без уточнения ---------------------------------------------
    if city:
        pool = _route_flights(city, flights, direction)
        if pool:
            lines = [_flight_line(f) for f in pool[:4]]
            if ru:
                return ("Рейсы в {}:".format(label_acc) + "\n" + "\n".join(lines) +
                        "\nМогу подсказать цену, остаток мест или что входит в тариф."), _suggestions(message, city, ru)
            return ("Flights to {}:".format(city) + "\n" + "\n".join(lines) +
                    "\nAsk me about prices, seats left or fares."), _suggestions(message, city, ru)

    if ru:
        return ("Могу рассказать про рейсы и цены, свободные места, тарифы, багаж, мили, оплату, "
                "возврат и регистрацию. Например: «сколько стоит билет до Лондона?»"), _suggestions(message, city, ru)
    return ("I can help with flights and prices, seats left, fares, baggage, miles, payment, refunds "
            "and sign-up. Try: \"how much is a flight to London?\""), _suggestions(message, city, ru)


def _schedule_for_prompt(flights):
    if not flights:
        return "no flights in the schedule"
    lines = []
    for flight in flights:
        lines.append("{no}: {a} -> {b}, {d}, {p} KZT, seats {s}".format(
            no=flight["number"], a=flight["from"], b=flight["to"],
            d=flight["departure"], p=flight["price"], s=flight["seats"]))
    return "\n".join(lines)


def _ask_ai_model(message, flights, model, history=None, page=""):
    """Один запрос к модели с явно указанным именем."""
    system = (
        "Ты — ассистент авиакомпании eNAir на демонстрационном сайте. Отвечай тепло и по делу, "
        "2–4 предложения, на языке пользователя (русский или английский). "
        "Если вопрос про конкретный рейс — назови номер, дату, цену и остаток мест из данных ниже. "
        "Никогда не выдумывай рейсы, цены, даты и правила: если данных нет, честно скажи и предложи, "
        "куда посмотреть на сайте. Не обещай вернуть деньги: оплата здесь демонстрационная. "
        "Если вопрос неполный, задай один короткий уточняющий вопрос.\n\n"
        "Расписание (цены в тенге за пассажира, места — свободный остаток):\n" + _schedule_for_prompt(flights) + "\n\n"
        "Тарифы: Lite — ручная кладь 8 кг, выбор места, снеки; Flex — 12 кг плюс место багажа, "
        "бесплатные изменения, питание; Business — два места багажа, капсула, лаунж.\n"
        "Багаж: Lite 8 кг ручная кладь, Flex +12 кг и одно место, Business два места по 32 кг.\n"
        "Мили: Silver 15 000, Gold 40 000, Platinum 85 000, Diamond 150 000; калькулятор на странице Loyalty.\n"
        "Возврат: зависит от тарифа, на странице тарифов есть условия.\n"
        "Оплата: демонстрационная, деньги не списываются; бронь и списание мест сохраняются в базе, "
        "после оплаты открывается чек с номером брони.\n"
        "Контакты: concierge@enair.aero, форма на странице About & Contact."
    )
    if page:
        system += "\nПользователь сейчас на странице: {}.".format(page)

    messages = [{"role": "system", "content": system}]
    for item in (history or [])[-8:]:
        role = item.get("role")
        content = str(item.get("content") or "").strip()[:600]
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": message})

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.35,
        "max_tokens": 400,
    }

    request_obj = urllib.request.Request(
        AI_BASE_URL + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": "Bearer " + AI_API_KEY,
            # Groq стоит за Cloudflare и блокирует дефолтный Python-urllib
            # ошибкой 1010, поэтому представляемся нормально.
            "User-Agent": "eNAir-Assistant/1.0 (+https://enair-app-1.onrender.com)",
        },
        method="POST",
    )

    with urllib.request.urlopen(request_obj, timeout=20) as response:
        data = json.loads(response.read().decode("utf-8"))

    return (data["choices"][0]["message"]["content"] or "").strip()


def _ask_ai(message, flights, history=None, page=""):
    """Запрос к модели. При 400/404 пробует запасную, при прочих ошибках — откат на правила."""
    try:
        return _ask_ai_model(message, flights, AI_MODEL, history, page)
    except urllib.error.HTTPError as exc:
        if exc.code in (400, 404) and AI_MODEL_FALLBACK and AI_MODEL_FALLBACK != AI_MODEL:
            app.logger.warning(
                "Model %s is unavailable (%s), retrying with %s", AI_MODEL, exc.code, AI_MODEL_FALLBACK
            )
            return _ask_ai_model(message, flights, AI_MODEL_FALLBACK, history, page)
        raise


@app.route("/api/assistant", methods=["POST"])
def assistant():
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", ""))[:400].strip()
    page = str(data.get("page", "") or "")[:60]
    history = data.get("history") or []
    if not isinstance(history, list):
        history = []
    history = [item for item in history if isinstance(item, dict)][-8:]

    if not message:
        return jsonify({"error": "Пустой запрос"}), 400

    flights = _all_flights()
    ai_error = None

    if AI_API_KEY:
        try:
            reply = _ask_ai(message, flights, history, page)
            if reply:
                city = _find_city(message, flights)
                return jsonify({"reply": reply, "source": "ai",
                                "suggestions": _suggestions(message, city)})
        except urllib.error.HTTPError as exc:
            ai_error = "HTTP {}".format(exc.code)
            app.logger.exception("AI assistant request failed")
        except Exception:
            ai_error = "connection"
            app.logger.exception("AI assistant request failed")

    reply, suggestions = _rule_reply(message, flights, history)
    payload = {"reply": reply, "source": "rules", "suggestions": suggestions}
    if ai_error:
        payload["ai_error"] = ai_error
    return jsonify(payload)

@app.route("/api/assistant/selftest")
def assistant_selftest():
    """Проверка связи с моделью: показывает точную ошибку провайдера."""
    if not AI_API_KEY:
        return jsonify({"ok": False, "stage": "config", "error": "Ключ ИИ не найден в переменных окружения"})

    result = {"ok": False, "base_url": AI_BASE_URL, "models_tried": []}

    for model in (AI_MODEL, AI_MODEL_FALLBACK):
        if not model:
            continue
        try:
            reply = _ask_ai_model("Ответь одним словом: привет", [], model)
            result.update({"ok": True, "stage": "ok", "model": model, "reply": (reply or "")[:200]})
            return jsonify(result)
        except urllib.error.HTTPError as exc:
            body = ""
            try:
                body = exc.read().decode("utf-8", "replace")[:400]
            except Exception:
                pass
            result["models_tried"].append({"model": model, "http": exc.code, "body": body})
        except Exception as exc:
            result["models_tried"].append({
                "model": model,
                "error": type(exc).__name__ + ": " + str(exc)[:200],
            })

    result["error"] = "Ни одна модель не ответила, смотри models_tried"
    return jsonify(result)


@app.route("/api/assistant/status")
def assistant_status():
    """Диагностика: включён ли режим ИИ. Ключ наружу не отдаётся."""
    return jsonify({
        "mode": "ai" if AI_API_KEY else "rules",
        "ai_enabled": bool(AI_API_KEY),
        "model": AI_MODEL if AI_API_KEY else None,
        "fallback_model": AI_MODEL_FALLBACK if AI_API_KEY else None,
        "base_url": AI_BASE_URL if AI_API_KEY else None,
        "key_variable_hint": "ключ найден" if AI_API_KEY else "ключ не найден ни в одной переменной",
        "selftest": "/api/assistant/selftest",
    })


# Важно: инициализация на уровне модуля, чтобы срабатывала и под gunicorn на Render.
init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
