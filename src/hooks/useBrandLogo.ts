/** @doc useBrandLogo — returns the current display mark; legacy export stays compatible. */
import { BRAND } from "@/lib/brand";

const megsyIconUrl = BRAND.logoUrl;

export function useBrandLogo(): string {
  return megsyIconUrl;
}

export { megsyIconUrl as megsyIcon };
