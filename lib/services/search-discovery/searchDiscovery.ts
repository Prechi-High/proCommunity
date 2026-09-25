/**
 * Search Discovery Service
 * Uses Serper to discover product intelligence from the web
 */

import { SerperProvider } from '../providers/serper';

interface SearchQuery {
  q: string;
  purpose: string;
  fields: string[];
}

interface DiscoveryResult {
  queries: SearchQuery[];
  evidence: DiscoveryEvidence[];
}

interface DiscoveryEvidence {
  url: string;
  title: string;
  content: string;
  relevance: number;
  type: 'text' | 'image' | 'structured_data';
}

export class SearchDiscoveryService {
  private readonly serper: SerperProvider;

  constructor() {
    this.serper = new SerperProvider();
  }

  async planSearch(productName: string, brand: string, fields: string[]): Promise<SearchQuery[]> {
    const queries: SearchQuery[] = [];

    // Build targeted search queries for each field
    for (const field of fields) {
      const query = this.buildSearchQuery(productName, brand, field);
      queries.push({
        q: query,
        purpose: `Find information about ${field} for ${brand} ${productName}`,
        fields: [field],
      });
    }

    // Add general searches
    queries.push(
      {
        q: `${brand} ${productName} official product page`,
        purpose: 'Find official product information',
        fields: ['product_name', 'brand', 'description'],
      },
      {
        q: `${brand} ${productName} review`,
        purpose: 'Find user reviews and experiences',
        fields: ['common_praise', 'common_complaints'],
      },
      {
        q: `${brand} ${productName} ingredients`,
        purpose: 'Find ingredient list',
        fields: ['ingredients'],
      },
      {
        q: `${brand} ${productName} price Nigeria`,
        purpose: 'Find current price',
        fields: ['price', 'availability'],
      }
    );

    return queries;
  }

  private buildSearchQuery(productName: string, brand: string, field: string): string {
    const fieldQueries: Record<string, string[]> = {
      specifications: [
        `${brand} ${productName} specifications`,
        `${brand} ${productName} technical details`,
        `${brand} ${productName} product specs`,
      ],
      ingredients: [
        `${brand} ${productName} ingredients list`,
        `${brand} ${productName} full ingredients`,
        `${brand} ${productName} ingredient breakdown`,
      ],
      price: [
        `${brand} ${productName} price Nigeria`,
        `${brand} ${productName} cost`,
        `${brand} ${productName} retail price`,
      ],
      availability: [
        `${brand} ${productName} availability Nigeria`,
        `${brand} ${productName} in stock`,
        `${brand} ${productName} where to buy`,
      ],
      reviews: [
        `${brand} ${productName} review`,
        `${brand} ${productName} user experience`,
        `${brand} ${productName} customer feedback`,
      ],
      competitors: [
        `${brand} ${productName} alternatives`,
        `${brand} ${productName} similar products`,
        `competitors of ${brand} ${productName}`,
      ],
    };

    const fieldQueriesList = fieldQueries[field.toLowerCase()] || [
      `${brand} ${productName} ${field}`,
      `${brand} ${productName} ${field} information`,
    ];

    return fieldQueriesList[0];
  }

  async executeSearch(query: SearchQuery): Promise<DiscoveryResult> {
    const results: DiscoveryEvidence[] = [];

    try {
      // Execute search
      const searchResults = await this.serper.search(query.q);

      // Process results
      for (const result of searchResults.slice(0, 10)) {
        results.push({
          url: result.link,
          title: result.title,
          content: result.snippet || '',
          relevance: this.calculateRelevance(query, result),
          type: 'text',
        });
      }

      // Get images if needed
      if (query.fields.some((f) => f.includes('image') || f.includes('photo'))) {
        const imageResults = await this.serper.images(query.q);
        for (const image of imageResults.slice(0, 5)) {
          results.push({
            url: image.imageUrl,
            title: image.title || 'Product image',
            content: '',
            relevance: 0.8,
            type: 'image',
          });
        }
      }
    } catch (error) {
      console.error(`Search failed for "${query.q}":`, error);
    }

    return {
      queries: [query],
      evidence: results.sort((a, b) => b.relevance - a.relevance),
    };
  }

  private calculateRelevance(query: SearchQuery, result: any): number {
    let relevance = 0.5;
    const queryLower = query.q.toLowerCase();
    const titleLower = result.title.toLowerCase();
    const snippetLower = (result.snippet || '').toLowerCase();

    // Exact match in title
    if (titleLower.includes(queryLower)) {
      relevance += 0.3;
    }

    // Keyword match in snippet
    for (const word of query.q.split(' ').slice(0, 5)) {
      if (snippetLower.includes(word)) {
        relevance += 0.05;
      }
    }

    // High authority domains
    const authorityDomains = ['official', 'manufacturer', 'retailer', 'reviews', 'amazon', 'jumia'];
    for (const domain of authorityDomains) {
      if (result.link.includes(domain)) {
        relevance += 0.1;
      }
    }

    return Math.min(0.95, relevance);
  }

  async discoverForProduct(
    productName: string,
    brand: string,
    fields: string[]
  ): Promise<DiscoveryResult[]> {
    const queries = await this.planSearch(productName, brand, fields);
    const allResults: DiscoveryResult[] = [];

    for (const query of queries) {
      const result = await this.executeSearch(query);
      allResults.push(result);
    }

    return allResults;
  }

  /**
   * Deduplicate and consolidate evidence from multiple searches
   */
  consolidateEvidence(results: DiscoveryResult[]): DiscoveryEvidence[] {
    const urlMap = new Map<string, DiscoveryEvidence>();

    for (const result of results) {
      for (const evidence of result.evidence) {
        const existing = urlMap.get(evidence.url);
        if (existing) {
          // Merge relevance scores
          existing.relevance = Math.max(existing.relevance, evidence.relevance);
        } else {
          urlMap.set(evidence.url, evidence);
        }
      }
    }

    return Array.from(urlMap.values()).sort((a, b) => b.relevance - a.relevance);
  }
}
