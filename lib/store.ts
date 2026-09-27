import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { track } from './analytics';
import { communityPosts } from './seed';
import type {
  AppNotification,
  CommunityPost,
  DiscussionThread,
  Favorite,
  Ownership,
  Product,
  Profile,
  SearchHistoryItem,
} from './types';

const OWNERSHIP_WAIT_DAYS = 14;
const KNOWN_PRODUCTS_MAX = 80;

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function plusDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export type HapticsMode = 'off' | 'subtle' | 'full';

export interface AppState {
  hydrated: boolean;
  setHydrated: () => void;
  profile: Profile | null;
  favorites: Favorite[];
  ownerships: Ownership[];
  userPosts: CommunityPost[];
  helpfulVotes: string[];
  notifications: AppNotification[];
  searchHistory: SearchHistoryItem[];
  flaggedPostIds: string[];
  userThreads: DiscussionThread[];
  hapticsMode: HapticsMode;
  saveSearchHistory: boolean;
  recentProductIds: string[];
  knownProducts: Record<string, Product>;
  setHapticsMode: (mode: HapticsMode) => void;
  setSaveSearchHistory: (on: boolean) => void;
  rememberProduct: (product: Product) => void;
  addRecentProduct: (productId: string) => void;
  clearRecentProducts: () => void;
  deleteMyData: () => void;
  signIn: (email: string, displayName?: string) => void;
  joinCommunity: (displayName: string) => void;
  signOut: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  toggleFavorite: (productId: string) => void;
  setPriceAlert: (productId: string, enabled: boolean) => void;
  markPurchased: (productId: string) => void;
  addPost: (post: Omit<CommunityPost, 'id' | 'createdAt' | 'helpfulCount' | 'status' | 'parentPostId'> & {
    parentPostId?: string | null;
  }) => void;
  voteHelpful: (postId: string) => void;
  addSearch: (query: string) => void;
  clearSearchHistory: () => void;
  markNotificationRead: (id: string) => void;
  flagPost: (postId: string) => void;
  resolveFlag: (postId: string) => void;
  addThread: (productId: string, title: string) => string;
}

const emptyUserSlice = {
  profile: null as Profile | null,
  favorites: [] as Favorite[],
  ownerships: [] as Ownership[],
  userPosts: [] as CommunityPost[],
  helpfulVotes: [] as string[],
  notifications: [] as AppNotification[],
  flaggedPostIds: [] as string[],
  userThreads: [] as DiscussionThread[],
};

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: async (name: string) => map.get(name) ?? null,
    setItem: async (name: string, value: string) => {
      map.set(name, value);
    },
    removeItem: async (name: string) => {
      map.delete(name);
    },
  };
}

let asyncStorage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} = memoryStorage();

// Web routes are rendered in Node first, where AsyncStorage's web backend
// reaches for window.localStorage and throws.
if (Platform.OS !== 'web' || typeof window !== 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    asyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch {
    asyncStorage = memoryStorage();
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      ...emptyUserSlice,
      searchHistory: [] as SearchHistoryItem[],
      hapticsMode: 'full' as HapticsMode,
      saveSearchHistory: true,
      recentProductIds: [] as string[],
      knownProducts: {} as Record<string, Product>,
      setHapticsMode: (mode) => set({ hapticsMode: mode }),
      setSaveSearchHistory: (on) => set({ saveSearchHistory: on }),
      rememberProduct: (product) => {
        const known = { ...get().knownProducts, [product.id]: product };
        const keys = Object.keys(known);
        if (keys.length > KNOWN_PRODUCTS_MAX) {
          const keep = new Set([
            ...get().favorites.map((f) => f.productId),
            ...get().recentProductIds,
            product.id,
          ]);
          for (const key of keys.slice(0, keys.length - KNOWN_PRODUCTS_MAX)) {
            if (!keep.has(key)) delete known[key];
          }
        }
        set({ knownProducts: known });
      },
      addRecentProduct: (productId) => {
        set({
          recentProductIds: [productId, ...get().recentProductIds.filter((id) => id !== productId)].slice(0, 12),
        });
      },
      clearRecentProducts: () => set({ recentProductIds: [] }),
      deleteMyData: () => {
        set({ searchHistory: [], favorites: [], recentProductIds: [], knownProducts: {} });
      },
      signIn: (email, displayName) => {
        const normalized = email.trim().toLowerCase();
        const existing = get().profile;
        if (existing && existing.email === normalized) return;
        set({
          ...emptyUserSlice,
          profile: {
            id: uid('user'),
            email: normalized,
            displayName: displayName?.trim() || normalized.split('@')[0],
            onboardingComplete: true,
            isAdmin: normalized.endsWith('@sourced.local'),
          },
        });
      },
      joinCommunity: (displayName) => {
        const name = displayName.trim().slice(0, 40);
        if (!name) return;
        const existing = get().profile;
        if (existing) {
          set({ profile: { ...existing, displayName: name } });
          return;
        }
        set({
          profile: {
            id: uid('member'),
            email: '',
            displayName: name,
            onboardingComplete: true,
          },
        });
        track('community_joined', {});
      },
      signOut: () => set({ ...emptyUserSlice }),
      updateProfile: (patch) => {
        const profile = get().profile;
        if (!profile) return;
        set({ profile: { ...profile, ...patch } });
      },
      toggleFavorite: (productId) => {
        const favorites = get().favorites;
        const found = favorites.find((item) => item.productId === productId);
        if (!found) track('product_saved', { productId });
        set({
          favorites: found
            ? favorites.filter((item) => item.productId !== productId)
            : [{ productId, priceAlertEnabled: false }, ...favorites],
        });
      },
      setPriceAlert: (productId, enabled) => {
        set({
          favorites: get().favorites.map((item) =>
            item.productId === productId ? { ...item, priceAlertEnabled: enabled } : item,
          ),
        });
      },
      markPurchased: (productId) => {
        if (get().ownerships.some((item) => item.productId === productId)) return;
        const now = new Date().toISOString();
        set({
          ownerships: [
            ...get().ownerships,
            { productId, markedPurchasedAt: now, eligibleToPostAt: plusDays(now, OWNERSHIP_WAIT_DAYS) },
          ],
        });
      },
      addPost: (post) => {
        const profile = get().profile;
        if (!profile) return;
        set({
          userPosts: [
            {
              id: uid('post'),
              createdAt: new Date().toISOString(),
              helpfulCount: 0,
              status: 'visible',
              parentPostId: post.parentPostId ?? null,
              ...post,
              userId: profile.id,
              authorName: profile.displayName,
            },
            ...get().userPosts,
          ],
        });
      },
      voteHelpful: (postId) => {
        if (get().helpfulVotes.includes(postId)) return;
        set({ helpfulVotes: [...get().helpfulVotes, postId] });
      },
      addSearch: (query) => {
        const trimmed = query.trim();
        if (!trimmed || !get().saveSearchHistory) return;
        set({
          searchHistory: [
            { id: uid('search'), query: trimmed, at: new Date().toISOString() },
            ...get().searchHistory.filter((item) => item.query.toLowerCase() !== trimmed.toLowerCase()),
          ].slice(0, 20),
        });
      },
      clearSearchHistory: () => set({ searchHistory: [] }),
      markNotificationRead: (id) => {
        set({
          notifications: get().notifications.map((item) =>
            item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
          ),
        });
      },
      flagPost: (postId) => {
        if (get().flaggedPostIds.includes(postId)) return;
        set({ flaggedPostIds: [...get().flaggedPostIds, postId] });
      },
      resolveFlag: (postId) => {
        set({ flaggedPostIds: get().flaggedPostIds.filter((id) => id !== postId) });
      },
      addThread: (productId, title) => {
        const id = uid('thread');
        const profile = get().profile;
        set({
          userThreads: [
            {
              id,
              productId,
              title: title.trim(),
              createdBy: profile?.id ?? 'you',
              createdAt: new Date().toISOString(),
            },
            ...get().userThreads,
          ],
        });
        track('thread_started', { productId, threadId: id });
        return id;
      },
    }),
    {
      name: 'sourced-v2',
      storage: createJSONStorage(() => asyncStorage),
      partialize: (state) => {
        const { hydrated: _hydrated, setHydrated: _setHydrated, ...rest } = state;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

export function isVerifiedForProduct(ownerships: Ownership[], productId: string): boolean {
  const row = ownerships.find((item) => item.productId === productId);
  if (!row) return false;
  return +new Date() >= +new Date(row.eligibleToPostAt);
}

export function allVisiblePosts(userPosts: CommunityPost[]): CommunityPost[] {
  return [...userPosts, ...communityPosts].filter((post) => post.status === 'visible');
}
