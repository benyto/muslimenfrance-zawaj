import { supabase } from "~/lib/supabase-client";

const API_URL = import.meta.env.VITE_API_URL;

// Thin fetch wrapper for calling apps/api — attaches the current session's
// access token so the API's auth plugin can verify who's calling. Throws on
// non-2xx so callers can rely on try/catch or React Query's error handling
// rather than checking response.ok everywhere.
export async function apiFetch(path: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? `API error: ${response.status}`);
  }

  return response.json();
}
