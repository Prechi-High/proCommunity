import type { SkinType } from './types';

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: { id: string; label: string; type: SkinType }[];
}

/** Three-question sheet from sourced-v1 (2).html — not a diagnosis. */
export const FIT_QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'midday',
    prompt: 'By midday, how does your skin usually feel?',
    options: [
      { id: 'shiny-all', label: 'Shiny all over', type: 'oily' },
      {
        id: 'tzone',
        label: 'Shiny on forehead and nose, normal elsewhere',
        type: 'combination',
      },
      { id: 'tight', label: 'Tight, dry or flaky', type: 'dry' },
      { id: 'comfortable', label: 'Comfortable, not much change', type: 'combination' },
    ],
  },
  {
    id: 'after-wash',
    prompt: 'After washing your face, it feels…',
    options: [
      { id: 'tight-now', label: 'Tight right away', type: 'dry' },
      { id: 'fine-then-shiny', label: 'Fine for an hour, then shiny', type: 'oily' },
      { id: 'comfortable-day', label: 'Comfortable all day', type: 'combination' },
      { id: 'stingy', label: 'Stingy or red', type: 'sensitive' },
    ],
  },
  {
    id: 'pores',
    prompt: 'How do your pores look?',
    options: [
      { id: 'large', label: 'Large and visible all over', type: 'oily' },
      { id: 'tzone-pores', label: 'Visible on nose and forehead', type: 'combination' },
      { id: 'barely', label: 'Barely visible', type: 'dry' },
      { id: 'react', label: 'I react easily to new products', type: 'sensitive' },
    ],
  },
];

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'midday',
    prompt: 'By midday, how does your skin usually feel?',
    options: [
      { id: 'shiny-all', label: 'Shiny all over', type: 'oily' },
      {
        id: 'tzone',
        label: 'Shiny on forehead and nose, normal elsewhere',
        type: 'combination',
      },
      { id: 'tight', label: 'Tight, dry, or flaky', type: 'dry' },
      { id: 'comfortable', label: 'Comfortable — not much change', type: 'normal' },
      { id: 'reactive', label: 'Warm, stingy, or easily flushed', type: 'sensitive' },
    ],
  },
  {
    id: 'after-wash',
    prompt: 'After a gentle cleanse, how does your skin feel 20 minutes later with nothing on it?',
    options: [
      { id: 'oil-returns', label: 'Oil is already coming back', type: 'oily' },
      { id: 'tzone-only', label: 'The T-zone looks shiny; cheeks feel fine', type: 'combination' },
      { id: 'tight-flaky', label: 'Tight, dry, or a little flaky', type: 'dry' },
      { id: 'settled', label: 'Settled and comfortable', type: 'normal' },
      { id: 'stings', label: 'It often stings or looks red', type: 'sensitive' },
    ],
  },
  {
    id: 'pores',
    prompt: 'How visible are your pores, especially on the nose and cheeks?',
    options: [
      { id: 'very', label: 'Very visible across a wide area', type: 'oily' },
      { id: 'tzone-pores', label: 'Mostly on the nose and forehead', type: 'combination' },
      { id: 'fine', label: 'Fine, not very noticeable', type: 'dry' },
      { id: 'average', label: 'Average — I notice them if I look', type: 'normal' },
      { id: 'red-pores', label: 'They look more obvious when my skin is irritated', type: 'sensitive' },
    ],
  },
  {
    id: 'new-product',
    prompt: 'How does your skin typically react to a new product?',
    options: [
      { id: 'breakout', label: 'It can clog or look shinier', type: 'oily' },
      { id: 'mixed', label: 'Cheeks and T-zone often react differently', type: 'combination' },
      { id: 'drier', label: 'It can feel drier or tighter', type: 'dry' },
      { id: 'steady', label: 'It usually takes it in stride', type: 'normal' },
      { id: 'sting', label: 'It often stings, itches, or flushes', type: 'sensitive' },
    ],
  },
  {
    id: 'priority',
    prompt: 'What bothers you most on a typical day?',
    options: [
      { id: 'shine', label: 'Shine and clogged-looking pores', type: 'oily' },
      { id: 'both', label: 'Oily middle, dry or tight cheeks', type: 'combination' },
      { id: 'flakes', label: 'Dry patches and tightness', type: 'dry' },
      { id: 'none', label: 'Nothing major — I want to maintain it', type: 'normal' },
      { id: 'react', label: 'Redness, stinging, or easily upset skin', type: 'sensitive' },
    ],
  },
];

export function inferSkinType(answers: Record<string, string>): SkinType {
  const counts: Record<SkinType, number> = {
    dry: 0,
    oily: 0,
    combination: 0,
    sensitive: 0,
    normal: 0,
    unknown: 0,
  };

  for (const question of QUIZ_QUESTIONS) {
    const selected = question.options.find((option) => option.id === answers[question.id]);
    if (selected) counts[selected.type] += 1;
  }

  const ranked = (Object.entries(counts) as [SkinType, number][])
    .filter(([type]) => type !== 'unknown')
    .sort((a, b) => b[1] - a[1]);

  return ranked[0]?.[1] ? ranked[0][0] : 'unknown';
}

export const SKIN_TYPE_LABEL: Record<SkinType, string> = {
  dry: 'dry',
  oily: 'oily',
  combination: 'combination',
  sensitive: 'sensitive',
  normal: 'normal',
  unknown: 'not set',
};

export const CONCERN_LABEL: Record<string, string> = {
  acne: 'Acne',
  aging: 'Aging',
  hyperpigmentation: 'Dark spots',
  sensitivity: 'Sensitivity',
  dryness: 'Dryness',
  oiliness: 'Oiliness',
  redness: 'Redness',
};
