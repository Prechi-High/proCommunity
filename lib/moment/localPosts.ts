import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { MomentKind } from "@/lib/moment/kinds";

const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export type StoryItem = {
  id: string;
  media: string;
  mediaKind: "photo" | "video";
  caption?: string;
  createdAt: string;
  expiresAt: string;
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
  createdAt: string;
};

type State = {
  posts: LocalMoment[];
  stories: StoryItem[];
  pruneStories: () => void;
  activeStories: () => StoryItem[];
  add: (post: Omit<LocalMoment, "id" | "createdAt">) => LocalMoment;
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
      pruneStories: () => set((state) => ({ stories: prune(state.stories) })),
      activeStories: () => prune(get().stories),
      add: (post) => {
        const row: LocalMoment = {
          ...post,
          id: `you-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        const storyMedia = post.destination !== "post" && post.photo;
        const storyRow: StoryItem | null = storyMedia
          ? {
              id: `story-${Date.now()}`,
              media: post.photo!,
              mediaKind: post.mediaKind || "photo",
              caption: post.caption,
              createdAt: row.createdAt,
              expiresAt: new Date(Date.now() + STORY_TTL_MS).toISOString(),
            }
          : null;

        set((state) => {
          const stories = prune(storyRow ? [storyRow, ...state.stories] : state.stories);
          return {
            posts: post.destination === "story" ? state.posts : [row, ...state.posts],
            stories,
          };
        });
        return row;
      },
    }),
    {
      name: "unmask-local-moments",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ posts: s.posts, stories: s.stories }),
    },
  ),
);