export type ExperienceQuality = "strong" | "moderate" | "weak" | "noise";

export type ExperienceQualityAssessment = {
  experienceQuality: ExperienceQuality;
  firsthandExperienceConfidence: number;
  specificityConfidence: number;
  temporalExperienceSignal: number;
  ownershipSignal: number;
  /** When false, item may remain for display but must not affect dimension scores. */
  affectsScoring: boolean;
  reason: string;
};

const NOISE_PATTERNS = [
  /\b(great video|thanks for (the )?review|subscribed|first!|lol|nice vid)\b/i,
  /\b(looks amazing|want one|can't wait to (get|buy))\b/i,
  /^\+1\.?$/i,
  /\b(who else|anyone else)\b/i,
];

const STRONG_FIRSTHAND =
  /\b(i('ve| have) (used|been using|owned|tried|bought|had)|for (about |over )?\d+ (day|week|month|year)|after \d+ (week|month)|every (day|night|morning)|my (unit|bottle|jar|phone|washer))\b/i;

const TEMPORAL = /\b(after|for|since|months?|weeks?|years?|daily|nightly|long[- ]term)\b/i;
const SPECIFIC = /\b(but|however|except|although|greasy|broke|noise|smell|absorb|battery|heat)\b/i;

export function assessExperienceQuality(text: string, platform?: string): ExperienceQualityAssessment {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 20) {
    return low("too_short");
  }
  if (NOISE_PATTERNS.some((re) => re.test(t))) {
    return noise("engagement_noise");
  }
  if (platform === "youtube" && /^(thanks|great|love this|awesome)\b/i.test(t) && t.length < 80) {
    return noise("youtube_praise_only");
  }

  const firsthand = STRONG_FIRSTHAND.test(t) ? 0.85 : /\b(i|my|me|we)\b/i.test(t) ? 0.55 : 0.2;
  const temporal = TEMPORAL.test(t) ? 0.75 : 0.15;
  const specificity = SPECIFIC.test(t) || t.split(/\s+/).length >= 18 ? 0.7 : 0.35;
  const ownership = firsthand >= 0.55 ? 0.7 : 0.25;

  const score = firsthand * 0.4 + temporal * 0.2 + specificity * 0.25 + ownership * 0.15;
  let experienceQuality: ExperienceQuality = "weak";
  if (score >= 0.62) experienceQuality = "strong";
  else if (score >= 0.42) experienceQuality = "moderate";

  const affectsScoring = experienceQuality !== "noise" && score >= 0.38 && t.length >= 35;

  return {
    experienceQuality,
    firsthandExperienceConfidence: Math.min(0.95, firsthand),
    specificityConfidence: Math.min(0.95, specificity),
    temporalExperienceSignal: Math.min(0.95, temporal),
    ownershipSignal: Math.min(0.95, ownership),
    affectsScoring,
    reason: affectsScoring ? "usable_experience" : experienceQuality === "noise" ? "noise" : "low_experience_signal",
  };
}

function noise(reason: string): ExperienceQualityAssessment {
  return {
    experienceQuality: "noise",
    firsthandExperienceConfidence: 0.05,
    specificityConfidence: 0.05,
    temporalExperienceSignal: 0.05,
    ownershipSignal: 0.05,
    affectsScoring: false,
    reason,
  };
}

function low(reason: string): ExperienceQualityAssessment {
  return {
    experienceQuality: "weak",
    firsthandExperienceConfidence: 0.15,
    specificityConfidence: 0.1,
    temporalExperienceSignal: 0.1,
    ownershipSignal: 0.1,
    affectsScoring: false,
    reason,
  };
}
