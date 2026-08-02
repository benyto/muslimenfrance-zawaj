import { z } from "zod";

// Mirrors the client-writable columns of public.profiles.
// moderation_status / moderated_by / moderated_at / deleted_at are never
// accepted here — those are only ever set by admin Edge Functions.
export const profileInputSchema = z.object({
  nickname: z.string().trim().min(2).max(50),
  gender: z.enum(["male", "female"]),
  birthdate: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date")
    .refine((value) => {
      const eighteenYearsAgo = new Date();
      eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
      return new Date(value) <= eighteenYearsAgo;
    }, "You must be at least 18 years old"),
  interests: z.array(z.string().trim().min(1).max(30)).max(20).default([]),

  height: z.number().int().min(100).max(250).nullable().optional(),
  weight: z.number().int().min(30).max(300).nullable().optional(),
  eyeColor: z.string().trim().max(20).nullable().optional(),
  hairColor: z.string().trim().max(20).nullable().optional(),
  bodyType: z.string().trim().max(20).nullable().optional(),

  educationLevel: z.string().trim().max(50).nullable().optional(),
  occupation: z.string().trim().max(100).nullable().optional(),
  employmentStatus: z.string().trim().max(30).nullable().optional(),
  incomeRange: z.string().trim().max(30).nullable().optional(),

  ethnicity: z.string().trim().max(50).nullable().optional(),
  religion: z.string().trim().max(30).nullable().optional(),
  religiosityLevel: z.string().trim().max(20).nullable().optional(),
  languagesSpoken: z.array(z.string().trim().min(1).max(30)).max(10).default([]),

  relationshipGoal: z.string().trim().max(30).nullable().optional(),
  smoker: z.string().trim().max(20).nullable().optional(),
  drinker: z.string().trim().max(20).nullable().optional(),
  hasChildren: z.boolean().nullable().optional(),
  wantsChildren: z.string().trim().max(20).nullable().optional(),

  communeInseeCode: z.string().trim().min(1).max(10).nullable().optional(),

  // Required explicit consent before religion/religiosity (GDPR Art. 9
  // special-category data) can be stored — enforced again by the
  // `profiles owner upsert` RLS policy's WITH CHECK clause.
  specialCategoryConsent: z.literal(true),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export const searchProfilesFiltersSchema = z.object({
  gender: z.enum(["male", "female"]).optional(),
  communeInseeCode: z.string().trim().min(1).max(10).optional(),
  departmentCode: z.string().trim().min(1).max(5).optional(),
  regionCode: z.string().trim().min(1).max(5).optional(),
  relationshipGoal: z.string().max(30).optional(),
  minAge: z.number().int().min(18).max(120).optional(),
  maxAge: z.number().int().min(18).max(120).optional(),
  limit: z.number().int().min(1).max(48).default(24),
  offset: z.number().int().min(0).default(0),
});

export type SearchProfilesFilters = z.infer<typeof searchProfilesFiltersSchema>;
