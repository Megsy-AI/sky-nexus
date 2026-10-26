import { describe, expect, it } from "vitest";
import { demoReply } from "./demo";

describe("account-free demo", () => {
  it("does not produce a reply for an empty request", () => {
    expect(demoReply("  ", false)).toBe("");
  });
  it("returns a local sample for a planning request", () => {
    expect(demoReply("plan my day", false)).toContain("Sample daily plan:");
  });
});