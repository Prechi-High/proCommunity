import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, SectionHead, TrendingCard, useMemberGate } from '@/components/community';
import { ArrowsLeftRight, Fire, ImageIcon, MagnifyingGlass, Plus, TrendUp, X } from '@/components/icons';
import { Lightbox } from '@/components/Lightbox';
import { ProductImage, Shimmer } from '@/components/kit';
import { BellButton, Composer, KIND_STYLE, PostCard } from '@/components/social';
import { colors, fonts } from '@/constants/theme';
import { fetchFeed, fetchFollowing, fetchPulse, NICHES, nicheOf, timeAgo, type FeedSort, type NicheId } from '@/lib/community';
import { hapticSelect, hapticTap } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import type { CommunityThread, ThreadKind, TrendingProduct } from '@/lib/types';

type Tab = FeedSort | 'following';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'hot', label: 'For you' },
  { id: 'new', label: 'New' },
  { id: 'top', label: 'Top' },
  { id: 'following', label: 'Following' },
];

const KINDS: Array<{ id: ThreadKind | 'all'; label: string }> = [
  { id: 'all', label: 'Everything' },
  { id: 'review', label: 'Reviews' },
  { id: 'question', label: 'Questions' },
  { id: 'worry', label: 'Worries' },
  { id: 'compare', label: 'Comparisons' },
  { id: 'tip', label: 'Tips' },
  { id: 'experience', label: 'Stories' },
];

const CATEGORIES: Array<{ id: NicheId | 'all'; label: string }> = [
  { id: 'all', label: 'All categories' },
  ...NICHES.map((n) => ({ id: n.id, label: n.label })),
  { id: 'other', label: 'Everything else' },
];

const matchNiche = (niche: NicheId | 'all', category: string | null | undefined) => niche === 'all' || nicheOf(category) === niche;

export default function PulseScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const profile = useAppStore((s) => s.profile);
  const { requireMember, gate } = useMemberGate();
  const [tab, setTab] = useState<Tab>('hot');
  const [kind, setKind] = useState<ThreadKind | 'all'>('all');
  const [niche, setNiche] = useState<NicheId | 'all'>('all');
  const inNiche = (category: string | null | undefined) => matchNiche(niche, category);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [composing, setComposing] = useState<{ product?: CommunityThread | null; body?: string } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(draft.trim()), 400);
    return () => clearTimeout(t);
  }, [draft]);

  const pulse = useQuery({ queryKey: ['pulse'], queryFn: () => fetchPulse(), staleTime: 60_000 });
  const feed = useQuery({
    queryKey: ['feed', tab, kind, q, niche === 'all' ? 'all' : 'niche', profile?.id],
    queryFn: () =>
      tab === 'following'
        ? fetchFollowing()
        : fetchFeed({ sort: tab, kind: kind === 'all' ? null : kind, q: q || undefined, limit: niche === 'all' ? undefined : 80 }),
    staleTime: 20_000,
  });
  const compares = useQuery({
    queryKey: ['feed', 'hot', 'compare', '', profile?.id],
    queryFn: () => fetchFeed({ sort: 'hot', kind: 'compare', limit: 10 }),
    staleTime: 60_000,
  });

  const threads = useMemo(() => {
    const list = (feed.data ?? []).filter((t) => matchNiche(niche, t.category));
    return tab === 'following' && kind !== 'all' ? list.filter((t) => t.kind === kind) : list;
  }, [feed.data, tab, kind, niche]);
  const trending = (pulse.data?.trending ?? []).filter((t) => inNiche(t.category));
  const hotCompares = (compares.data ?? []).filter((t) => inNiche(t.category));
  const nicheName = CATEGORIES.find((c) => c.id === niche)?.label ?? '';
  const home = tab === 'hot' && kind === 'all' && !q;

  const stream = threads;

  const openRoom = (id: string, name: string) => router.push({ pathname: '/room/[id]', params: { id, name } } as unknown as Href);
  const openThread = (id: string) => router.push({ pathname: '/thread/[id]', params: { id } } as Href);
  const compose = (seed: { product?: CommunityThread | null; body?: string } = {}) => requireMember(() => setComposing(seed));

  const seedProduct = useMemo(
    () =>
      composing?.product
        ? {
            id: composing.product.product_id,
            name: composing.product.product_name,
            brand: '',
            category: composing.product.category ?? '',
            heroImageUrl: composing.product.product_image,
          }
        : null,
    [composing],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 110, gap: 18 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching}
            onRefresh={() => {
              void feed.refetch();
              void pulse.refetch();
            }}
            tintColor={colors.hi}
          />
        }
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1, lineHeight: 38, color: colors.bone }}>Pulse</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, color: colors.bone2 }}>Where people connect through real product experiences.</Text>
            </View>
            <BellButton />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.lac, borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: colors.line }}>
            <MagnifyingGlass size={17} color={colors.bone3} weight="bold" />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Search posts, products, brands…"
              placeholderTextColor={colors.bone3}
              returnKeyType="search"
              style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15.5, color: colors.bone, outlineStyle: 'none' } as never}
            />
            {draft ? (
              <Pressable onPress={() => setDraft('')} hitSlop={8} accessibilityLabel="Clear search">
                <X size={16} color={colors.bone3} weight="bold" />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => compose()}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.lac, borderRadius: 18, padding: 12, opacity: pressed ? 0.85 : 1 })}
          >
            <Avatar name={profile?.displayName ?? 'You'} size={38} />
            <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.bone3 }}>Own something? Tell people the truth…</Text>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.hiSoft, alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon size={18} color={colors.hi} weight="bold" />
            </View>
          </Pressable>
        </View>

        <View style={{ backgroundColor: colors.wine, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
          <View style={{ flexDirection: 'row', marginHorizontal: 16, backgroundColor: colors.wineDeep, borderRadius: 12, padding: 3 }}>
            {TABS.map((t) => {
              const on = t.id === tab;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    if (!on) hapticSelect();
                    if (t.id === 'following' && !profile) return requireMember(() => setTab('following'));
                    setTab(t.id);
                  }}
                  style={{ flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.lac : 'transparent' }}
                >
                  <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 13.5, color: on ? colors.bone : colors.bone2 }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 20, paddingHorizontal: 16 }}>
            {CATEGORIES.map((c) => {
              const on = c.id === niche;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    if (!on) hapticSelect();
                    setNiche(c.id);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={{ paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: on ? colors.hi : 'transparent' }}
                >
                  <Text style={{ fontFamily: on ? fonts.bold : fonts.medium, fontSize: 14, color: on ? colors.bone : colors.bone3 }}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {KINDS.map((k) => {
              const on = k.id === kind;
              const s = k.id === 'all' ? null : KIND_STYLE[k.id];
              return (
                <Pressable
                  key={k.id}
                  onPress={() => {
                    if (!on) hapticSelect();
                    setKind(k.id);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 13, borderRadius: 999, backgroundColor: on ? colors.black : colors.lac, borderWidth: on ? 0 : 1, borderColor: colors.line }}
                >
                  {s ? <s.Icon size={13} color={on ? colors.white : s.fg} weight="bold" /> : null}
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: on ? colors.white : colors.bone }}>{k.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {home && trending.length ? (
          <View style={{ gap: 12 }}>
            <View style={{ paddingHorizontal: 16, gap: 4 }}>
              <SectionHead title="Trending searches" icon={<Fire size={20} color={colors.coral} weight="fill" />} />
              <Text style={{ fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 18, color: colors.bone2 }}>
                Products members are searching for most right now.
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
              {trending.slice(0, 12).map((t: TrendingProduct, i) => (
                <TrendingCard key={t.id} item={t} rank={i + 1} onPress={() => openRoom(t.id, t.name)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {home && hotCompares.length > 0 ? (
          <View style={{ gap: 12 }}>
            <View style={{ paddingHorizontal: 16 }}>
              <SectionHead title="Hot comparisons" icon={<ArrowsLeftRight size={20} color={colors.hi} weight="bold" />} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
              {hotCompares.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => openThread(t.id)}
                  style={({ pressed }) => ({ width: 260, backgroundColor: colors.lac, borderRadius: 20, padding: 14, gap: 10, opacity: pressed ? 0.85 : 1 })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ProductImage uri={t.product_image} category={t.category ?? ''} size={52} radius={12} />
                    <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.bone3 }}>VS</Text>
                    <ProductImage uri={t.compare_image} category={t.category ?? ''} size={52} radius={12} />
                  </View>
                  <Text numberOfLines={2} style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.bone }}>{t.title}</Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.bone3 }}>
                    {t.reply_count ? `${t.reply_count} ${t.reply_count === 1 ? 'reply' : 'replies'}` : 'Be the first to reply'} · {timeAgo(t.last_activity_at)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          {home ? <SectionHead title="The conversation" icon={<TrendUp size={20} color={colors.hi} weight="bold" />} /> : null}
          {q ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 13.5, color: colors.bone2 }}>
              {feed.isLoading ? 'Searching…' : `${threads.length} ${threads.length === 1 ? 'post' : 'posts'} about “${q}”`}
            </Text>
          ) : null}
          {feed.isLoading ? (
            [0, 1, 2].map((i) => <Shimmer key={i} height={180} radius={22} />)
          ) : stream.length ? (
            stream.map((t) => (
              <PostCard
                key={t.id}
                thread={t}
                requireMember={requireMember}
                onOpen={() => openThread(t.id)}
                onProduct={(id, name) => openRoom(id, name)}
                onImage={setPhoto}
              />
            ))
          ) : (
            <View style={{ backgroundColor: colors.lac, borderRadius: 22, padding: 22, gap: 10, alignItems: 'flex-start' }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 19, letterSpacing: -0.4, color: colors.bone }}>
                {tab === 'following'
                  ? 'Nothing followed yet'
                  : q
                    ? 'No posts match that yet'
                    : niche !== 'all'
                      ? `Nothing in ${nicheName} yet`
                      : 'Start the conversation'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.bone2 }}>
                {tab === 'following'
                  ? 'Tap the bell on any post to get updates when people reply.'
                  : 'One honest post about something you own helps the next person avoid a bad buy.'}
              </Text>
              <Pressable onPress={() => compose()} style={{ marginTop: 4, height: 42, paddingHorizontal: 18, borderRadius: 21, backgroundColor: colors.hi, justifyContent: 'center' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14.5, color: colors.white }}>Write a post</Text>
              </Pressable>
            </View>
          )}
        </View>

        {home ? (
          <Pressable
            onPress={() => trending[0] && openRoom(trending[0].id, trending[0].name)}
            style={{ marginHorizontal: 16, backgroundColor: colors.black, borderRadius: 22, padding: 18, gap: 10 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TrendUp size={18} color={colors.hi} weight="bold" />
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' }}>For brands & makers</Text>
            </View>
            <Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.4, color: colors.white }}>See how your product is really doing.</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.7)' }}>
              Every product has a room: owner score, what people praise and fear, how often it’s compared — straight from the people deciding.
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={() => {
          hapticTap();
          compose();
        }}
        accessibilityLabel="New post"
        style={({ pressed }) => ({
          position: 'absolute',
          right: 18,
          bottom: 22,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.hi,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          boxShadow: '0 10px 30px rgba(26,77,255,0.35)',
        })}
      >
        <Plus size={26} color={colors.white} weight="bold" />
      </Pressable>

      <Composer
        visible={Boolean(composing)}
        onClose={() => setComposing(null)}
        initialProduct={seedProduct}
        initialBody={composing?.body}
        initialKind={composing?.body ? 'experience' : undefined}
        onPosted={(t) => {
          setComposing(null);
          void qc.invalidateQueries({ queryKey: ['feed'] });
          void qc.invalidateQueries({ queryKey: ['pulse'] });
          openThread(t.id);
        }}
      />
      <Lightbox images={photo ? [{ url: photo }] : []} index={photo ? 0 : null} onClose={() => setPhoto(null)} />
      {gate}
    </SafeAreaView>
  );
}
