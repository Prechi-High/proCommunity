/** Unmask brand copy — see project info/Unmask_Brand_Kit/guide/Brand_Guide.md */
export const BRAND_NAME = 'Unmask';

export const BRAND_TAGLINE = 'Know before you buy.';

export const BRAND_COPY = {
  searchPrompt: 'What are you thinking of buying?',
  searchPlaceholder: 'Search a product, brand, or model',
  homeAction: 'Unmask a product',
  resultsIntro: "Here's what we found.",
  contributionPrompt: 'What should the next buyer know?',
  disclaimer:
    'Unmask organises public evidence from across the web. Always check the seller and product details before you buy.',
  positioning: 'Your product investigator — see beyond the sales pitch.',
} as const;

export const brandAssets = {
  wordmarkInk: require('../assets/brand/wordmark-ink.png'),
  combinationInk: require('../assets/brand/combination-ink.png'),
  combinationWhite: require('../assets/brand/combination-white.png'),
  symbolInk: require('../assets/brand/symbol-ink.png'),
  symbolWhite: require('../assets/brand/symbol-white.png'),
} as const;
