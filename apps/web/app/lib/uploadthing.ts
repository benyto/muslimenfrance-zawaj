import { generateReactHelpers } from "@uploadthing/react";
// Type-only — apps/api's actual router (createUploadthing, middleware, etc.)
// never ships to the client; only its route-name/type shape is imported
// here so useUploadThing("profileDatingPhotos") stays type-checked against
// the real backend route.
import type { OurFileRouter } from "../../../api/src/uploadthing/router";
import { supabase } from "~/lib/supabase-client";

const API_URL = import.meta.env.VITE_API_URL;

export const { useUploadThing, uploadFiles } = generateReactHelpers<OurFileRouter>({
  url: `${API_URL}/api/uploadthing`,
});

export async function authHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : ({} as HeadersInit);
}
