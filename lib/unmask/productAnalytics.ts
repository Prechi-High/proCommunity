import { track } from '@/lib/analytics';
import { getPresentation } from '@/lib/unmask/presentation';
import type { ProductProfile } from '@/lib/types';

export function productAnalyticsProps(profile: ProductProfile | null, productId: string) {
  const pres = getPresentation(profile);
  const domain = pres?.product?.domain;
  return {
    product_id: productId,
    domain: domain?.name,
    domain_status: domain?.status,
    product_family: pres?.product?.productFamily,
    product_type: pres?.product?.productType,
    product_subtype: pres?.product?.productSubtype,
    blueprint_version: pres?.intelligenceMeta?.blueprintVersion,
    domain_template_version: pres?.intelligenceMeta?.domainTemplateVersion,
    classification_confidence: pres?.intelligenceMeta?.classificationConfidence,
  };
}

export function trackUnmaskStarted(profile: ProductProfile | null, productId: string) {
  track('unmask_started', productAnalyticsProps(profile, productId));
}

export function trackUnmaskCompleted(profile: ProductProfile | null, productId: string) {
  track('unmask_completed', productAnalyticsProps(profile, productId));
}

export function trackOverviewViewed(profile: ProductProfile | null, productId: string) {
  track('overview_viewed', productAnalyticsProps(profile, productId));
}

export function trackFactSectionViewed(profile: ProductProfile | null, productId: string, sectionKey: string) {
  track('fact_section_viewed', { ...productAnalyticsProps(profile, productId), section_key: sectionKey });
}

export function trackInferredNoticeShown(domain: string, productId: string) {
  track('inferred_domain_notice_shown', { domain, product_id: productId });
}

export function trackInferredVoteSubmitted(domain: string, productId: string) {
  track('inferred_domain_vote_submitted', { domain, product_id: productId });
}
