import type { ContentTagKey } from './taxonomy';

const RULES: Array<{ tag: ContentTagKey; pattern: RegExp }> = [
  {
    tag: 'how_to_use',
    pattern:
      /\b(how to|how i|tutorial|guide|setup|set up|install|unbox\w*|use this|using|tips|steps?)\b/i,
  },
  {
    tag: 'how_it_works',
    pattern: /\b(how it works|explained|explains?|science|mechanism|teardown|inside|why it)\b/i,
  },
  {
    tag: 'composition',
    pattern: /\b(specs?|specifications|materials?|build quality|made of|what.?s in|ingredients?|components?)\b/i,
  },
  {
    tag: 'who_its_for',
    pattern: /\b(who (it'?s|is) for|worth it|should you buy|buyer'?s guide|best for|good for|beginners?)\b/i,
  },
  {
    tag: 'results_over_time',
    pattern: /\b(long.?term|after \d+|months? later|years? later|week|month|durability|still worth|update)\b/i,
  },
  {
    tag: 'precautions',
    pattern: /\b(problems?|issues?|defects?|don'?t buy|avoid|warning|caution|side effect|broke|failure|recall)\b/i,
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
