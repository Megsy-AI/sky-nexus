import { describe, expect, it, vi } from "vitest";
import { registerAccount } from "./registration";

describe("real account registration", () => {
  it("uses native signup with normalized email and a same-origin confirmation destination", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { user: { id: "new-user" }, session: { user: { id: "new-user" } } }, error: null });
    expect(await registerAccount({ signUp }, " User@Example.com ", "secure-password", "https://app.example.com")).toEqual({ status: "signed-in" });
    expect(signUp).toHaveBeenCalledWith({ email: "user@example.com", password: "secure-password", options: { emailRedirectTo: "https://app.example.com" } });
  });
  it("does not report sign-in when email confirmation is still required", async () => {
    const signUp = vi.fn().mockResolvedValue({ data: { user: { id: "new-user" }, session: null }, error: null });
    expect(await registerAccount({ signUp }, "user@example.com", "secure-password", "https://app.example.com")).toEqual({ status: "confirmation-required" });
  });
  it("propagates signup failures without claiming success", async () => {
    const error = new Error("Signup unavailable");
    const signUp = vi.fn().mockResolvedValue({ data: { user: null, session: null }, error });
    await expect(registerAccount({ signUp }, "user@example.com", "secure-password", "https://app.example.com")).rejects.toThrow(error);
  });
});