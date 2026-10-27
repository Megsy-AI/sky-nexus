// Browser Use agent host. The function name is kept for deployment/URL
// compatibility; all old image/video providers were removed — media now runs
// through AgentSky. Actions: create | poll | stop (body.kind === "agent").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { handleAgent } from "./agent.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const out = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return out({ error: true, message: "invalid json" }, 400);
  }
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data } = token ? await db.auth.getUser(token) : ({ data: { user: null } } as any);
  const user = data?.user;
  if (!user) return out({ error: true, message: "Please sign in to run computer tasks." }, 401);
  if (body.kind !== "agent")
    return out({ error: true, message: "Image and video generation moved to AgentSky." }, 410);
  return handleAgent(db, user.id, body, out);
});
