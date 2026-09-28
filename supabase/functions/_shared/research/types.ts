export type Channel = "app" | "whatsapp" | "web";
export type CardStatus = "created" | "identifying" | "researching" | "partial" | "complete" | "failed" | "archived";
export type Focus = "everything" | "fit" | "ingredients" | "community" | "price" | "stores" | "alternatives" | "comparison";
export type ProductRole = "primary" | "comparison" | "alternative" | "related";

export const FOCUSES: Focus[] = ["everything", "fit", "ingredients", "community", "price", "stores", "alternatives", "comparison"];

export type ProductRef = { productId: string; name: string; brand?: string; category?: string; image?: string | null };

export interface ResearchCard {
  id: string;
  user_id: string;
  public_reference: string;
  title: string | null;
  primary_product_id: string | null;
  research_type: "product" | "comparison" | "category";
  status: CardStatus;
  focus: Focus;
  source_channel: Channel;
  image_url: string | null;
  search_text: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  last_refreshed_at: string | null;
  is_shared: boolean;
}

export interface ResearchProduct {
  id?: string;
  research_card_id: string;
  product_id: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  image: string | null;
  role: ProductRole;
  added_at?: string;
}

export interface ResearchSection {
  section_key: string;
  title: string;
  content: Record<string, unknown>;
  status: "ready" | "partial" | "unavailable";
  display_order: number;
}

export type SnapshotType = "product" | "community" | "confidence" | "price" | "availability" | "fit";

export interface ResearchSnapshot {
  id?: string;
  research_card_id: string;
  snapshot_type: SnapshotType;
  data: Record<string, unknown>;
  source_version: string | null;
  created_at?: string;
}

export interface ResearchSource {
  section_key: string | null;
  source_type: string;
  source_name: string;
  source_url: string | null;
  source_reference: string | null;
  metadata?: Record<string, unknown>;
}

export interface ResearchQuestion {
  id: string;
  research_card_id: string;
  user_id: string;
  question: string;
  answer: Record<string, unknown> | null;
  status: "pending" | "processing" | "answered" | "failed";
  source_channel: Channel;
  created_at: string;
  answered_at: string | null;
}

export interface ResearchComparison {
  id: string;
  research_card_id: string;
  product_a_id: string;
  product_b_id: string;
  comparison_snapshot: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface ResearchShare {
  id: string;
  research_card_id: string;
  created_by: string;
  share_token_hash: string;
  status: "active" | "revoked" | "expired";
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export type ActivityEvent =
  | "research_created"
  | "product_identified"
  | "research_started"
  | "research_completed"
  | "research_failed"
  | "question_asked"
  | "comparison_added"
  | "product_saved"
  | "research_shared"
  | "share_revoked"
  | "price_changed"
  | "research_refreshed"
  | "research_archived";

export interface ResearchCardView {
  card: ResearchCard;
  statusLabel: string;
  products: ResearchProduct[];
  sections: ResearchSection[];
  questions: ResearchQuestion[];
  comparisons: ResearchComparison[];
  price: { then: Record<string, unknown> | null; now: Record<string, unknown> | null };
}

export class ResearchError extends Error {
  constructor(
    readonly code: "RESEARCH_NOT_FOUND" | "PERMISSION_DENIED" | "PRODUCT_NOT_IDENTIFIED" | "RESEARCH_FAILED" | "INVALID_INPUT" | "TEMPORARY_ERROR",
    message?: string,
  ) {
    super(message ?? code);
  }
}
