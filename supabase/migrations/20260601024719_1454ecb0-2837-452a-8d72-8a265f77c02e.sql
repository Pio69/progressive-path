CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  goal TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.daily_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  calories NUMERIC NOT NULL DEFAULT 0,
  protein_g NUMERIC NOT NULL DEFAULT 0,
  carbs_g NUMERIC NOT NULL DEFAULT 0,
  fat_g NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_goals TO authenticated;
GRANT ALL ON public.daily_goals TO service_role;
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals select" ON public.daily_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own goals insert" ON public.daily_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own goals update" ON public.daily_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own goals delete" ON public.daily_goals FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.daily_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  calories_per_100g NUMERIC NOT NULL DEFAULT 0,
  protein_per_100g NUMERIC NOT NULL DEFAULT 0,
  carbs_per_100g NUMERIC NOT NULL DEFAULT 0,
  fat_per_100g NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_foods_user ON public.foods(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.foods TO authenticated;
GRANT ALL ON public.foods TO service_role;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own foods select" ON public.foods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own foods insert" ON public.foods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own foods update" ON public.foods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own foods delete" ON public.foods FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_foods_updated BEFORE UPDATE ON public.foods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_meals_user_date ON public.meals(user_id, meal_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meals TO authenticated;
GRANT ALL ON public.meals TO service_role;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meals select" ON public.meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own meals insert" ON public.meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own meals update" ON public.meals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own meals delete" ON public.meals FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_meals_updated BEFORE UPDATE ON public.meals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES public.foods(id),
  quantity_g NUMERIC NOT NULL DEFAULT 0,
  food_name TEXT NOT NULL,
  calories_per_100g NUMERIC NOT NULL DEFAULT 0,
  protein_per_100g NUMERIC NOT NULL DEFAULT 0,
  carbs_per_100g NUMERIC NOT NULL DEFAULT 0,
  fat_per_100g NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_meal_items_user ON public.meal_items(user_id);
CREATE INDEX idx_meal_items_meal ON public.meal_items(meal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_items TO authenticated;
GRANT ALL ON public.meal_items TO service_role;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meal_items select" ON public.meal_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own meal_items insert" ON public.meal_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own meal_items update" ON public.meal_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own meal_items delete" ON public.meal_items FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_meal_items_updated BEFORE UPDATE ON public.meal_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.weight_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg NUMERIC NOT NULL,
  measured_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_weight_user_date ON public.weight_history(user_id, measured_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_history TO authenticated;
GRANT ALL ON public.weight_history TO service_role;
ALTER TABLE public.weight_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weight select" ON public.weight_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own weight insert" ON public.weight_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own weight update" ON public.weight_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own weight delete" ON public.weight_history FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
