CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS routine_logged BOOLEAN NOT NULL DEFAULT false;

UPDATE public.daily_logs
SET routine_logged = true
WHERE routine_logged IS false
  AND (
    weight_kg IS NOT NULL
    OR water_l IS NOT NULL
    OR trained IS true
    OR training_start IS NOT NULL
    OR training_end IS NOT NULL
    OR training_intensity IS NOT NULL
    OR cardio IS true
    OR sleep_hours IS NOT NULL
    OR alcohol IS true
    OR free_meal IS true
    OR COALESCE(array_length(tags, 1), 0) > 0
    OR notes IS NOT NULL
  );

ALTER TABLE public.meal_items
  DROP CONSTRAINT IF EXISTS meal_items_food_id_fkey;

ALTER TABLE public.meal_items
  ADD CONSTRAINT meal_items_food_id_fkey
  FOREIGN KEY (food_id)
  REFERENCES public.foods(id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  waist_cm NUMERIC,
  chest_cm NUMERIC,
  arm_cm NUMERIC,
  thigh_cm NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, measured_at)
);

CREATE INDEX IF NOT EXISTS idx_body_measurements_user_date ON public.body_measurements(user_id, measured_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_measurements TO authenticated;
GRANT ALL ON public.body_measurements TO service_role;
ALTER TABLE public.body_measurements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'body_measurements' AND policyname = 'own body_measurements select'
  ) THEN
    CREATE POLICY "own body_measurements select" ON public.body_measurements FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'body_measurements' AND policyname = 'own body_measurements insert'
  ) THEN
    CREATE POLICY "own body_measurements insert" ON public.body_measurements FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'body_measurements' AND policyname = 'own body_measurements update'
  ) THEN
    CREATE POLICY "own body_measurements update" ON public.body_measurements FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'body_measurements' AND policyname = 'own body_measurements delete'
  ) THEN
    CREATE POLICY "own body_measurements delete" ON public.body_measurements FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_body_measurements_updated ON public.body_measurements;
CREATE TRIGGER trg_body_measurements_updated BEFORE UPDATE ON public.body_measurements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
