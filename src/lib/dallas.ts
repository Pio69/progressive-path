// Types and helpers for the MVP (Projeto Dallas)

export type Profile = {
  id: string;
  user_id: string;
  name: string;
  height_cm: number;
  current_weight_kg: number;
  goal_weight_kg: number;
  goal: string;
};

export type DailyGoals = {
  id: string;
  user_id: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type Food = {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
};

export type Meal = {
  id: string;
  user_id: string;
  date: string;
  name: string;
  time: string | null;
  notes: string | null;
};

export type MealItem = {
  id: string;
  meal_id: string;
  food_id: string;
  grams: number;
  foods?: Food;
};

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export function calcMacros(food: Pick<Food, "kcal_100g" | "protein_100g" | "carbs_100g" | "fat_100g">, grams: number): Macros {
  const f = grams / 100;
  return {
    kcal: +(Number(food.kcal_100g) * f).toFixed(1),
    protein: +(Number(food.protein_100g) * f).toFixed(1),
    carbs: +(Number(food.carbs_100g) * f).toFixed(1),
    fat: +(Number(food.fat_100g) * f).toFixed(1),
  };
}

export function sumMacros(items: Macros[]): Macros {
  return items.reduce(
    (acc, m) => ({
      kcal: +(acc.kcal + m.kcal).toFixed(1),
      protein: +(acc.protein + m.protein).toFixed(1),
      carbs: +(acc.carbs + m.carbs).toFixed(1),
      fat: +(acc.fat + m.fat).toFixed(1),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
