import { createClient } from "npm:@supabase/supabase-js@2.45.4";

// Account emails live only here (server side), never in the public page.
const ACCOUNTS = ["admin@azawi.app", "staff@azawi.app"];

// قفل رمز الدخول
const WINDOW_MIN = 15;     // نافذة العدّ بالدقائق
const MAX_PER_IP = 5;      // محاولات خاطئة مسموحة لكل جهاز/عنوان خلال النافذة
const MAX_GLOBAL = 50;     // سقف عام يوقف التخمين الموزّع من عناوين كثيرة

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const clientIp = (req: Request) =>
  (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
  req.headers.get("x-real-ip") || "unknown";

const minutesLeft = (oldestIso: string) =>
  Math.max(1, Math.ceil((Date.parse(oldestIso) + WINDOW_MIN * 60_000 - Date.now()) / 60_000));

async function lockStatus(ip: string): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();

  // آخر دخول ناجح لهذا العنوان يصفّر العدّاد
  const { data: lastOk } = await admin.from("login_attempts").select("at")
    .eq("ip", ip).eq("ok", true).gte("at", since).order("at", { ascending: false }).limit(1);
  const from = lastOk && lastOk.length ? lastOk[0].at : since;

  const { data: ipFails, error } = await admin.from("login_attempts").select("at")
    .eq("ip", ip).eq("ok", false).gt("at", from).order("at", { ascending: true }).limit(MAX_PER_IP);
  if (error) throw error;
  if ((ipFails?.length || 0) >= MAX_PER_IP) return minutesLeft(ipFails![0].at);

  const { count } = await admin.from("login_attempts").select("id", { count: "exact", head: true })
    .eq("ok", false).gte("at", since);
  if ((count || 0) >= MAX_GLOBAL) return WINDOW_MIN;
  return 0;
}

const record = (ip: string, ok: boolean) => admin.from("login_attempts").insert({ ip, ok });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  let pin = "";
  try {
    const b = await req.json();
    pin = typeof b?.pin === "string" ? b.pin.trim() : "";
  } catch { /* bad body */ }
  if (!pin || pin.length > 128) return json({ error: "invalid" }, 400);

  const ip = clientIp(req);
  try {
    const wait = await lockStatus(ip);
    if (wait) return json({ error: "locked", retry_min: wait }, 429);
  } catch {
    return json({ error: "server" }, 500); // لو تعذّر فحص القفل، نرفض بدل ما نفتح الباب
  }

  const sb = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const email of ACCOUNTS) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pin });
    if (!error && data.session) {
      await record(ip, true);
      return json({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
    }
    if (error && !/invalid/i.test(error.message)) {
      return json({ error: /rate|many/i.test(error.message) ? "rate" : "server" }, /rate|many/i.test(error.message) ? 429 : 500);
    }
  }

  await record(ip, false);
  // تنظيف السجلات الأقدم من يوم (أحياناً فقط)
  if (Math.random() < 0.05) {
    await admin.from("login_attempts").delete().lt("at", new Date(Date.now() - 86_400_000).toISOString());
  }
  await new Promise((r) => setTimeout(r, 800));
  return json({ error: "invalid" }, 401);
});
