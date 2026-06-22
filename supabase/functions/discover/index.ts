import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// REX deck proxy: holds the TMDB token server-side and serves a shaped Title[].
// Gated: CORS locked to the app's origins + a best-effort per-IP rate limit.

const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";
const TOKEN = Deno.env.get("TMDB_TOKEN") ?? "";

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
const RL_LIMIT = 30, RL_WINDOW = 60_000;
function limited(ip: string): boolean {
  const now = Date.now();
  if (RL.size > 5000) RL.clear();
  const e = RL.get(ip);
  if (!e || now - e.t > RL_WINDOW) { RL.set(ip, { c: 1, t: now }); return false; }
  e.c++;
  return e.c > RL_LIMIT;
}

const MOVIE_GENRES: Record<number, string> = { 28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family", 14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music", 9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie", 53: "Thriller", 10752: "War", 37: "Western" };
const TV_GENRES: Record<number, string> = { 10759: "Action & Adventure", 16: "Animation", 35: "Comedy", 80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family", 10762: "Kids", 9648: "Mystery", 10763: "News", 10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk", 10768: "War & Politics", 37: "Western" };
const nameToId = (m: Record<number, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v.toLowerCase(), Number(k)])) as Record<string, number>;
const MOVIE_NAME = nameToId(MOVIE_GENRES);
const TV_NAME = nameToId(TV_GENRES);

const PROVIDERS: Record<string, number> = { "netflix": 8, "disney+": 337, "disney plus": 337, "hulu": 15, "max": 1899, "hbo max": 384, "prime video": 9, "amazon prime video": 9, "apple tv+": 350, "paramount+": 531, "peacock": 386 };

// Studios that are genuine taste signals (production_companies is otherwise noisy).
const STUDIOS = new Set([41077, 3172, 10342, 3, 420, 521, 90733, 10146, 43, 127928, 297, 28788, 6704, 923, 491, 7976, 11461, 2348]);
const JUNK_KW = new Set(["aftercreditsstinger", "duringcreditsstinger", "based on novel or book", "woman director", "based on comic", "based on true story"]);

const GRADIENTS: [string, string][] = [["#C2703A", "#5A2E12"], ["#2C7A7B", "#0B1B2B"], ["#6B46C1", "#E53E3E"], ["#3182CE", "#15294B"], ["#9B2C2C", "#1A202C"], ["#319795", "#553C9A"], ["#B7791F", "#1A1A1A"], ["#2B6CB0", "#1A1A2E"], ["#742A2A", "#0B0B12"], ["#2F855A", "#1A202C"]];
const gradientFor = (id: number) => GRADIENTS[Math.abs(id) % GRADIENTS.length];

async function tmdb(path: string, params: Record<string, string | undefined>) {
  const u = new URL(TMDB + path);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") u.searchParams.set(k, v);
  const r = await fetch(u.toString(), { headers: { Authorization: `Bearer ${TOKEN}`, accept: "application/json" } });
  if (!r.ok) throw new Error(`tmdb ${path} ${r.status}`);
  return r.json();
}

async function providersFor(type: "movie" | "tv", id: number, region: string): Promise<string[]> {
  try {
    const d = await tmdb(`/${type}/${id}/watch/providers`, {});
    const flat = d?.results?.[region]?.flatrate ?? [];
    return flat.slice(0, 3).map((p: { provider_name: string }) => p.provider_name);
  } catch { return []; }
}

function isRecent(date?: string) {
  if (!date) return false;
  const t = Date.parse(date);
  return Number.isFinite(t) && Date.now() - t < 1000 * 60 * 60 * 24 * 75 && t <= Date.now() + 1000 * 60 * 60 * 24 * 30;
}

// Build the compact tag list for a single (enriched) title.
function buildTags(type: "movie" | "tv", det: Record<string, any>) {
  const tags: { type: string; id: number; name: string; role?: string }[] = [];
  for (const g of det.genres || []) tags.push({ type: "genre", id: g.id, name: g.name });
  for (const c of (det.credits?.cast || []).slice(0, 6)) tags.push({ type: "person", id: c.id, name: c.name, role: "cast" });
  if (type === "movie") {
    for (const c of (det.credits?.crew || []).filter((x: any) => x.job === "Director")) tags.push({ type: "person", id: c.id, name: c.name, role: "director" });
  } else {
    for (const c of (det.created_by || [])) tags.push({ type: "person", id: c.id, name: c.name, role: "creator" });
  }
  for (const co of det.production_companies || []) if (STUDIOS.has(co.id)) tags.push({ type: "company", id: co.id, name: co.name, role: "studio" });
  const kws = (det.keywords?.keywords || det.keywords?.results || []).filter((k: any) => !JUNK_KW.has(String(k.name).toLowerCase())).slice(0, 6);
  for (const k of kws) tags.push({ type: "keyword", id: k.id, name: k.name });
  // de-dup by type:id
  const seen = new Set<string>();
  return tags.filter((t) => { const key = `${t.type}:${t.id}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

type Pivot = { type: string; id?: number; name?: string };

function discoverParams(type: "movie" | "tv", o: { region: string; withIds?: string; withoutIds?: string; year?: string; actorId?: number; providerId?: number; sort: string; page: string; pivot?: Pivot }) {
  const isMovie = type === "movie";
  const today = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10);
  const dateField = isMovie ? "primary_release_date" : "first_air_date";
  const NAME = isMovie ? MOVIE_NAME : TV_NAME;
  const p: Record<string, string | undefined> = { include_adult: "false", watch_region: o.region, page: o.page };

  if (o.pivot) {
    const pv = o.pivot;
    if (pv.type === "genre") p.with_genres = pv.id ? String(pv.id) : (NAME[String(pv.name || "").toLowerCase()] ? String(NAME[String(pv.name).toLowerCase()]) : undefined);
    else if (pv.type === "company") p.with_companies = pv.id ? String(pv.id) : undefined;
    else if (pv.type === "keyword") p.with_keywords = pv.id ? String(pv.id) : undefined;
    else if (pv.type === "person") p[isMovie ? "with_cast" : "with_people"] = pv.id ? String(pv.id) : undefined;
  } else {
    p.with_genres = o.withIds;
    p.without_genres = o.withoutIds;
  }

  if (o.year) p[isMovie ? "primary_release_year" : "first_air_date_year"] = o.year;
  if (o.actorId) p[isMovie ? "with_cast" : "with_people"] = String(o.actorId);
  if (o.providerId) { p.with_watch_providers = String(o.providerId); p.with_watch_monetization_types = "flatrate"; }
  switch (o.sort) {
    case "top": p.sort_by = "vote_average.desc"; p["vote_count.gte"] = "500"; break;
    case "hidden": p.sort_by = "vote_average.desc"; p["vote_count.gte"] = "50"; p["vote_count.lte"] = "700"; break;
    case "box_office":
      if (isMovie) { p.sort_by = "revenue.desc"; p["vote_count.gte"] = "100"; }
      else { p.sort_by = "popularity.desc"; p["vote_count.gte"] = "150"; }
      break;
    case "new": p.sort_by = `${dateField}.desc`; p[`${dateField}.lte`] = today; p["vote_count.gte"] = "20"; break;
    case "streaming_new":
      p.with_watch_monetization_types = "flatrate";
      p.sort_by = `${dateField}.desc`; p[`${dateField}.lte`] = today; p[`${dateField}.gte`] = yearAgo; p["vote_count.gte"] = "10"; break;
    default: p.sort_by = o.pivot ? "popularity.desc" : "popularity.desc"; p["vote_count.gte"] = o.pivot ? "20" : "150";
  }
  return p;
}

Deno.serve(async (req: Request) => {
  const cors = corsFor(req.headers.get("origin"));
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return json({ error: "rate limited" }, 429);
  if (!TOKEN) return json({ error: "TMDB_TOKEN not set" }, 500);
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // Single-title lookup for deep-link cold-open + tag enrichment.
    if (body.titleId && (body.mediaType === "movie" || body.mediaType === "tv")) {
      const type = body.mediaType as "movie" | "tv";
      const region0 = String(body.region || "US");
      const r = await tmdb(`/${type}/${body.titleId}`, { append_to_response: "credits,keywords" });
      const providers = await providersFor(type, r.id, region0);
      const dateStr = type === "movie" ? r.release_date : r.first_air_date;
      return json([{
        id: r.id, mediaType: type,
        title: type === "movie" ? r.title : r.name,
        year: dateStr ? Number(String(dateStr).slice(0, 4)) : 0,
        genres: (r.genres || []).map((g: { name: string }) => g.name).filter(Boolean).slice(0, 3),
        overview: r.overview || "",
        providers,
        rating: typeof r.vote_average === "number" ? r.vote_average : 0,
        poster: r.poster_path ? IMG + r.poster_path : undefined,
        gradient: gradientFor(r.id),
        inTheaters: type === "movie" && providers.length === 0 && isRecent(dateStr),
        tags: buildTags(type, r),
      }]);
    }

    const mediaTypes: string[] = Array.isArray(body.mediaTypes) && body.mediaTypes.length ? body.mediaTypes : ["movie", "tv"];
    const region = String(body.region || "US");
    const genreName = String(body.genre || "").toLowerCase();
    const withList: string[] = Array.isArray(body.withGenres) ? body.withGenres : [];
    const withoutList: string[] = Array.isArray(body.withoutGenres) ? body.withoutGenres : [];
    const year = body.year ? String(body.year) : undefined;
    const sort = String(body.sort || "popular");
    const providerId = body.service ? PROVIDERS[String(body.service).toLowerCase()] : undefined;
    const pivot: Pivot | undefined = body.pivot && body.pivot.type ? body.pivot : undefined;
    const fixedPage = sort === "top" || sort === "box_office";
    const page = String(body.page && Number(body.page) > 0 ? Number(body.page) : fixedPage ? 1 : 1 + Math.floor(Math.random() * 3));

    let actorId: number | undefined;
    if (body.actor && !pivot) {
      const s = await tmdb("/search/person", { query: String(body.actor), include_adult: "false" });
      actorId = s?.results?.[0]?.id;
      if (!actorId) return json([]);
    }

    const out: Record<string, unknown>[] = [];
    for (const type of mediaTypes) {
      if (type !== "movie" && type !== "tv") continue;
      const isMovie = type === "movie";
      const NAME = isMovie ? MOVIE_NAME : TV_NAME;
      const gid = NAME[genreName];
      const withIds = gid ? String(gid) : (withList.map((n) => NAME[n.toLowerCase()]).filter(Boolean).join("|") || undefined);
      const withoutIds = withoutList.map((n) => NAME[n.toLowerCase()]).filter(Boolean).join(",") || undefined;
      const params = discoverParams(type, { region, withIds, withoutIds, year, actorId, providerId, sort, page, pivot });
      const data = await tmdb(`/discover/${type}`, params);
      const gmap = isMovie ? MOVIE_GENRES : TV_GENRES;
      const results = (data.results || []).slice(0, 12);
      const items = await Promise.all(results.map(async (r: Record<string, any>) => {
        const providers = await providersFor(type, r.id, region);
        const dateStr = isMovie ? r.release_date : r.first_air_date;
        return {
          id: r.id, mediaType: type,
          title: isMovie ? r.title : r.name,
          year: dateStr ? Number(String(dateStr).slice(0, 4)) : 0,
          genres: (r.genre_ids || []).map((g: number) => gmap[g]).filter(Boolean).slice(0, 3),
          overview: r.overview || "",
          providers,
          rating: typeof r.vote_average === "number" ? r.vote_average : 0,
          poster: r.poster_path ? IMG + r.poster_path : undefined,
          gradient: gradientFor(r.id),
          inTheaters: isMovie && providers.length === 0 && isRecent(dateStr),
        };
      }));
      out.push(...items.filter((i) => i.title));
    }
    if (!pivot && sort === "popular" && mediaTypes.length > 1) {
      for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    }
    return json(out);
  } catch (e) {
    return json({ error: String(e) }, 502);
  }
});
