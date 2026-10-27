-- ============================================================
--  StudyCoach Schema v3 — avec rôle Admin
--  Coller dans Supabase SQL Editor et cliquer Run
-- ============================================================

-- Profiles (liés à Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       VARCHAR(100) NOT NULL,
  role       VARCHAR(20)  NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Study plans
CREATE TABLE IF NOT EXISTS public.study_plans (
  id          SERIAL PRIMARY KEY,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title       VARCHAR(255),
  situation   TEXT NOT NULL,
  mode        VARCHAR(20) NOT NULL CHECK (mode IN ('lazy','balanced','hardcore')),
  plan_text   TEXT NOT NULL,
  model_used  VARCHAR(100),
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Study sessions (timer)
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id               SERIAL PRIMARY KEY,
  user_id          UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id          INTEGER REFERENCES public.study_plans(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL,
  session_type     VARCHAR(30) DEFAULT 'focus',
  completed        BOOLEAN DEFAULT FALSE,
  started_at       TIMESTAMP DEFAULT NOW(),
  ended_at         TIMESTAMP
);

-- ── RLS ────────────────────────────────────────────────────
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS VARCHAR AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: user sees own, admin sees all
DROP POLICY IF EXISTS "profiles_policy" ON public.profiles;
CREATE POLICY "profiles_policy" ON public.profiles FOR ALL
  USING (auth.uid() = id OR public.get_my_role() = 'admin');

-- Plans: user sees own, admin sees all
DROP POLICY IF EXISTS "plans_policy" ON public.study_plans;
CREATE POLICY "plans_policy" ON public.study_plans FOR ALL
  USING (auth.uid() = user_id OR public.get_my_role() = 'admin');

-- Sessions: user sees own, admin sees all
DROP POLICY IF EXISTS "sessions_policy" ON public.study_sessions;
CREATE POLICY "sessions_policy" ON public.study_sessions FOR ALL
  USING (auth.uid() = user_id OR public.get_my_role() = 'admin');

-- ── Stats view ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.user_stats AS
SELECT
  p.id AS user_id,
  p.name,
  p.role,
  COUNT(DISTINCT sp.id)                                                         AS total_plans,
  COUNT(DISTINCT ss.id)                                                         AS total_sessions,
  COALESCE(SUM(CASE WHEN ss.completed THEN ss.duration_minutes ELSE 0 END), 0) AS total_minutes_studied,
  COUNT(DISTINCT CASE WHEN ss.completed THEN DATE(ss.started_at) END)           AS study_days
FROM public.profiles p
LEFT JOIN public.study_plans    sp ON sp.user_id = p.id
LEFT JOIN public.study_sessions ss ON ss.user_id = p.id
GROUP BY p.id, p.name, p.role;

-- ── Trigger: auto-create profile on signup ─────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Étudiant'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Promote a user to admin manually ───────────────────────
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'USER_UUID_HERE';
