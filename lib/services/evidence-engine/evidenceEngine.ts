/**
 * Evidence Engine
 * Retrieves and processes evidence from various sources
 */

import { SerperProvider } from '../providers/serper';

interface Evidence {
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  content: string;
  evidenceType: 'text' | 'structured_data' | 'html' | 'json' | 'image' | 'video';
  retrievedAt: Date;
  sourceReliability: number;
  contentHash: string;
}

interface EvidenceSource {
  domain: string;
  reliability: number;
  type: 'manufacturer' | 'retailer' | 'review' | 'forum' | 'social' | 'official';
}

export class EvidenceEngine {
  private readonly serper: SerperProvider;
  private readonly trustedSources: EvidenceSource[] = [
    { domain: 'amazon.com', reliability: 0.8, type: 'retailer' },
    { domain: 'jumia.com', reliability: 0.8, type: 'retailer' },
    { domain: 'konga.com', reliability: 0.8, type: 'retailer' },
    { domain: 'lookup.app', reliability: 0.9, type: 'official' },
    { domain: 'nykaa.com', reliability: 0.85, type: 'retailer' },
    { domain: 'sephora.com', reliability: 0.9, type: 'retailer' },
    { domain: 'ulta.com', reliability: 0.9, type: 'retailer' },
    { domain: 'amazon.ng', reliability: 0.8, type: 'retailer' },
    { domain: 'jumia.com.ng', reliability: 0.8, type: 'retailer' },
    { domain: 'konga.com', reliability: 0.8, type: 'retailer' },
    { domain: 'beautyheaven.com.au', reliability: 0.75, type: 'review' },
    { domain: 'allure.com', reliability: 0.7, type: 'review' },
    { domain: 'byrdie.com', reliability: 0.7, type: 'review' },
    { domain: 'elle.com', reliability: 0.7, type: 'review' },
    { domain: 'vogue.com', reliability: 0.7, type: 'review' },
    { domain: 'reddit.com', reliability: 0.6, type: 'forum' },
    { domain: 'youtube.com', reliability: 0.65, type: 'video' },
    { domain: 'tiktok.com', reliability: 0.6, type: 'social' },
  ];

  constructor() {
    this.serper = new SerperProvider();
  }

  async retrieve(url: string): Promise<Evidence | null> {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        return null;
      }

      const contentType = response.headers.get('content-type') || '';
      const content = await response.text();

      return {
        id: `ev_${this.generateHash(url + content)}`,
        sourceUrl: url,
        sourceTitle: this.extractTitle(content, url),
        content,
        evidenceType: this.determineEvidenceType(contentType, content),
        retrievedAt: new Date(),
        sourceReliability: this.getReliability(url),
        contentHash: this.generateHash(content),
      };
    } catch {
      return null;
    }
  }

  async retrieveBatch(urls: string[]): Promise<Evidence[]> {
    const results: Evidence[] = [];
    const promises = urls.map(async (url) => {
      const evidence = await this.retrieve(url);
      if (evidence) {
        results.push(evidence);
      }
    });

    await Promise.all(promises);
    return results;
  }

  private determineEvidenceType(contentType: string, content: string): 'text' | 'structured_data' | 'html' | 'json' | 'image' | 'video' {
    if (contentType.includes('application/json')) {
      return 'json';
    }
    if (contentType.includes('text/html')) {
      return 'html';
    }
    if (contentType.includes('text/plain')) {
      return 'text';
    }
    if (contentType.includes('image')) {
      return 'image';
    }
    if (contentType.includes('video')) {
      return 'video';
    }
    // Default based on content analysis
    if (content.includes('<script type="application/ld+json">')) {
      return 'structured_data';
    }
    return 'text';
  }

  private getReliability(url: string): number {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname.toLowerCase();

    const source = this.trustedSources.find((s) => domain.includes(s.domain));
    return source?.reliability ?? 0.5;
  }

  private extractTitle(content: string, url: string): string {
    // Try to extract from title tag
    const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      return titleMatch[1].trim();
    }

    // Fallback to URL
    return url;
  }

  private generateHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Extract structured data from HTML content
   */
  extractStructuredData(evidence: Evidence): Record<string, unknown> {
    const structuredData: Record<string, unknown> = {};

    if (evidence.evidenceType === 'json' || evidence.evidenceType === 'structured_data') {
      try {
        const json = JSON.parse(evidence.content);
        return json;
      } catch {
        // Not JSON
      }
    }

    // Extract common structured data patterns from HTML
    const html = evidence.content;

    // Product schema
    const productMatch = html.match(/"name"\s*:\s*"([^"]+)"/);
    if (productMatch) structuredData.productName = productMatch[1];

    const priceMatch = html.match(/"price"\s*:\s*["']?([\d.]+)["']?/);
    if (priceMatch) structuredData.price = parseFloat(priceMatch[1]);

    const currencyMatch = html.match(/"priceCurrency"\s*:\s*"([^"]+)"/);
    if (currencyMatch) structuredData.currency = currencyMatch[1];

    const availabilityMatch = html.match(/"availability"\s*:\s*"([^"]+)"/);
    if (availabilityMatch) structuredData.availability = availabilityMatch[1];

    return structuredData;
  }

  /**
   * Score evidence sources by reliability
   */
  scoreSources(evidence: Evidence[]): { sources: EvidenceSource[]; overallReliability: number } {
    const sourceReliabilities: { source: EvidenceSource; reliability: number }[] = [];

    for (const ev of evidence) {
      const source = this.trustedSources.find((s) => ev.sourceUrl.includes(s.domain));
      if (source) {
        sourceReliabilities.push({ source, reliability: source.reliability });
      }
    }

    // Calculate overall reliability (weighted average)
    if (sourceReliabilities.length === 0) {
      return { sources: [], overallReliability: 0.5 };
    }

    const totalReliability = sourceReliabilities.reduce((sum, s) => sum + s.reliability, 0);
    const overall = totalReliability / sourceReliabilities.length;

    return {
      sources: sourceReliabilities.map((s) => s.source),
      overallReliability: overall,
    };
  }

  /**
   * Find product images from evidence
   */
  findProductImages(evidence: Evidence[]): Evidence[] {
    return evidence.filter((e) => e.evidenceType === 'image' || e.content.includes('<img'));
  }
}
