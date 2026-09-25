/**
 * Product Identification Service
 * Identifies products from text or images
 */

import { SerperProvider } from '../providers/serper';

interface ProductCandidate {
  id: string;
  name: string;
  brand: string;
  category: string;
  confidence: number;
  evidence: string[];
}

interface IdentificationResult {
  product: ProductCandidate;
  confidence: number;
  method: 'text' | 'image' | 'ocr';
  candidates: ProductCandidate[];
}

export class ProductIdentificationService {
  private readonly serper: SerperProvider;
  private readonly cache = new Map<string, ProductCandidate>();

  constructor() {
    this.serper = new SerperProvider();
  }

  async identifyFromText(query: string): Promise<IdentificationResult> {
    const cached = this.cache.get(query.toLowerCase());
    if (cached) {
      return {
        product: cached,
        confidence: 0.95,
        method: 'cached',
        candidates: [cached],
      };
    }

    // Try exact match first
    const exactCandidates = await this.searchExactMatch(query);
    if (exactCandidates.length > 0) {
      const best = exactCandidates[0];
      this.cache.set(query.toLowerCase(), best);
      return {
        product: best,
        confidence: best.confidence,
        method: 'text',
        candidates: exactCandidates,
      };
    }

    // Fall back to broad search
    const broadCandidates = await this.searchBroad(query);
    if (broadCandidates.length > 0) {
      this.cache.set(query.toLowerCase(), broadCandidates[0]);
      return {
        product: broadCandidates[0],
        confidence: broadCandidates[0].confidence,
        method: 'text',
        candidates: broadCandidates,
      };
    }

    return {
      product: {
        id: 'unknown',
        name: query,
        brand: 'Unknown',
        category: 'unknown',
        confidence: 0,
        evidence: ['No matches found'],
      },
      confidence: 0,
      method: 'text',
      candidates: [],
    };
  }

  private async searchExactMatch(query: string): Promise<ProductCandidate[]> {
    const results: ProductCandidate[] = [];
    const searchQuery = `${query} official product page`;

    try {
      const searchResults = await this.serper.search(searchQuery);

      for (const result of searchResults) {
        const confidence = this.calculateExactMatchConfidence(result, query);
        if (confidence > 0.5) {
          results.push({
            id: this.generateId(result.title, result.link),
            name: this.extractProductName(result.title),
            brand: this.extractBrand(result.title, result.link),
            category: 'unknown',
            confidence,
            evidence: [`Match from: ${result.title}`, result.snippet],
          });
        }
      }
    } catch {
      // Ignore errors, return empty results
    }

    return results.sort((a, b) => b.confidence - a.confidence);
  }

  private async searchBroad(query: string): Promise<ProductCandidate[]> {
    const results: ProductCandidate[] = [];
    const searchResults = await this.serper.search(query);

    for (const result of searchResults.slice(0, 10)) {
      results.push({
        id: this.generateId(result.title, result.link),
        name: this.extractProductName(result.title),
        brand: this.extractBrand(result.title, result.link),
        category: 'unknown',
        confidence: 0.3,
        evidence: [`Found: ${result.title}`, result.snippet],
      });
    }

    return results;
  }

  private calculateExactMatchConfidence(result: any, query: string): number {
    let confidence = 0.5;
    const title = result.title.toLowerCase();
    const queryLower = query.toLowerCase();

    // Exact title match
    if (title.includes(queryLower)) confidence += 0.3;

    // Brand in title
    if (title.includes('official') || title.includes('product')) confidence += 0.15;

    // URL contains product-related terms
    if (result.link.includes('product') || result.link.includes('shop')) confidence += 0.1;

    return Math.min(0.95, confidence);
  }

  private extractProductName(title: string): string {
    // Remove common suffixes
    let name = title.replace(/[-—]\s*Official.*$/i, '');
    name = name.replace(/[-—]\s*Buy.*$/i, '');
    name = name.replace(/[-—]\s*Price.*$/i, '');
    name = name.replace(/\|.*$/i, '').trim();
    return name;
  }

  private extractBrand(title: string, url: string): string {
    // Extract from URL if possible
    const urlMatch = url.match(/(?:brand|brands?)\/([^/]+)/i);
    if (urlMatch) return urlMatch[1];

    // Extract from title
    const parts = title.split(/[-—|]/);
    if (parts.length > 0) {
      let brand = parts[0].trim();
      brand = brand.replace(/\s*Official.*$/i, '');
      return brand;
    }

    return 'Unknown';
  }

  private generateId(title: string, url: string): string {
    const hash = (str: string): string => {
      let h = 0;
      for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h |= 0;
      }
      return Math.abs(h).toString(36);
    };
    return `prod_${hash(title + url)}`;
  }

  async identifyFromImage(imageUrl: string): Promise<IdentificationResult> {
    // For now, treat image identification as a text search
    // Future: Implement OCR to extract text from images
    const searchQuery = `product image ${imageUrl}`;
    return this.identifyFromText(searchQuery);
  }
}
