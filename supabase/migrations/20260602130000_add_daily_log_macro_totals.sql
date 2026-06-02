ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS carbs_g NUMERIC,
  ADD COLUMN IF NOT EXISTS fat_g NUMERIC;

NOTIFY pgrst, 'reload schema';
