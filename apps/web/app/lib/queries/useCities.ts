import { useQuery } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";

export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cities").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
  });
}
