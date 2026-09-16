import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { communityPosts } from './seed';
import type {
  AppNotification,
  CommunityPost,
  Concern,
  Favorite,
  Ownership,
  Profile,
  ProgressEntry,
  QuizAnswers,
  RoutineLog,
  RoutineStep,
  SearchHistoryItem,
  SkinType,
  UsageEstimate,
} from './types';

const OWNERSHIP_WAIT_DAYS = 14;

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function plusDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface AppState {
  hydrated: boolean;
  setHydrated: () => void;
  profile: Profile | null;
  quizAnswers: QuizAnswers;
  favorites: Favorite[];
  ownerships: Ownership[];
  routineSteps: RoutineStep[];
  routineLogs: RoutineLog[];
  progressEntries: ProgressEntry[];
  usageEstimates: UsageEstimate[];
  userPosts: CommunityPost[];
  helpfulVotes: string[];
  notifications: AppNotification[];
  searchHistory: SearchHistoryItem[];
  flaggedPostIds: string[];
  signIn: (email: string, displayName?: string) => void;
  signOut: () => void;
  completeOnboarding: (input: {
    skinType: SkinType;
    skinTypeSource: Profile['skinTypeSource'];
    concerns: Concern[];
    displayName: string;
    quizAnswers?: QuizAnswers;
  }) => void;
  skipOnboarding: () => void;
  updateProfile: (patch: Partial<Profile>) => void;
  toggleFavorite: (productId: string) => void;
  setPriceAlert: (productId: string, enabled: boolean) => void;
  markPurchased: (productId: string) => void;
  addRoutineStep: (productId: string, timeOfDay: 'am' | 'pm') => void;
  removeRoutineStep: (stepId: string) => void;
  toggleRoutineStep: (stepId: string, timeOfDay: 'am' | 'pm') => void;
  addProgressEntry: (entry: Omit<ProgressEntry, 'id' | 'isShared'> & { isShared?: boolean }) => void;
  setProgressShared: (id: string, isShared: boolean) => void;
  addPost: (post: Omit<CommunityPost, 'id' | 'createdAt' | 'helpfulCount' | 'status' | 'parentPostId'> & {
    parentPostId?: string | null;
  }) => void;
  voteHelpful: (postId: string) => void;
  addSearch: (query: string) => void;
  clearSearchHistory: () => void;
  markNotificationRead: (id: string) => void;
  flagPost: (postId: string) => void;
  resolveFlag: (postId: string) => void;
}

const emptyUserSlice = {
  profile: null as Profile | null,
  quizAnswers: {} as QuizAnswers,
  favorites: [] as Favorite[],
  ownerships: [] as Ownership[],
  routineSteps: [] as RoutineStep[],
  routineLogs: [] as RoutineLog[],
  progressEntries: [] as ProgressEntry[],
  usageEstimates: [] as UsageEstimate[],
  userPosts: [] as CommunityPost[],
  helpfulVotes: [] as string[],
  notifications: [] as AppNotification[],
  searchHistory: [] as SearchHistoryItem[],
  flaggedPostIds: [] as string[],
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

try {
  // Loaded at runtime so the store can import before native modules attach.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  asyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {
  asyncStorage = memoryStorage();
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
      ...emptyUserSlice,
      signIn: (email, displayName) => {
        const existing = get().profile;
        if (existing && existing.email === email.trim().toLowerCase()) return;
        const id = uid('user');
        set({
          ...emptyUserSlice,
          profile: {
            id,
            email: email.trim().toLowerCase(),
            displayName: displayName?.trim() || email.split('@')[0],
            skinType: 'unknown',
            skinTypeSource: null,
            concerns: [],
            onboardingComplete: false,
            isAdmin: email.trim().toLowerCase().endsWith('@sourced.local'),
          },
        });
      },
      signOut: () => set({ ...emptyUserSlice }),
      completeOnboarding: ({ skinType, skinTypeSource, concerns, displayName, quizAnswers }) => {
        const profile = get().profile;
        if (!profile) return;
        set({
          profile: {
            ...profile,
            skinType,
            skinTypeSource,
            concerns,
            displayName: displayName.trim() || profile.displayName,
            onboardingComplete: true,
          },
          quizAnswers: quizAnswers ?? get().quizAnswers,
        });
      },
      skipOnboarding: () => {
        const profile = get().profile;
        if (!profile) return;
        set({ profile: { ...profile, onboardingComplete: true } });
      },
      updateProfile: (patch) => {
        const profile = get().profile;
        if (!profile) return;
        set({ profile: { ...profile, ...patch } });
      },
      toggleFavorite: (productId) => {
        const favorites = get().favorites;
        const found = favorites.find((item) => item.productId === productId);
        set({
          favorites: found
            ? favorites.filter((item) => item.productId !== productId)
            : [...favorites, { productId, priceAlertEnabled: true }],
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
        const usageStarted = now;
        set({
          ownerships: [
            ...get().ownerships,
            {
              productId,
              markedPurchasedAt: now,
              eligibleToPostAt: plusDays(now, OWNERSHIP_WAIT_DAYS),
            },
          ],
          usageEstimates: [
            ...get().usageEstimates.filter((item) => item.productId !== productId),
            {
              productId,
              startedAt: usageStarted,
              estimatedEmptyDate: null,
              expiryDate: null,
            },
          ],
        });
      },
      addRoutineStep: (productId, timeOfDay) => {
        const existing = get().routineSteps.filter((step) => step.timeOfDay === timeOfDay);
        if (existing.some((step) => step.productId === productId)) return;
        set({
          routineSteps: [
            ...get().routineSteps,
            {
              id: uid('step'),
              productId,
              timeOfDay,
              stepOrder: existing.length + 1,
            },
          ],
        });
      },
      removeRoutineStep: (stepId) => {
        set({ routineSteps: get().routineSteps.filter((step) => step.id !== stepId) });
      },
      toggleRoutineStep: (stepId, timeOfDay) => {
        const date = todayStamp();
        const logs = get().routineLogs;
        const current =
          logs.find((log) => log.date === date && log.timeOfDay === timeOfDay) ?? {
            date,
            timeOfDay,
            completedStepIds: [],
          };
        const completed = current.completedStepIds.includes(stepId)
          ? current.completedStepIds.filter((id) => id !== stepId)
          : [...current.completedStepIds, stepId];
        set({
          routineLogs: [
            ...logs.filter((log) => !(log.date === date && log.timeOfDay === timeOfDay)),
            { ...current, completedStepIds: completed },
          ],
        });
      },
      addProgressEntry: (entry) => {
        set({
          progressEntries: [
            {
              id: uid('progress'),
              isShared: entry.isShared ?? false,
              ...entry,
            },
            ...get().progressEntries,
          ],
        });
      },
      setProgressShared: (id, isShared) => {
        set({
          progressEntries: get().progressEntries.map((entry) =>
            entry.id === id ? { ...entry, isShared } : entry,
          ),
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
        if (!trimmed) return;
        set({
          searchHistory: [
            { id: uid('search'), query: trimmed, at: new Date().toISOString() },
            ...get().searchHistory.filter((item) => item.query !== trimmed),
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
    }),
    {
      name: 'sourced-app',
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

export function currentStreak(logs: RoutineLog[], steps: RoutineStep[]): number {
  if (steps.length === 0) return 0;
  const amIds = steps.filter((step) => step.timeOfDay === 'am').map((step) => step.id);
  const pmIds = steps.filter((step) => step.timeOfDay === 'pm').map((step) => step.id);
  const completeDates = new Set(
    logs
      .filter((log) => {
        const needed = log.timeOfDay === 'am' ? amIds : pmIds;
        if (needed.length === 0) return false;
        return needed.every((id) => log.completedStepIds.includes(id));
      })
      .map((log) => log.date),
  );

  // A day counts when every active routine for that day was finished.
  const daysWithAnyRoutine = (date: string) => {
    const hasAm = amIds.length > 0;
    const hasPm = pmIds.length > 0;
    const amOk = !hasAm || logs.some((log) => log.date === date && log.timeOfDay === 'am' && amIds.every((id) => log.completedStepIds.includes(id)));
    const pmOk = !hasPm || logs.some((log) => log.date === date && log.timeOfDay === 'pm' && pmIds.every((id) => log.completedStepIds.includes(id)));
    return amOk && pmOk;
  };

  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const stamp = cursor.toISOString().slice(0, 10);
    if (daysWithAnyRoutine(stamp)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (i === 0) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }
  void completeDates;
  return streak;
}

export function isVerifiedForProduct(ownerships: Ownership[], productId: string): boolean {
  const row = ownerships.find((item) => item.productId === productId);
  if (!row) return false;
  return +new Date() >= +new Date(row.eligibleToPostAt);
}

export function allVisiblePosts(userPosts: CommunityPost[]): CommunityPost[] {
  return [...userPosts, ...communityPosts].filter((post) => post.status === 'visible');
}
