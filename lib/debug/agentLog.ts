import Constants from 'expo-constants';

/** Debug session f3e121 — NDJSON ingest for product-open audit. */
const INGEST_PATH = '/ingest/9f58124c-bd9e-4e3f-86ed-475dc16b5dba';

function ingestHost(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  if (typeof hostUri === 'string' && hostUri.includes(':')) {
    return hostUri.split(':')[0]!;
  }
  return '127.0.0.1';
}

export function agentLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'audit',
): void {
  const payload = {
    sessionId: 'f3e121',
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  // #region agent log
  if (__DEV__) {
    console.log('[agentLog:f3e121]', JSON.stringify(payload));
  }
  const endpoint = `http://${ingestHost()}:7606${INGEST_PATH}`;
  fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'f3e121' },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
  // #endregion
}
