/** @doc useBrandLogo — returns the Megsy brand icon URL. */
import { BRAND } from "@/lib/brand";

const megsyIconUrl = BRAND.logoUrl;

export function useBrandLogo(): string {
  return megsyIconUrl;
}

export { megsyIconUrl as megsyIcon };
