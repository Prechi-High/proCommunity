import { BRAND_NAME, BRAND_TAGLINE } from '@/constants/brand';

export type VerificationEmailParams = {
  code: string;
  logoUrl?: string;
};

export function renderVerificationCodeEmail({ code, logoUrl }: VerificationEmailParams): string {
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="${BRAND_NAME}" width="120" style="display:block;margin:0 auto 16px;" />`
    : `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:26px;font-weight:700;color:#161616;text-align:center;margin-bottom:8px;">${BRAND_NAME}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#F6F4EF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F6F4EF;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:540px;background:#FFFFFF;border-radius:12px;padding:32px 28px;border:1px solid #DDDAD4;">
        <tr><td>
          ${logoBlock}
          <h1 style="margin:0 0 8px;font-size:22px;color:#161616;text-align:center;">Verify your email</h1>
          <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#595959;text-align:center;">Enter this code in ${BRAND_NAME}:</p>
          <div style="text-align:center;margin:0 0 28px;">
            <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:0.35em;color:#2457FF;padding:16px 24px;background:#E9EEFF;border-radius:8px;border:1px solid #DDDAD4;">${code}</span>
          </div>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#595959;text-align:center;">This code expires soon.</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#595959;text-align:center;">If you didn't request this code, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #DDDAD4;margin:28px 0 16px;" />
          <p style="margin:0;font-size:13px;color:#161616;text-align:center;">— ${BRAND_NAME}<br/><span style="color:#595959;">${BRAND_TAGLINE}</span></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
