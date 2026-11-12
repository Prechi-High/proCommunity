import {
  activeMoments,
  type Expression,
  type Moment,
  type UnmaskCard,
} from "./model";

const amaka = require("../../assets/social/amaka.jpg") as number;
const chioma = require("../../assets/social/chioma.jpg") as number;
const zainab = require("../../assets/social/zainab.jpg") as number;
const ife = require("../../assets/social/ife.jpg") as number;
const adaeze = require("../../assets/social/adaeze.jpg") as number;
const tunde = require("../../assets/social/tunde.jpg") as number;
const glow = require("../../assets/social/glow.jpg") as number;
const hands = require("../../assets/social/hands.jpg") as number;

const hour = 3600000;

function at(offsetHours: number) {
  return new Date(Date.now() + offsetHours * hour).toISOString();
}

/** Imagined people. Every one is marked sample. Never mix these flags onto a real row. */
export function sampleMoments(now = Date.now()): Moment[] {
  const rows: Moment[] = [
    {
      id: "sample-amaka-now",
      authorId: "sample-amaka",
      author: "Amaka",
      handle: "amaka",
      avatar: amaka,
      media: amaka,
      mediaKind: "photo",
      caption: "This is me, before the day starts.",
      createdAt: at(-1),
      expiresAt: at(20),
      sample: true,
      attach: { kind: "card", id: "sample-amaka", label: "My Unmask" },
    },
    {
      id: "sample-amaka-routine",
      authorId: "sample-amaka",
      author: "Amaka",
      handle: "amaka",
      avatar: amaka,
      media: glow,
      mediaKind: "photo",
      caption: "And this is what I'm using right now.",
      createdAt: at(-2),
      expiresAt: at(18),
      sample: true,
      attach: { kind: "card", id: "sample-amaka", label: "My Unmask" },
    },
    {
      id: "sample-chioma-now",
      authorId: "sample-chioma",
      author: "Chioma",
      handle: "chioma",
      avatar: chioma,
      media: chioma,
      mediaKind: "photo",
      caption: "Good for who? For my skin, today, this is it.",
      createdAt: at(-3),
      expiresAt: at(21),
      sample: true,
      poll: { prompt: "Do you show your routine?", a: "Yes", b: "Not yet" },
    },
    {
      id: "sample-zainab-now",
      authorId: "sample-zainab",
      author: "Zainab",
      handle: "zainab",
      avatar: zainab,
      media: zainab,
      mediaKind: "photo",
      caption: "Week three of paying attention.",
      createdAt: at(-4),
      expiresAt: at(19),
      sample: true,
      attach: { kind: "timeline", id: "sample-zainab", label: "Week 3", detail: "Same product. No verdict yet." },
    },
    {
      id: "sample-ife-now",
      authorId: "sample-ife",
      author: "Ife",
      handle: "ife",
      avatar: ife,
      media: ife,
      mediaKind: "photo",
      caption: "Your skin isn't everybody else's skin.",
      createdAt: at(-5),
      expiresAt: at(17),
      sample: true,
      attach: { kind: "card", id: "sample-ife", label: "My Unmask" },
    },
    {
      id: "sample-adaeze-now",
      authorId: "sample-adaeze",
      author: "Adaeze",
      handle: "adaeze",
      avatar: adaeze,
      media: adaeze,
      mediaKind: "photo",
      caption: "Show us your Unmask. This is mine.",
      createdAt: at(-6),
      expiresAt: at(16),
      sample: true,
      attach: { kind: "card", id: "sample-adaeze", label: "My Unmask" },
    },
    {
      id: "sample-tunde-now",
      authorId: "sample-tunde",
      author: "Tunde",
      handle: "tunde",
      avatar: tunde,
      media: tunde,
      mediaKind: "photo",
      caption: "Check my Unmask. Skin, not a costume.",
      createdAt: at(-7),
      expiresAt: at(15),
      sample: true,
      attach: { kind: "card", id: "sample-tunde", label: "My Unmask" },
    },
  ];
  return activeMoments(rows, now);
}

export function samplePosts(): Expression[] {
  return [
    {
      id: "sample-post-amaka",
      authorId: "sample-amaka",
      author: "Amaka",
      handle: "amaka",
      avatar: amaka,
      media: amaka,
      mediaKind: "photo",
      caption: "This is me. This is my Unmask.",
      createdAt: at(-2),
      sample: true,
      attach: { kind: "card", id: "sample-amaka", label: "My Unmask" },
    },
    {
      id: "sample-post-chioma",
      authorId: "sample-chioma",
      author: "Chioma",
      handle: "chioma",
      avatar: chioma,
      media: chioma,
      mediaKind: "photo",
      caption: "Not a review. Just what my skin is doing today.",
      createdAt: at(-5),
      sample: true,
      attach: { kind: "card", id: "sample-chioma", label: "My Unmask" },
    },
    {
      id: "sample-post-ife",
      authorId: "sample-ife",
      author: "Ife",
      handle: "ife",
      avatar: ife,
      media: hands,
      mediaKind: "photo",
      caption: "A slow morning. This is what I'm using right now.",
      createdAt: at(-8),
      sample: true,
      attach: { kind: "product", id: "sample-ife", label: "What I use" },
    },
    {
      id: "sample-post-zainab",
      authorId: "sample-zainab",
      author: "Zainab",
      handle: "zainab",
      avatar: zainab,
      media: zainab,
      mediaKind: "photo",
      caption: "Progress is a face, not a star rating.",
      createdAt: at(-12),
      sample: true,
      attach: { kind: "timeline", id: "sample-zainab", label: "Week 3" },
    },
    {
      id: "sample-post-adaeze",
      authorId: "sample-adaeze",
      author: "Adaeze",
      handle: "adaeze",
      avatar: adaeze,
      media: glow,
      mediaKind: "photo",
      caption: "New to the routine. I'll show what happens.",
      createdAt: at(-20),
      sample: true,
      attach: { kind: "card", id: "sample-adaeze", label: "My Unmask" },
    },
    {
      id: "sample-post-tunde",
      authorId: "sample-tunde",
      author: "Tunde",
      handle: "tunde",
      avatar: tunde,
      media: tunde,
      mediaKind: "photo",
      caption: "This is what I use when I want to look like myself.",
      createdAt: at(-26),
      sample: true,
      attach: { kind: "card", id: "sample-tunde", label: "My Unmask" },
    },
  ];
}

const CARDS: UnmaskCard[] = [
  {
    userId: "sample-amaka",
    name: "Amaka",
    handle: "amaka",
    avatar: amaka,
    skin: "Dry, easily tight",
    hair: "Long, colored",
    routine: "Evening: cleanse, a small serum, then cream. Morning: rinse and protect.",
    concerns: ["Tightness", "Dullness"],
    goals: "Skin that feels comfortable by week six.",
    products: [
      { id: "sample-dew", name: "Cream, evenings" },
      { id: "sample-serum", name: "Serum, three nights" },
    ],
    timelines: [{ id: "sample-amaka-timeline", label: "Evening cream · Week 6" }],
    sample: true,
  },
  {
    userId: "sample-chioma",
    name: "Chioma",
    handle: "chioma",
    avatar: chioma,
    skin: "Combination",
    hair: "Short, natural",
    routine: "Light layers. I stop when something stings.",
    concerns: ["Shine", "Texture"],
    goals: "A routine I can actually repeat.",
    products: [{ id: "sample-chioma-spf", name: "Day protection" }],
    timelines: [{ id: "sample-chioma-timeline", label: "Day protection · Week 2" }],
    sample: true,
  },
  {
    userId: "sample-zainab",
    name: "Zainab",
    handle: "zainab",
    avatar: zainab,
    skin: "Normal to dry",
    routine: "Same order every night, so the week means something.",
    concerns: ["Dryness"],
    products: [{ id: "sample-zainab-oil", name: "Face oil, last step" }],
    timelines: [{ id: "sample-zainab-timeline", label: "Face oil · Week 3" }],
    sample: true,
  },
  {
    userId: "sample-ife",
    name: "Ife",
    handle: "ife",
    avatar: ife,
    skin: "Sensitive",
    routine: "Few products. Plenty of time between new ones.",
    concerns: ["Sensitivity"],
    goals: "Know what changed, and what didn't.",
    products: [{ id: "sample-ife-mask", name: "Mask, Sundays" }],
    timelines: [],
    sample: true,
  },
  {
    userId: "sample-adaeze",
    name: "Adaeze",
    handle: "adaeze",
    avatar: adaeze,
    skin: "Combination",
    routine: "Cleanse, treat, moisturize. I write the week, not a score.",
    concerns: ["Breakouts", "Marks"],
    products: [
      { id: "sample-ada-cleanse", name: "Gel cleanser" },
      { id: "sample-ada-cream", name: "Light cream" },
    ],
    timelines: [{ id: "sample-adaeze-timeline", label: "Gel cleanser · Month 1" }],
    sample: true,
  },
  {
    userId: "sample-tunde",
    name: "Tunde",
    handle: "tunde",
    avatar: tunde,
    skin: "Oily in Lagos heat",
    hair: "Short",
    routine: "Wash, a light moisturizer, sun protection if I'm out.",
    concerns: ["Shine"],
    products: [{ id: "sample-tunde-spf", name: "Light protection" }],
    timelines: [],
    sample: true,
  },
];

export function sampleCard(id: string): UnmaskCard | null {
  return CARDS.find((card) => card.userId === id) ?? null;
}

export function samplePostsByAuthor(authorId: string): Expression[] {
  return samplePosts().filter((post) => post.authorId === authorId);
}
