import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// REX remote match rooms: two devices share a short code, swipe the same deck,
// and poll each other's swipes for live matches. Ephemeral, low-sensitivity
// (a transient watch session). Mirrors the `backup` function's hardening:
// CORS allowlist + per-IP rate limit, service-role REST against a table with RLS
// on and no policies (reachable only through this function). verify_jwt off.

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
  // Generous: polling is ~1 req/1.5s per device → ~40/min/device.
  if (!e || now - e.t > 60_000) { RL.set(ip, { c: 1, t: now }); return false; }
  e.c++;
  return e.c > 120;
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const makeCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join("");
const validCode = (c: unknown) => typeof c === "string" && /^[A-Z0-9]{4}$/.test(c);
const cap = (s: unknown, n: number) => (typeof s === "string" ? s.slice(0, n) : "");

// Coerce an untrusted player payload into a bounded shape.
function cleanPlayer(p: unknown) {
  const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
  const swipes = (o.swipes && typeof o.swipes === "object" ? o.swipes : {}) as Record<string, unknown>;
  const out: Record<string, "like" | "pass"> = {};
  let n = 0;
  for (const [k, v] of Object.entries(swipes)) {
    if (n++ > 400) break;
    if ((v === "like" || v === "pass") && k.length < 40) out[k] = v;
  }
  return { name: cap(o.name, 24) || "Player", taste: (o.taste && typeof o.taste === "object" ? o.taste : {}), swipes: out };
}

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

    if (action === "create") {
      // Opportunistic TTL: purge rooms idle >24h so codes recycle and the
      // table can't grow unboundedly. Fire-and-forget — no cron needed here.
      rest(`match_rooms?updated_at=lt.${new Date(Date.now() - 86_400_000).toISOString()}`, {
        method: "DELETE", headers: { Prefer: "return=minimal" },
      }).catch(() => {});
      const deck = Array.isArray(body.deck) ? body.deck.slice(0, 120) : null;
      if (!deck) return json({ error: "no deck" }, 400);
      const host = cleanPlayer(body.player);
      // Find a free code.
      let code = "";
      for (let i = 0; i < 8; i++) {
        const c = makeCode();
        const chk = await rest(`match_rooms?code=eq.${c}&select=code`, { method: "GET" });
        if (chk.ok && (await chk.json()).length === 0) { code = c; break; }
      }
      if (!code) return json({ error: "could not allocate room" }, 503);
      const r = await rest("match_rooms", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ code, deck, host, guest: null, updated_at: new Date().toISOString() }),
      });
      if (!r.ok) return json({ error: `create failed ${r.status}` }, 502);
      return json({ code });
    }

    if (action === "join") {
      if (!validCode(body.code)) return json({ error: "bad code" }, 400);
      const guest = cleanPlayer(body.player);
      const g = await rest(`match_rooms?code=eq.${body.code}&select=code,deck,host,guest`, { method: "GET" });
      if (!g.ok) return json({ error: `join failed ${g.status}` }, 502);
      const rows = await g.json();
      if (!rows.length) return json({ error: "Room not found — check the code." }, 404);
      if (rows[0].guest) return json({ error: "That room is already full." }, 409);
      const u = await rest(`match_rooms?code=eq.${body.code}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ guest, updated_at: new Date().toISOString() }),
      });
      if (!u.ok) return json({ error: `join failed ${u.status}` }, 502);
      const out = await u.json();
      return json(out[0] ?? { code: body.code, deck: rows[0].deck, host: rows[0].host, guest });
    }

    if (action === "sync") {
      if (!validCode(body.code)) return json({ error: "bad code" }, 400);
      const role = body.role === "guest" ? "guest" : "host";
      const player = cleanPlayer(body.player);
      const u = await rest(`match_rooms?code=eq.${body.code}`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ [role]: player, updated_at: new Date().toISOString() }),
      });
      if (!u.ok) return json({ error: `sync failed ${u.status}` }, 502);
      const out = await u.json();
      if (!out.length) return json({ error: "Room closed." }, 404);
      return json(out[0]);
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});
