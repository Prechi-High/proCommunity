/**
 * Product Intelligence Service
 * Orchestrates all services to investigate and build product knowledge
 */

import { CategoryClassificationService } from './category-classification/categoryClassification';
import { EvidenceEngine } from './evidence-engine/evidenceEngine';
import { ExtractionField, LLMExtractionService } from './llmExtraction';
import { ProductIdentificationService } from './product-identification/productIdentification';
import { SearchDiscoveryService } from './search-discovery/searchDiscovery';
import { VerificationService } from './verification/verification';

interface ProductIntelligence {
  productId: string;
  name: string;
  brand: string;
  category: string;
  intelligence: Record<string, unknown>;
  evidence: Record<string, string>;
  images: string[];
  confidence: number;
  sources: string[];
}

export class ProductIntelligenceService {
  private readonly identification: ProductIdentificationService;
  private readonly classification: CategoryClassificationService;
  private readonly discovery: SearchDiscoveryService;
  private readonly evidenceEngine: EvidenceEngine;
  private readonly llm: LLMExtractionService;
  private readonly verification: VerificationService;

  constructor() {
    this.identification = new ProductIdentificationService();
    this.classification = new CategoryClassificationService();
    this.discovery = new SearchDiscoveryService();
    this.evidenceEngine = new EvidenceEngine();
    this.llm = new LLMExtractionService();
    this.verification = new VerificationService();
  }

  async investigateProduct(query: string): Promise<ProductIntelligence> {
    // Step 1: Identify the product
    const identificationResult = await this.identification.identifyFromText(query);
    const product = identificationResult.product;

    // Step 2: Classify the product
    const classificationResult = await this.classification.classify(
      query,
      product.name,
      product.brand
    );

    // Step 3: Plan research based on category template
    const fields = this.getCategoryFields(classificationResult.category.id);
    const discoveryResults = await this.discovery.discoverForProduct(
      product.name,
      product.brand,
      fields
    );

    // Step 4: Retrieve evidence
    const evidence = await this.collectEvidence(discoveryResults);

    // Step 5: Extract intelligence using LLM
    const extractionFields: ExtractionField[] = fields.map((field) => ({
      key: field,
      label: field.replace(/_/g, ' '),
      description: `Extract ${field} information`,
      dataType: 'text',
      extractionInstruction: `Find information about ${field} for ${product.brand} ${product.name}`,
    }));

    const extractionResults = await this.llm.extractForTemplate(
      Object.values(evidence).join('\n\n'),
      extractionFields,
      product.id
    );

    // Step 6: Verify and calculate confidence
    const verificationResults = await this.verification.verifyClaims(
      extractionResults.results.map((r) => ({
        field: r.field,
        value: r.value,
        evidenceIds: r.evidenceIds || [],
        sourceUrls: [],
      }))
    );

    // Step 7: Build final intelligence
    const intelligence: Record<string, unknown> = {};
    const sources: string[] = [];

    for (let i = 0; i < extractionResults.results.length; i++) {
      const result = extractionResults.results[i];
      const verification = verificationResults[i];

      if (verification.isValid) {
        intelligence[result.field] = result.value;
        sources.push(...verification.supportingSources);
      }
    }

    // Step 8: Get product images
    const images = await this.getProductImages(product.name, product.brand);

    return {
      productId: product.id,
      name: product.name,
      brand: product.brand,
      category: classificationResult.category.name,
      intelligence,
      evidence,
      images,
      confidence: this.calculateOverallConfidence(verificationResults),
      sources: [...new Set(sources)],
    };
  }

  private getCategoryFields(categoryId: string): string[] {
    const categoryFields: Record<string, string[]> = {
      skincare: ['product_name', 'brand', 'category', 'description', 'primary_image', 'gallery_images', 'price', 'availability', 'common_praise', 'common_complaints', 'sources'],
      cleanser: ['product_name', 'brand', 'size', 'skin_type', 'ingredients', 'active_ingredients', ' fragrance', 'usage', 'performance', 'price', 'availability', 'alternatives', 'common_praise', 'common_complaints'],
      serum: ['product_name', 'brand', 'size', 'skin_type', 'ingredients', 'active_ingredients', 'concerns', 'how_to_use', 'frequency', 'performance', 'time_to_results', 'price', 'alternatives', 'common_praise', 'common_complaints'],
      moisturizer: ['product_name', 'brand', 'size', 'skin_type', 'ingredients', 'texture', 'how_to_use', 'frequency', 'claimed_benefits', 'reported_results', 'price', 'availability', 'alternatives', 'common_praise', 'common_complaints'],
      spf: ['product_name', 'brand', 'size', 'spf_value', 'skin_type', 'ingredients', 'uva_protection', 'water_resistance', 'texture', 'how_to_use', 'reapplication', 'price', 'availability', 'alternatives', 'common_praise', 'common_complaints'],
    };

    return categoryFields[categoryId] || categoryFields.skincare;
  }

  private async collectEvidence(discoveryResults: any[]): Promise<Record<string, string>> {
    const evidence: Record<string, string> = {};
    let index = 0;

    for (const result of discoveryResults) {
      for (const ev of result.evidence) {
        if (ev.content) {
          evidence[`ev_${index++}`] = `${ev.title}\n\n${ev.content}`;
        }
      }
    }

    return evidence;
  }

  private async getProductImages(productName: string, brand: string): Promise<string[]> {
    try {
      const searchQuery = `${brand} ${productName} product image`;
      const results = await this.discovery.serper.images(searchQuery);
      return results.slice(0, 10).map((r) => r.imageUrl);
    } catch {
      return [];
    }
  }

  private calculateOverallConfidence(verificationResults: any[]): number {
    if (verificationResults.length === 0) return 0.5;

    const validCount = verificationResults.filter((r) => r.isValid).length;
    const avgConfidence = verificationResults.reduce((sum, r) => sum + r.confidence, 0) / verificationResults.length;

    return (validCount / verificationResults.length) * 0.5 + avgConfidence * 0.5;
  }

  /**
   * Research a specific product by ID
   */
  async researchProduct(productId: string): Promise<ProductIntelligence> {
    // For now, delegate to general investigation
    // Future: Use database to retrieve existing intelligence
    return this.investigateProduct(productId);
  }

  /**
   * Refresh existing product intelligence
   */
  async refreshProduct(productId: string): Promise<ProductIntelligence> {
    return this.researchProduct(productId);
  }
}
