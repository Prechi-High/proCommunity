export type VerificationEmailParams = {
  code: string;
  logoUrl?: string;
};

export function renderVerificationCodeEmail({ code, logoUrl }: VerificationEmailParams): string {
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="Sourced" width="120" style="display:block;margin:0 auto 16px;" />`
    : `<div style="font-family:Georgia,serif;font-size:28px;font-weight:600;color:#8C3547;letter-spacing:0.12em;text-align:center;margin-bottom:8px;">SOURCED</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#FBF5F1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#FBF5F1;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:540px;background:#FFFFFF;border-radius:16px;padding:32px 28px;border:1px solid #E7DED7;">
        <tr><td>
          ${logoBlock}
          <h1 style="margin:0 0 8px;font-size:22px;color:#2A211D;text-align:center;">Verify your email</h1>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#2A211D;text-align:center;opacity:0.85;">Enter this code in Sourced:</p>
          <div style="text-align:center;margin:0 0 28px;">
            <span style="display:inline-block;font-size:32px;font-weight:700;letter-spacing:0.35em;color:#8C3547;padding:16px 24px;background:#FBF5F1;border-radius:12px;border:1px solid #E7DED7;">${code}</span>
          </div>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#2A211D;text-align:center;">This code expires soon.</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:#6E8F73;text-align:center;">If you didn't request this code, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #E7DED7;margin:28px 0 16px;" />
          <p style="margin:0;font-size:13px;color:#2A211D;text-align:center;">— Sourced<br/><span style="color:#D9A441;">Know before you buy.</span></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
