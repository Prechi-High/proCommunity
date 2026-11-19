import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MomentKind } from "@/lib/moment/kinds";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export type StoryItem = {
  id: string;
  media: string;
  mediaKind: "photo" | "video";
  /** Still frame for video stories (never a video URI). */
  coverPosterUri?: string;
  caption?: string;
  createdAt: string;
  expiresAt: string;
  momentKind?: MomentKind;
  authorName?: string;
  likes: number;
  occasion?: string;
  productLabels?: string[];
  productImages?: string[];
  momentTitle?: string;
  skinType?: string;
  usageFrequency?: string;
  usageDuration?: string;
  soundUri?: string;
  soundMaxMs?: number;
};

export type LocalMoment = {
  id: string;
  photo?: string;
  caption: string;
  author: string;
  productName?: string;
  skin?: string;
  timelineId?: string;
  timelineLabel?: string;
  destination: "post" | "story" | "both";
  stickers?: string[];
  mediaKind?: "photo" | "video";
  momentKind?: MomentKind;
  occasion?: string;
  usageDuration?: string;
  routineTags?: string[];
  productIds?: string[];
  audience?: "everyone" | "followers" | "private";
  saveToJourney?: boolean;
  trendId?: string;
  mediaSource?: "camera" | "device_upload";
  coverPosterUri?: string;
  soundUri?: string;
  soundMaxMs?: number;
  productLabels?: string[];
  productImages?: string[];
  momentTitle?: string;
  skinType?: string;
  usageFrequency?: string;
  slideCaptions?: string[];
  createdAt: string;
};

type State = {
  posts: LocalMoment[];
  stories: StoryItem[];
  storyLikes: Record<string, boolean>;
  pruneStories: () => void;
  activeStories: () => StoryItem[];
  add: (post: Omit<LocalMoment, "id" | "createdAt">) => LocalMoment;
  toggleStoryLike: (storyId: string) => void;
  reshareStory: (storyId: string, authorName: string) => void;
};

function prune(list: StoryItem[]): StoryItem[] {
  const now = Date.now();
  return list.filter((s) => new Date(s.expiresAt).getTime() > now);
}

export const useLocalMoments = create<State>()(
  persist(
    (set, get) => ({
      posts: [],
      stories: [],
      storyLikes: {},
      pruneStories: () =>
        set((state) => {
          const stories = prune(state.stories);
          if (stories.length === state.stories.length) return state;
          return { stories };
        }),
      activeStories: () => prune(get().stories),
      toggleStoryLike: (storyId) =>
        set((state) => {
          const was = !!state.storyLikes[storyId];
          const liked = !was;
          const stories = state.stories.map((s) =>
            s.id === storyId ? { ...s, likes: Math.max(0, s.likes + (liked ? 1 : -1)) } : s,
          );
          return { stories, storyLikes: { ...state.storyLikes, [storyId]: liked } };
        }),
      reshareStory: (storyId, authorName) => {
        const original = get().stories.find((s) => s.id === storyId);
        if (!original) return;
        const copy: StoryItem = {
          ...original,
          id: `story-reshare-${Date.now()}`,
          authorName,
          caption: original.caption ? `Reshared · ${original.caption}` : "Reshared to your status",
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + STORY_TTL_MS).toISOString(),
          likes: 0,
        };
        set((state) => ({ stories: prune([copy, ...state.stories]) }));
      },
      add: (post) => {
        const row: LocalMoment = {
          ...post,
          id: `you-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        const isMoment = !!post.momentKind;
        const toStory =
          isMoment || post.destination === "story" || post.destination === "both";
        const toFeed = !isMoment && (post.destination === "post" || post.destination === "both");

        const storyRow: StoryItem | null =
          toStory && post.photo
            ? {
                id: `story-${Date.now()}`,
                media: post.photo,
                mediaKind: post.mediaKind || "photo",
                coverPosterUri: post.coverPosterUri || undefined,
                caption: post.caption,
                momentKind: post.momentKind,
                authorName: post.author,
                occasion: post.occasion,
                productLabels: post.productLabels,
                productImages: post.productImages,
                momentTitle: post.momentTitle,
                skinType: post.skinType,
                usageFrequency: post.usageFrequency,
                usageDuration: post.usageDuration,
                soundUri: post.mediaKind === "video" ? undefined : post.soundUri,
                soundMaxMs: post.mediaKind === "video" ? undefined : post.soundMaxMs,
                createdAt: row.createdAt,
                expiresAt: new Date(Date.now() + STORY_TTL_MS).toISOString(),
                likes: 0,
              }
            : null;

        set((state) => {
          const stories = prune(storyRow ? [storyRow, ...state.stories] : state.stories);
          return {
            posts: toFeed ? [row, ...state.posts] : state.posts,
            stories,
          };
        });
        return row;
      },
    }),
    {
      name: "unmask-local-moments",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ posts: s.posts, stories: s.stories, storyLikes: s.storyLikes }),
    },
  ),
);