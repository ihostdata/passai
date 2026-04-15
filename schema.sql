-- ============================================================
-- PassAI — Complete Database Setup
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── PROFILES ─────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id                      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name               TEXT NOT NULL,
  target_exam             TEXT DEFAULT 'JAMB',
  country                 TEXT DEFAULT 'Nigeria',
  plan                    TEXT DEFAULT 'free' CHECK (plan IN ('free','basic','pro')),
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  avatar_url              TEXT,
  exam_date               DATE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PAST QUESTIONS ───────────────────────────────────────────────────────────
CREATE TABLE past_questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam            TEXT NOT NULL,
  year            INTEGER NOT NULL,
  subject         TEXT NOT NULL,
  topic           TEXT,
  question        TEXT NOT NULL,
  options         JSONB NOT NULL,
  correct_index   INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation     TEXT,
  difficulty      TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  image_url       TEXT,
  country         TEXT DEFAULT 'Nigeria',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pq_country ON past_questions(country);
CREATE INDEX idx_pq_exam ON past_questions(exam);
CREATE INDEX idx_pq_subject ON past_questions(subject);
CREATE INDEX idx_pq_year ON past_questions(year DESC);

-- ─── QUESTION ATTEMPTS ────────────────────────────────────────────────────────
CREATE TABLE question_attempts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES past_questions(id),
  selected_index  INTEGER NOT NULL,
  is_correct      BOOLEAN NOT NULL,
  time_taken      INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qa_user_id ON question_attempts(user_id);

-- ─── TEST ATTEMPTS ────────────────────────────────────────────────────────────
CREATE TABLE test_attempts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exam            TEXT NOT NULL,
  subject         TEXT NOT NULL,
  difficulty      TEXT,
  count           INTEGER,
  questions       JSONB,
  answers         JSONB,
  score           INTEGER,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── USER STATS ───────────────────────────────────────────────────────────────
CREATE TABLE user_stats (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_questions     INTEGER DEFAULT 0,
  total_correct       INTEGER DEFAULT 0,
  current_streak      INTEGER DEFAULT 0,
  longest_streak      INTEGER DEFAULT 0,
  last_active_date    DATE,
  total_study_time    INTEGER DEFAULT 0,
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
  schedule        JSONB,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PDF SESSIONS ─────────────────────────────────────────────────────────────
CREATE TABLE pdf_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── AI USAGE ─────────────────────────────────────────────────────────────────
CREATE TABLE ai_usage (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,
  tokens_used     INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE POLICY "profiles_own" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "qa_own" ON question_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "ta_own" ON test_attempts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "us_own" ON user_stats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "sp_own" ON subject_performance FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "da_own" ON daily_activity FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "ss_own" ON study_schedules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pdf_own" ON pdf_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pq_read" ON past_questions FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================================
-- STORED FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION update_user_stats(
  p_user_id UUID, p_subject TEXT, p_score INTEGER, p_total INTEGER
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_stats (user_id, total_questions, total_correct)
  VALUES (p_user_id, p_total, p_score)
  ON CONFLICT (user_id) DO UPDATE SET
    total_questions = user_stats.total_questions + p_total,
    total_correct = user_stats.total_correct + p_score,
    updated_at = NOW();

  INSERT INTO subject_performance (user_id, subject, questions_done, correct)
  VALUES (p_user_id, p_subject, p_total, p_score)
  ON CONFLICT (user_id, subject) DO UPDATE SET
    questions_done = subject_performance.questions_done + p_total,
    correct = subject_performance.correct + p_score,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION record_daily_activity(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_last_date DATE;
  v_today DATE := CURRENT_DATE;
BEGIN
  INSERT INTO daily_activity (user_id, date, questions_done)
  VALUES (p_user_id, v_today, 1)
  ON CONFLICT (user_id, date) DO UPDATE SET
    questions_done = daily_activity.questions_done + 1;

  SELECT last_active_date INTO v_last_date FROM user_stats WHERE user_id = p_user_id;

  IF v_last_date IS NULL THEN
    INSERT INTO user_stats (user_id, current_streak, longest_streak, last_active_date)
    VALUES (p_user_id, 1, 1, v_today)
    ON CONFLICT (user_id) DO UPDATE SET current_streak = 1, longest_streak = 1, last_active_date = v_today;
  ELSIF v_last_date = v_today - INTERVAL '1 day' THEN
    UPDATE user_stats SET
      current_streak = current_streak + 1,
      longest_streak = GREATEST(longest_streak, current_streak + 1),
      last_active_date = v_today, updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSIF v_last_date < v_today - INTERVAL '1 day' THEN
    UPDATE user_stats SET current_streak = 1, last_active_date = v_today, updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_study_streak(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(current_streak, 0) FROM user_stats WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_weekly_activity(p_user_id UUID)
RETURNS TABLE(date DATE, questions_done INTEGER) AS $$
  SELECT gs.date::DATE, COALESCE(da.questions_done, 0)
  FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day') gs(date)
  LEFT JOIN daily_activity da ON da.date = gs.date AND da.user_id = p_user_id
  ORDER BY gs.date;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- SEED DATA — All 5 Countries
-- ============================================================

-- 🇳🇬 NIGERIA
INSERT INTO past_questions (exam, year, subject, topic, question, options, correct_index, explanation, difficulty, country) VALUES
('JAMB', 2023, 'Mathematics', 'Logarithms', 'If log₂(x+3)=3, find x.', '["5","3","8","6"]', 0, '2³=x+3 → x=5', 'medium', 'Nigeria'),
('JAMB', 2022, 'Chemistry', 'Oxidation States', 'What is the oxidation state of Cr in K₂Cr₂O₇?', '["+3","+6","+7","+4"]', 1, '2+2Cr-14=0, Cr=+6', 'hard', 'Nigeria'),
('WAEC', 2022, 'Physics', 'Newton Laws', 'A body moves with uniform velocity. The net force is:', '["Non-zero","Equal to weight","Zero","Equal to friction"]', 2, 'Uniform velocity = no acceleration = zero net force', 'medium', 'Nigeria'),
('WAEC', 2023, 'English Language', 'Vocabulary', 'Choose the word closest in meaning to VERBOSE:', '["Silent","Wordy","Angry","Confused"]', 1, 'Verbose means using more words than needed', 'easy', 'Nigeria'),
('JAMB', 2022, 'Biology', 'Cell Biology', 'The powerhouse of the cell is the:', '["Nucleus","Ribosome","Mitochondrion","Golgi body"]', 2, 'Mitochondria produce ATP through cellular respiration', 'easy', 'Nigeria'),
('NECO', 2023, 'Economics', 'Factors of Production', 'Which is NOT a factor of production?', '["Land","Capital","Money","Labour"]', 2, 'Factors are Land, Labour, Capital, Entrepreneurship', 'medium', 'Nigeria'),
('JAMB', 2023, 'Physics', 'Mechanics', 'A car from rest at 2m/s². Velocity after 5s:', '["5 m/s","10 m/s","15 m/s","20 m/s"]', 1, 'v = u+at = 0+(2)(5) = 10 m/s', 'easy', 'Nigeria'),
('JAMB', 2021, 'Mathematics', 'Quadratic', 'Solve: x² - 5x + 6 = 0', '["x=2,3","x=1,6","x=-2,-3","x=2,-3"]', 0, '(x-2)(x-3)=0, x=2 or x=3', 'medium', 'Nigeria');

-- 🇬🇭 GHANA
INSERT INTO past_questions (exam, year, subject, topic, question, options, correct_index, explanation, difficulty, country) VALUES
('WASSCE', 2023, 'Core Mathematics', 'Linear Equations', 'Find the gradient of the line 3y = 6x + 9.', '["2","3","6","1/2"]', 0, 'y=2x+3, so gradient m=2', 'medium', 'Ghana'),
('WASSCE', 2022, 'English Language', 'Vocabulary', 'VERBOSE most nearly means:', '["Silent","Wordy","Angry","Confused"]', 1, 'Verbose = wordy, long-winded', 'easy', 'Ghana'),
('WASSCE', 2023, 'Integrated Science', 'Human Biology', 'Which organ produces insulin?', '["Liver","Kidney","Pancreas","Stomach"]', 2, 'The pancreas produces insulin to regulate blood sugar', 'easy', 'Ghana'),
('BECE', 2023, 'Core Mathematics', 'Fractions', 'What is 3/4 + 1/2?', '["4/6","5/4","1 1/4","1/2"]', 2, 'LCM is 4: 3/4 + 2/4 = 5/4 = 1 1/4', 'easy', 'Ghana'),
('WASSCE', 2022, 'Physics', 'Electricity', 'The unit of electrical resistance is:', '["Ampere","Volt","Ohm","Watt"]', 2, 'Resistance is measured in Ohms (Ω)', 'easy', 'Ghana');

-- 🇹🇿 TANZANIA
INSERT INTO past_questions (exam, year, subject, topic, question, options, correct_index, explanation, difficulty, country) VALUES
('CSEE', 2022, 'Physics', 'Mechanics', 'Which quantity has both magnitude and direction?', '["Mass","Temperature","Velocity","Speed"]', 2, 'Velocity is a vector — has magnitude and direction', 'medium', 'Tanzania'),
('ACSEE', 2023, 'Mathematics', 'Calculus', 'Find dy/dx if y = 3x³ - 2x² + 5.', '["9x²-4x","9x²+4x","3x²-2x","6x-4"]', 0, 'dy/dx = 9x² - 4x by the power rule', 'hard', 'Tanzania'),
('CSEE', 2023, 'Chemistry', 'Acids and Bases', 'pH of a neutral solution at 25°C:', '["0","7","14","1"]', 1, 'pH 7 = neutral. Below 7 = acidic, above 7 = basic', 'easy', 'Tanzania'),
('CSEE', 2022, 'Biology', 'Photosynthesis', 'Raw materials for photosynthesis are:', '["O₂ and glucose","CO₂ and H₂O","H₂O and O₂","Glucose and O₂"]', 1, 'CO₂ + H₂O + light → glucose + O₂', 'medium', 'Tanzania');

-- 🇺🇬 UGANDA
INSERT INTO past_questions (exam, year, subject, topic, question, options, correct_index, explanation, difficulty, country) VALUES
('UCE', 2023, 'Chemistry', 'Acids and Bases', 'pH of a neutral solution at 25°C:', '["0","7","14","1"]', 1, 'pH 7 = neutral. Below 7 = acidic, above 7 = basic', 'easy', 'Uganda'),
('UACE', 2022, 'Economics', 'Market Structures', 'Characteristic of perfect competition:', '["Product differentiation","Price making power","Many buyers and sellers","High barriers"]', 2, 'Many buyers & sellers, homogeneous products, free entry/exit', 'medium', 'Uganda'),
('UCE', 2023, 'Mathematics', 'Algebra', 'Solve for x: 2x + 5 = 13', '["3","4","5","6"]', 1, '2x = 8, so x = 4', 'easy', 'Uganda'),
('UACE', 2023, 'Physics', 'Electricity', 'SI unit of electric current:', '["Volt","Ohm","Ampere","Watt"]', 2, 'Electric current is measured in Amperes (A)', 'easy', 'Uganda');

-- 🇰🇪 KENYA
INSERT INTO past_questions (exam, year, subject, topic, question, options, correct_index, explanation, difficulty, country) VALUES
('KCSE', 2022, 'Mathematics', 'Speed', 'A car travels 120km in 2 hours. Speed in m/s:', '["16.67","60","33.33","120"]', 0, '60 km/h ÷ 3.6 = 16.67 m/s', 'medium', 'Kenya'),
('KCSE', 2023, 'Biology', 'Photosynthesis', 'Process by which plants make food using sunlight:', '["Respiration","Photosynthesis","Transpiration","Osmosis"]', 1, '6CO₂+6H₂O+light → C₆H₁₂O₆+6O₂', 'easy', 'Kenya'),
('KCPE', 2023, 'Mathematics', 'Fractions', 'What is 2/3 + 1/4?', '["3/7","11/12","3/12","5/6"]', 1, 'LCM=12: 8/12+3/12=11/12', 'easy', 'Kenya'),
('KCSE', 2022, 'Chemistry', 'Atomic Structure', 'Number of protons in an atom is its:', '["Mass number","Atomic number","Neutron number","Electron number"]', 1, 'Atomic number = number of protons', 'easy', 'Kenya'),
('KCSE', 2023, 'Physics', 'Mechanics', 'Stone dropped from rest falls for 3s. Distance? (g=10m/s²)', '["15m","30m","45m","60m"]', 2, 's = ½gt² = ½×10×9 = 45m', 'medium', 'Kenya');

SELECT 'PassAI database setup complete! All 5 countries seeded ✅' AS status;
