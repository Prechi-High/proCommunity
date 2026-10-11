export type LabeledIdentity = {
  id: string;
  domain: "tech" | "beauty" | "home" | "inferred";
  target: { name: string; brand: string; query: string };
  context?: { videoTitle?: string; parentText?: string };
  text: string;
  expect: {
    affectsScore: boolean;
    level?: string;
    minConfidence?: number;
    maxConfidence?: number;
  };
};

export type LabeledRelevance = {
  id: string;
  domain: "tech" | "beauty" | "home" | "inferred";
  dimension: { key: string; label: string; keywords: string[]; whyItMatters?: string };
  text: string;
  context?: { videoTitle?: string };
  expect: {
    maps: boolean;
    minConfidence?: number;
    snippetIncludes?: string;
  };
};

/** Curated calibration set (expand over time). */
export const IDENTITY_LABELS: LabeledIdentity[] = [
  {
    id: "tech-explicit",
    domain: "tech",
    target: { name: "iPhone 8", brand: "Apple", query: "iPhone 8" },
    text: "My iPhone 8 battery is still at 88% after two years.",
    expect: { affectsScore: true, level: "exact", minConfidence: 0.85 },
  },
  {
    id: "tech-contextual",
    domain: "tech",
    target: { name: "iPhone 8", brand: "Apple", query: "iPhone 8" },
    context: { videoTitle: "iPhone 8 Review After 2 Years" },
    text: "Mine still lasts all day.",
    expect: { affectsScore: true, minConfidence: 0.75 },
  },
  {
    id: "tech-sibling",
    domain: "tech",
    target: { name: "iPhone 8", brand: "Apple", query: "iPhone 8" },
    text: "The Plus model is much bigger in the hand.",
    expect: { affectsScore: false, level: "variant_related" },
  },
  {
    id: "tech-competitor",
    domain: "tech",
    target: { name: "iPhone 8", brand: "Apple", query: "iPhone 8" },
    text: "I prefer the Samsung Galaxy.",
    expect: { affectsScore: false },
  },
  {
    id: "beauty-explicit",
    domain: "beauty",
    target: { name: "Daily Moisturizing Lotion", brand: "CeraVe", query: "CeraVe Daily Moisturizing Lotion" },
    text: "CeraVe daily lotion broke me out after three weeks.",
    expect: { affectsScore: true, minConfidence: 0.85 },
  },
  {
    id: "beauty-contextual",
    domain: "beauty",
    target: { name: "Daily Moisturizing Lotion", brand: "CeraVe", query: "CeraVe Daily Moisturizing Lotion" },
    context: { videoTitle: "CeraVe Daily Moisturizing Lotion Review" },
    text: "It irritated my skin after three weeks.",
    expect: { affectsScore: true, minConfidence: 0.75 },
  },
  {
    id: "beauty-sibling",
    domain: "beauty",
    target: { name: "Moisturizing Cream", brand: "CeraVe", query: "CeraVe Moisturizing Cream" },
    text: "The lotion version is much thinner.",
    expect: { affectsScore: false },
  },
  {
    id: "home-explicit",
    domain: "home",
    target: { name: "V15 Detect", brand: "Dyson", query: "Dyson V15 Detect" },
    text: "My Dyson V15 Detect picks up pet hair amazingly.",
    expect: { affectsScore: true, minConfidence: 0.85 },
  },
  {
    id: "home-sibling",
    domain: "home",
    target: { name: "V15 Detect", brand: "Dyson", query: "Dyson V15 Detect" },
    text: "The V12 is lighter but less suction.",
    expect: { affectsScore: false },
  },
  {
    id: "inferred-bike",
    domain: "inferred",
    target: { name: "Trail 7", brand: "Trek", query: "Trek Trail 7" },
    context: { videoTitle: "Trek Trail 7 Mountain Bike Review" },
    text: "Brakes feel strong on steep descents.",
    expect: { affectsScore: true, minConfidence: 0.7 },
  },
];

const TECH_TARGETS = [
  { name: "iPhone 15", brand: "Apple", query: "iPhone 15" },
  { name: "Galaxy Watch 6", brand: "Samsung", query: "Samsung Galaxy Watch 6" },
  { name: "PowerCore 10000", brand: "Anker", query: "Anker PowerCore 10000" },
  { name: "QuietComfort Earbuds", brand: "Bose", query: "Bose QuietComfort Earbuds" },
];

const BEAUTY_TARGETS = [
  { name: "Moisturizing Cream", brand: "CeraVe", query: "CeraVe Moisturizing Cream" },
  { name: "Double Wear Foundation", brand: "Estée Lauder", query: "Estée Lauder Double Wear" },
  { name: "Ruby Woo", brand: "MAC", query: "MAC Ruby Woo" },
  { name: "Hydrating Facial Cleanser", brand: "CeraVe", query: "CeraVe Hydrating Cleanser" },
];

const HOME_TARGETS = [
  { name: "Ninja Air Fryer Max", brand: "Ninja", query: "Ninja Air Fryer Max" },
  { name: "Series 5 Washer", brand: "Bosch", query: "Bosch Series 5 Washer" },
  { name: "V15 Detect", brand: "Dyson", query: "Dyson V15 Detect" },
  { name: "Professional 750", brand: "Vitamix", query: "Vitamix 750" },
];

function expandIdentityLabels(): LabeledIdentity[] {
  const out: LabeledIdentity[] = [];
  let n = 0;
  for (const t of [...TECH_TARGETS, ...BEAUTY_TARGETS, ...HOME_TARGETS]) {
    out.push({
      id: `exp-explicit-${n++}`,
      domain: "tech",
      target: t,
      text: `I've been using the ${t.query} for months and it's been reliable.`,
      expect: { affectsScore: true, minConfidence: 0.75 },
    });
    out.push({
      id: `exp-context-${n++}`,
      domain: "tech",
      target: t,
      context: { videoTitle: `${t.query} Honest Review` },
      text: "Mine still works great after daily use.",
      expect: { affectsScore: true, minConfidence: 0.75 },
    });
    out.push({
      id: `exp-generic-${n++}`,
      domain: "tech",
      target: t,
      text: "Nice weather today.",
      expect: { affectsScore: false },
    });
  }
  return out;
}

export const RELEVANCE_LABELS: LabeledRelevance[] = [
  {
    id: "generic-praise",
    domain: "tech",
    dimension: { key: "battery_health", label: "Battery Health", keywords: ["battery", "health"] },
    context: { videoTitle: "iPhone 8 Review" },
    text: "Mine is amazing",
    expect: { maps: false },
  },
  {
    id: "battery-explicit",
    domain: "tech",
    dimension: {
      key: "battery_health",
      label: "Battery Health",
      keywords: ["battery health", "degradation"],
      whyItMatters: "capacity retention over years",
    },
    context: { videoTitle: "iPhone 8 Review" },
    text: "Mine still has 88% battery health after 2 years.",
    expect: { maps: true, minConfidence: 0.8, snippetIncludes: "88%" },
  },
  {
    id: "multi-topic",
    domain: "tech",
    dimension: { key: "heat_management", label: "Heat Management", keywords: ["heat", "warm", "gaming"] },
    text: "Battery is fine. Camera is decent. The phone gets warm when gaming.",
    expect: { maps: true, snippetIncludes: "warm" },
  },
  {
    id: "irritation-beauty",
    domain: "beauty",
    dimension: {
      key: "irritation",
      label: "Irritation",
      keywords: ["irritat", "rash", "broke out", "break out"],
      whyItMatters: "sensitive skin reactions",
    },
    context: { videoTitle: "CeraVe Daily Moisturizing Lotion Review" },
    text: "It broke me out after 3 weeks.",
    expect: { maps: true, minConfidence: 0.85 },
  },
];

export const ALL_IDENTITY_LABELS: LabeledIdentity[] = [...IDENTITY_LABELS, ...expandIdentityLabels()];
