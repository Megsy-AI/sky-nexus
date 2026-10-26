import { describe, expect, it } from "vitest";
import { safeInternalPath, safeRedirectTo } from "./safeRedirect";

describe("post-authentication redirect boundary", () => {
  it("preserves a same-origin destination with query parameters", () => {
    expect(safeInternalPath("/settings?tab=security")).toBe("/settings?tab=security");
  });

  it.each([
    "https://attacker.example/account",
    "//attacker.example/account",
    "/\\attacker.example/account",
    "javascript:alert(1)",
    "/javascript:alert(1)",
    "/chat\n/redirect",
    `/${"a".repeat(2048)}`,
  ])("rejects an unsafe destination: %s", (destination) => {
    expect(safeInternalPath(destination)).toBeNull();
  });

  it("uses the local fallback when a destination is rejected", () => {
    expect(safeRedirectTo("https://attacker.example", "/chat")).toBe(`${window.location.origin}/chat`);
  });
});