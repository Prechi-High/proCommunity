"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lib/server/auth/requestEmailCodeRoute.ts
var requestEmailCodeRoute_exports = {};
__export(requestEmailCodeRoute_exports, {
  default: () => handler
});
module.exports = __toCommonJS(requestEmailCodeRoute_exports);

// lib/server/auth/requestEmailCodeHandler.ts
var import_zod = require("zod");

// lib/server/auth/constants.ts
var OTP_RESEND_COOLDOWN_SECONDS = 60;
var OTP_MAX_EMAIL_REQUESTS_PER_HOUR = 5;
var OTP_MAX_IP_REQUESTS_PER_HOUR = 20;
var AUTH_REQUEST_MAX_BODY_BYTES = 512;

// lib/server/auth/supabaseAdmin.ts
var import_supabase_js = require("@supabase/supabase-js");
var admin = null;
function secret(name) {
  return (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "");
}
function getSupabaseAdmin() {
  if (admin) return admin;
  const url = secret("SUPABASE_URL") || secret("EXPO_PUBLIC_SUPABASE_URL");
  const key = secret("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("supabase_admin_unconfigured");
  }
  admin = (0, import_supabase_js.createClient)(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return admin;
}

// lib/server/auth/generateEmailOtp.ts
async function generateEmailOtp(email) {
  const supabase = getSupabaseAdmin();
  const normalized = email.trim().toLowerCase();
  const attempt = async (type) => {
    return supabase.auth.admin.generateLink({
      type,
      email: normalized
    });
  };
  let { data, error } = await attempt("magiclink");
  if (error) {
    const retry = await attempt("invite");
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    console.error("[auth] generate_link_failed", error.message);
    throw new Error("otp_generation_failed");
  }
  const props = data?.properties;
  const otp = props?.email_otp?.trim();
  if (!otp || !/^\d{6}$/.test(otp)) {
    console.error("[auth] generate_link_missing_otp");
    throw new Error("otp_generation_failed");
  }
  return { otp };
}

// lib/server/redis/client.ts
var import_redis = require("@upstash/redis");
var cached;
function getRedisClient() {
  if (cached !== void 0) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim() || process.env.REDIS_URL?.trim() || "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || process.env.REDIS_TOKEN?.trim() || "";
  if (!url || !token) {
    cached = null;
    return cached;
  }
  try {
    cached = new import_redis.Redis({ url, token });
  } catch (error) {
    console.error("[redis] client_init_failed", error instanceof Error ? error.message : error);
    cached = null;
  }
  return cached;
}

// lib/server/auth/hash.ts
var import_crypto = require("crypto");
function pepper() {
  return process.env.AUTH_RATE_LIMIT_PEPPER?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 24) || "sourced-auth-rate-limit";
}
function hashEmail(email) {
  return (0, import_crypto.createHash)("sha256").update(`email:${pepper()}:${email}`).digest("hex");
}
function hashIp(ip) {
  return (0, import_crypto.createHash)("sha256").update(`ip:${pepper()}:${ip}`).digest("hex");
}

// lib/server/auth/rateLimit.ts
var HOUR_SEC = 3600;
async function redisCooldown(emailHash) {
  const redis = getRedisClient();
  if (!redis) return false;
  const key = `auth:otp:cooldown:${emailHash}`;
  const set = await redis.set(key, "1", { nx: true, ex: OTP_RESEND_COOLDOWN_SECONDS });
  return set === "OK";
}
async function redisCount(key, windowSec, max) {
  const redis = getRedisClient();
  if (!redis) return true;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec + 5);
  return n <= max;
}
async function supabaseRecordAndCount(emailHash, ipHash) {
  const admin2 = getSupabaseAdmin();
  const since = new Date(Date.now() - HOUR_SEC * 1e3).toISOString();
  const sinceCooldown = new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1e3).toISOString();
  const { count: emailRecent } = await admin2.from("auth_email_rate_limits").select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gte("created_at", sinceCooldown);
  if ((emailRecent ?? 0) > 0) return { allowed: false, reason: "cooldown" };
  const { count: emailHour } = await admin2.from("auth_email_rate_limits").select("id", { count: "exact", head: true }).eq("email_hash", emailHash).gte("created_at", since);
  if ((emailHour ?? 0) >= OTP_MAX_EMAIL_REQUESTS_PER_HOUR) return { allowed: false, reason: "email" };
  const { count: ipHour } = await admin2.from("auth_email_rate_limits").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", since);
  if ((ipHour ?? 0) >= OTP_MAX_IP_REQUESTS_PER_HOUR) return { allowed: false, reason: "ip" };
  await admin2.from("auth_email_rate_limits").insert({ email_hash: emailHash, ip_hash: ipHash });
  await admin2.from("auth_email_rate_limits").delete().lt("created_at", new Date(Date.now() - 2 * HOUR_SEC * 1e3).toISOString());
  return { allowed: true };
}
async function checkOtpRequestRateLimit(email, ip) {
  const emailHash = hashEmail(email);
  const ipHash = hashIp(ip || "unknown");
  const redis = getRedisClient();
  if (redis) {
    const cooldownOk = await redisCooldown(emailHash);
    if (!cooldownOk) return { allowed: false, reason: "cooldown" };
    const emailOk = await redisCount(`auth:otp:email:${emailHash}`, HOUR_SEC, OTP_MAX_EMAIL_REQUESTS_PER_HOUR);
    if (!emailOk) return { allowed: false, reason: "email" };
    const ipOk = await redisCount(`auth:otp:ip:${ipHash}`, HOUR_SEC, OTP_MAX_IP_REQUESTS_PER_HOUR);
    if (!ipOk) return { allowed: false, reason: "ip" };
    return { allowed: true };
  }
  return supabaseRecordAndCount(emailHash, ipHash);
}

// constants/brandText.ts
var BRAND_NAME = "Unmask";
var BRAND_TAGLINE = "Know before you buy.";

// lib/server/email/templates/verificationCode.ts
var escape = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function renderVerificationCodeEmail({ code, logoUrl }) {
  if (!/^\d{6}$/.test(code)) throw new Error("Invalid verification code");
  const logo = logoUrl && /^https:\/\//.test(logoUrl) ? `<img src="${escape(logoUrl)}" alt="Unmask" width="110" style="display:block;margin:0 0 20px;"/>` : `<p style="font-size:25px;font-weight:750;letter-spacing:-1px;margin:0 0 26px;color:#431223;">${escape(BRAND_NAME)}</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Your Unmask code</title></head>
<body style="margin:0;background:#F5F1ED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#242021;">
<div style="display:none;max-height:0;overflow:hidden;">Your code is ${code}. One small step closer to your community.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border:1px solid #E7DDD9;border-radius:24px;overflow:hidden;">
<tr><td style="height:6px;background:#431223;"></td></tr><tr><td style="padding:34px 28px;">${logo}
<p style="font-size:11px;letter-spacing:1.4px;color:#795D69;font-weight:700;margin:0 0 14px;">YOUR COMMUNITY IS ONE STEP AWAY</p>
<h1 style="font-size:29px;line-height:35px;letter-spacing:-.6px;margin:0 0 14px;">A little code.<br/>Your way back in.</h1>
<p style="font-size:16px;line-height:25px;color:#62595D;margin:0 0 25px;">Enter these six digits in Unmask to verify your email and continue.</p>
<div style="background:#F5EDF2;border:1px solid #E6D4DF;border-radius:17px;text-align:center;padding:22px 10px;font-size:36px;font-weight:750;letter-spacing:9px;color:#431223;">${code}</div>
<p style="font-size:13px;line-height:21px;color:#72676C;margin:18px 0 26px;">Use the most recent code. If it expires, request a new one in the app. Keep it to yourself\u2014our team will never ask you to share it.</p>
<div style="height:1px;background:#EDE6E2;"></div><p style="font-size:14px;line-height:22px;margin:24px 0 8px;">Real people. Real product stories.<br/><strong>${escape(BRAND_TAGLINE)}</strong></p><p style="font-size:12px;line-height:19px;color:#81767B;margin:16px 0 0;">Didn\u2019t request this? You can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
}

// lib/server/email/gmailTransport.ts
var import_nodemailer = __toESM(require("nodemailer"));
var transport = null;
function creds() {
  const user = (process.env.AUTH_EMAIL_ADDRESS ?? "").trim();
  const pass = (process.env.AUTH_EMAIL_APP_PASSWORD ?? "").trim();
  if (!user || !pass) throw new Error("gmail_unconfigured");
  return { user, pass };
}
function getMailTransport() {
  if (transport) return transport;
  const { user, pass } = creds();
  transport = import_nodemailer.default.createTransport({
    service: "gmail",
    auth: { user, pass }
  });
  return transport;
}

// lib/server/email/authEmailProvider.ts
var GmailAuthEmailProvider = class {
  async sendVerificationCode(params) {
    const fromAddress = (process.env.AUTH_EMAIL_ADDRESS ?? "").trim();
    if (!fromAddress) throw new Error("gmail_unconfigured");
    const html = renderVerificationCodeEmail({ code: params.code });
    await getMailTransport().sendMail({
      from: `Unmask <${fromAddress}>`,
      to: params.to,
      subject: "Your Unmask verification code",
      html,
      text: `Your Unmask verification code is ${params.code}. Enter it in the app to continue. Keep it private. If you didn\u2019t request it, ignore this email.`
    });
  }
};
var provider = null;
function getAuthEmailProvider() {
  if (!provider) provider = new GmailAuthEmailProvider();
  return provider;
}

// lib/server/auth/requestEmailCodeHandler.ts
var emailSchema = import_zod.z.object({
  email: import_zod.z.string().trim().email().max(320)
});
function clientIp(headers) {
  const fwd = headers["x-forwarded-for"];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  if (raw) return raw.split(",")[0]?.trim() || "unknown";
  const real = headers["x-real-ip"];
  return (Array.isArray(real) ? real[0] : real)?.trim() || "unknown";
}
async function handleRequestEmailCode(rawBody2, headers) {
  if (rawBody2.length > AUTH_REQUEST_MAX_BODY_BYTES) {
    return { status: 400, body: { error: "Please enter a valid email address." } };
  }
  let json;
  try {
    json = JSON.parse(rawBody2);
  } catch {
    return { status: 400, body: { error: "Please enter a valid email address." } };
  }
  const parsed = emailSchema.safeParse(json);
  if (!parsed.success) {
    return { status: 400, body: { error: "Please enter a valid email address." } };
  }
  const email = parsed.data.email.toLowerCase();
  const ip = clientIp(headers);
  const limit = await checkOtpRequestRateLimit(email, ip);
  if (!limit.allowed) {
    return { status: 429, body: { error: "Please wait before requesting another code." } };
  }
  try {
    const { otp } = await generateEmailOtp(email);
    try {
      await getAuthEmailProvider().sendVerificationCode({ to: email, code: otp });
    } catch (sendErr) {
      console.error("[auth] email_delivery_failed", sendErr instanceof Error ? sendErr.message : "unknown");
      return { status: 503, body: { error: "We couldn't send your code right now. Please try again." } };
    }
    return { status: 200, body: { success: true } };
  } catch {
    return { status: 503, body: { error: "We couldn't send your code right now. Please try again." } };
  }
}

// lib/server/auth/requestEmailCodeRoute.ts
var DEFAULT_ORIGINS = ["http://localhost:8081", "http://localhost:19006", "http://localhost:3000", "http://127.0.0.1:8081"];
function applyCors(req, res) {
  const configured = process.env.AUTH_CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? DEFAULT_ORIGINS;
  const origin = typeof req.headers?.origin === "string" ? req.headers.origin : void 0;
  if (origin && configured.includes(origin)) {
    res.setHeader?.("Access-Control-Allow-Origin", origin);
  }
  res.setHeader?.("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader?.("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader?.("Vary", "Origin");
}
function rawBody(req) {
  if (typeof req.body === "string") return req.body;
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  return "";
}
async function handler(req, res) {
  applyCors(req, res);
  const method = (req.method ?? "GET").toUpperCase();
  if (method === "OPTIONS") {
    res.status(200).send("ok");
    return;
  }
  if (method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }
  const result = await handleRequestEmailCode(rawBody(req), req.headers ?? {});
  res.status(result.status).json(result.body);
}
module.exports = module.exports.default;
