
-- Função utilitária para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  height_cm NUMERIC(5,1) NOT NULL,
  current_weight_kg NUMERIC(5,2) NOT NULL,
  goal_weight_kg NUMERIC(5,2) NOT NULL,
  goal TEXT NOT NULL DEFAULT 'cutting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- daily_goals
CREATE TABLE public.daily_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  calories INTEGER NOT NULL,
  protein_g INTEGER NOT NULL,
  carbs_g INTEGER NOT NULL,
  fat_g INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_goals TO authenticated;
GRANT ALL ON public.daily_goals TO service_role;
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals select" ON public.daily_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own goals insert" ON public.daily_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own goals update" ON public.daily_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own goals delete" ON public.daily_goals FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.daily_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- foods
CREATE TABLE public.foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  kcal_100g NUMERIC(7,2) NOT NULL,
  protein_100g NUMERIC(6,2) NOT NULL DEFAULT 0,
  carbs_100g NUMERIC(6,2) NOT NULL DEFAULT 0,
  fat_100g NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
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

-- meals
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  name TEXT NOT NULL,
  time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meals_user_date ON public.meals(user_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meals TO authenticated;
GRANT ALL ON public.meals TO service_role;
ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meals select" ON public.meals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own meals insert" ON public.meals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own meals update" ON public.meals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own meals delete" ON public.meals FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER trg_meals_updated BEFORE UPDATE ON public.meals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- meal_items
CREATE TABLE public.meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
  grams NUMERIC(7,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_meal_items_meal ON public.meal_items(meal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_items TO authenticated;
GRANT ALL ON public.meal_items TO service_role;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own meal_items select" ON public.meal_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));
CREATE POLICY "own meal_items insert" ON public.meal_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));
CREATE POLICY "own meal_items update" ON public.meal_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));
CREATE POLICY "own meal_items delete" ON public.meal_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.meals m WHERE m.id = meal_id AND m.user_id = auth.uid()));

-- weight_history
CREATE TABLE public.weight_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
CREATE INDEX idx_weight_user_date ON public.weight_history(user_id, date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weight_history TO authenticated;
GRANT ALL ON public.weight_history TO service_role;
ALTER TABLE public.weight_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own weight select" ON public.weight_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own weight insert" ON public.weight_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own weight update" ON public.weight_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own weight delete" ON public.weight_history FOR DELETE USING (auth.uid() = user_id);
