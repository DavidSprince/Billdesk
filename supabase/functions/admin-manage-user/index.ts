// Supabase Edge Function — Master Admin user management
// Handles: create user (email+password) · set another user's password.
// The caller's JWT is verified; only an active master_admin may proceed.
//
// Deploy:  supabase functions deploy admin-manage-user
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // admin API — server only
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1) verify the caller's JWT
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Not signed in" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 2) caller must be an active Master Admin
    const { data: caller } = await admin.from("profiles").select("role, is_active").eq("id", user.id).single();
    if (!caller || caller.role !== "master_admin" || caller.is_active === false) {
      return new Response(JSON.stringify({ ok: false, error: "Only the Master Admin can do this" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const body = await req.json();

    // 3) create a new user account
    if (body.action === "create") {
      if (!body.email || !body.password || !body.full_name) {
        return new Response(JSON.stringify({ ok: false, error: "full_name, email and password are required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const { data: created, error } = await admin.auth.admin.createUser({
        email: String(body.email).trim(),
        password: String(body.password),
        email_confirm: true, // no confirmation email — admin-created accounts
        user_metadata: {
          full_name: body.full_name,
          designation: body.designation ?? "",
          phone: body.phone ?? "",
        },
      });
      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      // profile row is auto-created by the on_auth_user_created trigger; set role & extras
      const { error: pErr } = await admin.from("profiles").update({
        role: ["user", "sub_admin", "master_admin"].includes(body.role) ? body.role : "user",
        designation: body.designation ?? "",
        phone: body.phone ?? "",
      }).eq("id", created.user.id);
      if (pErr) {
        return new Response(JSON.stringify({ ok: false, error: pErr.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, id: created.user.id }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 4) set/change another user's password
    if (body.action === "set-password") {
      if (!body.id || !body.password || String(body.password).length < 6) {
        return new Response(JSON.stringify({ ok: false, error: "id and a 6+ character password are required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      const { error } = await admin.auth.admin.updateUserById(body.id, { password: String(body.password) });
      if (error) {
        return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: false, error: "Unknown action" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
