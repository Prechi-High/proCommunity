/**
 * The First 90 — the one config for the movement.
 *
 * FIRST_90_START is Day 1 itself, as a calendar date in Africa/Lagos.
 * It is not the day before, and it is not UTC midnight.
 * Change this when the founder confirms the real opening date.
 * Until then it is 2026-11-12.
 *
 * ORIENTATION_VIDEO_URL is the pinned founder film.
 * Paste a YouTube URL, an 11-character YouTube id, a Vimeo URL, or a direct
 * https video file (.mp4 / .webm). Leave it as "" and the homepage keeps a
 * framed placeholder instead of an empty embed.
 */
export const FIRST_90_START = "2026-11-12";

export const ORIENTATION_VIDEO_URL = "";

export const LAGOS_TIME_ZONE = "Africa/Lagos";

export const FIRST_90_LENGTH = 90;

export type First90Phase = {
  from: number;
  to: number;
  name: string;
  /** One line for this stretch. Not a script for all 90 days. */
  line: string;
};

export const FIRST_90_PHASES: readonly First90Phase[] = [
  {
    from: 1,
    to: 7,
    name: "The Wake-Up",
    line: "We are questioning how we buy. Start with one product.",
  },
  {
    from: 8,
    to: 21,
    name: "Contextless Buying",
    line: "The same product can mean two different things. Ask: good for who?",
  },
  {
    from: 22,
    to: 30,
    name: "Become an Unmasker",
    line: "You are an Unmasker. Your experience is valid. Your conclusion still needs context.",
  },
  {
    from: 31,
    to: 45,
    name: "Build the Timeline",
    line: "Document the starting point. Update it as the experience changes.",
  },
  {
    from: 46,
    to: 55,
    name: "Experience Becomes Intelligence",
    line: "One experience is a story. A timeline keeps what a star rating lets disappear.",
  },
  {
    from: 56,
    to: 65,
    name: "Seller Era",
    line: "What happens after checkout is part of the product.",
  },
  {
    from: 66,
    to: 70,
    name: "Something Is Coming",
    line: "You have been building something. The next layer is getting closer.",
  },
  {
    from: 71,
    to: 75,
    name: "Ultra Unmask Reveal",
    line: "Some experiences raise a question a review cannot hold. The next layer is coming.",
  },
  {
    from: 76,
    to: 80,
    name: "Seller Audio Room Reveal",
    line: "A direct conversation can carry what a page cannot. The next layer is coming.",
  },
  {
    from: 81,
    to: 85,
    name: "The Future of Buying",
    line: "Buy. Track. Question. Understand. Context is becoming the way.",
  },
  {
    from: 86,
    to: 89,
    name: "Final Countdown",
    line: "What we are building together is almost ready for the next layer.",
  },
  {
    from: 90,
    to: 90,
    name: "The Next Layer",
    line: "Day 90 is not the beginning. The next layer opens.",
  },
];

export type First90Status = "before" | "during" | "complete";

export type First90State = {
  status: First90Status;
  /** 1–90 while the movement is open. 0 before Day 1. Stays 90 after it closes. */
  day: number;
  phase: string;
  line: string;
  /** 0–1. Day 1 is 1/90, not zero. */
  progress: number;
  start: string;
  today: string;
};

export function lagosISO(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: LAGOS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

/** Civil-day index. Independent of the machine timezone. */
export function civilDayNumber(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

export function daysBetween(laterISO: string, earlierISO: string): number | null {
  const later = civilDayNumber(laterISO);
  const earlier = civilDayNumber(earlierISO);
  if (later === null || earlier === null) return null;
  return later - earlier;
}

export function phaseForDay(day: number): First90Phase | null {
  return FIRST_90_PHASES.find((phase) => day >= phase.from && day <= phase.to) ?? null;
}

export function first90(now = new Date(), start = FIRST_90_START): First90State {
  const today = lagosISO(now);
  const elapsed = daysBetween(today, start);
  if (elapsed === null) {
    return {
      status: "before",
      day: 0,
      phase: "The Wake-Up",
      line: "The First 90 begins when Day 1 is set. You can start with one product now.",
      progress: 0,
      start,
      today,
    };
  }
  if (elapsed < 0) {
    return {
      status: "before",
      day: 0,
      phase: "The Wake-Up",
      line: "The First 90 has not opened. You can still start with one product.",
      progress: 0,
      start,
      today,
    };
  }
  const day = elapsed + 1;
  if (day > FIRST_90_LENGTH) {
    return {
      status: "complete",
      day: FIRST_90_LENGTH,
      phase: "The Next Layer",
      line: "The First 90 is complete. The next layer is opening.",
      progress: 1,
      start,
      today,
    };
  }
  const phase = phaseForDay(day) ?? FIRST_90_PHASES[0];
  return {
    status: "during",
    day,
    phase: phase.name,
    line: phase.line,
    progress: day / FIRST_90_LENGTH,
    start,
    today,
  };
}

export type OrientationEmbed =
  | { kind: "iframe"; src: string; title: string }
  | { kind: "file"; src: string; title: string };

const TITLE = "Unmask orientation";

/** Turn the config value into something the film frame can play. Empty stays empty. */
export function orientationEmbed(raw: string): OrientationEmbed | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^[\w-]{11}$/.test(value)) {
    return { kind: "iframe", src: `https://www.youtube.com/embed/${value}?rel=0&modestbranding=1&playsinline=1`, title: TITLE };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^www\./i, "").toLowerCase();
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (/^[\w-]{11}$/.test(id)) {
      return { kind: "iframe", src: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`, title: TITLE };
    }
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    const fromQuery = url.searchParams.get("v");
    const parts = url.pathname.split("/").filter(Boolean);
    const id =
      fromQuery && /^[\w-]{11}$/.test(fromQuery)
        ? fromQuery
        : (parts[0]?.toLowerCase() === "shorts" || parts[0]?.toLowerCase() === "embed") && /^[\w-]{11}$/.test(parts[1] ?? "")
          ? parts[1]
          : "";
    if (id) return { kind: "iframe", src: `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`, title: TITLE };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).pop() ?? "";
    if (/^\d+$/.test(id)) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}`, title: TITLE };
  }
  if (/\.(mp4|webm|ogg)$/i.test(url.pathname)) return { kind: "file", src: url.href, title: TITLE };
  return { kind: "iframe", src: url.href, title: TITLE };
}
