/** @doc Serverless chat and deep-research endpoints consolidated for Vercel Hobby. */
import { streamChatProxy, type ChatProxyPayload } from "../chat/proxyCore";
import { streamDeepResearch } from "../research/deepResearchCore";
import { guardApiRequest, guardResponse } from "../api/apiGuard";
import { apiHeaders } from "../api/authenticateRequest";
import { edgeAnonKey, edgeUrl } from "../edgeRuntime";

export const config = { runtime: "nodejs", maxDuration: 300 };

export default async function handler(req: Request): Promise<Response> {
  const headers = apiHeaders(req);
  const url = new URL(req.url);
  const isDeepResearch =
    url.pathname.endsWith("/deep-research") || url.searchParams.get("route") === "deep-research";

  if (req.method === "OPTIONS") {
    return new Response(isDeepResearch ? null : "ok", {
      status: isDeepResearch ? 204 : 200,
      headers,
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  if (isDeepResearch) {
    const guard = await guardApiRequest(req, "deep-research");
    if (!guard.ok) return guardResponse(guard, headers);
    const payload = await req.json().catch(() => null);
    return streamDeepResearch(payload ?? {}, req);
  }

  // Without this guard the proxy is an open relay: anyone could burn provider
  // credit by POSTing here with no session.
  const guard = await guardApiRequest(req, "chat");
  if (!guard.ok) return guardResponse(guard, headers);

  const payload = (await req.json().catch(() => null)) as ChatProxyPayload | null;
  const local = await streamChatProxy(payload ?? {}, headers);
  if (local.status !== 503 && local.status !== 502) return local;

  // Imported deployments may keep their provider pools only in the existing
  // hosted runtime. Relay there with the verified caller, never with an admin
  // key, instead of returning a local-configuration 503 to the browser.
  await local.body?.cancel();
  const fn = payload?.lane === "fast" ? "chat-fast" : "chat-alibaba";
  const authorization = req.headers.get("authorization");
  if (!authorization) return guardResponse({ ok: false, status: 401 }, headers);
  try {
    const upstream = await fetch(edgeUrl(fn), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: edgeAnonKey(fn),
        Authorization: authorization,
      },
      body: JSON.stringify(payload),
      signal: req.signal,
    });
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Content-Type", upstream.headers.get("content-type") || "application/json");
    if (upstream.headers.get("x-model-used")) {
      responseHeaders.set("x-model-used", upstream.headers.get("x-model-used") || "");
    }
    if (upstream.headers.get("retry-after")) {
      responseHeaders.set("Retry-After", upstream.headers.get("retry-after") || "");
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (error) {
    if (req.signal.aborted) throw error;
    console.error("Hosted chat relay failed", { function: fn });
    return new Response(JSON.stringify({ error: "Chat service is temporarily unavailable. Please try again." }), { status: 502, headers });
  }
}
