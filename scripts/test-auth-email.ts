/**
 * Dev-only: verify Gmail credentials and send a sample verification template.
 * Usage: npx tsx scripts/test-auth-email.ts --to recipient@example.com
 */
import { verifyMailTransport } from '../lib/server/email/gmailTransport';
import { getAuthEmailProvider } from '../lib/server/email/authEmailProvider';

async function main() {
  const toArg = process.argv.find((a) => a.startsWith('--to='))?.split('=')[1] ?? process.argv[process.argv.indexOf('--to') + 1];
  if (!toArg || !toArg.includes('@')) {
    console.error('Usage: npx tsx scripts/test-auth-email.ts --to recipient@example.com');
    process.exit(1);
  }

  await verifyMailTransport();
  await getAuthEmailProvider().sendVerificationCode({ to: toArg.trim().toLowerCase(), code: '000000' });
  console.log('Test email sent (code 000000 is not valid for sign-in).');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
