import { create } from "zustand";

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
  createdAt: string;
};

type State = {
  posts: LocalMoment[];
  /** Latest face for the story ring when they chose Story or Both. */
  storyPhoto?: string;
  /** The story currently on your ring, so a tap plays it instead of the camera. */
  story?: LocalMoment;
  add: (post: Omit<LocalMoment, "id" | "createdAt">) => LocalMoment;
};

export const useLocalMoments = create<State>((set) => ({
  posts: [],
  add: (post) => {
    const row: LocalMoment = {
      ...post,
      id: `you-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      posts: post.destination === "story" ? state.posts : [row, ...state.posts],
      story: post.destination === "post" ? state.story : row,
      storyPhoto:
        post.destination === "post" ? state.storyPhoto : post.photo || state.storyPhoto,
    }));
    return row;
  },
}));
