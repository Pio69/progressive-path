import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Profile, DailyGoals } from "@/lib/dallas";

export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id;

  const profileQ = useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const goalsQ = useQuery({
    queryKey: ["daily_goals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_goals")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as DailyGoals | null;
    },
  });

  return {
    profile: profileQ.data ?? null,
    goals: goalsQ.data ?? null,
    loading: profileQ.isLoading || goalsQ.isLoading,
    hasProfile: !!profileQ.data,
  };
}
