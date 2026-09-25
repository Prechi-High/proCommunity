/**
 * Serper Provider Adapter
 * Implements search discovery for the Product Intelligence Organisation
 * 
 * Reference: https://serper.dev/documentation
 */


const SERPER_API_KEY = process.env.SERPER_API_KEY?.trim();

export type SerperSearchType = 'search' | 'images' | 'news' | 'places';

export interface SerperSearchOptions {
  type?: SerperSearchType;
  num?: number;
  page?: number;
  tbs?: string;
  qcorplang?: string;
}

export interface SerperResult {
  organic?: SerperOrganicResult[];
  images?: SerperImageResult[];
  news?: SerperNewsResult[];
  places?: SerperPlaceResult[];
  answerBox?: SerperAnswerBox;
  peopleAlsoAsk?: SerperPeopleAlsoAsk[];
  relatedSearches?: SerperRelatedSearch;
}

export interface SerperOrganicResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  sitelinks?: SerperSitelinks[];
  imageUrl?: string;
  date?: string;
}

export interface SerperSitelinks {
  title: string;
  link: string;
}

export interface SerperImageResult {
  title?: string;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  thumbnail?: string;
  thumbnailWidth?: number;
  thumbnailHeight?: number;
  source?: string;
  page?: string;
}

export interface SerperNewsResult {
  title: string;
  link: string;
  snippet?: string;
  date: string;
  source: string;
  imageUrl?: string;
}

export interface SerperPlaceResult {
  title: string;
  address: string;
  coordinates?: { lat: number; lng: number };
  rating?: number;
  reviews?: number;
  phone?: string;
  website?: string;
  imageUrl?: string;
}

export interface SerperAnswerBox {
  title: string;
  snippet: string;
  snippetHighlightingWords?: string[];
  answer?: string;
  type?: string;
  url?: string;
  imageUrl?: string;
}

export interface SerperPeopleAlsoAsk {
  question: string;
  snippet: string;
  title: string;
  link: string;
}

export interface SerperRelatedSearch {
  query: string;
  title: string;
}

export class SerperProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://google.serper.dev';

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? SERPER_API_KEY ?? '';
  }

  private getHeaders(): Record<string, string> {
    return {
      'X-API-KEY': this.apiKey,
      'Content-Type': 'application/json',
    };
  }

  private async request(
    endpoint: string,
    body: Record<string, unknown>,
    options: SerperSearchOptions = {}
  ): Promise<SerperResult> {
    if (!this.apiKey) {
      throw new Error('SERPER_API_KEY is not configured');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ ...body, ...options }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Serper API error (${response.status}): ${errorBody}`);
    }

    return (await response.json()) as SerperResult;
  }

  async search(
    query: string,
    options: SerperSearchOptions = {}
  ): Promise<SerperOrganicResult[]> {
    const result = await this.request('/search', { q: query }, options);
    return result.organic ?? [];
  }

  async images(
    query: string,
    options: SerperSearchOptions = {}
  ): Promise<SerperImageResult[]> {
    const result = await this.request('/images', { q: query }, options);
    return result.images ?? [];
  }

  async news(
    query: string,
    options: SerperSearchOptions = {}
  ): Promise<SerperNewsResult[]> {
    const result = await this.request('/news', { q: query }, options);
    return result.news ?? [];
  }

  async places(
    query: string,
    options: SerperSearchOptions = {}
  ): Promise<SerperPlaceResult[]> {
    const result = await this.request('/places', { q: query }, options);
    return result.places ?? [];
  }

  async fullSearch(
    query: string,
    options: SerperSearchOptions = {}
  ): Promise<SerperResult> {
    return this.request('/search', { q: query }, options);
  }

  /**
   * Extract structured data from search results
   * Returns extracted facts with confidence scores
   */
  async extractStructuredData(
    query: string,
    fields: string[],
    options: SerperSearchOptions = {}
  ): Promise<Record<string, unknown>> {
    const results = await this.search(query, options);
    const extracted: Record<string, unknown> = {};

    for (const field of fields) {
      const values: string[] = [];
      for (const result of results) {
        if (result.snippet?.toLowerCase().includes(field.toLowerCase())) {
          values.push(result.snippet);
        }
        if (result.title?.toLowerCase().includes(field.toLowerCase())) {
          values.push(result.title);
        }
      }
      if (values.length > 0) {
        extracted[field] = {
          values: [...new Set(values)].slice(0, 5),
          confidence: Math.min(0.95, 0.5 + values.length * 0.1),
        };
      }
    }

    return extracted;
  }

  /**
   * Search for product images with quality filtering
   */
  async findProductImages(
    query: string,
    options: { minWidth?: number; minHeight?: number; limit?: number } = {}
  ): Promise<SerperImageResult[]> {
    const allImages = await this.images(query, options);
    
    return allImages
      .filter((img) => {
        const width = img.imageWidth ?? 0;
        const height = img.imageHeight ?? 0;
        const minWidth = options.minWidth ?? 300;
        const minHeight = options.minHeight ?? 300;
        return width >= minWidth && height >= minHeight;
      })
      .slice(0, options.limit ?? 10);
  }
}
