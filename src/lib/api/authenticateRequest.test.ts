import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, createClient } = vi.hoisted(() => {
  const getUser = vi.fn();
  return { getUser, createClient: vi.fn(() => ({ auth: { getUser } })) };
});

vi.mock("@supabase/supabase-js", () => ({ createClient }));
import { authenticateRequest } from "./authenticateRequest";

describe("API caller authentication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a missing bearer session before contacting the account service", async () => {
    expect(await authenticateRequest(new Request("https://app.example/api/chat"))).toBeNull();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects a session rejected by the account service", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "Invalid session" } });
    const request = new Request("https://app.example/api/chat", {
      headers: { Authorization: "Bearer invalid-test-session" },
    });
    expect(await authenticateRequest(request)).toBeNull();
    expect(getUser).toHaveBeenCalledWith("invalid-test-session");
  });

  it("returns only the user verified by the account service", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "verified-test-user" } }, error: null });
    const request = new Request("https://app.example/api/chat", {
      headers: { Authorization: "Bearer verified-test-session" },
    });
    expect(await authenticateRequest(request)).toEqual({ user: { id: "verified-test-user" } });
  });
});