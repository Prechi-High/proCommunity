import { create } from "zustand";

export type MomentDraft = {
  photo: string;
  caption: string;
  productId?: string;
  productName?: string;
  journeyId?: string;
};

export const useMomentDraft = create<{
  draft: MomentDraft | null;
  setDraft: (draft: MomentDraft | null) => void;
}>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
}));
