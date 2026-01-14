import { z } from "zod";

// === TYPE DEFINITIONS ===
export const addonSchema = z.object({
  id: z.string(),
  name: z.string(),
  outputs: z.array(z.string()),
});

export const itemSpecsSchema = z.object({
  inputs: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  signals: z.array(z.string()).optional(),
  isSVS: z.boolean().optional(),
  isCustomSwitch: z.boolean().optional(),
  isHDMISwitch: z.boolean().optional(),
  maxInputs: z.number().optional(),
  maxOutputs: z.number().optional(),
  addons: z.array(addonSchema).optional(),
}).passthrough(); // Allow additional fields to pass through

export const variantSchema = z.object({
  name: z.string(),
  region: z.string(),
});

export const itemSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: z.string(), // 'console', 'switch', 'display', 'cable'
  specs: itemSpecsSchema,
  variants: z.array(variantSchema).optional(),
  imageUrl: z.string().nullable().optional(),
});
