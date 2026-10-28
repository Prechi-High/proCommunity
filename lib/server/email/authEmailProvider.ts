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
      from: `Unmask <${fromAddress}>`,
      to: params.to,
      subject: 'Your Unmask verification code',
      html,
      text: `Your Unmask verification code is ${params.code}. Enter it in the app to continue. Keep it private. If you didn’t request it, ignore this email.`,
    });
  }
}

let provider: AuthEmailProvider | null = null;

export function getAuthEmailProvider(): AuthEmailProvider {
  if (!provider) provider = new GmailAuthEmailProvider();
  return provider;
}
