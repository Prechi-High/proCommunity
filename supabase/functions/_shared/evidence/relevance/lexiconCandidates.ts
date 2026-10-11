import { RELEVANCE_CANDIDATE_MIN, RELEVANCE_STRONG_MIN, clampConfidence } from "../confidence/tiers.ts";

/** Static lexicon — candidate generation / tests only, not final authority. */
const LEXICON: Record<string, RegExp[]> = {
  hydration: [/\b(hydrat|moistur|dry skin|dehydrat)\b/i],
  absorption: [/\b(absorb|soak in|sinks in|greasy|sticky|film|residue)\b/i],
  irritation: [/\b(irritat|burn|sting|broke out|broke me out|break out|rash|eczema)\b/i],
  camera_quality: [/\b(camera|photo|video|lens|selfie)\b/i],
  battery_health: [/\b(battery health|cycle|degradation|capacity|88%|90%)\b/i],
  battery_endurance: [/\b(battery life|lasts all day|drain|endurance)\b/i],
  ergonomics: [/\b(one[- ]?handed|hand|grip|pocket|comfortable to hold|size)\b/i],
  performance_longevity: [/\b(slow|lag|months|year|ios update|long.?term|still fast|smooth)\b/i],
  heat_management: [/\b(warm|hot|heat|thermal|overheat|gaming)\b/i],
  noise: [/\b(noise|loud|quiet)\b/i],
  cooking_consistency: [/\b(cook|crisp|even|bake|fry)\b/i],
};

export function lexiconCandidateScore(dimensionKey: string, text: string): number {
  const patterns = LEXICON[dimensionKey];
  if (!patterns?.some((re) => re.test(text))) return 0;
  return clampConfidence(RELEVANCE_STRONG_MIN);
}

export function lexiconMightMatch(dimensionKey: string, text: string): boolean {
  return lexiconCandidateScore(dimensionKey, text) >= RELEVANCE_CANDIDATE_MIN;
}
