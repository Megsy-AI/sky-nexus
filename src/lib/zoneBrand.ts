import { BRAND } from "./brand";

/** Display brand; existing technical identifiers are deliberately unchanged. */
export function getZoneBrand(): "elgiza" {
  return BRAND.name;
}

/** Passthrough — no rebrand needed. */
export function brandText<T>(value: T, _brand: string = BRAND.name): T {
  return value;
}
