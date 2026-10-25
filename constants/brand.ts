/** Unmask voice — two layers of clarity. Plain words. Loss aversion without cruelty. */

export const BRAND_NAME = 'Unmask';

export const BRAND_TAGLINE = 'Know before you buy.';

export const BRAND_COPY = {
  searchPrompt: 'Search a product. See what people lived.',
  searchPlaceholder: 'Name it, or ask what happened.',
  homeAction: 'Share what happened',
  resultsIntro: 'Lived stories and questions for this search.',
  contributionPrompt: 'What happened when you used it?',
  disclaimer:
    'Unmask gathers lived experience and Unmasker answers. Always check the seller and the product in your hand before you buy.',
  positioning: 'See what happened to people who used it — then decide.',
} as const;

export const COPY = {
  welcomeTitle: 'Don’t find out the hard way.',
  welcomeSupport:
    'See what people lived with a product before you buy. If it went wrong — or surprisingly right — you can take it further.',
  welcomeExplore: 'See what people lived',
  welcomeShare: 'I used something',
  homeEyebrow: 'Unmask',
  homeTitle: 'Know before you buy.',
  homePrompt: 'Tried it? Tell us what happened. Keep telling us as it changes.',
  questionPrompt: 'What do you want to know before you buy?',
  praisePrompt: 'It worked. Show what changed, so someone else can buy right.',
  followUpPrompt: 'How is it going now?',
  requestPrompt: 'This deserves an answer.',
  supportPrompt: 'Want why — not just a post? Add Sparks.',
  supportConfirm: (n: number) =>
    `You added ${n} Sparks. You’ve supported this investigation.`,
  working: 'An Unmask Creator is looking into this.',
  answer: 'Here’s what we found.',
  noAnswer: 'The question is still open. Follow its progress or contribute your experience.',
  privateTimeline: 'Your progress, for you. Share only what you choose.',
  emptyFeed: 'This place fills with lived stories. What have you tried?',
  noStories: 'Not enough lived experience here yet.',
  noStoriesNext: 'Ask the community. Or be the first to say what happened.',
  unmaskTeach:
    'Community Unmask: see what people lived. Ultra Unmask: a creator investigates your question.',
  sparkTeach: 'Sparks are paid support. 10 Sparks = ₦100. They support a deeper investigation. They cannot buy a conclusion.',
  sparkSheetTitle: 'Help take this question further.',
  sparkSheetDetail:
    '10 Sparks · ₦100. You’re not buying a verdict. You’re supporting the work of investigating this question. The team confirms the scope and assigns a creator.',
  sparkAction: 'Add 10 Sparks',
  storyLive: 'Your story is live. Come back and update it.',
  requestOpen: 'Your Ultra Unmask is open for Sparks.',
  photoFailed: 'Photo didn’t upload.',
  photoFailedNext: 'Your words are still here. Try again.',
  noMatch: 'Can’t find this product?',
  noMatchNext: 'Add its name and a photo.',
  checkingSupport: 'Still checking your Sparks.',
  supportFailed: 'Sparks weren’t added.',
  publicPreview: 'Here’s what people will see.',
  createExperience: 'Share what happened',
  createQuestion: 'Ask before you buy',
  createTrack: 'Track it over time',
  readStory: 'Read what they lived',
  answerCta: 'Answer with what you lived',
  seeUnmask: 'See the Ultra Unmask',
  watchUnmask: 'Watch the Ultra Unmask',
  takeFurther: 'Investigate this question',
  requestUnmask: 'Start an Ultra Unmask',
  addUpdate: 'Add what changed',
  addSparks: 'Add Sparks',
  layerOneTitle: 'Ask the community',
  layerOneBody: 'Search. See lived stories that get updated. If we have too little, ask.',
  layerTwoTitle: 'Ultra Unmask',
  layerTwoBody: 'When you need why, Spark it. A creator can gather experiences and seek company or expert responses.',
  unmaskersTitle: 'Unmask Creators',
  unmaskersTeach: 'Meet the creators who investigate your questions. Follow their work. Creator requests are coming later.',
  chooseUnmasker: 'Choose a creator · coming soon',
  offersHook: 'See what people lived before you visit a store.',
  offersTitle: 'Unmask it first.',
  offersEmpty: 'No offers right now. Search a product instead — that’s the real way in.',
  waitingUnmasker: 'Waiting for a creator assignment.',
  unmaskerHasThis: 'is taking this further',
  contributePlaceholder: 'Day one it stung. Week six it settled. Keep writing as it changes.',
  todaySubtitle: 'Lived stories, questions, and Ultra Unmasks.',
  unmaskTabSubtitle: 'Investigate this question. Spark it. An Unmasker can take it to the company.',
  productTabSubtitle: 'Track it over time. Share only what you choose.',
} as const;

export const BRAND_SECTIONS = {
  whatToKnow: 'What to know',
  claimsEvidence: 'Claims & evidence',
  ownerExperiences: 'Lived stories',
  watchFor: 'What to watch for',
  whereToBuy: 'Where to buy',
  alternatives: 'Alternatives',
} as const;

export const brandAssets = {
  wordmarkInk: require('../assets/brand/wordmark-ink.png'),
  combinationInk: require('../assets/brand/combination-ink.png'),
  combinationWhite: require('../assets/brand/combination-white.png'),
  fullTaglineInk: require('../assets/brand/full-tagline-ink.png'),
  fullTaglineWhite: require('../assets/brand/full-tagline-white.png'),
  symbolInk: require('../assets/brand/symbol-ink.png'),
  symbolWhite: require('../assets/brand/symbol-white.png'),
} as const;
