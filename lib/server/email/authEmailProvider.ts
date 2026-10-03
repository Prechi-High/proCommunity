/**
 * SERVER ONLY — swappable mail delivery for auth codes.
 */
import { renderVerificationCodeEmail } from './templates/verificationCode';
import { getMailTransport } from './gmailTransport';

export interface AuthEmailProvider {
  sendVerificationCode(params: { to: string; code: string }): Promise<void>;
}

export class GmailAuthEmailProvider implements AuthEmailProvider {
  async sendVerificationCode(params: { to: string; code: string }): Promise<void> {
    const fromAddress = (process.env.AUTH_EMAIL_ADDRESS ?? '').trim();
    if (!fromAddress) throw new Error('gmail_unconfigured');

    const html = renderVerificationCodeEmail({ code: params.code });
    await getMailTransport().sendMail({
      from: `Sourced <${fromAddress}>`,
      to: params.to,
      subject: 'Your Sourced verification code',
      html,
    });
  }
}

let provider: AuthEmailProvider | null = null;

export function getAuthEmailProvider(): AuthEmailProvider {
  if (!provider) provider = new GmailAuthEmailProvider();
  return provider;
}
