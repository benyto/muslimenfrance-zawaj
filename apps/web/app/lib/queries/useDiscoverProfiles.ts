import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";

const PAGE_SIZE = 24;

export type DiscoverFilters = {
  gender?: "male" | "female";
  communeInseeCode?: string;
  departmentCode?: string;
  regionCode?: string;
  relationshipGoal?: string;
  minAge?: number;
  maxAge?: number;
};

export function useDiscoverProfiles(filters: DiscoverFilters) {
  return useInfiniteQuery({
    queryKey: ["discover", filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("search_profiles", {
        p_gender: filters.gender ?? undefined,
        p_commune_insee_code: filters.communeInseeCode ?? undefined,
        p_department_code: filters.departmentCode ?? undefined,
        p_region_code: filters.regionCode ?? undefined,
        p_relationship_goal: filters.relationshipGoal ?? undefined,
        p_min_age: filters.minAge ?? undefined,
        p_max_age: filters.maxAge ?? undefined,
        p_limit: PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
  });
}
