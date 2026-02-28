-- Power Yield — D1 Schema
-- Apply with: wrangler d1 execute power-yield-db --file=./db/schema.sql

CREATE TABLE IF NOT EXISTS projects (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT    NOT NULL,
  location             TEXT    NOT NULL,           -- e.g. "Algarve, PT"
  developer_name       TEXT    NOT NULL,
  technology           TEXT    NOT NULL CHECK (technology IN ('solar','wind','hybrid')),
  technology_label     TEXT    NOT NULL,           -- Display string: "Solar PV", "Wind — Offshore", etc.
  status               TEXT    NOT NULL CHECK (status IN ('open','closing','coming')),
  volume_eur           REAL    NOT NULL,
  target_irr           REAL    NOT NULL,           -- percent, e.g. 8.4
  capacity_mw          REAL    NOT NULL,
  duration_years       INTEGER NOT NULL,
  region_code          TEXT    NOT NULL,           -- ISO 3166-1 alpha-2, e.g. "PT"
  revenue_type         TEXT    NOT NULL,           -- e.g. "PPA + FiT"
  funding_progress_pct REAL    NOT NULL DEFAULT 0,
  opens_label          TEXT,                       -- e.g. "Q3 2026" (only for 'coming')
  is_featured          INTEGER NOT NULL DEFAULT 0, -- 1 = show on homepage
  display_order        INTEGER NOT NULL DEFAULT 0,
  is_visible           INTEGER NOT NULL DEFAULT 1, -- soft-delete
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS waitlist (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT    NOT NULL UNIQUE,
  source     TEXT    NOT NULL DEFAULT 'unknown',   -- 'hero', 'cta', 'investors', 'listings'
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_submissions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name    TEXT NOT NULL,
  contact_name    TEXT NOT NULL,
  contact_email   TEXT NOT NULL,
  project_name    TEXT NOT NULL,
  technology      TEXT NOT NULL,
  volume_eur      REAL,
  stage           TEXT NOT NULL,
  country         TEXT NOT NULL,
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new',     -- 'new','reviewing','accepted','declined'
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── Seed: 6 projects matching current listings page ────────────────────────
INSERT INTO projects
  (name, location, developer_name, technology, technology_label, status,
   volume_eur, target_irr, capacity_mw, duration_years, region_code,
   revenue_type, funding_progress_pct, opens_label, is_featured, display_order)
VALUES
  ('Algarve Solar I',        'Algarve, PT',    'Iberian Renewable Fund',  'solar',  'Solar PV',         'open',    48500000,  8.4,  42,  12, 'PT', 'PPA + FiT', 78,   NULL,     1, 1),
  ('North Sea Offshore II',  'North Sea, DE',  'Northern Yield Fund',     'wind',   'Wind — Offshore',  'closing', 124000000, 9.1, 120,  15, 'DE', 'CfD',       94,   NULL,     1, 2),
  ('Andalusia Wind Farm',    'Andalusia, ES',  'Iberian Wind Partners',   'wind',   'Wind — Onshore',   'open',    67000000,  8.8,  58,  14, 'ES', 'PPA',       45,   NULL,     0, 3),
  ('Loire Valley Agrivoltaic','Loire, FR',     'Hexagone Renewables',     'hybrid', 'Agrivoltaic',      'open',    22000000,  8.1,  18,  10, 'FR', 'FiT',       31,   NULL,     0, 4),
  ('Puglia Solar II',        'Puglia, IT',     'Meridian Energia',        'solar',  'Solar PV',         'coming',  35000000,  7.9,  30,  12, 'IT', 'PPA + FiT',  0,   'Q3 2025', 0, 5),
  ('Baltic Offshore I',      'Baltic Sea, DK', 'Nordic Offshore Capital', 'wind',   'Wind — Offshore',  'coming',  180000000, 9.6, 175,  18, 'DK', 'CfD',        0,   'Q4 2025', 0, 6);
