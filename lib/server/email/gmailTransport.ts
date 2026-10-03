/**
 * SERVER ONLY — Gmail via Nodemailer + App Password.
 */
import nodemailer, { type Transporter } from 'nodemailer';

let transport: Transporter | null = null;

function creds(): { user: string; pass: string } {
  const user = (process.env.AUTH_EMAIL_ADDRESS ?? '').trim();
  const pass = (process.env.AUTH_EMAIL_APP_PASSWORD ?? '').trim();
  if (!user || !pass) throw new Error('gmail_unconfigured');
  return { user, pass };
}

export function getMailTransport(): Transporter {
  if (transport) return transport;
  const { user, pass } = creds();
  transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return transport;
}

export async function verifyMailTransport(): Promise<void> {
  await getMailTransport().verify();
}
