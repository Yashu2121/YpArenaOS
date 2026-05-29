-- ============================================================
-- YpArenaOS Full Production Database Schema (PostgreSQL)
-- ============================================================

-- ============================================================
-- 1. USERS
-- All people in the system: owners, staff, customers
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'staff', 'customer')),
    phone       VARCHAR(20),
    avatar_url  TEXT,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. GAMEZONES
-- Each registered café / gaming center
-- ============================================================
CREATE TABLE IF NOT EXISTS gamezones (
    gamezone_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id            UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    name                VARCHAR(200) NOT NULL,
    address             TEXT,
    city                VARCHAR(100),
    latitude            DECIMAL(9,6),
    longitude           DECIMAL(9,6),
    subscription_status VARCHAR(20) DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired')),
    expiry_date         DATE,
    phone               VARCHAR(20),
    logo_url            TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. CLIENTS
-- Each PC / PS4 / PS5 device inside a gamezone
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
    client_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gamezone_id     UUID NOT NULL REFERENCES gamezones(gamezone_id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,  -- "PC-01", "PS5-VIP"
    device_type     VARCHAR(20) DEFAULT 'PC' CHECK (device_type IN ('PC', 'PS4', 'PS5', 'VR')),
    status          VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'in_use', 'offline', 'maintenance')),
    ip_address      VARCHAR(45),
    mac_address     VARCHAR(17) UNIQUE,
    hw_fingerprint  TEXT,
    specs           JSONB,  -- { "gpu": "RTX 4070", "ram": "16GB", "cpu": "i7-12700" }
    hourly_rate     DECIMAL(10,2) DEFAULT 40.00,
    last_seen       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. SESSIONS
-- All gaming sessions (active and completed)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    session_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(client_id),
    customer_id     UUID REFERENCES users(user_id),
    gamezone_id     UUID NOT NULL REFERENCES gamezones(gamezone_id),
    start_time      TIMESTAMPTZ DEFAULT NOW(),
    end_time        TIMESTAMPTZ,
    duration_minutes INTEGER,
    amount          DECIMAL(10,2) DEFAULT 0.00,
    payment_method  VARCHAR(20) DEFAULT 'wallet' CHECK (payment_method IN ('wallet', 'UPI', 'card', 'cash')),
    payment_status  VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'powercut_paused')),
    notes           TEXT,
    is_synced       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. PAYMENTS
-- All financial transactions in the system
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    payment_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id),
    gamezone_id     UUID NOT NULL REFERENCES gamezones(gamezone_id),
    session_id      UUID REFERENCES sessions(session_id),
    amount          DECIMAL(10,2) NOT NULL,
    method          VARCHAR(20) NOT NULL CHECK (method IN ('UPI', 'card', 'wallet', 'cash')),
    status          VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending', 'refunded')),
    reference_id    VARCHAR(100),  -- UPI transaction ID, etc.
    description     TEXT,
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. MEMBERSHIPS
-- Customer loyalty points and wallet balance per gamezone
-- ============================================================
CREATE TABLE IF NOT EXISTS memberships (
    membership_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    gamezone_id     UUID NOT NULL REFERENCES gamezones(gamezone_id) ON DELETE CASCADE,
    points          INTEGER DEFAULT 0,
    wallet_balance  DECIMAL(10,2) DEFAULT 0.00,
    tier            VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    expiry_date     DATE,
    joined_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, gamezone_id)
);

-- ============================================================
-- 7. TOURNAMENTS
-- Esports events organized by a gamezone
-- ============================================================
CREATE TABLE IF NOT EXISTS tournaments (
    tournament_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gamezone_id     UUID NOT NULL REFERENCES gamezones(gamezone_id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    game            VARCHAR(100) NOT NULL,
    description     TEXT,
    banner_url      TEXT,
    entry_fee       DECIMAL(10,2) DEFAULT 0.00,
    prize_pool      DECIMAL(10,2) DEFAULT 0.00,
    max_participants INTEGER,
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    status          VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. TOURNAMENT_REGISTRATIONS
-- Links customers to tournaments
-- ============================================================
CREATE TABLE IF NOT EXISTS tournament_registrations (
    registration_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id   UUID NOT NULL REFERENCES tournaments(tournament_id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    team_name       VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'registered' CHECK (status IN ('registered', 'confirmed', 'eliminated', 'winner', 'disqualified')),
    registered_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, user_id)
);

-- ============================================================
-- 9. POS (Point of Sale — Food, Beverages, Peripherals)
-- Items available for sale in a gamezone
-- ============================================================
CREATE TABLE IF NOT EXISTS pos_items (
    pos_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gamezone_id     UUID NOT NULL REFERENCES gamezones(gamezone_id) ON DELETE CASCADE,
    item_name       VARCHAR(200) NOT NULL,
    category        VARCHAR(50) DEFAULT 'food' CHECK (category IN ('food', 'beverage', 'peripheral', 'voucher', 'merchandise')),
    price           DECIMAL(10,2) NOT NULL,
    stock           INTEGER DEFAULT 0,
    image_url       TEXT,
    is_available    BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. ORDERS
-- Customer purchases from POS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
    order_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pos_id          UUID NOT NULL REFERENCES pos_items(pos_id),
    user_id         UUID REFERENCES users(user_id),
    gamezone_id     UUID NOT NULL REFERENCES gamezones(gamezone_id),
    session_id      UUID REFERENCES sessions(session_id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      DECIMAL(10,2) NOT NULL,
    total_amount    DECIMAL(10,2) NOT NULL,
    payment_method  VARCHAR(20) DEFAULT 'wallet',
    status          VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
    timestamp       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. SYNC_QUEUE (Offline resilience)
-- Events queued while internet is down, synced when back online
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_queue (
    id              SERIAL PRIMARY KEY,
    event_type      VARCHAR(50) NOT NULL,
    payload         JSONB NOT NULL,
    gamezone_id     UUID REFERENCES gamezones(gamezone_id),
    is_processed    BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    processed_at    TIMESTAMPTZ
);

-- ============================================================
-- 12. GAMES
-- Global list of games managed by the system
-- ============================================================
CREATE TABLE IF NOT EXISTS games (
    game_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    platform        VARCHAR(50) DEFAULT 'standalone', -- 'steam', 'epic', 'standalone'
    app_id          VARCHAR(100), -- Steam App ID or Epic App Name
    current_version VARCHAR(50) NOT NULL,
    size_mb         INTEGER DEFAULT 0,
    logo_url        TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. CLIENT_GAMES
-- Tracks which game version is installed on which PC
-- ============================================================
CREATE TABLE IF NOT EXISTS client_games (
    client_game_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
    game_id         UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
    installed_version VARCHAR(50) NOT NULL,
    status          VARCHAR(20) DEFAULT 'up_to_date' CHECK (status IN ('up_to_date', 'outdated', 'updating', 'failed')),
    last_updated    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, game_id)
);

-- ============================================================
-- INDEXES (for performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sessions_client     ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_customer   ON sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_gamezone   ON sessions(gamezone_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status     ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_clients_gamezone    ON clients(gamezone_id);
CREATE INDEX IF NOT EXISTS idx_clients_status      ON clients(status);
CREATE INDEX IF NOT EXISTS idx_payments_user       ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_gamezone   ON payments(gamezone_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user    ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_gamezone     ON orders(gamezone_id);
CREATE INDEX IF NOT EXISTS idx_tournament_gamezone ON tournaments(gamezone_id);

-- ============================================================
-- SEED DATA (Demo data for development)
-- ============================================================

-- Demo Owner
INSERT INTO users (user_id, name, email, password_hash, role, phone)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Yash Arena Owner',
    'owner@yparenaos.com',
    '$2b$10$examplehashedpassword123456',  -- password: admin123
    'owner',
    '+91-9876543210'
) ON CONFLICT DO NOTHING;

-- Demo Gamezone
INSERT INTO gamezones (gamezone_id, owner_id, name, address, city, subscription_status, expiry_date)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    'YpArenaos Downtown',
    '123 Gaming Street, MG Road',
    'Hyderabad',
    'active',
    '2026-12-31'
) ON CONFLICT DO NOTHING;

-- Demo PCs
INSERT INTO clients (gamezone_id, name, device_type, status, ip_address, specs, hourly_rate)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'PC-01', 'PC', 'online', '192.168.1.101', '{"gpu":"RTX 4070","ram":"16GB","cpu":"i9-12900K"}', 60.00),
    ('b0000000-0000-0000-0000-000000000001', 'PC-02', 'PC', 'online', '192.168.1.102', '{"gpu":"RTX 4070","ram":"16GB","cpu":"i9-12900K"}', 60.00),
    ('b0000000-0000-0000-0000-000000000001', 'PC-03', 'PC', 'online', '192.168.1.103', '{"gpu":"RTX 3060","ram":"16GB","cpu":"i7-12700"}', 40.00),
    ('b0000000-0000-0000-0000-000000000001', 'PC-04', 'PC', 'offline', '192.168.1.104', '{"gpu":"RTX 3060","ram":"16GB","cpu":"i7-12700"}', 40.00),
    ('b0000000-0000-0000-0000-000000000001', 'PS5-VIP', 'PS5', 'online', '192.168.1.201', '{"storage":"1TB","controllers":2}', 80.00),
    ('b0000000-0000-0000-0000-000000000001', 'PC-05', 'PC', 'online', '192.168.1.105', '{"gpu":"RTX 4080","ram":"32GB","cpu":"i9-13900K"}', 80.00),
    ('b0000000-0000-0000-0000-000000000001', 'PC-06', 'PC', 'online', '192.168.1.106', '{"gpu":"RTX 4080","ram":"32GB","cpu":"i9-13900K"}', 80.00),
    ('b0000000-0000-0000-0000-000000000001', 'PC-07', 'PC', 'maintenance', '192.168.1.107', '{"gpu":"RTX 3070","ram":"16GB","cpu":"Ryzen 7 5800X"}', 50.00)
ON CONFLICT DO NOTHING;

-- Demo POS Items
INSERT INTO pos_items (gamezone_id, item_name, category, price, stock)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'Red Bull Energy', 'beverage', 120.00, 50),
    ('b0000000-0000-0000-0000-000000000001', 'Monster Energy', 'beverage', 100.00, 40),
    ('b0000000-0000-0000-0000-000000000001', 'Cold Coffee', 'beverage', 80.00, 30),
    ('b0000000-0000-0000-0000-000000000001', 'Cheese Sandwich', 'food', 60.00, 20),
    ('b0000000-0000-0000-0000-000000000001', 'Maggi Noodles', 'food', 50.00, 25),
    ('b0000000-0000-0000-0000-000000000001', 'Gaming Headset (Rental)', 'peripheral', 30.00, 10),
    ('b0000000-0000-0000-0000-000000000001', '1-Hour Voucher', 'voucher', 60.00, 100),
    ('b0000000-0000-0000-0000-000000000001', '5-Hour Bundle', 'voucher', 250.00, 100)
ON CONFLICT DO NOTHING;

-- Demo Tournament
INSERT INTO tournaments (gamezone_id, name, game, prize_pool, entry_fee, max_participants, start_date, status)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'YpArenaos Championship #1',
    'Valorant',
    10000.00,
    100.00,
    32,
    NOW() + INTERVAL '7 days',
    'upcoming'
) ON CONFLICT DO NOTHING;

-- Demo Games
INSERT INTO games (game_id, name, platform, app_id, current_version, size_mb)
VALUES 
    ('c0000000-0000-0000-0000-000000000001', 'Valorant', 'epic', 'valorant', 'v7.08', 35000),
    ('c0000000-0000-0000-0000-000000000002', 'Counter-Strike 2', 'steam', '730', 'v1.39', 42000),
    ('c0000000-0000-0000-0000-000000000003', 'Apex Legends', 'steam', '1172470', 'v19.1', 65000)
ON CONFLICT DO NOTHING;
