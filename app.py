import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import psycopg2
from werkzeug.security import generate_password_hash, check_password_hash

# Настраиваем Flask так, чтобы он искал HTML/CSS/JS в текущей папке
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Разрешаем запросы с фронтенда

# Подключение к базе данных
def get_db():
    # Проверяем, есть ли облачная строка подключения от Render/Neon
    database_url = os.environ.get("DATABASE_URL")
    
    if database_url:
        # Если запущено в облаке (Render), подключаемся к Neon.tech
        return psycopg2.connect(database_url)
    else:
        # Если запущено локально на твоем ПК
        return psycopg2.connect(
            dbname="airline",
            user="postgres",
            password="2726259012",
            host="localhost",
            port="5432"
        )

# Главная страница (отдает index.html)
@app.route('/')
def home():
    return send_from_directory('.', 'index.html')

# Маршрут для отдачи всех остальных файлов (CSS, JS, картинки)
@app.route('/<path:path>')
def send_static(path):
    return send_from_directory('.', path)

# Совместимость с путями вида /images/filename.jpg, когда файлы лежат в корне проекта
@app.route('/images/<path:filename>')
def serve_images(filename):
    return send_from_directory('.', filename)

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

# API по��учения рейсов
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

# API БРОНИРОВАНИЯ (ЗАЩИЩЕННЫЙ)
@app.route('/api/book', methods=['POST'])
def book_flight():
    data = request.get_json()
    user_id = data.get('user_id')
    flight_id = data.get('flight_id')

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

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    init_db()
    app.run(debug=True)
