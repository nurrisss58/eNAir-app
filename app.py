from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)  # Разрешаем запросы с фронтенда

# Подключение к базе (твои реальные параметры)
def get_db():
    return psycopg2.connect(
        dbname="airline",
        user="postgres",
        password="2726259012",   # Твой пароль от pgAdmin
        host="localhost",
        port="5432"
    )

# Автоматическое создание таблицы пользователей при старте (если ее еще нет)
def init_db():
    try:
        conn = get_db()
        cur = conn.cursor()
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
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);")
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);")
        cur.execute("ALTER TABLE users ALTER COLUMN name DROP NOT NULL;")
        cur.execute("ALTER TABLE users ALTER COLUMN password DROP NOT NULL;")
        conn.commit()
        cur.close()
        conn.close()
        print("Таблица пользователей проверена/создана успешно!")
    except Exception:
        app.logger.exception("Unable to initialize the users table")

# API получения рейсов
@app.route("/api/flights")
def flights():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        SELECT id, flight_number, departure_city, arrival_city,
               departure_time, arrival_time, price, seats_available
        FROM flights ORDER BY departure_time
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    result = []
    for r in rows:
        result.append({
            "id": r[0],
            "flight_number": r[1],
            "departure_city": r[2],
            "arrival_city": r[3],
            "departure_time": r[4].strftime("%d.%m.%Y %H:%M"),
            "arrival_time": r[5].strftime("%d.%m.%Y %H:%M"),
            "price": float(r[6]),
            "seats_available": r[7]
        })
    return jsonify(result)

# API Регистрации
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Укажите email и пароль"}), 400

    password_hash = generate_password_hash(password)

    conn = None
    cur = None
    try:
        conn = get_db()
        cur = conn.cursor()
        # Проверяем, есть ли уже такой пользователь
        cur.execute("SELECT id FROM users WHERE email = %s;", (email,))
        if cur.fetchone():
            return jsonify({"error": "Пользователь с таким email уже существует"}), 400

        # Сохраняем
        cur.execute(
            "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id, email;",
            (email, password_hash)
        )
        new_user = cur.fetchone()
        conn.commit()

        return jsonify({
            "message": "Регистрация прошла успешно!",
            "user": {"id": new_user[0], "email": new_user[1]}
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

# API Логина
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

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

        # Проверяем хэш пароля
        if check_password_hash(user[2], password):
            return jsonify({
                "message": "Успешный вход!",
                "user": {"id": user[0], "email": user[1]}
            }), 200
        else:
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

# ---------------- API БРОНИРОВАНИЯ (ЗАЩИЩЕННЫЙ) ----------------
@app.route('/api/book', methods=['POST'])
def book_flight():
    data = request.get_json()
    user_id = data.get('user_id')
    flight_id = data.get('flight_id')

    # Жесткая проверка на бэкенде: если юзера нет, рубим запрос
    if not user_id:
        return jsonify({"error": "Доступ запрещен. Пожалуйста, войдите в систему."}), 401

    try:
        conn = get_db()
        cur = conn.cursor()
        
        # Проверяем, существует ли такой пользователь в базе данных
        cur.execute("SELECT id FROM users WHERE id = %s;", (user_id,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "Недействительный пользователь"}), 401

        # Здесь в будущем можно будет добавить сохранение брони в таблицу bookings
        # cur.execute("INSERT INTO bookings (user_id, flight_id) VALUES (%s, %s);", (user_id, flight_id))
        # conn.commit()

        cur.close()
        conn.close()
        return jsonify({"message": "Билет успешно забронирован!"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    init_db()  # Создаст таблицу при запуске
    app.run(debug=True)