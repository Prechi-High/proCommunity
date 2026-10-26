export type Visibility = "private" | "followers" | "public";
export type ProductState =
  | "purchased"
  | "active"
  | "paused"
  | "finished"
  | "stopped"
  | "replaced"
  | "repurchased";
export interface LivingProduct {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  company_id: string | null;
  market?: string | null;
  formulation?: string | null;
}
export interface Company {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  country: string | null;
  support_url: string | null;
  verification_status: string;
  parent_id: string | null;
}
export interface Journey {
  id: string;
  user_id: string;
  product_id: string;
  status: ProductState;
  acquisition: string;
  started_on: string | null;
  stopped_on: string | null;
  frequency: string | null;
  goal: string | null;
  context: string | null;
  stop_reason: string | null;
  replacement_id: string | null;
  visibility: Visibility;
  created_at: string;
  unmask_catalog?: LivingProduct;
}
export interface Experience {
  id: string;
  journey_id: string;
  user_id: string;
  author_name: string;
  changed: string;
  unchanged: string | null;
  reaction: string | null;
  uncertainty: string | null;
  would_rebuy: boolean | null;
  photo_path: string | null;
  visibility: Visibility;
  created_at: string;
  product_id: string;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  context: string | null;
  acquisition: string;
  frequency: string | null;
  maturity: string;
  claimed_days: number;
  documented_days: number;
  helpful_count: number;
  trust_explanation: string;
  product_status: string;
}
export interface Routine {
  id: string;
  user_id: string;
  name: string;
  goal: string | null;
  time_of_day: string;
  context: string | null;
  uncertainty: string | null;
  visibility: Visibility;
  started_on: string | null;
  updated_at: string;
  is_active: boolean;
}
export interface RoutineItem {
  id: string;
  routine_id: string;
  product_id: string;
  step_order: number;
  frequency: string | null;
  started_on: string | null;
  stopped_on: string | null;
  unmask_catalog: LivingProduct;
}
export interface Question {
  skin_type?: string | null;
  audience?: string;
  id: string;
  user_id: string;
  author_name: string;
  product_id: string | null;
  routine_id: string | null;
  body: string;
  context: string | null;
  created_at: string;
}
export interface Answer {
  attached_journey_id?: string | null;
  id: string;
  user_id: string;
  author_name: string;
  question_id: string;
  attached_experience_id?: string | null;
  duration: string;
  context: string;
  acquisition: string;
  body: string;
  uncertainty: string | null;
  created_at: string;
}
export interface Subscription {
  target_type: string;
  target_id: string;
  preferences: string[];
}
export interface Activity {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  route: string | null;
  read_at: string | null;
  created_at: string;
}
