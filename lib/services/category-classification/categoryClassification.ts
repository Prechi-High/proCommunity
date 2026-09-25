/**
 * Category Classification Service
 * Classifies products into categories and assigns intelligence templates
 */

interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id?: string;
  intelligence_template_id?: string;
  description?: string;
}

interface ClassificationResult {
  category: Category;
  templateId?: string;
  confidence: number;
  reasoning: string[];
}

export class CategoryClassificationService {
  private readonly categories: Record<string, Category> = {
    skincare: {
      id: 'skincare',
      name: 'Skincare',
      slug: 'skincare',
      intelligence_template_id: 'skincare_default',
      description: 'Skincare and beauty products',
    },
    cleanser: {
      id: 'cleanser',
      name: 'Cleanser',
      slug: 'cleanser',
      parent_id: 'skincare',
      intelligence_template_id: 'skincare_cleanser',
      description: 'Facial cleansers and washes',
    },
    serum: {
      id: 'serum',
      name: 'Serum',
      slug: 'serum',
      parent_id: 'skincare',
      intelligence_template_id: 'skincare_serum',
      description: 'Treatment serums',
    },
    moisturizer: {
      id: 'moisturizer',
      name: 'Moisturizer',
      slug: 'moisturizer',
      parent_id: 'skincare',
      intelligence_template_id: 'skincare_moisturizer',
      description: 'Face moisturizers and creams',
    },
    spf: {
      id: 'spf',
      name: 'Sunscreen',
      slug: 'spf',
      parent_id: 'skincare',
      intelligence_template_id: 'skincare_spf',
      description: 'Sun protection products',
    },
  };

  async classify(query: string, productName: string, brand: string): Promise<ClassificationResult> {
    const combined = `${productName} ${brand} ${query}`.toLowerCase();
    const reasoning: string[] = [];

    // Try to find the best matching category
    const scores: { category: Category; score: number }[] = [];

    for (const category of Object.values(this.categories)) {
      const score = this.calculateCategoryScore(category, combined);
      scores.push({ category, score });
    }

    // Sort by score
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];

    if (best.score > 0.5) {
      reasoning.push(`Best match: ${best.category.name} (score: ${best.score.toFixed(2)})`);
      return {
        category: best.category,
        templateId: best.category.intelligence_template_id,
        confidence: best.score,
        reasoning,
      };
    }

    // Fallback to generic category
    reasoning.push('No specific category match found, using default');
    return {
      category: this.categories.skincare,
      templateId: 'skincare_default',
      confidence: 0.5,
      reasoning,
    };
  }

  private calculateCategoryScore(category: Category, content: string): number {
    let score = 0;

    // Check if category name appears in content
    if (content.includes(category.slug) || content.includes(category.name.toLowerCase())) {
      score += 0.4;
    }

    // Check for category-specific keywords
    const keywords: Record<string, string[]> = {
      cleanser: ['cleanser', 'wash', 'foam', 'gel', 'cream', 'cleansing'],
      serum: ['serum', 'treatment', 'essence', 'ampoule'],
      moisturizer: ['moisturizer', 'moisturising', 'moisturizing', 'cream', 'lotion'],
      spf: ['sunscreen', 'sun block', 'sun protection', 'spf', 'uv protection'],
    };

    const catKeywords = keywords[category.slug] || [];
    for (const keyword of catKeywords) {
      if (content.includes(keyword)) {
        score += 0.2;
      }
    }

    return Math.min(0.95, score);
  }

  async getCategories(): Promise<Category[]> {
    return Object.values(this.categories);
  }

  async getCategory(id: string): Promise<Category | undefined> {
    return this.categories[id];
  }

  /**
   * Get parent categories for a category
   */
  async getAncestors(categoryId: string): Promise<Category[]> {
    const ancestors: Category[] = [];
    let current = this.categories[categoryId];

    while (current && current.parent_id) {
      const parent = this.categories[current.parent_id];
      if (parent) {
        ancestors.unshift(parent);
        current = parent;
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Get all descendant categories
   */
  async getDescendants(categoryId: string): Promise<Category[]> {
    const descendants: Category[] = [];
    const children = Object.values(this.categories).filter(
      (c) => c.parent_id === categoryId
    );

    for (const child of children) {
      descendants.push(child);
      descendants.push(...(await this.getDescendants(child.id)));
    }

    return descendants;
  }
}
