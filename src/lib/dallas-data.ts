import { supabase } from "@/integrations/supabase/client";
import {
  calcMacros,
  sumMacros,
  type DailyLog,
  type Macros,
  type Meal,
  type MealItem,
} from "@/lib/dallas";

type MealWithItems = Meal & { meal_items: MealItem[] };

type DailyLogContext = Pick<
  DailyLog,
  | "id"
  | "routine_logged"
  | "weight_kg"
  | "water_l"
  | "trained"
  | "training_start"
  | "training_end"
  | "training_intensity"
  | "cardio"
  | "sleep_hours"
  | "alcohol"
  | "free_meal"
  | "tags"
  | "notes"
>;

function itemHasMacroData(item: MealItem) {
  return (
    Number(item.calories_per_100g) > 0 ||
    Number(item.protein_per_100g) > 0 ||
    Number(item.carbs_per_100g) > 0 ||
    Number(item.fat_per_100g) > 0
  );
}

function logHasDailyContext(log: DailyLogContext) {
  return (
    log.routine_logged ||
    log.weight_kg != null ||
    log.water_l != null ||
    log.trained ||
    log.training_start != null ||
    log.training_end != null ||
    log.training_intensity != null ||
    log.cardio ||
    log.sleep_hours != null ||
    log.alcohol ||
    log.free_meal ||
    (Array.isArray(log.tags) && log.tags.length > 0) ||
    Boolean(log.notes)
  );
}

export async function getDayNutrition(userId: string, date: string): Promise<Macros | null> {
  const { data, error } = await supabase
    .from("meals")
    .select("*, meal_items(*)")
    .eq("user_id", userId)
    .eq("meal_date", date);

  if (error) throw error;

  const items = ((data ?? []) as MealWithItems[]).flatMap((meal) => meal.meal_items);
  const measuredItems = items.filter(itemHasMacroData);
  if (measuredItems.length === 0) return null;

  return sumMacros(measuredItems.map((item) => calcMacros(item, Number(item.quantity_g))));
}

export async function syncDailyLogNutrition(userId: string, date: string): Promise<Macros | null> {
  const nutrition = await getDayNutrition(userId, date);

  if (nutrition) {
    const { error } = await supabase.from("daily_logs").upsert(
      {
        user_id: userId,
        log_date: date,
        calories: nutrition.kcal,
        protein_g: nutrition.protein,
      },
      { onConflict: "user_id,log_date" },
    );
    if (error) throw error;
    return nutrition;
  }

  const { data: existing, error: existingError } = await supabase
    .from("daily_logs")
    .select(
      "id,routine_logged,weight_kg,water_l,trained,training_start,training_end,training_intensity,cardio,sleep_hours,alcohol,free_meal,tags,notes",
    )
    .eq("user_id", userId)
    .eq("log_date", date)
    .maybeSingle();

  if (existingError) throw existingError;
  if (!existing) return null;

  if (!logHasDailyContext(existing as DailyLogContext)) {
    const { error } = await supabase.from("daily_logs").delete().eq("id", existing.id);
    if (error) throw error;
    return null;
  }

  const { error } = await supabase.from("daily_logs").upsert(
    {
      user_id: userId,
      log_date: date,
      calories: null,
      protein_g: null,
    },
    { onConflict: "user_id,log_date" },
  );

  if (error) throw error;
  return null;
}
