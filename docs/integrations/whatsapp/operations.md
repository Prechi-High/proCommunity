# Operations

## Feature flags

Supabase secrets; values `true` / `1` / `on` / `yes`. Child flags only apply when the integration flag is on.

| Flag | Default | Effect when off |
| --- | --- | --- |
| `WHATSAPP_INTEGRATION_ENABLED` | off | Webhook acknowledges and drops everything; Flow endpoint refuses; no WhatsApp sends |
| `WHATSAPP_RESEARCH_ENABLED` | on | Linked users can still open cards, ask and save, but new research requests get the help menu |
| `WHATSAPP_FLOWS_ENABLED` | off | No Flow messages are sent; chat still works |
| `WHATSAPP_NOTIFICATIONS_ENABLED` | off | Notification jobs record a `skipped` delivery and send nothing |

Research Cards in the app do not depend on any flag.

**Kill switch**: `npx supabase secrets set --project-ref aqdptcuwpneuyzjavjak WHATSAPP_INTEGRATION_ENABLED=false`. Takes effect on the next request.

## Worker cron

The webhook and `research` kick the worker right after enqueueing, but a schedule is needed to pick up retries (`run_after` in the future) and anything missed. Schedule `whatsapp-worker` every minute.

With `pg_cron` + `pg_net` (Database → Extensions → enable both), run once in the SQL editor, replacing the key via Vault rather than pasting it into a file:

```sql
select vault.create_secret('<service role key>', 'service_role_key');

select cron.schedule(
  'whatsapp-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://aqdptcuwpneuyzjavjak.supabase.co/functions/v1/whatsapp-worker',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

Each run works for up to ~110 s in batches of 4 jobs.

## Retries and dead letters

- Retryable failures (network, 429, 5xx) back off 30 s → 60 s → 120 s … max 15 min, until `max_attempts`.
- Non-retryable failures and exhausted jobs become `dead` and are sent to Sentry with job id and kind only.

Inspect:

```sql
select kind, status, count(*) from integration_jobs group by 1, 2 order by 1, 2;

select id, kind, attempts, last_error, updated_at
from integration_jobs where status = 'dead' order by updated_at desc limit 50;
```

Requeue after fixing the cause:

```sql
update integration_jobs
set status = 'queued', attempts = 0, run_after = now(), last_error = null
where id = '<job id>';
```

A card stuck in `researching` for more than 15 minutes usually means its job is dead — requeue it or use Refresh in the app.

## Monitoring

| Signal | Where |
| --- | --- |
| Errors (redacted) | Sentry, `area` tag: `whatsapp_webhook`, `whatsapp_worker`, `whatsapp_flow`, `research` |
| Funnel events | PostHog (hashed user ref): `whatsapp_connection_started`, `whatsapp_connected`, `whatsapp_research_started`, `whatsapp_image_received`, `whatsapp_product_identified`, `whatsapp_research_completed` / `_failed`, `whatsapp_question_asked`, `whatsapp_comparison_created`, `whatsapp_product_saved`, `whatsapp_research_shared`, `whatsapp_disconnected`, `research_card_created`, `research_card_shared` |
| Function logs | Supabase → Edge Functions → Logs (structured JSON, no message text) |
| Delivery outcomes | `notification_deliveries` (`sent`, `skipped` with the reason in `error`, `failed`) |
| Meta quality | WhatsApp Manager → phone number quality rating and messaging limit |

Useful queries:

```sql
-- webhook volume and duplicates, last 24 h
select status, count(*) from whatsapp_webhook_events
where received_at > now() - interval '24 hours' group by 1;

-- why notifications were skipped
select status, error, count(*) from notification_deliveries
where created_at > now() - interval '7 days' group by 1, 2 order by 3 desc;
```

## Runbooks

**Webhook returns 401 for every Meta call** — `META_APP_SECRET` is wrong or was rotated. Update the secret; Meta retries failed deliveries for a while.

**Meta verification fails** — `WHATSAPP_VERIFY_TOKEN` differs from what was entered in Meta, or it was set after clicking Verify.

**Flow shows "Something went wrong"** — check function logs for 421 (key mismatch: re-upload the public key) or 432 (app secret). Run the Flow Builder health check.

**Sends fail with 131047 / re-engagement** — the 24-hour window closed and the template is not approved or not in `WHATSAPP_APPROVED_TEMPLATES`. The delivery is recorded as skipped (`no_template`).

**Token expired (190)** — the access token was not a permanent system-user token. Generate one per [meta-setup.md](./meta-setup.md#3-permanent-access-token).

**Abuse from one number** — rate limits already cap it; to block, set the connection `status = 'blocked'` in `whatsapp_connections`.

## Data retention

- `whatsapp_webhook_events`: prune rows older than 30 days.
- `whatsapp_link_tokens`: prune used or expired rows older than 1 day.
- `whatsapp_flow_sessions`: prune expired rows older than 1 day.
- `integration_jobs`: prune `done` rows older than 14 days; keep `dead` until reviewed.

These can be added as additional `pg_cron` jobs.
