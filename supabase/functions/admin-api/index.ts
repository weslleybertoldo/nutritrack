import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-schema, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Ambiente: schema "public" (prod) ou "staging", resolvido por request via header x-schema.
const _ALLOWED_SCHEMAS = ["public", "staging"];
function resolveSchema(req: Request): string {
  const h = (req.headers.get("x-schema") || "public").toLowerCase();
  return _ALLOWED_SCHEMAS.includes(h) ? h : "public";
}

// ── HS256 JWT helpers (sem deps externas) ──────────────────────────────────
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64UrlEncode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64UrlEncodeStr(s: string): string {
  return b64UrlEncode(enc.encode(s));
}
function b64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 ? 4 - (s.length % 4) : 0;
  const norm = (s + "=".repeat(pad)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
// CryptoKey cacheada por secret — evita re-importKey a cada request.
let _hmacKeyCache: { secret: string; promise: Promise<CryptoKey> } | null = null;
function hmacKey(secret: string): Promise<CryptoKey> {
  if (_hmacKeyCache && _hmacKeyCache.secret === secret) return _hmacKeyCache.promise;
  const promise = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  _hmacKeyCache = { secret, promise };
  return promise;
}
async function signJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = b64UrlEncodeStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64UrlEncodeStr(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const key = await hmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
  return `${data}.${b64UrlEncode(sig)}`;
}
async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const data = `${header}.${body}`;
  try {
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, b64UrlDecode(sig), enc.encode(data));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(b64UrlDecode(body))) as Record<string, unknown>;
    // Defesa em profundidade: exige claims minimas (sem isso, tokens sem exp seriam "eternos").
    if (typeof payload.exp !== "number" || Date.now() / 1000 > payload.exp) return null;
    if (typeof payload.iat !== "number") return null;
    if (payload.sub !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const adminJwtSecret = Deno.env.get("ADMIN_JWT_SECRET");
    const adminUsername = Deno.env.get("ADMIN_USERNAME");
    const adminPassword = Deno.env.get("ADMIN_PASSWORD");
    if (!supabaseUrl || !serviceRoleKey || !adminJwtSecret || !adminUsername || !adminPassword) {
      return json({ error: "Configuração de servidor incompleta" }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, { db: { schema: resolveSchema(req) as "public" } });

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    }
    const url = new URL(req.url);
    const action = (body.action as string) || url.searchParams.get("action");

    // ── LOGIN: emite JWT assinado pelo servidor ────────────────────────────
    if (action === "login") {
      const username = body.username as string | undefined;
      const password = body.password as string | undefined;
      if (typeof username !== "string" || typeof password !== "string") {
        return json({ success: false, error: "Credenciais inválidas" }, 401);
      }
      // Comparacao constant-time pra resistir a timing attack
      const u1 = enc.encode(username), u2 = enc.encode(adminUsername);
      const p1 = enc.encode(password), p2 = enc.encode(adminPassword);
      let diff = (u1.length ^ u2.length) | (p1.length ^ p2.length);
      for (let i = 0; i < Math.max(u1.length, u2.length); i++) diff |= (u1[i] ?? 0) ^ (u2[i] ?? 0);
      for (let i = 0; i < Math.max(p1.length, p2.length); i++) diff |= (p1[i] ?? 0) ^ (p2[i] ?? 0);
      if (diff !== 0) return json({ success: false, error: "Credenciais inválidas" }, 401);

      const now = Math.floor(Date.now() / 1000);
      const token = await signJWT({ sub: "admin", iat: now, exp: now + 24 * 60 * 60 }, adminJwtSecret);
      return json({ success: true, token });
    }

    // ── VERIFY: cliente confere validade do token ──────────────────────────
    if (action === "verify") {
      const t = (body.token as string | undefined) || req.headers.get("x-admin-token") || "";
      const payload = await verifyJWT(t, adminJwtSecret);
      return json({ valid: !!payload });
    }

    // ── Demais actions exigem JWT valido ───────────────────────────────────
    const adminToken = req.headers.get("x-admin-token") || (body.token as string | undefined) || "";
    const payload = await verifyJWT(adminToken, adminJwtSecret);
    if (!payload) return json({ error: "Não autorizado" }, 401);

    if (action === "list_users") {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, user_code, nome, email, created_at, blocked, admin_locked, foto_url, plano_id, plano_inicio, plano_expiracao")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json(data);
    }

    if (action === "get_user") {
      const userId = (url.searchParams.get("user_id") || body.user_id) as string;
      const { data: profile, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
      if (error) throw error;
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const { data: meals } = await supabase
        .from("meals").select("*, meal_items:meal_items(*, food:foods(*))").eq("user_id", userId).eq("data", today);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 6);
      const weekAgoStr = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, "0")}-${String(weekAgo.getDate()).padStart(2, "0")}`;
      const { data: weekMeals } = await supabase
        .from("meals").select("*, meal_items:meal_items(*, food:foods(*))").eq("user_id", userId).gte("data", weekAgoStr).lte("data", today);
      return json({ profile, meals: meals || [], weekMeals: weekMeals || [] });
    }

    if (action === "update_profile") {
      const { user_id: targetUserId, data: profileData } = body as { user_id: string; data: Record<string, unknown> };
      const { error } = await supabase.from("profiles").update(profileData).eq("user_id", targetUserId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "toggle_block") {
      const uid = body.user_id as string;
      const { data: current } = await supabase.from("profiles").select("blocked").eq("user_id", uid).single();
      const { error } = await supabase.from("profiles").update({ blocked: !current?.blocked }).eq("user_id", uid);
      if (error) throw error;
      return json({ success: true, blocked: !current?.blocked });
    }

    if (action === "toggle_lock") {
      const uid = body.user_id as string;
      const { data: current } = await supabase.from("profiles").select("admin_locked").eq("user_id", uid).single();
      const { error } = await supabase.from("profiles").update({ admin_locked: !current?.admin_locked }).eq("user_id", uid);
      if (error) throw error;
      return json({ success: true, admin_locked: !current?.admin_locked });
    }

    if (action === "delete_user") {
      const tid = body.user_id as string;
      await supabase.from("favorites").delete().eq("user_id", tid);
      await supabase.from("recent_foods").delete().eq("user_id", tid);
      await supabase.from("water_intake").delete().eq("user_id", tid);
      await supabase.from("habitos_registro").delete().eq("user_id", tid);
      await supabase.from("habitos").delete().eq("user_id", tid);
      await supabase.from("meal_reminders").delete().eq("user_id", tid);
      await supabase.from("user_meal_config").delete().eq("user_id", tid);
      await supabase.from("user_roles").delete().eq("user_id", tid);
      const { data: mealIds } = await supabase.from("meals").select("id").eq("user_id", tid);
      if (mealIds && mealIds.length) {
        const ids = mealIds.map((m) => m.id);
        await supabase.from("meal_items").delete().in("meal_id", ids);
      }
      await supabase.from("meals").delete().eq("user_id", tid);
      const { data: recipeIds } = await supabase.from("recipes").select("id").eq("user_id", tid);
      if (recipeIds && recipeIds.length) {
        const ids = recipeIds.map((r) => r.id);
        await supabase.from("recipe_items").delete().in("recipe_id", ids);
      }
      await supabase.from("recipes").delete().eq("user_id", tid);
      await supabase.from("profiles").delete().eq("user_id", tid);
      await supabase.auth.admin.deleteUser(tid);
      return json({ success: true });
    }

    if (action === "signup_stats") {
      const { data, error } = await supabase.from("profiles").select("created_at, blocked");
      if (error) throw error;
      return json(data);
    }

    if (action === "list_plans") {
      const { data, error } = await supabase.from("admin_plans").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return json(data);
    }

    if (action === "create_plan") {
      const { nome, cor } = body as { nome: string; cor?: string };
      const { data, error } = await supabase.from("admin_plans").insert({ nome, cor: cor || "#6366f1" }).select().single();
      if (error) throw error;
      return json(data);
    }

    if (action === "update_plan") {
      const { plan_id, nome, cor } = body as { plan_id: string; nome?: string; cor?: string };
      const updates: Record<string, unknown> = {};
      if (nome !== undefined) updates.nome = nome;
      if (cor !== undefined) updates.cor = cor;
      const { error } = await supabase.from("admin_plans").update(updates).eq("id", plan_id);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "delete_plan") {
      const planId = body.plan_id as string;
      await supabase.from("profiles").update({ plano_id: null, plano_inicio: null, plano_expiracao: null }).eq("plano_id", planId);
      const { error } = await supabase.from("admin_plans").delete().eq("id", planId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action === "assign_plan") {
      const { user_id: uid, plano_id, plano_inicio, plano_expiracao } = body as { user_id: string; plano_id?: string; plano_inicio?: string; plano_expiracao?: string };
      const { error } = await supabase.from("profiles").update({
        plano_id: plano_id || null,
        plano_inicio: plano_inicio || null,
        plano_expiracao: plano_expiracao || null,
      }).eq("user_id", uid);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ error: "Acao nao reconhecida: " + action }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 400);
  }
});
