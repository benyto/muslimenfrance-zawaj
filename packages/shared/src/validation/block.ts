import { z } from "zod";

export const createBlockSchema = z.object({
  blockedProfileId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export type CreateBlockInput = z.infer<typeof createBlockSchema>;
