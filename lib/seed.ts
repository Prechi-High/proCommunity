import type { CommunityPost, DiscussionThread, SeedAuthor, YoutubeComment } from './types';

/**
 * Community scaffolding only. Products are never seeded — every product comes from
 * live Product Intelligence. Real community content lives in Supabase.
 */
export const authors: Record<string, SeedAuthor> = {};

export const discussionThreads: DiscussionThread[] = [];

export const communityPosts: CommunityPost[] = [];

export const youtubeComments: YoutubeComment[] = [];
