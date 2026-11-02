import os
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
            "price": float(row[6]),
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


# Важно: инициализация на уровне модуля, чтобы срабатывала и под gunicorn на Render.
init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=False)
