-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Renu Fitness Club — V2 Update                                  ║
-- ║  Adds: Video support, Renu Regulars, Editable Plans            ║
-- ║  Run this in Supabase SQL Editor AFTER the original setup       ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── ADD VIDEO URL TO EXERCISES ─────────────────────────────────────────────
ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS video_thumbnail TEXT;
ALTER TABLE workout_exercises ADD COLUMN IF NOT EXISTS duration_sec INT DEFAULT 30;

-- ─── ADD MORE FIELDS TO WORKOUTS ────────────────────────────────────────────
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'Intermediate';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS estimated_calories INT DEFAULT 0;
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS video_intro_url TEXT;

-- ─── MEMBERSHIP PLANS TABLE (editable from admin) ──────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id            TEXT PRIMARY KEY,
  eyebrow       TEXT,
  name          TEXT NOT NULL,
  price         TEXT NOT NULL,
  per           TEXT,
  description   TEXT,
  features      TEXT[] DEFAULT '{}',
  sort_order    INT DEFAULT 0,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with current plans
INSERT INTO plans (id, eyebrow, name, price, per, description, features, sort_order) VALUES
  ('365', 'Best value',    'Renu 365',    '$156', '/mo equiv.', 'Paid annually · $1,872 + tax',  '{"Full year unlimited","All classes + amenities","Renu App access","5 workouts/week"}', 1),
  ('180', '6 months',      'Renu 180',    '$166', '/mo equiv.', '$996 + tax · paid in full',     '{"6-month unlimited","All classes + amenities","Renu App access"}', 2),
  ('90',  '3 months',      'Renu 90',     '$176', '/mo equiv.', '$528 + tax · paid in full',     '{"3-month unlimited","All classes + amenities","Renu App access"}', 3),
  ('30',  'No commitment', 'Renu 30',     '$186', '/mo',        '$186 + tax per month',          '{"Monthly unlimited","All classes + amenities","Renu App access"}', 4),
  ('teen','Add-on',        'Teen Add-On', '$60',  '/mo',        '$60 + tax per month',           '{"Ages 13–15 only","With parent/guardian","Classes + gym floor"}', 5)
ON CONFLICT (id) DO NOTHING;

-- RLS for plans (readable by all, editable by admin)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_select_all" ON plans FOR SELECT USING (true);
CREATE POLICY "plans_admin_insert" ON plans FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "plans_admin_update" ON plans FOR UPDATE
  USING (EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));

-- ─── RENU REGULARS — CHECK-IN TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkins (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  check_type  TEXT DEFAULT 'gym' CHECK (check_type IN ('gym', 'class', 'workout')),
  class_id    UUID REFERENCES classes(id),
  note        TEXT,
  checked_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RENU REGULARS — ENROLLMENT TABLE ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS renu_regulars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  month           INT NOT NULL,           -- 1-12
  year            INT NOT NULL,           -- e.g. 2026
  target_checkins INT DEFAULT 16,         -- monthly goal
  enrolled_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month, year)
);

-- ─── RENU REGULARS — MONTHLY LEADERBOARD VIEW ──────────────────────────────
-- This view auto-calculates the leaderboard from check-ins
CREATE OR REPLACE VIEW regulars_leaderboard AS
SELECT
  m.id AS user_id,
  m.full_name,
  rr.month,
  rr.year,
  rr.target_checkins,
  COUNT(c.id) AS total_checkins,
  CASE WHEN COUNT(c.id) >= rr.target_checkins THEN true ELSE false END AS goal_met,
  RANK() OVER (
    PARTITION BY rr.month, rr.year
    ORDER BY COUNT(c.id) DESC
  ) AS rank
FROM renu_regulars rr
JOIN members m ON m.id = rr.user_id
LEFT JOIN checkins c ON c.user_id = rr.user_id
  AND EXTRACT(MONTH FROM c.checked_at) = rr.month
  AND EXTRACT(YEAR FROM c.checked_at) = rr.year
GROUP BY m.id, m.full_name, rr.month, rr.year, rr.target_checkins;

-- ─── RLS FOR NEW TABLES ─────────────────────────────────────────────────────
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE renu_regulars ENABLE ROW LEVEL SECURITY;

-- Check-ins: members can see all (for leaderboard), but only insert their own
CREATE POLICY "checkins_select_all" ON checkins FOR SELECT USING (true);
CREATE POLICY "checkins_insert_own" ON checkins FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "checkins_admin_insert" ON checkins FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));

-- Renu Regulars enrollment: see all (for leaderboard), insert own
CREATE POLICY "regulars_select_all" ON renu_regulars FOR SELECT USING (true);
CREATE POLICY "regulars_insert_own" ON renu_regulars FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add check-in count to members for quick lookup
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_regular BOOLEAN DEFAULT FALSE;

-- ═══════════════════════════════════════════════════════════════════
-- DONE! New features are ready:
--   • Workout exercises now support video_url
--   • Membership plans are editable in the plans table
--   • Renu Regulars with check-ins and leaderboard
--   • Target: 16 check-ins per month
-- ═══════════════════════════════════════════════════════════════════
