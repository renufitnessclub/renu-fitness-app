-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Renu Fitness Club — Supabase Database Setup                    ║
-- ║  Run this in the Supabase SQL Editor (Dashboard → SQL Editor)   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── MEMBERS TABLE ──────────────────────────────────────────────────────────
-- Extends Supabase auth.users with app-specific profile data
CREATE TABLE IF NOT EXISTS members (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL DEFAULT 'Renu Member',
  phone       TEXT,
  plan_id     TEXT DEFAULT '365',
  role        TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  member_since DATE DEFAULT CURRENT_DATE,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'cancelled')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a member profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.members (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Renu Member')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── CLASSES TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS classes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  coach         TEXT,
  time_display  TEXT NOT NULL,       -- e.g. "5:30 AM"
  time_sort     INT DEFAULT 0,       -- minutes from midnight, for sorting
  duration      TEXT,                 -- e.g. "60 min"
  max_spots     INT DEFAULT 20,
  days_of_week  INT[] DEFAULT '{1,2,3,4,5}',  -- 0=Sun, 1=Mon ... 6=Sat
  category      TEXT DEFAULT 'class' CHECK (category IN ('class', 'walkin', 'amenity')),
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BOOKINGS TABLE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date        DATE DEFAULT CURRENT_DATE,
  status      TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlist', 'cancelled')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(class_id, user_id, date)
);

-- ─── LML SLOTS TABLE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lml_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE NOT NULL,
  time_display  TEXT NOT NULL,
  time_sort     INT DEFAULT 0,
  max_kids      INT DEFAULT 6,
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── LML BOOKINGS TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lml_bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id     UUID NOT NULL REFERENCES lml_slots(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  child_name  TEXT,
  status      TEXT DEFAULT 'confirmed',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(slot_id, user_id)
);

-- ─── WORKOUTS TABLE ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  type        TEXT NOT NULL,           -- e.g. "AMRAP 20"
  subtitle    TEXT,                     -- e.g. "For Max Rounds · Intermediate"
  tags        TEXT[] DEFAULT '{}',
  stats       JSONB DEFAULT '[]',      -- [{num, label}, ...]
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── WORKOUT EXERCISES TABLE ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_exercises (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id  UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  icon        TEXT,
  name        TEXT NOT NULL,
  description TEXT,
  sort_order  INT DEFAULT 0
);

-- ─── WORKOUT LOGS TABLE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  workout_id    UUID REFERENCES workouts(id),
  rounds        INT DEFAULT 0,
  duration_sec  INT DEFAULT 0,
  logged_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAYMENTS TABLE (for Helcim integration) ────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount_cents    INT NOT NULL,
  currency        TEXT DEFAULT 'CAD',
  description     TEXT,
  helcim_txn_id   TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — keeps member data private
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lml_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lml_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;

-- Members can read their own profile; admins can read all
CREATE POLICY "members_select_own" ON members FOR SELECT
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "members_update_own" ON members FOR UPDATE
  USING (auth.uid() = id);

-- Classes are readable by everyone (public schedule)
CREATE POLICY "classes_select_all" ON classes FOR SELECT USING (true);
CREATE POLICY "classes_admin_insert" ON classes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "classes_admin_update" ON classes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));

-- Bookings: members see own; admins see all
CREATE POLICY "bookings_select" ON bookings FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "bookings_insert" ON bookings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bookings_delete" ON bookings FOR DELETE USING (auth.uid() = user_id);

-- LML slots readable by all members
CREATE POLICY "lml_slots_select" ON lml_slots FOR SELECT USING (true);
CREATE POLICY "lml_slots_admin" ON lml_slots FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));

-- LML bookings: own only; admins see all
CREATE POLICY "lml_bookings_select" ON lml_bookings FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "lml_bookings_insert" ON lml_bookings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Workouts readable by all
CREATE POLICY "workouts_select" ON workouts FOR SELECT USING (true);
CREATE POLICY "workout_exercises_select" ON workout_exercises FOR SELECT USING (true);
CREATE POLICY "workouts_admin_insert" ON workouts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "workout_exercises_admin_insert" ON workout_exercises FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));

-- Workout logs: own only
CREATE POLICY "workout_logs_select" ON workout_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "workout_logs_insert" ON workout_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Payments: own only; admins see all
CREATE POLICY "payments_select" ON payments FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM members WHERE id = auth.uid() AND role = 'admin'));

-- ═══════════════════════════════════════════════════════════════════
-- SEED DATA — Your current classes
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO classes (name, coach, time_display, time_sort, duration, max_spots, days_of_week, category) VALUES
  ('Group Fitness',   'Coach: Jenna M.',  '5:30 AM',  330, '60 min', 20, '{1,2,3,4,5}',    'class'),
  ('Pilates Flow',    'Coach: Amber K.',  '9:00 AM',  540, '50 min', 15, '{1,2,3,4,5}',    'class'),
  ('Open Gym',        'Self-directed',    '12:00 PM', 720, '4am-10pm', 99, '{0,1,2,3,4,5,6}', 'walkin'),
  ('Strength & Tone', 'Coach: Mia R.',    '4:30 PM', 990, '55 min', 20, '{1,2,3,4,5}',    'class'),
  ('HIIT Express',    'Coach: Dana P.',   '5:30 PM', 1050, '45 min', 20, '{1,2,3,4,5}',   'class'),
  ('Sauna & Steam',   'Luxury amenity',   '6:30 PM', 1110, '18+ only', 99, '{0,1,2,3,4,5,6}', 'amenity');

-- Seed today's workout
INSERT INTO workouts (date, type, subtitle, tags, stats) VALUES
  (CURRENT_DATE, 'AMRAP 20', 'For Max Rounds · Intermediate',
   '{"Intermediate","Full Body","Strength + Cardio"}',
   '[{"num":"20","label":"Minutes"},{"num":"5","label":"Movements"},{"num":"~580","label":"Cal est."}]'
  );

-- Get the workout ID we just inserted and add exercises
DO $$
DECLARE w_id UUID;
BEGIN
  SELECT id INTO w_id FROM workouts ORDER BY created_at DESC LIMIT 1;
  INSERT INTO workout_exercises (workout_id, icon, name, description, sort_order) VALUES
    (w_id, '🏋️', 'Goblet Squats',   '15 reps · 35/25 lb · Heels on mat', 1),
    (w_id, '💪', 'Push-Ups',         '12 reps · Scale: knees OK', 2),
    (w_id, '🔄', 'Dumbbell Rows',    '10 each side · Brace your core', 3),
    (w_id, '📦', 'Step-Ups',         '8 each leg · Controlled descent', 4),
    (w_id, '⚡', 'Jump Rope',        '50 singles · Scale: high knees', 5);
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- DONE! Your database is ready.
-- Next: Set YOUR account as admin by running:
--   UPDATE members SET role = 'admin' WHERE email = 'your@email.com';
-- ═══════════════════════════════════════════════════════════════════
