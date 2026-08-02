import { z } from "zod";

export const reportReasons = [
  "spam",
  "inappropriate",
  "harassment",
  "fake",
  "violence",
  "hate_speech",
  "other",
] as const;

export const createReportSchema = z.object({
  contentType: z.enum(["profile", "message"]),
  contentId: z.string().uuid(),
  reason: z.enum(reportReasons),
  description: z.string().trim().max(1000).optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
