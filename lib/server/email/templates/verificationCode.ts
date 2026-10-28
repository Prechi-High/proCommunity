import { BRAND_NAME, BRAND_TAGLINE } from '../../../../constants/brandText';
export type VerificationEmailParams = { code: string; logoUrl?: string };
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function renderVerificationCodeEmail({ code, logoUrl }: VerificationEmailParams): string {
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid verification code');
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
<p style="font-size:13px;line-height:21px;color:#72676C;margin:18px 0 26px;">Use the most recent code. If it expires, request a new one in the app. Keep it to yourself—our team will never ask you to share it.</p>
<div style="height:1px;background:#EDE6E2;"></div><p style="font-size:14px;line-height:22px;margin:24px 0 8px;">Real people. Real product stories.<br/><strong>${escape(BRAND_TAGLINE)}</strong></p><p style="font-size:12px;line-height:19px;color:#81767B;margin:16px 0 0;">Didn’t request this? You can ignore this email.</p>
</td></tr></table></td></tr></table></body></html>`;
}
