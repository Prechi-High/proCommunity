import type { ContentTagKey } from './taxonomy';

const RULES: Array<{ tag: ContentTagKey; pattern: RegExp }> = [
  {
    tag: 'how_to_use',
    pattern:
      /\b(how to|how i|tutorial|routine|apply|application|layer|use this|using|cleanse|wash|steps?)\b/i,
  },
  {
    tag: 'how_it_works',
    pattern: /\b(how it works|science|mechanism|barrier|ceramide|explains?|dermatologist|why it)\b/i,
  },
  {
    tag: 'composition',
    pattern: /\b(ingredient|composition|formula|formulati|what.?s in|niacinamide|retinol|salicylic|zinc)\b/i,
  },
  {
    tag: 'who_its_for',
    pattern: /\b(oily|dry|sensitive|acne|combination|skin type|who (it'?s|is) for|good for)\b/i,
  },
  {
    tag: 'results_over_time',
    pattern: /\b(before\s*after|results?|week|month|progress|transform|journey|glow|healing)\b/i,
  },
  {
    tag: 'precautions',
    pattern: /\b(irritat|sting|burn|side effect|patch test|caution|warning|purge|react)\b/i,
  },
  {
    tag: 'comparisons',
    pattern: /\b(vs\.?|versus|compare|comparison|dupe|alternative|better than)\b/i,
  },
];

/** Keyword tags from title/author. Never invents keys outside the fixed taxonomy. */
export function heuristicContentTags(
  title: string,
  author = '',
): { tags: ContentTagKey[]; confidence: number; justification: string } {
  const hay = `${title} ${author}`.trim();
  if (!hay || /^(instagram|facebook|tiktok|pinterest|youtube)\s*video$/i.test(hay)) {
    return {
      tags: ['who_its_for'],
      confidence: 0.71,
      justification: 'heuristic_product_association',
    };
  }
  const tags: ContentTagKey[] = [];
  for (const rule of RULES) {
    if (rule.pattern.test(hay) && !tags.includes(rule.tag)) tags.push(rule.tag);
  }
  if (!tags.length) {
    return {
      tags: ['who_its_for'],
      confidence: 0.71,
      justification: 'heuristic_default_who_its_for',
    };
  }
  return {
    tags: tags.slice(0, 3),
    confidence: 0.78,
    justification: `heuristic:${tags.join(',')}`,
  };
}

export function clipMatchesTag(
  title: string,
  author: string,
  tag: ContentTagKey,
  existingTags: string[] = [],
): boolean {
  if (existingTags.includes(tag)) return true;
  return heuristicContentTags(title, author).tags.includes(tag);
}
