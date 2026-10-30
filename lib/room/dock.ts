import { create } from "zustand";

type ActiveRoom = { id: string; host: boolean; minimized: boolean };

type RoomDockState = {
  active: ActiveRoom | null;
  open: (room: { id: string; host?: boolean }) => void;
  minimize: () => void;
  expand: () => void;
  close: () => void;
};

/** The live Room stays mounted above the app so minimizing it leaves the page usable. */
export const useRoomDock = create<RoomDockState>((set) => ({
  active: null,
  open: (room) => set({ active: { id: room.id, host: !!room.host, minimized: false } }),
  minimize: () => set((state) => (state.active ? { active: { ...state.active, minimized: true } } : state)),
  expand: () => set((state) => (state.active ? { active: { ...state.active, minimized: false } } : state)),
  close: () => set({ active: null }),
}));
