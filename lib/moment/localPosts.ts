import { create } from "zustand";

export type LocalMoment = {
  id: string;
  photo?: string;
  caption: string;
  author: string;
  productName?: string;
  createdAt: string;
};

type State = {
  posts: LocalMoment[];
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
    set((state) => ({ posts: [row, ...state.posts] }));
    return row;
  },
}));
