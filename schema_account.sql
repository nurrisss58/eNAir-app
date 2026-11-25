-- eNAir: profile, account number and flight status persistence.
-- The same statements run automatically from account_api.ensure_schema() on boot,
-- so this file is for manual application in the Neon SQL editor and for review.

-- ---------------------------------------------------------------- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(80);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS membership_number VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'Gold';
ALTER TABLE users ADD COLUMN IF NOT EXISTS miles INTEGER NOT NULL DEFAULT 48250;
ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_updates BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_checkin BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_offers BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS users_membership_key ON users (membership_number);

-- Existing accounts receive a readable number: EN-0001-37, EN-0002-74, ...
UPDATE users
SET membership_number = 'EN-' || LPAD((id % 10000)::text, 4, '0') || '-'
    || LPAD(((id * 37) % 100)::text, 2, '0')
WHERE membership_number IS NULL;

-- ---------------------------------------------------------------- flights
ALTER TABLE flights ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'on_time';
ALTER TABLE flights ADD COLUMN IF NOT EXISTS delay_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS gate VARCHAR(10);
ALTER TABLE flights ADD COLUMN IF NOT EXISTS terminal VARCHAR(10);
ALTER TABLE flights ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE flights ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP;

-- ---------------------------------------------------------------- status history
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

CREATE INDEX IF NOT EXISTS flight_events_number_idx
    ON flight_events (flight_number, created_at DESC);

-- ---------------------------------------------------------------- checks
-- 1. New columns:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name IN ('users', 'flights') ORDER BY table_name, ordinal_position;
-- 2. New table:
--    SELECT * FROM flight_events ORDER BY created_at DESC LIMIT 5;
-- 3. After reporting a delay on /enair-flight-status.html this query must return a row:
--    SELECT flight_number, status, delay_minutes, reason, created_at
--    FROM flight_events WHERE flight_number = 'EN-88' ORDER BY created_at DESC LIMIT 3;

-- ---------------------------------------------------------------- cards, passengers, services, miles
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS seat TEXT;
ALTER TABLE bookings ALTER COLUMN seat TYPE TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS baggage_summary VARCHAR(120);

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
CREATE INDEX IF NOT EXISTS payment_methods_user_idx ON payment_methods (user_id);

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
CREATE UNIQUE INDEX IF NOT EXISTS booking_passengers_key ON booking_passengers (booking_reference, full_name);

CREATE TABLE IF NOT EXISTS booking_services (
    id SERIAL PRIMARY KEY,
    booking_reference VARCHAR(16) NOT NULL,
    service VARCHAR(30) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS booking_services_ref_idx ON booking_services (booking_reference);

CREATE TABLE IF NOT EXISTS miles_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason VARCHAR(120),
    reward VARCHAR(80),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS miles_transactions_user_idx ON miles_transactions (user_id, created_at DESC);
