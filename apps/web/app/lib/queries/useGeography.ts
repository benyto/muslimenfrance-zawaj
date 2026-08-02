import { useQuery } from "@tanstack/react-query";
import { supabase } from "~/lib/supabase-client";

export function useRegions() {
  return useQuery({
    queryKey: ["regions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("regions").select("code, name").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("code, name, region_code")
        .order("name");
      if (error) throw error;
      return data;
    },
    staleTime: Infinity,
  });
}

function normalizeSearchTerm(term: string) {
  return term
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Typeahead search — communes_fr has ~34,900 rows, far too many to load
// client-side like the old cities table, so this hits a trigram-indexed
// ILIKE query per keystroke (debounced by the caller) instead.
export function useCommuneSearch(query: string) {
  const normalized = normalizeSearchTerm(query);

  return useQuery({
    queryKey: ["commune-search", normalized],
    enabled: normalized.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communes_fr")
        .select("code_insee, nom_standard, code_postal, dep_nom")
        .ilike("nom_sans_accent", `%${normalized}%`)
        .order("population", { ascending: false, nullsFirst: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

export function useCommuneByCode(codeInsee: string | null | undefined) {
  return useQuery({
    queryKey: ["commune", codeInsee],
    enabled: !!codeInsee,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("communes_fr")
        .select("code_insee, nom_standard, code_postal, dep_nom")
        .eq("code_insee", codeInsee!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
