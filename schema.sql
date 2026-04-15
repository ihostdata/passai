-- ============================================================
-- PassAI — Supabase Database Schema
-- Run this in Supabase SQL Editor (in order)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
-- Extended user data (linked to Supabase auth.users)
CREATE TABLE profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name             TEXT NOT NULL,
  target_exam           TEXT DEFAULT 'JAMB' CHECK (target_exam IN ('JAMB','WAEC','NECO','GCE')),
  country               TEXT DEFAULT 'Nigeria',
  plan                  TEXT DEFAULT 'free' CHECK (plan IN ('free','basic','pro')),
  stripe_customer_id    TEXT UNIQUE,
  stripe_subscription_id TEXT,
  avatar_url            TEXT,
  exam_date             DATE,
  school                TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── PAST QUESTIONS ───────────────────────────────────────────────────────────
CREATE TABLE past_questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam            TEXT NOT NULL CHECK (exam IN ('JAMB','WAEC','NECO','GCE')),
  year            INTEGER NOT NULL CHECK (year BETWEEN 1990 AND 2025),
  subject         TEXT NOT NULL,
  topic           TEXT,
  question        TEXT NOT NULL,
  options         JSONB NOT NULL,          -- ["option A", "option B", "option C", "option D"]
  correct_index   INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation     TEXT,                    -- basic built-in explanation
  difficulty      TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  image_url       TEXT,                    -- for diagram-based questions
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index for common query patterns
CREATE INDEX idx_pq_exam_subject ON past_questions(exam, subject);
CREATE INDEX idx_pq_year ON past_questions(year DESC);
CREATE INDEX idx_pq_subject ON past_questions(subject);

-- ─── QUESTION ATTEMPTS ────────────────────────────────────────────────────────
CREATE TABLE question_attempts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES past_questions(id),
  selected_index  INTEGER NOT NULL,
  is_correct      BOOLEAN NOT NULL,
  time_taken      INTEGER,                 -- seconds
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qa_user_id ON question_attempts(user_id);
CREATE INDEX idx_qa_created_at ON question_attempts(created_at DESC);

-- ─── TEST ATTEMPTS ────────────────────────────────────────────────────────────
-- Stores AI-generated practice tests
CREATE TABLE test_attempts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam            TEXT NOT NULL,
  subject         TEXT NOT NULL,
  difficulty      TEXT,
  count           INTEGER,
  questions       JSONB,                   -- generated questions array
  answers         JSONB,                   -- user's answers {0: 2, 1: 0, ...}
  score           INTEGER,                 -- number correct
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ta_user_id ON test_attempts(user_id);

-- ─── USER STATS ───────────────────────────────────────────────────────────────
CREATE TABLE user_stats (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_questions     INTEGER DEFAULT 0,
  total_correct       INTEGER DEFAULT 0,
  current_streak      INTEGER DEFAULT 0,
  longest_streak      INTEGER DEFAULT 0,
  last_active_date    DATE,
  total_study_time    INTEGER DEFAULT 0,   -- minutes
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SUBJECT PERFORMANCE ──────────────────────────────────────────────────────
CREATE TABLE subject_performance (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject         TEXT NOT NULL,
  questions_done  INTEGER DEFAULT 0,
  correct         INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, subject)
);

-- ─── DAILY ACTIVITY ───────────────────────────────────────────────────────────
CREATE TABLE daily_activity (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  questions_done  INTEGER DEFAULT 1,
  UNIQUE(user_id, date)
);

-- ─── STUDY SCHEDULES ──────────────────────────────────────────────────────────
CREATE TABLE study_schedules (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam_date       DATE,
  schedule        JSONB,                   -- full AI-generated schedule object
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PDF SESSIONS ─────────────────────────────────────────────────────────────
CREATE TABLE pdf_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  content         TEXT NOT NULL,           -- extracted text (truncated)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-delete PDF sessions after 24 hours (via pg_cron or Edge Function)
-- CREATE INDEX idx_pdf_created ON pdf_sessions(created_at);

-- ─── AI USAGE LOGS ────────────────────────────────────────────────────────────
CREATE TABLE ai_usage (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,           -- 'chat', 'explain', 'generate-test', 'schedule'
  tokens_used     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STORED PROCEDURES / RPC FUNCTIONS
-- ============================================================

-- Update user stats after answering a question
CREATE OR REPLACE FUNCTION update_user_stats(
  p_user_id UUID,
  p_subject TEXT,
  p_score INTEGER,
  p_total INTEGER
) RETURNS VOID AS $$
BEGIN
  -- Upsert overall stats
  INSERT INTO user_stats (user_id, total_questions, total_correct)
  VALUES (p_user_id, p_total, p_score)
  ON CONFLICT (user_id) DO UPDATE SET
    total_questions = user_stats.total_questions + p_total,
    total_correct = user_stats.total_correct + p_score,
    updated_at = NOW();

  -- Upsert subject performance
  INSERT INTO subject_performance (user_id, subject, questions_done, correct)
  VALUES (p_user_id, p_subject, p_total, p_score)
  ON CONFLICT (user_id, subject) DO UPDATE SET
    questions_done = subject_performance.questions_done + p_total,
    correct = subject_performance.correct + p_score,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Record daily activity and update streak
CREATE OR REPLACE FUNCTION record_daily_activity(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_last_date DATE;
  v_today DATE := CURRENT_DATE;
  v_current_streak INTEGER;
BEGIN
  -- Upsert daily activity
  INSERT INTO daily_activity (user_id, date, questions_done)
  VALUES (p_user_id, v_today, 1)
  ON CONFLICT (user_id, date) DO UPDATE SET
    questions_done = daily_activity.questions_done + 1;

  -- Update streak in user_stats
  SELECT last_active_date, current_streak INTO v_last_date, v_current_streak
  FROM user_stats WHERE user_id = p_user_id;

  IF v_last_date IS NULL THEN
    -- First ever activity
    INSERT INTO user_stats (user_id, current_streak, longest_streak, last_active_date)
    VALUES (p_user_id, 1, 1, v_today)
    ON CONFLICT (user_id) DO UPDATE SET current_streak = 1, longest_streak = 1, last_active_date = v_today;
  ELSIF v_last_date = v_today - INTERVAL '1 day' THEN
    -- Consecutive day — increment streak
    UPDATE user_stats SET
      current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1),
      last_active_date = v_today,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF v_last_date < v_today - INTERVAL '1 day' THEN
    -- Streak broken
    UPDATE user_stats SET current_streak = 1, last_active_date = v_today, updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
  -- If v_last_date = v_today, nothing to do (already counted)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get study streak
CREATE OR REPLACE FUNCTION get_study_streak(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(current_streak, 0) FROM user_stats WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get weekly activity (last 7 days)
CREATE OR REPLACE FUNCTION get_weekly_activity(p_user_id UUID)
RETURNS TABLE(date DATE, questions_done INTEGER) AS $$
  SELECT
    gs.date::DATE,
    COALESCE(da.questions_done, 0) AS questions_done
  FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') gs(date)
  LEFT JOIN daily_activity da ON da.date = gs.date AND da.user_id = p_user_id
  ORDER BY gs.date;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_sessions ENABLE ROW LEVEL SECURITY;

-- Profiles: users see only their own
CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);

-- Question attempts: users see only their own
CREATE POLICY "qa_own" ON question_attempts FOR ALL USING (auth.uid() = user_id);

-- Test attempts: users see only their own
CREATE POLICY "ta_own" ON test_attempts FOR ALL USING (auth.uid() = user_id);

-- User stats: users see only their own
CREATE POLICY "us_own" ON user_stats FOR ALL USING (auth.uid() = user_id);

-- Subject performance: users see only their own
CREATE POLICY "sp_own" ON subject_performance FOR ALL USING (auth.uid() = user_id);

-- Daily activity: users see only their own
CREATE POLICY "da_own" ON daily_activity FOR ALL USING (auth.uid() = user_id);

-- Study schedules: users see only their own
CREATE POLICY "ss_own" ON study_schedules FOR ALL USING (auth.uid() = user_id);

-- PDF sessions: users see only their own
CREATE POLICY "pdf_own" ON pdf_sessions FOR ALL USING (auth.uid() = user_id);

-- Past questions: all authenticated users can read
CREATE POLICY "pq_read" ON past_questions FOR SELECT USING (auth.role() = 'authenticated');

-- Service role bypasses RLS (for backend API)
-- This is automatic — the service_role key bypasses all RLS

-- ============================================================
-- SEED: SAMPLE PAST QUESTIONS
-- ============================================================

INSERT INTO past_questions (exam, year, subject, topic, question, options, correct_index, explanation, difficulty) VALUES
('JAMB', 2023, 'Mathematics', 'Logarithms', 'If log₂(x+3) = 3, find x.', '["5","3","8","6"]', 0, '2³=x+3, so x=5', 'medium'),
('JAMB', 2023, 'Chemistry', 'Oxidation States', 'What is the oxidation state of Cr in K₂Cr₂O₇?', '["+3","+6","+7","+4"]', 1, '2+2Cr-14=0, so Cr=+6', 'hard'),
('WAEC', 2022, 'Physics', 'Newton Laws', 'A body moves with uniform velocity. The net force on it is:', '["Non-zero","Equal to weight","Zero","Equal to friction"]', 2, 'Uniform velocity means no acceleration, so F=0', 'medium'),
('WAEC', 2023, 'English Language', 'Vocabulary', 'Choose the word closest in meaning to VERBOSE:', '["Silent","Wordy","Angry","Confused"]', 1, 'Verbose means using more words than needed — wordy', 'easy'),
('JAMB', 2022, 'Biology', 'Cell Biology', 'The powerhouse of the cell is the:', '["Nucleus","Ribosome","Mitochondrion","Golgi body"]', 2, 'Mitochondria produce ATP through cellular respiration', 'easy'),
('NECO', 2023, 'Economics', 'Factors of Production', 'Which is NOT a factor of production?', '["Land","Capital","Money","Labour"]', 2, 'The four factors are Land, Labour, Capital, Entrepreneurship', 'medium'),
('JAMB', 2023, 'Physics', 'Mechanics', 'A car accelerates from rest at 2 m/s². Its velocity after 5s is:', '["5 m/s","10 m/s","15 m/s","20 m/s"]', 1, 'v = u + at = 0 + (2)(5) = 10 m/s', 'easy'),
('WAEC', 2022, 'Chemistry', 'Organic Chemistry', 'The general formula for alkanes is:', '["CₙH₂ₙ","CₙH₂ₙ₊₂","CₙH₂ₙ₋₂","CₙHₙ"]', 1, 'Alkanes are saturated hydrocarbons: CₙH₂ₙ₊₂', 'medium'),
('JAMB', 2021, 'Mathematics', 'Quadratic Equations', 'Solve: x² - 5x + 6 = 0', '["x=2,3","x=1,6","x=-2,-3","x=2,-3"]', 0, 'Factor: (x-2)(x-3)=0, so x=2 or x=3', 'medium'),
('NECO', 2022, 'Government', 'Nigerian Government', 'The constitution that granted Nigeria independence is the:', '["1960 Constitution","1963 Constitution","1979 Constitution","1999 Constitution"]', 0, 'Nigeria gained independence under the 1960 Constitution', 'hard');


-- ============================================================
-- MULTI-COUNTRY SUPPORT — Add to existing schema
-- ============================================================

-- Add country column to profiles if not already there
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Nigeria'
  CHECK (country IN ('Nigeria','Ghana','Tanzania','Uganda','Kenya'));

-- Add country column to past_questions
ALTER TABLE past_questions ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Nigeria'
  CHECK (country IN ('Nigeria','Ghana','Tanzania','Uganda','Kenya'));

-- Index for country-based queries
CREATE INDEX IF NOT EXISTS idx_pq_country ON past_questions(country);
CREATE INDEX IF NOT EXISTS idx_pq_country_exam ON past_questions(country, exam);

-- Country-specific exam validation (optional trigger)
-- Each country only allows its own exams
-- Nigeria: JAMB, WAEC, NECO, GCE
-- Ghana: WASSCE, BECE, NOVDEC
-- Tanzania: CSEE, ACSEE, PSLE
-- Uganda: UCE, UACE, PLE
-- Kenya: KCSE, KCPE, KPSEA

-- Seed: Ghana past questions
INSERT INTO past_questions (exam, year, subject, topic, question, options, correct_index, explanation, difficulty, country) VALUES
('WASSCE', 2023, 'Core Mathematics', 'Linear Equations', 'Find the gradient of the line 3y = 6x + 9.', '["2","3","6","1/2"]', 0, 'y=2x+3, gradient m=2', 'medium', 'Ghana'),
('WASSCE', 2022, 'English Language', 'Vocabulary', 'VERBOSE most nearly means:', '["Silent","Wordy","Angry","Confused"]', 1, 'Verbose = wordy, long-winded', 'easy', 'Ghana'),
('BECE', 2023, 'Integrated Science', 'Biology', 'Which organ produces insulin?', '["Liver","Kidney","Pancreas","Stomach"]', 2, 'The pancreas produces insulin to regulate blood sugar', 'easy', 'Ghana');

-- Seed: Tanzania past questions
INSERT INTO past_questions (exam, year, subject, topic, question, options, correct_index, explanation, difficulty, country) VALUES
('CSEE (Form 4)', 2022, 'Physics', 'Mechanics', 'Which quantity has both magnitude and direction?', '["Mass","Temperature","Velocity","Speed"]', 2, 'Velocity is a vector — has magnitude and direction', 'medium', 'Tanzania'),
('ACSEE (Form 6)', 2023, 'Mathematics', 'Calculus', 'Find dy/dx if y = 3x³ - 2x² + 5.', '["9x² - 4x","9x² + 4x","3x² - 2x","6x - 4"]', 0, 'dy/dx = 9x² - 4x by power rule', 'hard', 'Tanzania');

-- Seed: Uganda past questions
INSERT INTO past_questions (exam, year, subject, topic, question, options, correct_index, explanation, difficulty, country) VALUES
('UCE (O-Level)', 2023, 'Chemistry', 'Acids and Bases', 'What is the pH of a neutral solution at 25°C?', '["0","7","14","1"]', 1, 'pH 7 = neutral. Below 7 = acidic, above 7 = basic', 'easy', 'Uganda'),
('UACE (A-Level)', 2022, 'Economics', 'Market Structures', 'Which is a characteristic of perfect competition?', '["Product differentiation","Price making power","Many buyers and sellers","High barriers to entry"]', 2, 'Perfect competition: many buyers & sellers, homogeneous products, free entry/exit', 'medium', 'Uganda');

-- Seed: Kenya past questions
INSERT INTO past_questions (exam, year, subject, topic, question, options, correct_index, explanation, difficulty, country) VALUES
('KCSE', 2022, 'Mathematics', 'Speed', 'A car travels 120km in 2 hours. Its speed in m/s is:', '["16.67","60","33.33","120"]', 0, '60 km/h ÷ 3.6 = 16.67 m/s', 'medium', 'Kenya'),
('KCSE', 2023, 'Biology', 'Photosynthesis', 'The process by which plants make food using sunlight is:', '["Respiration","Photosynthesis","Transpiration","Osmosis"]', 1, 'Photosynthesis: 6CO₂+6H₂O+light → C₆H₁₂O₆+6O₂', 'easy', 'Kenya'),
('KCPE', 2023, 'Mathematics', 'Fractions', 'What is 2/3 + 1/4?', '["3/7","11/12","3/12","5/6"]', 1, 'LCM of 3 and 4 is 12. 2/3=8/12, 1/4=3/12. Sum=11/12', 'easy', 'Kenya');
