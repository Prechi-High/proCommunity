import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/**
 * Supabase Auth "Send Email" hook — delivers signup, magic link, reset, and OTP mail via Resend.
 * Dashboard: Authentication → Hooks → Send Email → HTTPS → this function URL + SEND_EMAIL_HOOK_SECRET.
 */

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type HookUser = { email?: string };
type HookEmail = { action_type?: string; token?: string; token_hash?: string; redirect_to?: string; otp?: string };
type HookPayload = { user?: HookUser; email_data?: HookEmail };

function secret(name: string): string {
  return (Deno.env.get(name) ?? "").trim().replace(/^["']|["']$/g, "");
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function subjectFor(action: string): string {
  switch (action) {
    case "signup":
      return "Confirm your Sourced account";
    case "recovery":
      return "Reset your Sourced password";
    case "magic_link":
      return "Your Sourced sign-in link";
    case "email_change":
      return "Confirm your new email for Sourced";
    default:
      return "Your Sourced sign-in code";
  }
}

function bodyFor(action: string, email: string, otp: string | undefined, link: string | undefined): string {
  const safeLink = link ?? "";
  if (action === "signup" || action === "magic_link" || action === "recovery") {
    return `<p>Hi,</p><p>Tap the button below to continue with Sourced (${action.replace("_", " ")}).</p><p><a href="${safeLink}" style="display:inline-block;padding:12px 20px;background:#C45C4A;color:#fff;text-decoration:none;border-radius:8px;">Open Sourced</a></p><p>Or paste this link: ${safeLink}</p>`;
  }
  return `<p>Hi,</p><p>Your Sourced sign-in code is <strong>${otp ?? "------"}</strong>.</p><p>It expires shortly. If you did not request this, ignore this email.</p>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const hookSecret = secret("SEND_EMAIL_HOOK_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  if (hookSecret && authHeader !== `Bearer ${hookSecret}`) {
    return json({ error: "unauthorized" }, 401);
  }

  const resendKey = secret("RESEND_API_KEY");
  const from = secret("RESEND_FROM_EMAIL") || "Sourced <onboarding@resend.dev>";
  if (!resendKey) return json({ error: "resend_not_configured" }, 503);

  let payload: HookPayload;
  try {
    payload = (await req.json()) as HookPayload;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const to = payload.user?.email?.trim();
  const data = payload.email_data ?? {};
  const action = data.action_type ?? "email";
  if (!to) return json({ error: "missing_email" }, 400);

  const supabaseUrl = secret("SUPABASE_URL").replace(/\/$/, "");
  const tokenHash = data.token_hash ?? "";
  const redirectTo = data.redirect_to ?? "";
  const link =
    tokenHash && supabaseUrl
      ? `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(action)}&redirect_to=${encodeURIComponent(redirectTo)}`
      : undefined;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject: subjectFor(action),
      html: bodyFor(action, to, data.otp, link),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    return json({ error: "resend_failed", detail: err.slice(0, 500) }, 502);
  }

  return json({ success: true });
});
