import { callIntel } from '@/lib/products';
import { getVisitorKeyForApi } from '@/lib/siteAnalytics';

export async function recordDomainNoticeShown(domainId: string): Promise<void> {
  const visitorKey = await getVisitorKeyForApi();
  await callIntel({ action: 'domain_notice', op: 'shown', domainId, visitorKey }, 12000);
}

export async function dismissDomainNotice(domainId: string): Promise<void> {
  const visitorKey = await getVisitorKeyForApi();
  await callIntel({ action: 'domain_notice', op: 'dismiss', domainId, visitorKey }, 12000);
}

export async function votePrioritizeDomain(domainId: string, productId: string): Promise<void> {
  const visitorKey = await getVisitorKeyForApi();
  await callIntel({ action: 'domain_vote', domainId, productId, visitorKey }, 12000);
}

export async function fetchDomainNoticeDismissed(domainId: string): Promise<boolean> {
  const visitorKey = await getVisitorKeyForApi();
  const res = await callIntel<{ dismissed?: boolean }>(
    { action: 'domain_notice', op: 'status', domainId, visitorKey },
    12000,
  );
  return Boolean(res.dismissed);
}
