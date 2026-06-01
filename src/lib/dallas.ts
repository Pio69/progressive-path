// Types and helpers for the MVP (Projeto Dallas)

export type Profile = {
  id: string;
  name: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: string | null;
};

export type DailyGoals = {
  id: string;
  user_id: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type DailyLog = {
  id: string;
  user_id: string;
  log_date: string;
  routine_logged: boolean;
  weight_kg: number | null;
  calories: number | null;
  protein_g: number | null;
  water_l: number | null;
  trained: boolean;
  training_start: string | null;
  training_end: string | null;
  training_intensity: string | null;
  cardio: boolean;
  sleep_hours: number | null;
  alcohol: boolean;
  free_meal: boolean;
  tags: string[];
  notes: string | null;
};

export type BodyMeasurement = {
  id: string;
  user_id: string;
  measured_at: string;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  notes: string | null;
};

export type Food = {
  id: string;
  user_id: string;
  name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
};

export type Meal = {
  id: string;
  user_id: string;
  meal_date: string;
  meal_type: string;
};

export type MealItem = {
  id: string;
  user_id: string;
  meal_id: string;
  food_id: string | null;
  quantity_g: number;
  food_name: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  foods?: Food | null;
};

export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export const MANUAL_MEAL_ITEM_FOOD_NAME = "__manual_meal_item__";

export function calcMacros(
  food: Pick<Food, "calories_per_100g" | "protein_per_100g" | "carbs_per_100g" | "fat_per_100g">,
  grams: number,
): Macros {
  const f = grams / 100;
  return {
    kcal: +(Number(food.calories_per_100g) * f).toFixed(1),
    protein: +(Number(food.protein_per_100g) * f).toFixed(1),
    carbs: +(Number(food.carbs_per_100g) * f).toFixed(1),
    fat: +(Number(food.fat_per_100g) * f).toFixed(1),
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
