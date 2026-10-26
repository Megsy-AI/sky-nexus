import { beforeEach, describe, expect, it, vi } from "vitest";

const { guard, stream } = vi.hoisted(() => ({ guard: vi.fn(), stream: vi.fn() }));
vi.mock("../api/apiGuard", () => ({ guardApiRequest: guard, guardResponse: (result: { status: number }) => new Response(null, { status: result.status }) }));
vi.mock("../chat/proxyCore", () => ({ streamChatProxy: stream }));
vi.mock("../research/deepResearchCore", () => ({ streamDeepResearch: vi.fn() }));
import handler from "./chat";

describe("authenticated chat deployment fallback", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); guard.mockResolvedValue({ ok: true, status: 200, userId: "user" }); });
  const request = (lane = "fast") => new Request("https://app.example/api/chat", { method: "POST", headers: { Authorization: "Bearer caller-session", "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "هلا" }], lane, thinking: false }) });

  it("streams hosted fast chat when the local key pool returns 503", async () => {
    stream.mockResolvedValue(new Response('{"error":"Chat provider not configured"}', { status: 503 }));
    const fetchMock = vi.fn().mockResolvedValue(new Response("data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\ndata: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await handler(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(await response.text()).toContain("Hello");
    expect(fetchMock.mock.calls[0][0]).toContain("/functions/v1/chat-fast");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer caller-session");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toEqual([{ role: "user", content: "هلا" }]);
  });
  it("uses the full hosted service for full-lane provider failures", async () => {
    stream.mockResolvedValue(new Response(null, { status: 502 }));
    const fetchMock = vi.fn().mockResolvedValue(new Response("data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await handler(request("full"))).status).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toContain("/functions/v1/chat-alibaba");
  });
  it("rejects unauthenticated callers before either provider path", async () => {
    guard.mockResolvedValue({ ok: false, status: 401 });
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect((await handler(request())).status).toBe(401);
    expect(stream).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not relay invalid payloads or duplicate successful local turns", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    stream.mockResolvedValueOnce(new Response(null, { status: 400 })).mockResolvedValueOnce(new Response("local answer", { status: 200 }));
    expect((await handler(request())).status).toBe(400);
    expect(await (await handler(request())).text()).toBe("local answer");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});