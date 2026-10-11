import type { BlueprintDimensionDef, BlueprintFactSectionDef, IntelligenceDomain } from "./types.ts";

type TypePreset = {
  productType: string;
  subtypes?: string[];
  match: RegExp;
  factSections: BlueprintFactSectionDef[];
  dimensions: BlueprintDimensionDef[];
  excludedDimensionKeys?: string[];
};

const TECH: TypePreset[] = [
  {
    productType: "smartphone",
    match: /\b(iphone|galaxy\s*s|pixel|smartphone|android phone)\b/i,
    factSections: [{ key: "specs", label: "Specs", renderer: "fact_groups", fieldKeys: ["display", "processor", "storage", "camera", "battery", "charging"] }],
    dimensions: [
      { key: "camera_quality", label: "Camera quality", importance: 0.92, keywords: ["camera", "photo", "video", "lens"] },
      { key: "battery_endurance", label: "Battery endurance", importance: 0.9, keywords: ["battery", "charge", "endurance"] },
      { key: "performance", label: "Performance", importance: 0.88, keywords: ["performance", "speed", "chip", "lag"] },
      { key: "heat_management", label: "Heat management", importance: 0.75, keywords: ["heat", "thermal", "warm"] },
      { key: "display_experience", label: "Display experience", importance: 0.82, keywords: ["display", "screen", "brightness"] },
      { key: "durability", label: "Durability", importance: 0.78, keywords: ["durability", "drop", "scratch", "build"] },
    ],
  },
  {
    productType: "smartwatch",
    match: /\b(watch|fitbit|garmin|smartwatch|apple watch|galaxy watch)\b/i,
    factSections: [{ key: "specs", label: "Specs", renderer: "fact_groups", fieldKeys: ["display", "sensors", "battery", "water_resistance", "connectivity"] }],
    dimensions: [
      { key: "health_tracking", label: "Health tracking accuracy", importance: 0.9, keywords: ["health", "heart", "sleep", "spo2"] },
      { key: "fitness_tracking", label: "Fitness tracking", importance: 0.88, keywords: ["fitness", "workout", "steps", "gps"] },
      { key: "battery_endurance", label: "Battery endurance", importance: 0.86, keywords: ["battery", "charge"] },
      { key: "comfort", label: "Comfort", importance: 0.8, keywords: ["comfort", "band", "wear"] },
      { key: "gps_accuracy", label: "GPS accuracy", importance: 0.72, keywords: ["gps", "location"] },
      { key: "connectivity", label: "Connectivity", importance: 0.7, keywords: ["bluetooth", "lte", "call", "notification"] },
    ],
    excludedDimensionKeys: ["camera_quality"],
  },
  {
    productType: "power_bank",
    match: /\b(power bank|portable charger|powerbank)\b/i,
    factSections: [{ key: "specs", label: "Specs", renderer: "fact_groups", fieldKeys: ["capacity", "ports", "charging_speed", "weight"] }],
    dimensions: [
      { key: "charging_speed", label: "Charging speed", importance: 0.9, keywords: ["charge", "fast", "watt"] },
      { key: "capacity_usability", label: "Capacity", importance: 0.88, keywords: ["capacity", "mah", "full charge"] },
      { key: "heat_management", label: "Heat management", importance: 0.7, keywords: ["heat", "warm"] },
      { key: "build_quality", label: "Build quality", importance: 0.75, keywords: ["build", "durability"] },
    ],
    excludedDimensionKeys: ["camera_quality", "display_experience"],
  },
];

const BEAUTY: TypePreset[] = [
  {
    productType: "foundation",
    match: /\b(foundation|bb cream|cc cream)\b/i,
    factSections: [
      { key: "ingredients", label: "Ingredients", renderer: "ingredient_list", fieldKeys: ["ingredients", "active_ingredients"] },
      { key: "product_details", label: "Product Details", renderer: "fact_groups", fieldKeys: ["coverage_type", "finish", "shade_range", "spf", "size"] },
    ],
    dimensions: [
      { key: "coverage", label: "Coverage", importance: 0.95, keywords: ["coverage", "cover"] },
      { key: "wear_longevity", label: "Longevity", importance: 0.93, keywords: ["last", "longevity", "wear", "hours"] },
      { key: "transfer_resistance", label: "Transfer resistance", importance: 0.82, keywords: ["transfer", "mask", "phone"] },
      { key: "oxidation", label: "Oxidation", importance: 0.78, keywords: ["oxid", "orange", "shade shift"] },
      { key: "shade_match", label: "Shade match", importance: 0.85, keywords: ["shade", "match", "tone"] },
      { key: "skin_comfort", label: "Skin comfort", importance: 0.73, keywords: ["comfort", "dry", "oily", "irritat"] },
    ],
    excludedDimensionKeys: ["camera_quality", "battery_endurance", "charging_speed"],
  },
  {
    productType: "lipstick",
    match: /\b(lipstick|lip gloss|lip colour|lip color)\b/i,
    factSections: [
      { key: "ingredients", label: "Ingredients", renderer: "ingredient_list", fieldKeys: ["ingredients"] },
      { key: "product_details", label: "Product Details", renderer: "fact_groups", fieldKeys: ["finish", "shade", "size"] },
    ],
    dimensions: [
      { key: "pigmentation", label: "Pigmentation", importance: 0.92, keywords: ["pigment", "color", "bold"] },
      { key: "wear_longevity", label: "Longevity", importance: 0.9, keywords: ["last", "longevity", "wear"] },
      { key: "transfer_resistance", label: "Transfer", importance: 0.8, keywords: ["transfer", "smudge"] },
      { key: "comfort", label: "Comfort", importance: 0.78, keywords: ["comfort", "dry", "hydrat"] },
      { key: "application", label: "Application", importance: 0.72, keywords: ["apply", "glide", "brush"] },
    ],
  },
  {
    productType: "moisturizer",
    match: /\b(moisturizer|moisturiser|face cream|hydrating cream|lotion)\b/i,
    factSections: [
      { key: "ingredients", label: "Ingredients", renderer: "ingredient_list", fieldKeys: ["ingredients", "active_ingredients"] },
      { key: "who_its_for", label: "Who It's For", renderer: "fact_groups", fieldKeys: ["skin_type", "concerns"] },
      { key: "how_to_use", label: "How to Use", renderer: "fact_groups", fieldKeys: ["usage", "frequency"] },
    ],
    dimensions: [
      { key: "hydration", label: "Hydration", importance: 0.9, keywords: ["hydrat", "moisture", "dry"] },
      { key: "absorption", label: "Absorption", importance: 0.85, keywords: ["absorb", "greasy", "sticky"] },
      { key: "irritation", label: "Irritation tolerance", importance: 0.8, keywords: ["irritat", "sensitive", "burn"] },
      { key: "texture", label: "Texture feel", importance: 0.75, keywords: ["texture", "light", "rich"] },
    ],
  },
];

const HOME: TypePreset[] = [
  {
    productType: "air_fryer",
    match: /\b(air fryer|airfryer)\b/i,
    factSections: [{ key: "specs", label: "Specs", renderer: "fact_groups", fieldKeys: ["capacity", "wattage", "temperature_range", "modes"] }],
    dimensions: [
      { key: "cooking_consistency", label: "Cooking consistency", importance: 0.92, keywords: ["even", "crisp", "cook"] },
      { key: "cooking_speed", label: "Cooking speed", importance: 0.85, keywords: ["fast", "speed", "time"] },
      { key: "capacity_usability", label: "Capacity usability", importance: 0.82, keywords: ["capacity", "basket", "portion"] },
      { key: "ease_of_cleaning", label: "Ease of cleaning", importance: 0.8, keywords: ["clean", "dishwasher"] },
      { key: "noise", label: "Noise", importance: 0.7, keywords: ["noise", "loud", "quiet"] },
      { key: "build_quality", label: "Build quality", importance: 0.75, keywords: ["build", "durability"] },
    ],
  },
  {
    productType: "washing_machine",
    match: /\b(washing machine|washer|laundry machine)\b/i,
    factSections: [{ key: "specs", label: "Specs", renderer: "fact_groups", fieldKeys: ["capacity", "spin_speed", "energy", "programs"] }],
    dimensions: [
      { key: "cleaning_performance", label: "Cleaning performance", importance: 0.92, keywords: ["clean", "stain", "wash"] },
      { key: "spin_noise", label: "Noise", importance: 0.78, keywords: ["noise", "vibrat", "loud"] },
      { key: "energy_efficiency", label: "Energy efficiency", importance: 0.75, keywords: ["energy", "electric", "water"] },
      { key: "reliability", label: "Reliability", importance: 0.85, keywords: ["reliable", "break", "repair"] },
      { key: "ease_of_use", label: "Ease of use", importance: 0.72, keywords: ["easy", "control", "interface"] },
    ],
  },
];

const DOMAIN_DEFAULTS: Record<IntelligenceDomain, { factSections: BlueprintFactSectionDef[]; dimensions: BlueprintDimensionDef[] }> = {
  tech: {
    factSections: [{ key: "specs", label: "Specs", renderer: "fact_groups", fieldKeys: [] }],
    dimensions: [
      { key: "performance", label: "Performance", importance: 0.85, keywords: ["performance", "speed"] },
      { key: "reliability", label: "Reliability", importance: 0.8, keywords: ["reliable", "break", "issue"] },
      { key: "usability", label: "Usability", importance: 0.75, keywords: ["easy", "use", "interface"] },
      { key: "build_quality", label: "Build quality", importance: 0.78, keywords: ["build", "quality"] },
      { key: "value", label: "Value for money", importance: 0.7, keywords: ["price", "worth", "value"] },
    ],
  },
  beauty: {
    factSections: [
      { key: "ingredients", label: "Ingredients", renderer: "ingredient_list", fieldKeys: [] },
      { key: "product_details", label: "Product Details", renderer: "fact_groups", fieldKeys: [] },
    ],
    dimensions: [
      { key: "result_quality", label: "Result quality", importance: 0.88, keywords: ["result", "effect", "work"] },
      { key: "application", label: "Application", importance: 0.75, keywords: ["apply", "blend"] },
      { key: "comfort_tolerance", label: "Comfort & tolerance", importance: 0.8, keywords: ["comfort", "irritat", "sensitive"] },
      { key: "wear_performance", label: "Wear performance", importance: 0.78, keywords: ["last", "wear", "longevity"] },
    ],
  },
  "home-appliances": {
    factSections: [{ key: "specs", label: "Specs", renderer: "fact_groups", fieldKeys: [] }],
    dimensions: [
      { key: "primary_task_effectiveness", label: "Primary task effectiveness", importance: 0.9, keywords: ["work", "effective", "performance"] },
      { key: "ease_of_use", label: "Ease of use", importance: 0.78, keywords: ["easy", "use"] },
      { key: "maintenance", label: "Cleaning & maintenance", importance: 0.75, keywords: ["clean", "maintain"] },
      { key: "noise", label: "Noise", importance: 0.7, keywords: ["noise", "loud"] },
      { key: "reliability", label: "Reliability", importance: 0.82, keywords: ["reliable", "break"] },
    ],
  },
};

const DOMAIN_LEAK_BLOCK: Record<IntelligenceDomain, string[]> = {
  tech: [],
  beauty: ["camera_quality", "charging_speed", "display_experience", "gps_accuracy", "heat_management"],
  "home-appliances": ["camera_quality", "pigmentation", "oxidation", "shade_match"],
};

export function presetsForDomain(domain: IntelligenceDomain): TypePreset[] {
  if (domain === "tech") return TECH;
  if (domain === "beauty") return BEAUTY;
  return HOME;
}

export function domainDefaults(domain: IntelligenceDomain) {
  return DOMAIN_DEFAULTS[domain];
}

export function blockedDimensionKeys(domain: IntelligenceDomain): Set<string> {
  return new Set(DOMAIN_LEAK_BLOCK[domain]);
}

export type { TypePreset };
