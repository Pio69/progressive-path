ALTER TABLE public.meal_items
  ALTER COLUMN food_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
