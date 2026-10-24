// translate: turns text typed in Chinese into Arabic (for the admin) and Arabic into Chinese (for staff).
// - Only logged-in admin/staff can call it.
// - Every translation is cached in public.translations, so each sentence is translated only once.
// - Provider: official Google Cloud Translation when the GOOGLE_TRANSLATE_KEY secret is set,
//   otherwise the free Google endpoint, then MyMemory as a backup.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const KEY = Deno.env.get("GOOGLE_TRANSLATE_KEY") || "";
const MAX_TEXTS = 60, MAX_LEN = 1500;
const GCODE: Record<string, string> = { ar: "ar", zh: "zh-CN" };

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
}
const srcOf = (s: string) => (/[㐀-鿿]/.test(s) ? "zh-CN" : /[؀-ۿ]/.test(s) ? "ar" : "auto");

async function viaOfficial(texts: string[], tl: string): Promise<(string | null)[]> {
  const r = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: texts, target: GCODE[tl], format: "text" }),
  });
  if (!r.ok) throw new Error("official " + r.status);
  const d = await r.json();
  return d.data.translations.map((t: { translatedText: string }) => t.translatedText);
}
async function viaFree(t: string, tl: string): Promise<string | null> {
  const u = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${GCODE[tl]}&dt=t&q=${encodeURIComponent(t)}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error("free " + r.status);
  const d = await r.json();
  const out = (d[0] || []).map((x: unknown[]) => x[0]).join("");
  return out || null;
}
async function viaMyMemory(t: string, tl: string): Promise<string | null> {
  const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(t)}&langpair=${srcOf(t)}|${GCODE[tl]}`;
  const r = await fetch(u);
  if (!r.ok) return null;
  const d = await r.json();
  const out = d?.responseData?.translatedText;
  return typeof out === "string" && out && !/MYMEMORY WARNING|INVALID/i.test(out) ? out : null;
}
async function translateMany(texts: string[], tl: string): Promise<(string | null)[]> {
  if (KEY) {
    try {
      return await viaOfficial(texts, tl);
    } catch (_) { /* fall back to free providers */ }
  }
  const out: (string | null)[] = [];
  for (const t of texts) {
    let v: string | null = null;
    try { v = await viaFree(t, tl); } catch (_) { v = null; }
    if (!v) { try { v = await viaMyMemory(t, tl); } catch (_) { v = null; } }
    out.push(v);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // who is calling? must be an active admin or staff account
  const auth = req.headers.get("Authorization") || "";
  const { data: u } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!u?.user) return json({ error: "auth" }, 401);
  const { data: prof } = await admin.from("profiles").select("role").eq("user_id", u.user.id).maybeSingle();
  if (!prof || !["admin", "staff"].includes(prof.role)) return json({ error: "forbidden" }, 403);

  let body: { to?: string; texts?: unknown[] } = {};
  try { body = await req.json(); } catch (_) { /* empty */ }
  const tl = body.to === "zh" ? "zh" : body.to === "ar" ? "ar" : "";
  const texts = Array.isArray(body.texts) ? body.texts.filter((x) => typeof x === "string").slice(0, MAX_TEXTS) as string[] : [];
  if (!tl || !texts.length) return json({ error: "invalid" }, 400);

  const items = await Promise.all(texts.map(async (t) => {
    const src = t.trim().slice(0, MAX_LEN);
    return { src, h: await sha(tl + "|" + src) };
  }));
  const { data: cached } = await admin.from("translations").select("h,out").in("h", items.map((i) => i.h));
  const hit = new Map((cached || []).map((r: { h: string; out: string }) => [r.h, r.out]));
  const missing = items.filter((i) => !hit.has(i.h) && i.src);
  if (missing.length) {
    const res = await translateMany(missing.map((m) => m.src), tl);
    const rows: { h: string; tl: string; src: string; out: string }[] = [];
    missing.forEach((m, k) => {
      const v = res[k];
      if (v) { hit.set(m.h, v); rows.push({ h: m.h, tl, src: m.src, out: v }); }
    });
    if (rows.length) await admin.from("translations").upsert(rows, { onConflict: "h" });
  }
  return json({ out: items.map((i) => hit.get(i.h) ?? null) });
});
