// Supabase Edge Function — WhatsApp bill reminders via Twilio
// (the "Logic" box in the architecture diagram)
//
// Deploy:  supabase functions deploy whatsapp-reminders --no-verify-jwt
// Secrets: supabase secrets set TWILIO_ACCOUNT_SID=… TWILIO_AUTH_TOKEN=… \
//            TWILIO_WHATSAPP_FROM=+14155238886 CRON_SECRET=…
//
// Called by pg_cron hourly (see migration.sql) OR by a Database Webhook on
// bill insert (pass {"bill_id": "..."} in the body for an instant reminder).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = Deno.env.get("CRON_SECRET");
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return new Response("Unauthorized", { status: 401, headers: cors });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // bypasses RLS — server only
    );

    // Single-bill mode (database webhook) or batch mode (cron)
    let billIds: string[] | null = null;
    try {
      const body = await req.json();
      if (body?.bill_id) billIds = [body.bill_id];
    } catch { /* empty body → cron mode */ }

    let q = admin
      .from("bills")
      .select("id, title, amount, due_date, status, user_id, owner:profiles!bills_user_id_fkey(id, full_name, phone)")
      .eq("status", "pending");

    if (billIds) {
      q = q.in("id", billIds);
    } else {
      const limit = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10); // due within 3 days (or overdue)
      q = q.lte("due_date", limit);
    }

    const { data: bills, error } = await q;
    if (error) throw error;

    let sent = 0, skipped = 0, failed = 0;

    for (const b of bills ?? []) {
      const phone = b.owner?.phone;
      if (!phone) { skipped++; continue; }

      // don't re-send for the same bill within 24h (cron mode only)
      if (!billIds) {
        const { data: recent } = await admin
          .from("notifications_log")
          .select("id")
          .eq("bill_id", b.id)
          .gte("sent_at", new Date(Date.now() - 86400000).toISOString())
          .limit(1);
        if (recent && recent.length) { skipped++; continue; }
      }

      const due = new Date(b.due_date + "T00:00:00").toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      });
      const label = b.description || b.bill_type;
      const msg =
        `🔔 *Bill Reminder*\n\n` +
        `Hi ${b.owner?.full_name ?? "there"},\n` +
        `Bill "${label}" (${b.bill_type}) of *₹${Number(b.amount).toLocaleString("en-IN")}* is due on ${due}.\n\n` +
        `Please submit/track it in BillDesk. — Office Admin`;

      const ok = await sendWhatsApp(phone, msg);
      await admin.from("notifications_log").insert({
        bill_id: b.id, user_id: b.user_id, phone,
        channel: "whatsapp", status: ok ? "sent" : "failed",
      });
      if (ok) sent++; else failed++;
    }

    return new Response(
      JSON.stringify({ ok: true, matched: bills?.length ?? 0, sent, failed, skipped }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

async function sendWhatsApp(phone: string, body: string): Promise<boolean> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
  if (!sid || !token || !from) return false;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${sid}:${token}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: `whatsapp:${phone.replace(/[^\d+]/g, "")}`,
        From: `whatsapp:${from.replace("whatsapp:", "")}`,
        Body: body,
      }),
    },
  );
  return res.ok;
}
