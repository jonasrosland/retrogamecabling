import { z } from "zod";

// === TYPE DEFINITIONS ===
export const itemSpecsSchema = z.object({
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  signals: z.array(z.string()).optional(),
  isSVS: z.boolean().optional(),
  maxInputs: z.number().optional(),
  maxOutputs: z.number().optional(),
}).passthrough(); // Allow additional fields to pass through

export const itemSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(), // 'console', 'switcher', 'display', 'cable'
  specs: itemSpecsSchema,
  imageUrl: z.string().nullable().optional(),
});
