import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';

import {
  ActionButton,
  AppShell,
  EmptyState,
  FilterChips,
  SearchField,
  StatusMessage,
  StoryCard,
  StorySkeleton,
} from '@/components/unmask-ui';
import { COPY } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { subscriptions } from '@/lib/living/api';
import { entrySeen } from '@/lib/entry/api';
import { loadHomeFeed, type FeedItem } from '@/lib/unmask/feed';
import { previewFeed } from '@/lib/unmask/samples';
import { useAppStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const uid = useAppStore((s) => s.profile?.id);
  const [seen, setSeen] = useState<boolean | null>(null);
  const [filter, setFilter] = useState('For you');
  const [q, setQ] = useState('');
  useEffect(() => {
    void entrySeen()
      .then(setSeen)
      .catch(() => setSeen(true));
  }, []);
  useEffect(() => {
    if (seen === false && !uid) router.replace('/welcome' as Href);
  }, [seen, uid, router]);

  const feed = useQuery({ queryKey: ['home-feed'], queryFn: loadHomeFeed });
  const subscriptionsQuery = useQuery({ queryKey: ['subscriptions', uid], queryFn: subscriptions, enabled: !!uid });
  const following = useAppStore((s) => s.favorites);
  const followedIds = useMemo(() => new Set(following.map((f) => f.productId)), [following]);

  const rows = useMemo(() => {
    const source = previewFeed(feed.data ?? []);
    let list = source;
    if (filter === 'Following') {
      const subscriptions = subscriptionsQuery.data ?? [];
      list = source.filter(i => (i.productId && followedIds.has(i.productId)) || subscriptions.some(s => s.target_type === 'product' && s.target_id === i.productId || s.target_type === 'person' && s.target_id === i.authorId));
    }
    if (q.trim()) {
      const n = q.trim().toLowerCase();
      list = list.filter((i) => `${i.title} ${i.productName} ${i.body}`.toLowerCase().includes(n));
    }
    return list;
  }, [feed.data, filter, followedIds, q, subscriptionsQuery.data]);

  const featured = rows.find((i) => i.kind === 'unmask' && i.status === 'Ultra Unmasked');
  const usingSamples = rows.some((i) => i.sample);
  const feedRows = featured ? rows.filter((i) => i.id !== featured.id) : rows;
  if (!uid && seen !== true) return null;

  return (
    <AppShell notify flush>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 14 }}>
        <Text
          style={{
            fontFamily: fonts.serifBold,
            fontSize: 28,
            lineHeight: 32,
            color: colors.ink,
            letterSpacing: -0.55,
          }}
        >
          {COPY.homeTitle}
        </Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>
          {COPY.homePrompt}
        </Text>
        <SearchField
          value={q}
          onChange={setQ}
          onSubmit={() => {
            if (q.trim().length > 1) router.push({ pathname: '/results', params: { q: q.trim() } } as Href);
          }}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}><View style={{ flex: 1, minWidth: 135 }}><ActionButton tone="secondary" label="Share an experience" onPress={() => router.push('/contribute' as Href)} /></View><View style={{ flex: 1, minWidth: 135 }}><ActionButton tone="ghost" label="Ask the community" onPress={() => router.push('/ask-community' as Href)} /></View></View>
        <FilterChips options={['For you', 'Following', 'Latest']} value={filter} onChange={setFilter} />
        {usingSamples && !feed.isLoading ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.inkSoft }}>
            Preview community · labeled samples so you can see a busy feed. Live posts appear here too.
          </Text>
        ) : null}
      </View>
      {featured ? <StoryCard item={featured} featured flush /> : null}
      {feed.isError ? (
        <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
          <StatusMessage
            kind="error"
            title="Couldn’t load stories."
            detail="Check your connection. You can still search or share."
          />
        </View>
      ) : null}
      {filter === 'Following' && !uid ? (
        <View style={{ paddingHorizontal: 20, paddingVertical: 8 }}>
          <ActionButton label="Sign in to see people you follow" onPress={() => router.push('/(auth)/sign-in')} />
        </View>
      ) : null}
      {feed.isLoading ? (
        <>
          <StorySkeleton />
          <StorySkeleton />
        </>
      ) : feedRows.length ? (
        feedRows.map((item: FeedItem) => <StoryCard key={item.id} item={item} flush />)
      ) : (
        <View style={{ paddingHorizontal: 20 }}>
          <EmptyState
            title={COPY.emptyFeed}
            detail={COPY.noStoriesNext}
            action={COPY.createExperience}
            onAction={() => router.push('/contribute' as Href)}
          />
        </View>
      )}
      <Pressable onPress={() => router.push('/unmask' as Href)} style={{ paddingHorizontal: 20, paddingVertical: 24 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.brandDeep }}>{COPY.unmaskersTitle} →</Text>
      </Pressable>
    </AppShell>
  );
}
