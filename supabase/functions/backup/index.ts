import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// REX cloud backup: stores a user's localStorage snapshot under a short random
// code so they can restore on a new device (defends against localStorage
// eviction). Low-sensitivity data (a watchlist), gated by CORS + rate limit.
// Deployed to Supabase project REX as the `backup` function (verify_jwt off).
// Uses the auto-injected SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; the backups
// table has RLS on with no policies, so it's reachable only via this function.

const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ALLOWED = new Set([
  "https://seanjoudrie.github.io",
  "http://localhost:5173", "http://localhost:5174", "http://localhost:5175",
]);
function corsFor(origin: string | null) {
  const allow = origin && ALLOWED.has(origin) ? origin : "https://seanjoudrie.github.io";
  return {
    "Access-Control-Allow-Origin": allow, "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const RL = new Map<string, { c: number; t: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  if (RL.size > 5000) RL.clear();
  const e = RL.get(ip);
  if (!e || now - e.t > 60_000) { RL.set(ip, { c: 1, t: now }); return false; }
  e.c++;
  return e.c > 20;
}

// Unambiguous code alphabet (no 0/O/1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
const validCode = (c: unknown) => typeof c === "string" && /^[A-Z0-9]{6}$/.test(c);

async function rest(path: string, init: RequestInit) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req.headers.get("origin"));
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return json({ error: "rate limited" }, 429);
  if (!SB_URL || !SVC) return json({ error: "backend not configured" }, 500);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "save") {
      if (!body.data || typeof body.data !== "object") return json({ error: "no data" }, 400);
      const code = validCode(body.code) ? body.code : makeCode();
      const r = await rest("backups", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ code, data: body.data, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) return json({ error: `save failed ${r.status}` }, 502);
      return json({ code });
    }

    if (action === "restore") {
      if (!validCode(body.code)) return json({ error: "bad code" }, 400);
      const r = await rest(`backups?code=eq.${body.code}&select=data`, { method: "GET" });
      if (!r.ok) return json({ error: `restore failed ${r.status}` }, 502);
      const rows = await r.json();
      if (!rows.length) return json({ error: "not found" }, 404);
      return json({ data: rows[0].data });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});
