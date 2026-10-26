import type { FeedItem } from "./feed";
const ago = (hours: number) =>
  new Date(Date.now() - hours * 3600000).toISOString();
const photo = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=80`;
const cream = photo("photo-1608571423902-eed4a5ad8108");
const serum = photo("photo-1620916566398-39f1143ab7be");
const cleanse = photo("photo-1556229010-6c3f2c9ca5f8");
const face = (n: number) => `https://i.pravatar.cc/128?img=${n}`;
export const SAMPLE_CREATORS = [
  {
    user_id: "sample-c-chioma",
    display_name: "Chioma",
    handle: "chioma.explains",
    avatar_url: face(20),
  },
  {
    user_id: "sample-c-adaeze",
    display_name: "Adaeze",
    handle: "adaeze.skin",
    avatar_url: face(45),
  },
  {
    user_id: "sample-c-ireti",
    display_name: "Ireti",
    handle: "ireti.unmasks",
    avatar_url: face(36),
  },
];
const products = [
  { id: "demo-dew", name: "Dew Days Daily Cream", image: cream },
  { id: "demo-sun", name: "Sunroom Daily SPF", image: serum },
  { id: "demo-cleanse", name: "Soft Start Gel Cleanser", image: cleanse },
];
function story(
  id: string,
  kind: FeedItem["kind"],
  title: string,
  body: string,
  author: string,
  product: number,
  hours: number,
  extra: Partial<FeedItem> = {},
): FeedItem {
  const p = products[product];
  return {
    id,
    kind,
    title,
    body,
    author,
    createdAt: ago(hours),
    productId: p.id,
    productName: p.name,
    productImage: p.image,
    photo: kind === "question" ? undefined : p.image,
    creatorAvatar: face(
      author === "Amaka"
        ? 32
        : author === "Chioma"
          ? 20
          : author === "Adaeze"
            ? 45
            : 24,
    ),
    chips: [],
    sample: true,
    href: `/${kind === "question" ? "question" : kind === "unmask" ? "investigation" : "story"}/${id}`,
    cta:
      kind === "question"
        ? "Join the conversation"
        : kind === "unmask"
          ? "See the story"
          : "Read the experience",
    ...extra,
  };
}
export const SAMPLE_FEED: FeedItem[] = [
  story(
    "sample-exp-1",
    "experience",
    "Week six. My skin feels less tight after washing.",
    "I wanted something simple for my dry skin. I use a small amount each evening. Week one: no obvious change. Week three: less tightness. Week six: still using it. This is an imagined experience for the design preview, not a recommendation.",
    "Amaka",
    0,
    2,
    { chips: ["6 weeks", "Dry skin"], replies: 3 },
  ),
  story(
    "sample-unmask-1",
    "unmask",
    "Same cream. Two very different experiences. Why?",
    "Amaka liked the feel. Libati noticed stinging. The community wants a closer look at how they used it and what else was in their routines.",
    "Libati",
    0,
    3,
    { chips: ["Open for Sparks"], status: "Open for Sparks", sparks: 340 },
  ),
  story(
    "sample-q-1",
    "question",
    "Does this sunscreen sit well under makeup?",
    "Combination skin here. I’m looking for experiences from people who wear it through a full workday. What was it like by lunchtime?",
    "Tunde",
    1,
    4,
    { replies: 2, chips: ["Before I buy"] },
  ),
  story(
    "sample-exp-2",
    "experience",
    "It felt good at first. Then my cheeks started stinging.",
    "I added this cream and a new serum in the same week. I stopped when the stinging started. I don’t know which change caused it — that’s what I want to understand. Fictional demo story.",
    "Libati",
    0,
    5,
    { chips: ["2 weeks", "Sensitive skin"], replies: 2 },
  ),
  story(
    "sample-unmask-2",
    "unmask",
    "Why does my sunscreen roll up when I layer it?",
    "Chioma is gathering routines and checking the product directions. This preview shows what a story looks like after a creator is assigned.",
    "Chioma",
    1,
    7,
    {
      creatorName: "Chioma",
      authorId: "sample-c-chioma",
      status: "Creator assigned",
      sparks: 520,
      chips: ["Creator assigned"],
    },
  ),
  story(
    "sample-exp-3",
    "experience",
    "One wash each evening. Here’s my month so far.",
    "Week one: easy to rinse. Week two: I reduced the amount. Week four: I’m keeping the same routine so I can compare. My notes matter more than a star rating. Fictional demo experience.",
    "Adaeze",
    2,
    10,
    {
      authorId: "sample-c-adaeze",
      chips: ["4 weeks", "Combination skin"],
      replies: 2,
    },
  ),
  story(
    "sample-q-2",
    "question",
    "What do you record when you start a new product?",
    "I want my updates to be useful. How often do you take a photo, and what changes do you write down?",
    "Bukky",
    2,
    14,
    { replies: 2 },
  ),
  story(
    "sample-unmask-3",
    "unmask",
    "A cleanser that feels gentler — what should we look at?",
    "Adaeze is preparing a comparison of the routines people shared. No company or expert has actually been contacted for this demo.",
    "Adaeze",
    2,
    18,
    {
      authorId: "sample-c-adaeze",
      creatorName: "Adaeze",
      status: "In the making",
      sparks: 680,
      chips: ["In the making"],
    },
  ),
  story(
    "sample-unmask-4",
    "unmask",
    "What a finished Ultra Unmask could look like.",
    "An example of a creator bringing the community’s questions, usage context and remaining unknowns together.",
    "Ireti",
    0,
    24,
    {
      authorId: "sample-c-ireti",
      creatorName: "Ireti",
      status: "Ultra Unmasked",
      sparks: 890,
      chips: ["Example answer"],
    },
  ),
];
for (const [i, row] of SAMPLE_FEED.entries()) {
  row.likes = [38, 24, 12, 17, 46, 29, 8, 53, 71][i] ?? 0;
  if (row.kind !== "unmask") {
    const linked = SAMPLE_FEED.find(
      (x) => x.kind === "unmask" && x.productId === row.productId,
    );
    if (linked) {
      row.sparkTargetId = linked.id;
      row.sparks = linked.sparks;
    }
  }
}
export const SAMPLE_REPLIES: Record<
  string,
  {
    id: string;
    author: string;
    body: string;
    createdAt: string;
    avatar: string;
  }[]
> = {
  "sample-exp-1": [
    {
      id: "demo-r1",
      author: "Bukky",
      body: "The week-by-week notes make this so much easier to understand.",
      createdAt: ago(1),
      avatar: face(24),
    },
    {
      id: "demo-r2",
      author: "Amaka",
      body: "I’m keeping the rest of my routine the same for my next update.",
      createdAt: ago(0.5),
      avatar: face(32),
    },
  ],
  "sample-q-1": [
    {
      id: "demo-a1",
      author: "Adaeze",
      body: "Could you share what you layer underneath? That context would help people reply.",
      createdAt: ago(2),
      avatar: face(45),
    },
    {
      id: "demo-a2",
      author: "Tunde",
      body: "Just moisturiser at the moment. I’ll include that in my question.",
      createdAt: ago(1),
      avatar: face(12),
    },
  ],
};
for (const row of SAMPLE_FEED)
  row.replies = SAMPLE_REPLIES[row.id]?.length ?? 0;
export const SAMPLE_UNMASK_DETAIL: Record<
  string,
  {
    findings?: string;
    uncertainty?: string;
    supporters: number;
    thunder: number;
  }
> = {
  "sample-unmask-1": { supporters: 28, thunder: 1 },
  "sample-unmask-2": { supporters: 47, thunder: 2 },
  "sample-unmask-3": { supporters: 56, thunder: 3 },
  "sample-unmask-4": {
    supporters: 64,
    thunder: 4,
    findings:
      "A finished story would separate what users reported, what a company or expert actually said, and what remains unknown. This is a layout example; no testing, expert interview or brand response took place.",
    uncertainty:
      "All products, people and findings in this preview are fictional.",
  },
};
export const SAMPLE_SHELF = products.map((p, i) => ({
  ...p,
  brand: "Fictional demo product",
  note: ["Week 6 · evening", "Week 2 · morning", "Week 4 · evening"][i],
  href: [
    "/story/sample-exp-1",
    "/investigation/sample-unmask-2",
    "/story/sample-exp-3",
  ][i],
}));
export const SAMPLE_OFFERS = products.map((p, i) => ({
  id: `sample-offer-${i + 1}`,
  sponsor: "Demo Beauty Store",
  title: `Discover ${p.name}`,
  product_id: p.id,
  kind: "Demo placement",
  price: [12500, 18000, 8500][i],
  compare_at_price: [15000, 20000, null][i],
  currency: "NGN",
  description:
    "An illustration of an offer connected to community experiences.",
  disclosure: "Fictional offer. No purchase or paid placement took place.",
  unmask_catalog: {
    name: p.name,
    brand: "Demo",
    category: "Skin",
    image_url: p.image,
  },
  experience_count: SAMPLE_FEED.filter(
    (r) => r.kind === "experience" && r.productId === p.id,
  ).length,
}));
export function sampleById(id?: string | null) {
  return SAMPLE_FEED.find((r) => r.id === id);
}
export function previewFeed(live: FeedItem[]): FeedItem[] {
  return [...live, ...SAMPLE_FEED];
}
export function previewUnmasks(
  live: FeedItem[],
  sort: "Recent" | "Most sparked",
) {
  const rows = previewFeed(live).filter((r) => r.kind === "unmask");
  return sort === "Most sparked"
    ? rows.sort((a, b) => (b.sparks ?? 0) - (a.sparks ?? 0))
    : rows;
}
