CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS public.daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC,
  calories NUMERIC,
  protein_g NUMERIC,
  water_l NUMERIC,
  trained BOOLEAN NOT NULL DEFAULT false,
  training_start TIME,
  training_end TIME,
  training_intensity TEXT,
  cardio BOOLEAN NOT NULL DEFAULT false,
  sleep_hours NUMERIC,
  alcohol BOOLEAN NOT NULL DEFAULT false,
  free_meal BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON public.daily_logs(user_id, log_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_logs TO authenticated;
GRANT ALL ON public.daily_logs TO service_role;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_logs' AND policyname = 'own daily_logs select'
  ) THEN
    CREATE POLICY "own daily_logs select" ON public.daily_logs FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_logs' AND policyname = 'own daily_logs insert'
  ) THEN
    CREATE POLICY "own daily_logs insert" ON public.daily_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_logs' AND policyname = 'own daily_logs update'
  ) THEN
    CREATE POLICY "own daily_logs update" ON public.daily_logs FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_logs' AND policyname = 'own daily_logs delete'
  ) THEN
    CREATE POLICY "own daily_logs delete" ON public.daily_logs FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_daily_logs_updated ON public.daily_logs;
CREATE TRIGGER trg_daily_logs_updated BEFORE UPDATE ON public.daily_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
