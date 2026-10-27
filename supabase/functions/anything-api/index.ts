/** @doc anything-api — connected-app tools, API apps and Telegram storage.
 *  Image/video generation was removed; all media runs through AgentSky. */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;


const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });


// ===================== connected-app agent tools =====================
// Uses the connected-apps credentials already stored as function secrets, so
// the browser only ever sends its own session token.

const TOOLS_API = "https://api.pipedream.com/v1";

function toolsConfig() {
  const pick = (...names: string[]) => {
    for (const n of names) {
      const v = Deno.env.get(n);
      if (v) return v;
    }
    return undefined;
  };
  const clientId = pick("PIPEDREAM_CLIENT_ID", "PIPEDREAM_OAUTH_CLIENT_ID");
  const clientSecret = pick("PIPEDREAM_CLIENT_SECRET", "PIPEDREAM_OAUTH_CLIENT_SECRET");
  const projectId = pick("PIPEDREAM_PROJECT_ID", "PIPEDREAM_PROJECT");
  if (!clientId || !clientSecret || !projectId) return null;
  return {
    clientId,
    clientSecret,
    projectId,
    environment: pick("PIPEDREAM_ENVIRONMENT", "PIPEDREAM_ENV") ?? "production",
  };
}

type ToolsCfg = NonNullable<ReturnType<typeof toolsConfig>>;

let toolsToken: { value: string; expiresAt: number } | null = null;

async function toolsAccessToken(cfg: ToolsCfg): Promise<string> {
  if (toolsToken && toolsToken.expiresAt > Date.now() + 30_000) return toolsToken.value;
  const res = await fetch(`${TOOLS_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) throw new Error(`app tools auth failed [${res.status}]`);
  toolsToken = {
    value: String(data.access_token),
    expiresAt: Date.now() + Math.max(60_000, Number(data.expires_in ?? 3600) * 1000),
  };
  return toolsToken.value;
}

async function toolsFetchEnv(
  cfg: ToolsCfg,
  environment: string,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {},
) {
  const token = await toolsAccessToken(cfg);
  const url = new URL(`${TOOLS_API}/connect/${cfg.projectId}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) if (v) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-PD-Environment": environment,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const detail = typeof data?.error === "string" ? data.error : text.slice(0, 300);
    throw new Error(`app request failed [${res.status}]: ${detail}`);
  }
  return data;
}

/** Tries the configured environment, then the alternate one (accounts may be linked in either). */
async function toolsFetch(
  cfg: ToolsCfg,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {},
) {
  const alt = cfg.environment === "production" ? "development" : "production";
  try {
    return await toolsFetchEnv(cfg, cfg.environment, path, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/404|not found/i.test(msg)) return await toolsFetchEnv(cfg, alt, path, init);
    throw e;
  }
}

const toolsAppSlug = (a: any) =>
  a?.app?.name_slug ?? a?.app?.slug ?? a?.app_slug ?? a?.appSlug ?? null;

/** Pipedream actions need the connected account passed as their `app` prop. */
async function toolsWithAuth(
  cfg: ToolsCfg,
  admin: ReturnType<typeof createClient>,
  userId: string,
  toolId: string,
  appHint: string,
  configured: Record<string, any>,
): Promise<Record<string, any>> {
  const props = { ...(configured ?? {}) };
  let authProps: { name: string; app: string }[] = [];
  try {
    const meta = await toolsFetch(cfg, `/components/${encodeURIComponent(toolId)}`);
    const list: any[] = meta?.data?.configurable_props ?? meta?.configurable_props ?? [];
    authProps = list
      .filter((p) => p?.type === "app" && p?.name)
      .map((p) => ({ name: String(p.name), app: String(p.app ?? appHint) }));
  } catch (_e) {
    // fall back to slug-derived guess below
  }
  if (!authProps.length && appHint) {
    const camel = appHint.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
    authProps = [{ name: camel, app: appHint }];
  }
  for (const p of authProps) {
    if (props[p.name]) continue;
    const { data: acc } = await admin
      .from("pipedream_accounts")
      .select("account_id")
      .eq("user_id", userId)
      .eq("app_slug", p.app || appHint)
      .maybeSingle();
    const accountId = (acc as any)?.account_id;
    if (accountId) props[p.name] = { authProvisionId: String(accountId) };
  }
  return props;
}

/** The external-user namespace the app's account was linked under. */
async function toolsExternalUser(
  admin: ReturnType<typeof createClient>,
  userId: string,
  fallback: string,
  app: string,
): Promise<string> {
  if (!app) return fallback;
  const { data } = await admin
    .from("pipedream_accounts")
    .select("external_user_id")
    .eq("user_id", userId)
    .eq("app_slug", app)
    .maybeSingle();
  const ext = (data as any)?.external_user_id;
  return ext ? String(ext) : fallback;
}

async function handleTools(
  req: Request,
  admin: ReturnType<typeof createClient>,
  body: any,
): Promise<Response> {
  const action = String(body?.action ?? "").trim();
  if (!action) return json({ ok: false, error: "Missing action" }, 400);

  const token = String(
    body?.token ?? (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, ""),
  );
  const { data: userData } = await admin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return json({ ok: false, error: "Sign in first" }, 401);

  const cfg = toolsConfig();
  if (!cfg) {
    if (action === "list") return json({ ok: true, configured: false, apps: [] });
    return json({ ok: false, error: "App tools are not configured yet" }, 400);
  }

  // Same external-user convention as the account-linking function.
  const externalUserId = `megsy_${userId}`;

  try {
    if (action === "list") {
      let rows: any[] = [];
      const accounts: any[] = [];
      for (const ext of [externalUserId, userId]) {
        try {
          const data = await toolsFetch(cfg, "/accounts", {
            query: { external_user_id: ext, limit: "100" },
          });
          if (Array.isArray(data?.data)) {
            for (const a of data.data) accounts.push({ ...a, _ext: ext });
          }
        } catch (_e) {
          // ignore: this external-user namespace may not exist
        }
      }
      const seen = new Set<string>();
      rows = accounts
        .map((a) => {
          const slug = toolsAppSlug(a);
          if (!slug || !a?.id || seen.has(String(slug))) return null;
          seen.add(String(slug));
          return {
            user_id: userId,
            external_user_id: String(a._ext ?? externalUserId),
            app_slug: String(slug),
            account_id: String(a.id),
            account_name: String(a.name ?? a.external_id ?? slug),
            healthy: a.healthy !== false,
            metadata: { app_name: a?.app?.name ?? null },
            updated_at: new Date().toISOString(),
          };
        })
        .filter(Boolean) as any[];
      if (rows.length) {
        await admin.from("pipedream_accounts").upsert(rows, { onConflict: "user_id,app_slug" });
      }
      // Merge in accounts linked through the connect flow (stored locally).
      {
        const { data } = await admin
          .from("pipedream_accounts")
          .select("app_slug, account_id, account_name, healthy")
          .eq("user_id", userId);
        for (const r of (data as any[]) ?? []) {
          const slug = String(r.app_slug ?? "");
          if (!slug || seen.has(slug)) continue;
          seen.add(slug);
          rows.push(r);
        }
      }

      const { data: prefs } = await admin
        .from("pipedream_tool_settings")
        .select("app_slug, enabled")
        .eq("user_id", userId);
      const off = new Set(
        ((prefs as any[]) ?? []).filter((r) => r.enabled === false).map((r) => String(r.app_slug)),
      );

      return json({
        ok: true,
        configured: true,
        apps: rows.map((a) => ({
          app: String(a.app_slug),
          account_id: String(a.account_id ?? ""),
          account_name: a.account_name ?? null,
          healthy: a.healthy !== false,
          enabled: !off.has(String(a.app_slug)),
        })),
      });
    }

    if (action === "actions") {
      const app = String(body?.app ?? "").trim();
      if (!app) return json({ ok: false, error: "Missing app" }, 400);
      const data = await toolsFetch(cfg, "/actions", { query: { app, limit: "100" } });
      const list: any[] = Array.isArray(data?.data) ? data.data : [];
      return json({
        ok: true,
        app,
        tools: list.map((a) => ({
          key: String(a?.key ?? a?.id ?? ""),
          app,
          name: String(a?.name ?? a?.key ?? "Action"),
          description: String(a?.description ?? "").slice(0, 400),
          version: a?.version ? String(a.version) : undefined,
        })),
      });
    }

    if (action === "props") {
      const tool = String(body?.tool ?? "");
      if (!tool) return json({ ok: false, error: "Missing tool" }, 400);
      const appHint = String(body?.app ?? tool.split("-")[0] ?? "").trim();
      const configured = await toolsWithAuth(
        cfg,
        admin,
        userId,
        tool,
        appHint,
        body?.configured_props ?? {},
      );
      const extUser = await toolsExternalUser(admin, userId, externalUserId, appHint);
      const data = await toolsFetch(cfg, "/actions/configure", {
        method: "POST",
        body: {
          external_user_id: extUser,

          id: tool,
          prop_name: body?.prop_name,
          configured_props: configured,
          query: body?.query,
        },
      });
      return json({ ok: true, result: data });
    }

    if (action === "run") {
      const tool = String(body?.tool ?? "");
      if (!tool) return json({ ok: false, error: "Missing tool" }, 400);
      const app = String(body?.app ?? tool.split("-")[0] ?? "").trim();
      if (app) {
        const { data: setting } = await admin
          .from("pipedream_tool_settings")
          .select("enabled")
          .eq("user_id", userId)
          .eq("app_slug", app)
          .maybeSingle();
        if (setting && (setting as any).enabled === false) {
          return json({ ok: false, error: "This app is turned off for the assistant" }, 403);
        }
      }
      const configured = await toolsWithAuth(
        cfg,
        admin,
        userId,
        tool,
        app,
        body?.configured_props ?? {},
      );
      const extUser = await toolsExternalUser(admin, userId, externalUserId, app);
      const data = await toolsFetch(cfg, "/actions/run", {
        method: "POST",
        body: {
          external_user_id: extUser,

          id: tool,
          configured_props: configured,
        },
      });
      return json({ ok: true, result: data?.ret ?? data, exports: data?.exports ?? null });
    }

    // Creates a link session in the same environment the tool runtime uses,
    // so newly connected apps can actually run actions.
    if (action === "connect") {
      const data = await toolsFetch(cfg, "/tokens", {
        method: "POST",
        body: {
          external_user_id: externalUserId,
          allowed_origins: Array.isArray(body?.allowed_origins)
            ? body.allowed_origins
            : body?.redirect_origin
              ? [String(body.redirect_origin)]
              : undefined,
        },
      });
      const link = data?.connect_link_url ?? data?.connectLinkUrl ?? null;
      if (!link) return json({ ok: false, error: "Could not start the connection" }, 500);
      return json({ ok: true, connect_link_url: String(link), token: data?.token ?? null });
    }

    if (action === "set_enabled") {
      const app = String(body?.app ?? "").trim();
      if (!app) return json({ ok: false, error: "Missing app" }, 400);
      const enabled = body?.enabled !== false;
      const { error } = await admin
        .from("pipedream_tool_settings")
        .upsert(
          { user_id: userId, app_slug: app, enabled, updated_at: new Date().toISOString() },
          { onConflict: "user_id,app_slug" },
        );
      if (error) return json({ ok: false, error: error.message }, 500);
      return json({ ok: true, app, enabled });
    }

    return json({ ok: false, error: "Unknown action" }, 400);
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "tools_failed" }, 500);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));

    // connected-app tools (list / actions / props / run / set_enabled)
    if (body?.kind === "tools" || body?.tools === true) {
      return await handleTools(req, createClient(SUPABASE_URL, SERVICE_KEY), body);
    }

    // ready-made API apps (bring your own key)
    if (body?.kind === "api_app") {
      const { handleApiApp } = await import("./apiAppRunner.ts");
      return await handleApiApp(req, createClient(SUPABASE_URL, SERVICE_KEY), body);
    }

    // Telegram-backed file storage (upload / resolve / list / status)
    if (body?.kind === "telegram_storage") {
      const { handleTelegramStorage } = await import("./telegramStorage.ts");
      return await handleTelegramStorage(req, body);
    }

    // Image and video generation moved to AgentSky (the app's single media provider).
    return json(
      { error: true, message: "Image and video generation moved to AgentSky." },
      410,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unexpected error";
    return json({ error: true, message: msg }, 500);
  }
});
