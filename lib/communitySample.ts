/**
 * Sample rooms, experts and journeys from sourced-v1 (2).html.
 * Presence and going counts are labeled as sample wherever they appear.
 */
export const SAMPLE_HERE = 1284;

export const SAMPLE_EXPERTS = [
  {
    id: 'lena',
    name: 'Dr. Lena Okafor',
    role: 'Dermatologist',
    cred: 'Licence verified',
    topic: 'Oily, acne-prone and sensitive skin',
  },
  {
    id: 'tobi',
    name: 'Tobi Adeyemi',
    role: 'Licensed esthetician',
    cred: 'Licence verified',
    topic: 'Sunscreen, routines and skin tones',
  },
  {
    id: 'sam',
    name: 'Sam Mensah',
    role: 'Cosmetic chemist',
    cred: 'Credentials verified',
    topic: 'Ingredients and formulas',
  },
] as const;

export type SampleRoom = {
  id: string;
  title: string;
  hostId: string;
  live: boolean;
  listening?: number;
  when?: string;
  going?: number;
  about?: string[];
  alarmLabel?: string;
};

export const SAMPLE_ROOMS: SampleRoom[] = [
  {
    id: '1',
    title: 'Building a routine for oily skin',
    hostId: 'lena',
    live: true,
    listening: 47,
  },
  {
    id: '2',
    title: 'Sunscreen and skin tones: ask me anything',
    hostId: 'tobi',
    live: false,
    when: 'Today, 7:00 PM',
    going: 38,
    about: ['Choosing a mineral sunscreen', 'Avoiding a white cast', 'Reapplying over makeup'],
    alarmLabel: '6:55 PM',
  },
  {
    id: '3',
    title: 'Niacinamide: what to expect in 8 weeks',
    hostId: 'lena',
    live: false,
    when: 'Thursday, 6:30 PM',
    going: 112,
    about: ['A realistic timeline', 'Pilling and layering', 'Who should be careful'],
    alarmLabel: '6:25 PM',
  },
];

export const SAMPLE_JOURNEYS = [
  {
    id: 'amara-niac',
    name: 'Amara O.',
    productLabel: 'Niacinamide serum',
    skin: 'Oily',
    week: 'Week 8',
    cap: 'Texture settled. Pilling under sunscreen is the main complaint I still have.',
    followers: 128,
    productId: 'niacinamide-10-zinc',
  },
  {
    id: 'nneka-spf',
    name: 'Nneka C.',
    productLabel: 'Mineral SPF 50',
    skin: 'Combination',
    week: 'Week 4',
    cap: 'White cast is real on my skin. Warming it in my hands first helped a bit.',
    followers: 86,
    productId: 'mineral-spf-50',
  },
  {
    id: 'kemi-clean',
    name: 'Kemi L.',
    productLabel: 'Foaming cleanser',
    skin: 'Dry',
    week: 'Week 6',
    cap: 'Fine in humid weather. Tight in AC. I follow with a cream every night now.',
    followers: 54,
    productId: 'gentle-foaming-cleanser',
  },
] as const;

export const SAMPLE_ROOM_CHAT: { name: string; skin: string; text: string; expert?: boolean }[] = [
  { name: 'Nneka C.', skin: 'Oily', text: 'Does a toner before serum matter?' },
  {
    name: 'Dr. Lena',
    skin: '',
    text: 'Toner first if you use one, then serum, then moisturizer. Thin to thick.',
    expert: true,
  },
  { name: 'Kemi L.', skin: 'Combination', text: 'How long before I should expect results?' },
  {
    name: 'Dr. Lena',
    skin: '',
    text: 'Usually a few weeks, and some people notice nothing. That’s a normal range.',
    expert: true,
  },
];

export function expertById(id: string) {
  return SAMPLE_EXPERTS.find((e) => e.id === id) ?? SAMPLE_EXPERTS[0];
}

export function roomById(id: string) {
  return SAMPLE_ROOMS.find((r) => r.id === id);
}

export function journeyById(id: string) {
  return SAMPLE_JOURNEYS.find((j) => j.id === id);
}

export function expertInitial(name: string) {
  return name.replace('Dr. ', '').slice(0, 1);
}
