"""Personal account, profile storage and persisted flight status for eNAir.

The module keeps the database work in one place:

* ``ensure_schema`` adds the profile columns, the flight status columns and the
  ``flight_events`` history table. It is idempotent, so a Render deploy can run
  it on every boot.
* ``register_routes`` attaches the JSON API used by the account page, the
  settings page and the flight status page.
* When PostgreSQL is unavailable (local machine without Neon), every endpoint
  answers with demo data marked ``demo: true`` so the UI still works.
"""

import json
import time

from flask import jsonify, request, session

STATUS_VALUES = ("on_time", "boarding", "departed", "landed", "delayed", "cancelled", "diverted")

STATUS_LABELS = {
    "on_time": "On time",
    "boarding": "Boarding",
    "departed": "Departed",
    "landed": "Landed",
    "delayed": "Delayed",
    "cancelled": "Cancelled",
    "diverted": "Diverted",
}

PROFILE_COLUMNS = (
    "id, email, name, first_name, last_name, phone, membership_number, tier, miles, "
    "language, created_at, last_login, notify_updates, notify_checkin, notify_offers"
)

EDITABLE_FIELDS = {
    "first_name": ("first_name", 80),
    "last_name": ("last_name", 80),
    "phone": ("phone", 40),
    "language": ("language", 10),
}

DEMO_PROFILE = {
    "id": 1,
    "email": "demo@enair.com",
    "name": "Alex Morgan",
    "first_name": "Alex",
    "last_name": "Morgan",
    "phone": "+1 212 555 0148",
    "membership_number": "EN-4829-13",
    "tier": "Member",
    "miles": 0,
    "language": "en",
    "member_since": "12.03.2024",
    "last_login": "20.11.2026 00:10",
    "notifications": {"updates": True, "checkin": True, "offers": False},
}

DEMO_BOOKINGS = [
    {
        "reference": "EN482913",
        "flight_number": "eN-102",
        "departure_city": "New York",
        "arrival_city": "London",
        "departure_time": "28.03.2026 08:15",
        "cabin": "Economy Flex",
        "passengers": 2,
        "total_price": 604660,
        "status": "confirmed",
    },
    {
        "reference": "EN771204",
        "flight_number": "eN-88",
        "departure_city": "London",
        "arrival_city": "Tokyo",
        "departure_time": "31.03.2026 09:30",
        "cabin": "Business",
        "passengers": 1,
        "total_price": 812000,
        "status": "confirmed",
    },
]

# In-process state so the demo still behaves like a database when Neon is absent.
# If the database just failed, answer from the demo store for a minute instead of
# timing out on every request.
_DB = {"down_until": 0.0}


def _db_down():
    return time.time() < _DB["down_until"]


def _db_mark_down():
    _DB["down_until"] = time.time() + 60


_DEMO = {
    "profile": dict(DEMO_PROFILE),
    "events": {},
    "cards": [
        {"id": 1, "brand": "Visa", "last4": "4242", "exp": "09/29", "holder": "Alex Morgan", "default": True},
        {"id": 2, "brand": "Mastercard", "last4": "8801", "exp": "02/27", "holder": "Alex Morgan", "default": False},
    ],
    "miles": [
        {"delta": 25000, "reason": "Welcome bonus", "reward": "", "created_at": "12.03.2024 10:00"},
        {"delta": 12000, "reason": "Flight eN-102", "reward": "", "created_at": "28.03.2024 18:20"},
        {"delta": 11250, "reason": "Flight eN-88", "reward": "", "created_at": "31.03.2024 09:40"},
    ],
    "passengers": {},
    "services": {},
}


# ---------------------------------------------------------------------------
# schema
# ---------------------------------------------------------------------------
def ensure_schema(cur):
    """Adds the profile, flight status and event history structures."""

    user_columns = [
        ("first_name", "VARCHAR(80)"),
        ("last_name", "VARCHAR(80)"),
        ("phone", "VARCHAR(40)"),
        ("membership_number", "VARCHAR(20)"),
        ("tier", "VARCHAR(20) DEFAULT 'Gold'"),
        ("miles", "INTEGER NOT NULL DEFAULT 48250"),
        ("language", "VARCHAR(10) DEFAULT 'en'"),
        ("avatar_url", "TEXT"),
        ("notify_updates", "BOOLEAN NOT NULL DEFAULT TRUE"),
        ("notify_checkin", "BOOLEAN NOT NULL DEFAULT TRUE"),
        ("notify_offers", "BOOLEAN NOT NULL DEFAULT FALSE"),
        ("last_login", "TIMESTAMP"),
        ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ("preferred_tier", "VARCHAR(20)"),
    ]
    for column, definition in user_columns:
        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS {} {};".format(column, definition))
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_membership_key ON users (membership_number);")
    cur.execute("ALTER TABLE users ALTER COLUMN miles SET DEFAULT 0;")
    cur.execute("ALTER TABLE users ALTER COLUMN tier SET DEFAULT 'Member';")
    cur.execute("ALTER TABLE users ALTER COLUMN miles SET NOT NULL;")

    flight_columns = [
        ("status", "VARCHAR(20) NOT NULL DEFAULT 'on_time'"),
        ("delay_minutes", "INTEGER NOT NULL DEFAULT 0"),
        ("gate", "VARCHAR(10)"),
        ("terminal", "VARCHAR(10)"),
        ("status_reason", "TEXT"),
        ("status_updated_at", "TIMESTAMP"),
    ]
    for column, definition in flight_columns:
        cur.execute("ALTER TABLE flights ADD COLUMN IF NOT EXISTS {} {};".format(column, definition))

    cur.execute("""
        CREATE TABLE IF NOT EXISTS flight_events (
            id SERIAL PRIMARY KEY,
            flight_number VARCHAR(50) NOT NULL,
            status VARCHAR(20) NOT NULL,
            delay_minutes INTEGER NOT NULL DEFAULT 0,
            reason TEXT,
            gate VARCHAR(10),
            terminal VARCHAR(10),
            source VARCHAR(20) DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute(
        "CREATE INDEX IF NOT EXISTS flight_events_number_idx "
        "ON flight_events (flight_number, created_at DESC);"
    )

    cur.execute("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seat VARCHAR(8);")
    cur.execute("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS baggage_summary VARCHAR(120);")
    cur.execute("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2);")
    cur.execute("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS payment_methods (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            brand VARCHAR(20) NOT NULL,
            last4 VARCHAR(4) NOT NULL,
            exp_month INTEGER,
            exp_year INTEGER,
            holder VARCHAR(120),
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS payment_methods_user_idx ON payment_methods (user_id);")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS booking_passengers (
            id SERIAL PRIMARY KEY,
            booking_reference VARCHAR(16) NOT NULL,
            full_name VARCHAR(120) NOT NULL,
            date_of_birth VARCHAR(20),
            document_last4 VARCHAR(8),
            seat VARCHAR(8),
            checked_in_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS booking_passengers_key ON booking_passengers (booking_reference, full_name);")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS booking_services (
            id SERIAL PRIMARY KEY,
            booking_reference VARCHAR(16) NOT NULL,
            service VARCHAR(30) NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            price NUMERIC(12,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS booking_services_ref_idx ON booking_services (booking_reference);")

    cur.execute("""
        CREATE TABLE IF NOT EXISTS miles_transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            delta INTEGER NOT NULL,
            balance_after INTEGER NOT NULL,
            reason VARCHAR(120),
            reward VARCHAR(80),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS miles_transactions_user_idx ON miles_transactions (user_id, created_at DESC);")

    # Existing rows get a readable account number once.
    cur.execute("""
        UPDATE users
        SET membership_number = 'EN-' || LPAD((id % 10000)::text, 4, '0') || '-'
            || LPAD(((id * 37) % 100)::text, 2, '0')
        WHERE membership_number IS NULL;
    """)


def membership_code(user_id):
    return "EN-{:04d}-{:02d}".format(int(user_id) % 10000, (int(user_id) * 37) % 100)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def profile_payload(row):
    """Turns a users row into the JSON shape used by the pages."""
    return {
        "id": row[0],
        "email": row[1],
        "name": row[2] or ("{} {}".format(row[3] or "", row[4] or "").strip()),
        "first_name": row[3] or "",
        "last_name": row[4] or "",
        "phone": row[5] or "",
        "membership_number": row[6] or "",
        "tier": row[7] or "Gold",
        "miles": int(row[8] or 0),
        "language": row[9] or "en",
        "member_since": row[10].strftime("%d.%m.%Y") if row[10] else "",
        "last_login": row[11].strftime("%d.%m.%Y %H:%M") if row[11] else "",
        "notifications": {
            "updates": bool(row[12]),
            "checkin": bool(row[13]),
            "offers": bool(row[14]),
        },
    }


def load_profile(cur, user_id):
    cur.execute("SELECT " + PROFILE_COLUMNS + " FROM users WHERE id = %s;", (user_id,))
    row = cur.fetchone()
    return profile_payload(row) if row else None


def demo_profile():
    return json.loads(json.dumps(_DEMO["profile"]))


def _booking_payload(row):
    return {
        "reference": row[0],
        "flight_number": row[1],
        "departure_city": row[2],
        "arrival_city": row[3],
        "departure_time": row[4].strftime("%d.%m.%Y %H:%M") if row[4] else "",
        "cabin": row[5],
        "passengers": row[6],
        "total_price": float(row[7] or 0),
        "status": row[8],
        "seat": row[9] if len(row) > 9 else "",
        "baggage_summary": row[10] if len(row) > 10 else "",
        "refund_amount": float(row[11]) if len(row) > 11 and row[11] is not None else None,
        "cancelled_at": row[12].strftime("%d.%m.%Y %H:%M") if len(row) > 12 and row[12] else "",
    }


def _demo_events(flight_number):
    events = _DEMO["events"].get(flight_number)
    if events:
        return events
    base = {
        "EN-88": ("delayed", 25, "Late inbound aircraft", "B22", "4"),
        "EN-101": ("delayed", 20, "Crew rotation", "A12", "1"),
    }.get(flight_number, ("on_time", 0, "On schedule", "B22", "4"))
    created = "20.11.2026 00:05"
    events = [{
        "status": base[0],
        "status_label": STATUS_LABELS[base[0]],
        "delay_minutes": base[1],
        "reason": base[2],
        "gate": base[3],
        "terminal": base[4],
        "source": "demo",
        "created_at": created,
    }]
    _DEMO["events"][flight_number] = events
    return events


def _status_payload(flight_number, latest, history, demo):
    return {
        "flight_number": flight_number,
        "status": latest.get("status", "on_time"),
        "status_label": STATUS_LABELS.get(latest.get("status", "on_time"), "On time"),
        "delay_minutes": int(latest.get("delay_minutes") or 0),
        "reason": latest.get("reason") or "",
        "gate": latest.get("gate") or "",
        "terminal": latest.get("terminal") or "",
        "updated_at": latest.get("created_at") or "",
        "history": history,
        "demo": bool(demo),
    }


def _variants(number):
    """Handles legacy rows without a hyphen: EN101 and EN-101 mean the same flight."""
    variants = [number]
    if "-" in number:
        variants.append(number.replace("-", ""))
    elif len(number) > 2:
        variants.append(number[:2] + "-" + number[2:])
    return variants


def _normalize_number(raw):
    text = (raw or "").strip().upper().replace(" ", "")
    if text and not text.startswith("EN"):
        text = "EN-" + text.lstrip("-")
    if text.startswith("EN") and "-" not in text[2:]:
        text = "EN-" + text[2:]
    return text[:50]


# ---------------------------------------------------------------------------
# routes
# ---------------------------------------------------------------------------
def award_miles(cur, user_id, amount, reason):
    """Adds miles for a paid booking and keeps the ledger in sync."""
    if not user_id or amount <= 0:
        return 0
    cur.execute("SELECT miles FROM users WHERE id = %s FOR UPDATE;", (user_id,))
    row = cur.fetchone()
    if not row:
        return 0
    balance = int(row[0] or 0) + int(amount)
    cur.execute("UPDATE users SET miles = %s WHERE id = %s;", (balance, user_id))
    cur.execute("""
        INSERT INTO miles_transactions (user_id, delta, balance_after, reason)
        VALUES (%s, %s, %s, %s);
    """, (user_id, int(amount), balance, reason[:120]))
    return balance


def register_routes(app, get_db):
    def db():
        if _db_down():
            raise RuntimeError("database is marked unavailable")
        try:
            return get_db()
        except Exception:
            _db_mark_down()
            raise

    @app.route("/api/me", methods=["GET"])
    def api_me():
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"authenticated": False, "demo": False, "user": None}), 200

        try:
            conn = db()
            cur = conn.cursor()
            profile = load_profile(cur, user_id)
            if not profile:
                session.clear()
                return jsonify({"authenticated": False, "demo": False, "user": None}), 200
            cur.execute("SELECT COUNT(*) FROM bookings WHERE user_id = %s;", (user_id,))
            count = cur.fetchone()[0]
            cur.close()
            conn.close()
            return jsonify({"authenticated": True, "user": profile, "bookings": count, "demo": False})
        except Exception:
            app.logger.exception("Unable to read the profile")
            return jsonify({"authenticated": True, "user": demo_profile(), "bookings": len(DEMO_BOOKINGS), "demo": True})

    @app.route("/api/me", methods=["POST"])
    def api_me_update():
        data = request.get_json(silent=True) or {}
        user_id = session.get("user_id")

        updates = {}
        for key, (column, limit) in EDITABLE_FIELDS.items():
            if key in data and data[key] is not None:
                updates[column] = str(data[key]).strip()[:limit]
        flags = {}
        for key in ("updates", "checkin", "offers"):
            if key in data:
                flags[key] = bool(data[key])

        if not user_id:
            return jsonify({"error": "Сначала войдите в аккаунт", "authenticated": False}), 401

        try:
            conn = db()
            cur = conn.cursor()
            if updates:
                columns = list(updates.keys())
                assignments = ", ".join("{} = %s".format(column) for column in columns)
                values = [updates[column] for column in columns] + [user_id]
                cur.execute(
                    "UPDATE users SET " + assignments + ", updated_at = CURRENT_TIMESTAMP WHERE id = %s;",
                    values,
                )
            if flags:
                cur.execute(
                    "UPDATE users SET notify_updates = %s, notify_checkin = %s, notify_offers = %s WHERE id = %s;",
                    (
                        flags.get("updates", _DEMO["profile"]["notifications"]["updates"]),
                        flags.get("checkin", _DEMO["profile"]["notifications"]["checkin"]),
                        flags.get("offers", _DEMO["profile"]["notifications"]["offers"]),
                        user_id,
                    ),
                )
            if "first_name" in updates or "last_name" in updates:
                cur.execute(
                    "UPDATE users SET name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) WHERE id = %s;",
                    (user_id,),
                )
            conn.commit()
            profile = load_profile(cur, user_id)
            cur.close()
            conn.close()
            return jsonify({"message": "Профиль сохранён", "user": profile, "demo": False})
        except Exception:
            app.logger.exception("Unable to update the profile")
            _DEMO["profile"].update({key: value for key, value in updates.items()})
            first = _DEMO["profile"].get("first_name") or ""
            last = _DEMO["profile"].get("last_name") or ""
            _DEMO["profile"]["name"] = (first + " " + last).strip() or _DEMO["profile"].get("name")
            if flags:
                _DEMO["profile"]["notifications"] = {
                    "updates": flags.get("updates", True),
                    "checkin": flags.get("checkin", True),
                    "offers": flags.get("offers", False),
                }
            return jsonify({"message": "Профиль сохранён (демо-режим)", "user": demo_profile(), "demo": True})

    @app.route("/api/me/bookings", methods=["GET"])
    def api_me_bookings():
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"authenticated": False, "bookings": [], "demo": False}), 200
        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("""
                SELECT reference, flight_number, departure_city, arrival_city,
                       departure_time, cabin, passengers, total_price, status,
                       seat, baggage_summary, refund_amount, cancelled_at
                FROM bookings WHERE user_id = %s
                ORDER BY created_at DESC NULLS LAST
                LIMIT 20;
            """, (user_id,))
            bookings = [_booking_payload(row) for row in cur.fetchall()]
            cur.close()
            conn.close()
            return jsonify({"authenticated": True, "bookings": bookings, "demo": False})
        except Exception:
            app.logger.exception("Unable to read the bookings of the account")
            return jsonify({"authenticated": True, "bookings": DEMO_BOOKINGS, "demo": True})

    @app.route("/api/logout", methods=["POST"])
    def api_logout():
        session.clear()
        return jsonify({"message": "Вы вышли из аккаунта", "authenticated": False})

    @app.route("/api/flights/<flight_number>/status", methods=["GET"])
    def flight_status(flight_number):
        number = _normalize_number(flight_number)
        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("""
                SELECT status, delay_minutes, reason, gate, terminal, created_at
                FROM flight_events WHERE flight_number = ANY(%s)
                ORDER BY created_at DESC LIMIT 10;
            """, (_variants(number),))
            rows = cur.fetchall()
            history = [{
                "status": row[0],
                "status_label": STATUS_LABELS.get(row[0], row[0]),
                "delay_minutes": int(row[1] or 0),
                "reason": row[2] or "",
                "gate": row[3] or "",
                "terminal": row[4] or "",
                "created_at": row[5].strftime("%d.%m.%Y %H:%M") if row[5] else "",
            } for row in rows]

            if history:
                latest = dict(history[0])
            else:
                cur.execute("""
                    SELECT status, delay_minutes, status_reason, gate, terminal, status_updated_at
                    FROM flights WHERE flight_number = ANY(%s) ORDER BY departure_time LIMIT 1;
                """, (_variants(number),))
                row = cur.fetchone()
                latest = {
                    "status": (row[0] if row else "on_time") or "on_time",
                    "delay_minutes": int((row[1] if row else 0) or 0),
                    "reason": (row[2] if row else "") or "",
                    "gate": (row[3] if row else "") or "",
                    "terminal": (row[4] if row else "") or "",
                    "created_at": row[5].strftime("%d.%m.%Y %H:%M") if row and row[5] else "",
                }
            cur.close()
            conn.close()
            return jsonify(_status_payload(number, latest, history, False))
        except Exception:
            app.logger.exception("Unable to read the flight status")
            events = _demo_events(number)
            return jsonify(_status_payload(number, dict(events[0]), events, True))

    @app.route("/api/flights/<flight_number>/status", methods=["POST"])
    def flight_status_update(flight_number):
        number = _normalize_number(flight_number)
        data = request.get_json(silent=True) or {}

        status = str(data.get("status") or "").strip()
        if status not in STATUS_VALUES:
            return jsonify({"error": "Неизвестный статус рейса", "allowed": list(STATUS_VALUES)}), 400

        try:
            delay = int(data.get("delay_minutes") or 0)
        except (TypeError, ValueError):
            return jsonify({"error": "Задержка должна быть числом минут"}), 400
        delay = max(0, min(delay, 2880))

        reason = str(data.get("reason") or "").strip()[:300]
        gate = str(data.get("gate") or "").strip()[:10]
        terminal = str(data.get("terminal") or "").strip()[:10]

        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("""
                UPDATE flights
                SET status = %s, delay_minutes = %s, gate = %s, terminal = %s,
                    status_reason = %s, status_updated_at = CURRENT_TIMESTAMP
                WHERE flight_number = ANY(%s);
            """, (status, delay, gate, terminal, reason, _variants(number)))
            cur.execute("""
                INSERT INTO flight_events (flight_number, status, delay_minutes, reason, gate, terminal, source)
                VALUES (%s, %s, %s, %s, %s, %s, 'admin');
            """, (number, status, delay, reason, gate, terminal))
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({
                "ok": True,
                "demo": False,
                "flight_number": number,
                "status": status,
                "status_label": STATUS_LABELS[status],
                "delay_minutes": delay,
                "reason": reason,
                "gate": gate,
                "terminal": terminal,
            })
        except Exception:
            app.logger.exception("Unable to store the flight status")
            event = {
                "status": status,
                "status_label": STATUS_LABELS[status],
                "delay_minutes": delay,
                "reason": reason,
                "gate": gate,
                "terminal": terminal,
                "source": "demo",
                "created_at": "just now",
            }
            events = _DEMO["events"].setdefault(number, [])
            events.insert(0, event)
            del events[10:]
            return jsonify(dict(event, ok=True, demo=True, flight_number=number))

    # ---------------------------------------------------------------- cards
    def _card_payload(row):
        return {
            "id": row[0],
            "brand": row[1],
            "last4": row[2],
            "exp": "{:02d}/{:02d}".format(int(row[3] or 0), int(row[4] or 0) % 100),
            "holder": row[5] or "",
            "default": bool(row[6]),
        }

    @app.route("/api/me/cards", methods=["GET"])
    def api_cards():
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"authenticated": False, "cards": [], "demo": False}), 200
        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("""
                SELECT id, brand, last4, exp_month, exp_year, holder, is_default
                FROM payment_methods WHERE user_id = %s ORDER BY is_default DESC, id;
            """, (user_id,))
            cards = [_card_payload(row) for row in cur.fetchall()]
            cur.close()
            conn.close()
            return jsonify({"authenticated": True, "cards": cards, "demo": False})
        except Exception:
            app.logger.exception("Unable to read the cards")
            return jsonify({"authenticated": True, "cards": list(_DEMO["cards"]), "demo": True})

    @app.route("/api/me/cards", methods=["POST"])
    def api_cards_add():
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Сначала войдите в аккаунт"}), 401
        data = request.get_json(silent=True) or {}
        brand = str(data.get("brand") or "").strip()[:20] or "Card"
        last4 = "".join(ch for ch in str(data.get("last4") or "") if ch.isdigit())[-4:]
        try:
            month = int(data.get("exp_month") or 0)
            year = int(data.get("exp_year") or 0)
        except (TypeError, ValueError):
            return jsonify({"error": "Срок действия указан неверно"}), 400
        if len(last4) != 4 or not 1 <= month <= 12 or year < 2024:
            return jsonify({"error": "Проверьте номер карты и срок действия"}), 400
        holder = str(data.get("holder") or "").strip()[:120]
        make_default = bool(data.get("default"))

        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM payment_methods WHERE user_id = %s;", (user_id,))
            count = cur.fetchone()[0]
            is_default = make_default or count == 0
            if is_default:
                cur.execute("UPDATE payment_methods SET is_default = FALSE WHERE user_id = %s;", (user_id,))
            cur.execute("""
                INSERT INTO payment_methods (user_id, brand, last4, exp_month, exp_year, holder, is_default)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id;
            """, (user_id, brand, last4, month, year, holder, is_default))
            card_id = cur.fetchone()[0]
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({"ok": True, "id": card_id, "demo": False})
        except Exception:
            app.logger.exception("Unable to store the card")
            if make_default or not _DEMO["cards"]:
                for card in _DEMO["cards"]:
                    card["default"] = False
            card = {
                "id": (max([item["id"] for item in _DEMO["cards"]]) + 1) if _DEMO["cards"] else 1,
                "brand": brand,
                "last4": last4,
                "exp": "{:02d}/{:02d}".format(month, year % 100),
                "holder": holder,
                "default": make_default or not _DEMO["cards"],
            }
            _DEMO["cards"].append(card)
            return jsonify({"ok": True, "id": card["id"], "demo": True})

    @app.route("/api/me/cards/<int:card_id>/default", methods=["POST"])
    def api_card_default(card_id):
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Сначала войдите в аккаунт"}), 401
        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("UPDATE payment_methods SET is_default = FALSE WHERE user_id = %s;", (user_id,))
            cur.execute(
                "UPDATE payment_methods SET is_default = TRUE WHERE id = %s AND user_id = %s;",
                (card_id, user_id),
            )
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({"ok": True, "demo": False})
        except Exception:
            for card in _DEMO["cards"]:
                card["default"] = card["id"] == card_id
            return jsonify({"ok": True, "demo": True})

    @app.route("/api/me/cards/<int:card_id>", methods=["DELETE"])
    def api_card_delete(card_id):
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Сначала войдите в аккаунт"}), 401
        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("DELETE FROM payment_methods WHERE id = %s AND user_id = %s;", (card_id, user_id))
            cur.execute("SELECT COUNT(*) FROM payment_methods WHERE user_id = %s AND is_default = TRUE;", (user_id,))
            if cur.fetchone()[0] == 0:
                cur.execute("""
                    UPDATE payment_methods SET is_default = TRUE
                    WHERE id = (SELECT id FROM payment_methods WHERE user_id = %s ORDER BY id LIMIT 1);
                """, (user_id,))
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({"ok": True, "demo": False})
        except Exception:
            _DEMO["cards"] = [card for card in _DEMO["cards"] if card["id"] != card_id]
            return jsonify({"ok": True, "demo": True})

    # ---------------------------------------------------------------- check-in
    def _passenger_payload(row):
        return {
            "id": row[0],
            "name": row[1],
            "dob": row[2] or "",
            "document": row[3] or "",
            "seat": row[4] or "",
            "checked_in_at": row[5].strftime("%d.%m.%Y %H:%M") if row[5] else "",
        }

    @app.route("/api/bookings/<reference>/passengers", methods=["GET"])
    def api_passengers(reference):
        ref = str(reference or "").strip().upper()[:16]
        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("""
                SELECT id, full_name, date_of_birth, document_last4, seat, checked_in_at
                FROM booking_passengers WHERE booking_reference = %s ORDER BY id;
            """, (ref,))
            passengers = [_passenger_payload(row) for row in cur.fetchall()]
            cur.close()
            conn.close()
            return jsonify({"reference": ref, "passengers": passengers, "demo": False})
        except Exception:
            return jsonify({"reference": ref, "passengers": _DEMO["passengers"].get(ref, []), "demo": True})

    @app.route("/api/bookings/<reference>/checkin", methods=["POST"])
    def api_checkin(reference):
        ref = str(reference or "").strip().upper()[:16]
        data = request.get_json(silent=True) or {}
        people = data.get("passengers") or []
        if not isinstance(people, list) or not people:
            return jsonify({"error": "Нет пассажиров для регистрации"}), 400

        cleaned = []
        for person in people[:9]:
            name = str(person.get("name") or "").strip()[:120]
            if not name:
                continue
            document = "".join(ch for ch in str(person.get("document") or "") if ch.isalnum())
            cleaned.append({
                "name": name,
                "dob": str(person.get("dob") or "").strip()[:20],
                "document": document[-4:],
                "seat": str(person.get("seat") or "").strip()[:8],
            })
        if not cleaned:
            return jsonify({"error": "Не удалось прочитать пассажиров"}), 400

        seats = ", ".join(person["seat"] for person in cleaned if person["seat"])
        try:
            conn = db()
            cur = conn.cursor()
            for person in cleaned:
                cur.execute("""
                    INSERT INTO booking_passengers
                        (booking_reference, full_name, date_of_birth, document_last4, seat, checked_in_at)
                    VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (booking_reference, full_name) DO UPDATE
                    SET date_of_birth = EXCLUDED.date_of_birth,
                        document_last4 = EXCLUDED.document_last4,
                        seat = EXCLUDED.seat,
                        checked_in_at = CURRENT_TIMESTAMP;
                """, (ref, person["name"], person["dob"], person["document"], person["seat"]))
            cur.execute(
                "UPDATE bookings SET status = 'checked_in', seat = COALESCE(NULLIF(%s, ''), seat) WHERE reference = %s;",
                (seats, ref),
            )
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({"ok": True, "reference": ref, "passengers": cleaned, "demo": False})
        except Exception:
            app.logger.exception("Unable to store the check-in")
            _DEMO["passengers"][ref] = cleaned
            return jsonify({"ok": True, "reference": ref, "passengers": cleaned, "demo": True})

    # ---------------------------------------------------------------- services
    def _services_payload(rows):
        items = [{
            "id": row[0],
            "service": row[1],
            "quantity": int(row[2] or 0),
            "price": float(row[3] or 0),
        } for row in rows]
        return {"items": items, "total": sum(item["price"] * item["quantity"] for item in items)}

    @app.route("/api/bookings/<reference>/services", methods=["GET"])
    def api_services(reference):
        ref = str(reference or "").strip().upper()[:16]
        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("""
                SELECT id, service, quantity, price FROM booking_services
                WHERE booking_reference = %s ORDER BY id;
            """, (ref,))
            payload = _services_payload(cur.fetchall())
            cur.close()
            conn.close()
            payload.update({"reference": ref, "demo": False})
            return jsonify(payload)
        except Exception:
            stored = _DEMO["services"].get(ref, [])
            payload = _services_payload([(0, item["service"], item["quantity"], item["price"]) for item in stored])
            payload.update({"reference": ref, "demo": True})
            return jsonify(payload)

    @app.route("/api/bookings/<reference>/services", methods=["POST"])
    def api_services_save(reference):
        ref = str(reference or "").strip().upper()[:16]
        data = request.get_json(silent=True) or {}
        raw_items = data.get("items") or []
        allowed = {"extra_bag", "sports", "oversized"}
        prices = {"extra_bag": 22050, "sports": 36750, "oversized": 46550}
        items = []
        for item in raw_items[:10]:
            service = str(item.get("service") or "").strip()
            if service not in allowed:
                continue
            try:
                quantity = max(0, min(int(item.get("quantity") or 0), 4))
            except (TypeError, ValueError):
                quantity = 0
            if quantity:
                items.append({"service": service, "quantity": quantity, "price": prices[service]})
        summary = ", ".join("{} ×{}".format(item["service"], item["quantity"]) for item in items)

        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("DELETE FROM booking_services WHERE booking_reference = %s;", (ref,))
            for item in items:
                cur.execute("""
                    INSERT INTO booking_services (booking_reference, service, quantity, price)
                    VALUES (%s, %s, %s, %s);
                """, (ref, item["service"], item["quantity"], item["price"]))
            cur.execute(
                "UPDATE bookings SET baggage_summary = %s WHERE reference = %s;", (summary[:120], ref)
            )
            conn.commit()
            cur.execute("""
                SELECT id, service, quantity, price FROM booking_services
                WHERE booking_reference = %s ORDER BY id;
            """, (ref,))
            payload = _services_payload(cur.fetchall())
            cur.close()
            conn.close()
            payload.update({"reference": ref, "demo": False})
            return jsonify(payload)
        except Exception:
            app.logger.exception("Unable to store the services")
            _DEMO["services"][ref] = items
            payload = _services_payload([(0, item["service"], item["quantity"], item["price"]) for item in items])
            payload.update({"reference": ref, "demo": True})
            return jsonify(payload)

    # ---------------------------------------------------------------- miles
    def _miles_transactions(cur, user_id):
        cur.execute("""
            SELECT delta, reason, reward, balance_after, created_at
            FROM miles_transactions WHERE user_id = %s
            ORDER BY created_at DESC NULLS LAST LIMIT 20;
        """, (user_id,))
        return [{
            "delta": int(row[0] or 0),
            "reason": row[1] or "",
            "reward": row[2] or "",
            "balance_after": int(row[3] or 0),
            "created_at": row[4].strftime("%d.%m.%Y %H:%M") if row[4] else "",
        } for row in cur.fetchall()]

    @app.route("/api/me/miles", methods=["GET"])
    def api_miles():
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"authenticated": False, "balance": 0, "transactions": [], "demo": False}), 200
        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("SELECT miles FROM users WHERE id = %s;", (user_id,))
            row = cur.fetchone()
            balance = int(row[0] or 0) if row else 0
            transactions = _miles_transactions(cur, user_id)
            cur.close()
            conn.close()
            return jsonify({"authenticated": True, "balance": balance, "transactions": transactions, "demo": False})
        except Exception:
            app.logger.exception("Unable to read the miles")
            return jsonify({
                "authenticated": True,
                "balance": int(_DEMO["profile"].get("miles") or 0),
                "transactions": _DEMO["miles"],
                "demo": True,
            })

    @app.route("/api/me/miles/redeem", methods=["POST"])
    def api_miles_redeem():
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Сначала войдите в аккаунт"}), 401
        data = request.get_json(silent=True) or {}
        reward = str(data.get("reward") or "Reward").strip()[:80]
        try:
            amount = int(data.get("miles") or 0)
        except (TypeError, ValueError):
            return jsonify({"error": "Неверное количество миль"}), 400
        if amount <= 0:
            return jsonify({"error": "Неверное количество миль"}), 400

        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("SELECT miles FROM users WHERE id = %s FOR UPDATE;", (user_id,))
            row = cur.fetchone()
            balance = int(row[0] or 0) if row else 0
            if amount > balance:
                conn.rollback()
                cur.close()
                conn.close()
                return jsonify({"error": "Недостаточно миль", "balance": balance}), 400
            new_balance = balance - amount
            cur.execute("UPDATE users SET miles = %s WHERE id = %s;", (new_balance, user_id))
            cur.execute("""
                INSERT INTO miles_transactions (user_id, delta, balance_after, reason, reward)
                VALUES (%s, %s, %s, %s, %s);
            """, (user_id, -amount, new_balance, "Reward redemption", reward))
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({"ok": True, "balance": new_balance, "demo": False})
        except Exception:
            app.logger.exception("Unable to redeem the miles")
            balance = int(_DEMO["profile"].get("miles") or 0)
            if amount > balance:
                return jsonify({"error": "Недостаточно миль", "balance": balance}), 400
            _DEMO["profile"]["miles"] = balance - amount
            _DEMO["miles"].insert(0, {
                "delta": -amount,
                "reason": "Reward redemption",
                "reward": reward,
                "balance_after": balance - amount,
                "created_at": "just now",
            })
            return jsonify({"ok": True, "balance": balance - amount, "demo": True})

    @app.route("/api/bookings/<reference>/cancel", methods=["POST"])
    def api_cancel(reference):
        ref = str(reference or "").strip().upper()[:16]
        data = request.get_json(silent=True) or {}
        reason = str(data.get("reason") or "Change of plans").strip()[:200]

        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("""
                SELECT user_id, total_price, status FROM bookings WHERE reference = %s FOR UPDATE;
            """, (ref,))
            row = cur.fetchone()
            if not row:
                conn.rollback()
                cur.close()
                conn.close()
                return jsonify({"error": "Бронь не найдена"}), 404
            user_id, total, status = row[0], float(row[1] or 0), row[2]
            if status == "cancelled":
                refund = float(0)
                cur.execute("SELECT refund_amount FROM bookings WHERE reference = %s;", (ref,))
                extra = cur.fetchone()
                if extra and extra[0] is not None:
                    refund = float(extra[0])
                cur.close()
                conn.close()
                return jsonify({"ok": True, "demo": False, "status": "cancelled", "refund": refund,
                                "reason": reason, "already": True})
            fee = round(total * 0.138)
            refund = round(total - fee)
            cur.execute("""
                UPDATE bookings SET status = 'cancelled', refund_amount = %s, cancelled_at = CURRENT_TIMESTAMP
                WHERE reference = %s;
            """, (refund, ref))
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({"ok": True, "demo": False, "status": "cancelled",
                            "refund": refund, "fee": fee, "reason": reason})
        except Exception:
            app.logger.exception("Unable to cancel the booking")
            total = 604660
            fee = round(total * 0.138)
            return jsonify({"ok": True, "demo": True, "status": "cancelled",
                            "refund": total - fee, "fee": fee, "reason": reason})

    @app.route("/api/me/preferences", methods=["POST"])
    def api_preferences():
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Сначала войдите в аккаунт"}), 401
        data = request.get_json(silent=True) or {}
        tier = str(data.get("preferred_tier") or "").strip().title()[:20]
        if tier not in ("Silver", "Gold", "Platinum", "Diamond"):
            return jsonify({"error": "Неизвестный уровень"}), 400
        try:
            conn = db()
            cur = conn.cursor()
            cur.execute("UPDATE users SET preferred_tier = %s WHERE id = %s;", (tier, user_id))
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({"ok": True, "preferred_tier": tier, "demo": False})
        except Exception:
            _DEMO["profile"]["preferred_tier"] = tier
            return jsonify({"ok": True, "preferred_tier": tier, "demo": True})
