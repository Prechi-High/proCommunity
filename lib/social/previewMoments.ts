/** Visual community preview. Real photography and short clips.
 *  These are design examples of the room — not claimed live accounts.
 */

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;

export type PulseComment = { name: string; text: string };

export type PulseMoment = {
  id: string;
  name: string;
  face: string;
  media: string;
  video?: string;
  caption: string;
  product?: string;
  timeline?: string;
  skin?: string;
  likes: number;
  comments: number;
  thread: PulseComment[];
  invite: string;
  stickers?: string[];
};

export const PREVIEW_MOMENTS: PulseMoment[] = [
  {
    id: "m-ada",
    name: "Ada",
    face: img("photo-1531123897727-8f129e1688ce"),
    media: img("photo-1616683693504-3ea7e9ad6fec"),
    video: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    caption: "No ring light. Just week 2 of this cream and the face I actually have.",
    product: "Dew Days Daily Cream",
    timeline: "Week 2",
    skin: "Combination",
    likes: 186,
    comments: 24,
    thread: [
      { name: "Tunde", text: "Week 2 was when mine stopped feeling tight." },
      { name: "Ife", text: "Same cream, drier skin. Still watching." },
    ],
    invite: "You don’t need a photoshoot.",
  },
  {
    id: "m-zuri",
    name: "Zuri",
    face: img("photo-1524504388940-b1c1722653e1"),
    media: img("photo-1596462502278-27bfdc403348"),
    caption: "GRWM with the routine I actually finish. Serum, then out the door.",
    product: "Sunroom Daily SPF",
    timeline: "Daily",
    skin: "Oily",
    likes: 412,
    comments: 37,
    thread: [{ name: "Malik", text: "The routine is the post. I like that." }],
    invite: "Show the routine. Flex it.",
  },
  {
    id: "m-malik",
    name: "Malik",
    face: img("photo-1506794778202-cad84cf45f1d"),
    media: img("photo-1621607512214-68297480165e"),
    caption: "Beard oil, day 10. Not a review. Just what my skin is doing.",
    product: "Soft Start Gel Cleanser",
    timeline: "Day 10",
    skin: "Sensitive",
    likes: 96,
    comments: 11,
    thread: [{ name: "Ken", text: "Beard oil day 10 here too." }],
    invite: "Men unmask too.",
  },
  {
    id: "m-nene",
    name: "Nene",
    face: img("photo-1529626455594-4ff0802cfb7e"),
    media: img("photo-1570172619644-dfd03ed5d881"),
    caption: "Good for who? For me, in this weather, this sunscreen didn’t pill.",
    product: "Sunroom Daily SPF",
    skin: "Dry",
    likes: 154,
    comments: 19,
    thread: [{ name: "Lola", text: "Good for who is the only honest question." }],
    invite: "Context is the flex.",
  },
  {
    id: "m-tunde",
    name: "Tunde",
    face: img("photo-1500648767791-00dcc994a43e"),
    media: img("photo-1556228720-195a672e8a03"),
    caption: "Shelf check. One product I’m actually tracking. The rest can wait.",
    timeline: "Start",
    skin: "Normal",
    likes: 73,
    comments: 8,
    thread: [{ name: "Ada", text: "One product is enough to start." }],
    invite: "One product. That’s the whole habit.",
  },
  {
    id: "m-ife",
    name: "Ife",
    face: img("photo-1487412720507-e7ab37603c6f"),
    media: img("photo-1512496015851-a90fb38ba796"),
    caption: "Mirror selfie because I never post. This is my Unmask anyway.",
    product: "Dew Days Daily Cream",
    skin: "Combination",
    likes: 221,
    comments: 16,
    thread: [{ name: "Zuri", text: "A mirror shot is a real post." }],
    invite: "A shy post still counts.",
  },
  {
    id: "m-ken",
    name: "Ken",
    face: img("photo-1507003211169-0a1dd7228f2d"),
    media: img("photo-1598440947619-2c35fc9aa908"),
    caption: "Hairline check, month 1. I’ll update if it changes. No verdict yet.",
    timeline: "Month 1",
    skin: "Oily",
    likes: 64,
    comments: 9,
    thread: [{ name: "Nene", text: "Month 1 with no verdict. That’s the point." }],
    invite: "Show what happened, not a star rating.",
  },
  {
    id: "m-lola",
    name: "Lola",
    face: img("photo-1531746020798-e6953c6e8e04"),
    media: img("photo-1522335789203-aabd1fc54bc9"),
    caption: "The glow is the routine, not a filter. Timeline is on the serum.",
    product: "Sunroom Daily SPF",
    timeline: "Week 3",
    skin: "Dry",
    likes: 308,
    comments: 28,
    thread: [{ name: "Ife", text: "Pinned timeline makes this useful." }],
    invite: "Attach the timeline when you want receipts.",
  },
];

export const STORY_FACES = PREVIEW_MOMENTS.map((m) => ({
  id: m.id,
  name: m.name,
  face: m.face,
}));
