export type RendererType =
  | "fact_grid"
  | "grouped_facts"
  | "ingredient_list"
  | "material_list"
  | "score_grid"
  | "evidence_list"
  | "video_groups"
  | "finding_list"
  | "warning_list"
  | "text_blocks"
  | "key_value_list";

export type ScoreDisplay = "numeric" | "limited" | "unavailable";

export type EvaluationDimensionUI = {
  id: string;
  key: string;
  label: string;
  description?: string;
  score?: number;
  score_display?: ScoreDisplay;
  validated_report_count?: number;
  confidence?: number;
  confidence_label?: "low" | "medium" | "high";
  finding?: string;
  why_it_matters?: string;
  evidence_count?: number;
  positive_count?: number;
  mixed_count?: number;
  negative_count?: number;
  display_order: number;
  evidence_filter_key?: string;
};

export type FindingUI = {
  id: string;
  title: string;
  finding: string;
  confidence?: number;
  evidence_count?: number;
};

export type ProductSectionUI = {
  id: string;
  key: string;
  title: string;
  description?: string;
  renderer: RendererType;
  display_order: number;
  enabled: boolean;
  data: unknown;
  empty_state?: { title: string; body?: string };
};

export type ProductUIContractV1 = {
  schema_version: "1";
  product: {
    id: string;
    name: string;
    brand?: string;
    image_url?: string;
    domain: {
      id: string;
      name: string;
      status: "official" | "inferred";
    };
    product_family?: string;
    product_type: string;
    product_subtype?: string;
  };
  navigation: Array<{
    key: string;
    label: string;
    section_ref: string;
    display_order: number;
    enabled: boolean;
  }>;
  overview: {
    overall?: {
      score?: number;
      score_display?: ScoreDisplay;
      confidence?: number;
      verdict?: string;
    };
    dimensions: EvaluationDimensionUI[];
    biggest_strength?: FindingUI;
    biggest_weakness?: FindingUI;
    most_divisive?: FindingUI;
    discoveries?: FindingUI[];
  };
  sections: ProductSectionUI[];
  domain_notice?: {
    should_show: boolean;
    official_domains: string[];
    can_vote: boolean;
  };
  intelligence_meta: {
    blueprint_id: string;
    blueprint_version: number;
    domain_template_version?: number;
    classification_confidence?: number;
    generated_at: string;
    refresh_after?: string;
  };
  ask_context?: {
    product_id: string;
    blueprint_id: string;
    available_fact_keys: string[];
    available_dimension_keys: string[];
  };
};
