import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Normalize signal type by stripping "(modded)" suffix for compatibility checks and handles
export function normalizeSignalType(signalType: string): string {
  return signalType.replace(/\s*\(modded\)/gi, '').trim();
}
