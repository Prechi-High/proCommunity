import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, useMemberGate } from '@/components/community';
import {
  Car,
  Check,
  DeviceMobile,
  Drop,
  Fire,
  Flask,
  Handbag,
  NotePencil,
  House,
  ImageSquare,
  Leaf,
  MagnifyingGlass,
  Package,
  Plus,
  Question,
  Scan,
  ShieldCheck,
  UsersThree,
  X,
} from '@/components/icons';
import { Lightbox } from '@/components/Lightbox';
import { Shimmer } from '@/components/kit';
import { PulseConversationCard } from '@/components/pulse/PulseConversationCard';
import { PulsePostCard } from '@/components/pulse/PulsePostCard';
import { BellButton, Composer } from '@/components/social';
import { colors, fonts } from '@/constants/theme';
import { fetchFeed, fetchFollowing, fetchPulse, NICHES, nicheOf, type FeedSort, type NicheId } from '@/lib/community';
import { hapticSelect, hapticTap } from '@/lib/haptics';
import { useAppStore } from '@/lib/store';
import type { CommunityThread, ThreadKind, TrendingProduct } from '@/lib/types';
import { useScan } from '@/lib/useScan';

type Tab = FeedSort | 'following';

const SCREEN_PAD_H = 8;
const CONVO_VISIBLE = 5;

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'hot', label: 'For you' },
  { id: 'new', label: 'New' },
  { id: 'top', label: 'Top' },
  { id: 'following', label: 'Following' },
];

function nicheIcon(id: NicheId): ComponentType<{ size?: number; color?: string; weight?: string }> {
  switch (id) {
    case 'tech':
      return DeviceMobile;
    case 'care':
      return Drop;
    case 'home':
      return House;
    case 'style':
      return Handbag;
    case 'food':
      return Leaf;
    case 'auto':
      return Car;
    case 'kids':
      return UsersThree;
    default:
      return Package;
  }
}

const INTEREST_TAGS: Array<{ id: NicheId | 'all'; label: string; Icon: ComponentType<{ size?: number; color?: string; weight?: string }> }> = [
  { id: 'all', label: 'Everything', Icon: ShieldCheck },
  ...NICHES.map((n) => ({
    id: n.id,
    label: n.label,
    Icon: nicheIcon(n.id),
  })),
  { id: 'other', label: 'Everything Else', Icon: Package },
];

const matchAnyNiche = (selected: Set<NicheId | 'all'>, category: string | null | undefined) => {
  if (selected.has('all') || selected.size === 0) return true;
  const n = nicheOf(category);
  return selected.has(n);
};

export default function PulseScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const profile = useAppStore((s) => s.profile);
  const { requireMember, gate } = useMemberGate();
  const scan = useScan();
  const [tab, setTab] = useState<Tab>('hot');
  const [selectedNiches, setSelectedNiches] = useState<Set<NicheId | 'all'>>(new Set(['all']));
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const [showCreateBanner, setShowCreateBanner] = useState(true);
  const [composing, setComposing] = useState<{ product?: CommunityThread | null; body?: string; kind?: ThreadKind } | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);

  const convoGap = 8;
  const convoCardW = (width - SCREEN_PAD_H * 2 - convoGap * (CONVO_VISIBLE - 1)) / CONVO_VISIBLE;

  useEffect(() => {
    const t = setTimeout(() => setQ(draft.trim()), 400);
    return () => clearTimeout(t);
  }, [draft]);

  const pulse = useQuery({ queryKey: ['pulse'], queryFn: () => fetchPulse(), staleTime: 60_000 });
  const feed = useQuery({
    queryKey: ['feed', tab, q, selectedNiches.size, profile?.id],
    queryFn: () =>
      tab === 'following'
        ? fetchFollowing()
        : fetchFeed({ sort: tab, q: q || undefined, limit: 80 }),
    staleTime: 20_000,
  });

  const allThreads = pulse.data?.threads ?? [];
  const threads = useMemo(() => {
    return (feed.data ?? []).filter((t) => matchAnyNiche(selectedNiches, t.category));
  }, [feed.data, selectedNiches]);

  const trending = (pulse.data?.trending ?? []).filter((t) => matchAnyNiche(selectedNiches, t.category));
  const home = tab === 'hot' && !q;

  const conversations = useMemo(() => {
    return trending.slice(0, 12).map((item) => {
      const related = allThreads.filter((th) => th.product_id === item.id);
      const title = related[0]?.title ?? item.name;
      const postCount =
        related.reduce((sum, th) => sum + 1 + (th.reply_count ?? 0), 0) || item.threads || Math.max(item.views, item.asks, 1);
      return { item, title, postCount };
    });
  }, [trending, allThreads]);

  const toggleNiche = (id: NicheId | 'all') => {
    hapticSelect();
    setSelectedNiches((prev) => {
      const next = new Set(prev);
      if (id === 'all') return new Set(['all']);
      next.delete('all');
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) next.add('all');
      return next;
    });
  };

  const clearNiches = () => {
    hapticSelect();
    setSelectedNiches(new Set(['all']));
  };

  const openRoom = (id: string, name: string) => router.push({ pathname: '/room/[id]', params: { id, name } } as unknown as Href);
  const openThread = (id: string) => router.push({ pathname: '/thread/[id]', params: { id } } as Href);
  const compose = (seed: { product?: CommunityThread | null; body?: string; kind?: ThreadKind } = {}) =>
    requireMember(() => setComposing(seed));

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
        contentContainerStyle={{ paddingBottom: 110, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
        <View style={{ paddingHorizontal: SCREEN_PAD_H, paddingTop: 10, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 32, letterSpacing: -0.8, lineHeight: 36, color: colors.bone }}>Pulse</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, marginTop: 4 }}>
                Where people connect through real product experiences.
              </Text>
            </View>
            <BellButton />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: colors.lac,
              borderRadius: 12,
              paddingLeft: 12,
              paddingRight: 4,
              height: 44,
              borderWidth: 1,
              borderColor: colors.line,
            }}
          >
            <MagnifyingGlass size={18} color={colors.bone3} weight="bold" />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Search posts, products, brands, or questions..."
              placeholderTextColor={colors.bone3}
              returnKeyType="search"
              style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.bone, outlineStyle: 'none' } as never}
            />
            {draft ? (
              <Pressable onPress={() => setDraft('')} hitSlop={8} style={{ padding: 8 }}>
                <X size={16} color={colors.bone3} weight="bold" />
              </Pressable>
            ) : (
              <Pressable
                onPress={() => scan.start()}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}
                accessibilityLabel="Scan product"
              >
                <Scan size={18} color={colors.white} weight="bold" />
              </Pressable>
            )}
          </View>

          {showCreateBanner ? (
            <View style={{ backgroundColor: '#F9E8EC', borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: '#F0D4DC' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Avatar name={profile?.displayName ?? 'You'} size={36} />
                <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: colors.bone2, paddingTop: 2 }}>
                  Own something? Share your experience, ask a question, or post a product test.
                </Text>
                <Pressable onPress={() => setShowCreateBanner(false)} hitSlop={8} accessibilityLabel="Dismiss">
                  <X size={16} color={colors.bone3} weight="bold" />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Pressable
                  onPress={() => compose({ kind: 'experience' })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.hi }}
                >
                  <NotePencil size={14} color={colors.white} weight="bold" />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.white }}>Experience</Text>
                </Pressable>
                <Pressable
                  onPress={() => compose({ kind: 'question' })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.lac,
                    borderWidth: 1,
                    borderColor: '#B8D4F0',
                  }}
                >
                  <Question size={14} color="#1A5FB4" weight="bold" />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: '#1A5FB4' }}>Question</Text>
                </Pressable>
                <Pressable
                  onPress={() => compose({ kind: 'compare' })}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: colors.lac,
                    borderWidth: 1,
                    borderColor: '#B8E0D4',
                  }}
                >
                  <Flask size={14} color="#1A6B52" weight="bold" />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: '#1A6B52' }}>Test</Text>
                </Pressable>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => compose()} accessibilityLabel="Add photo" hitSlop={8} style={{ padding: 6 }}>
                  <ImageSquare size={22} color={colors.bone3} weight="bold" />
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => compose()}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F9E8EC', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F0D4DC' }}
            >
              <Avatar name={profile?.displayName ?? 'You'} size={32} />
              <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.bone3 }}>Share your experience…</Text>
              <Plus size={20} color={colors.hi} weight="bold" />
            </Pressable>
          )}
        </View>

        <View style={{ paddingHorizontal: SCREEN_PAD_H, gap: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
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
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: on ? colors.hi : colors.lac,
                    borderWidth: on ? 0 : 1,
                    borderColor: colors.line,
                  }}
                >
                  <Text style={{ fontFamily: on ? fonts.semibold : fonts.medium, fontSize: 13, color: on ? colors.white : colors.bone2 }}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {INTEREST_TAGS.map((tag) => {
              const on = selectedNiches.has('all') ? tag.id === 'all' : selectedNiches.has(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  onPress={() => toggleNiche(tag.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: colors.lac,
                    borderWidth: 1,
                    borderColor: on ? colors.hi : colors.line,
                  }}
                >
                  <tag.Icon size={14} color={on ? colors.hi : colors.bone2} weight="bold" />
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.bone }}>{tag.label}</Text>
                  {on ? (
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: colors.hi, alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={10} color={colors.white} weight="bold" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11.5, color: colors.bone3 }}>Follow one or mix several interests.</Text>
            <Pressable onPress={clearNiches} hitSlop={8}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.hi }}>Clear all</Text>
            </Pressable>
          </View>
        </View>

        {home && conversations.length > 0 ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: SCREEN_PAD_H, gap: 8 }}>
              <Fire size={20} color={colors.coral} weight="fill" />
              <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 17, color: colors.bone }}>Conversations you may care about</Text>
              <Pressable onPress={() => router.push('/pulse' as Href)} hitSlop={8}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.hi }}>See all</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: convoGap, paddingHorizontal: SCREEN_PAD_H }}>
              {conversations.map(({ item, title, postCount }) => (
                <PulseConversationCard
                  key={item.id}
                  item={item}
                  title={title}
                  postCount={postCount}
                  width={convoCardW}
                  onPress={() => openRoom(item.id, item.name)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={{ paddingHorizontal: SCREEN_PAD_H, gap: 12 }}>
          {q ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.bone2 }}>
              {feed.isLoading ? 'Searching…' : `${threads.length} ${threads.length === 1 ? 'post' : 'posts'} about “${q}”`}
            </Text>
          ) : null}
          {feed.isLoading ? (
            [0, 1, 2].map((i) => <Shimmer key={i} height={220} radius={14} />)
          ) : threads.length ? (
            threads.map((t) => (
              <PulsePostCard
                key={t.id}
                thread={t}
                requireMember={requireMember}
                onOpen={() => openThread(t.id)}
                onProduct={(id, name) => openRoom(id, name)}
                onImage={setPhoto}
              />
            ))
          ) : (
            <View style={{ backgroundColor: colors.lac, borderRadius: 14, padding: 20, gap: 10, borderWidth: 1, borderColor: colors.line }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.bone }}>
                {tab === 'following' ? 'Nothing followed yet' : q ? 'No posts match that yet' : 'Start the conversation'}
              </Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.bone2 }}>
                One honest post about something you own helps the next person avoid a bad buy.
              </Text>
              <Pressable onPress={() => compose()} style={{ marginTop: 4, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.hi, justifyContent: 'center', alignSelf: 'flex-start' }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.white }}>Write a post</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => {
          hapticTap();
          compose();
        }}
        accessibilityLabel="New post"
        style={({ pressed }) => ({
          position: 'absolute',
          right: 16,
          bottom: 22,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: colors.hi,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Plus size={26} color={colors.white} weight="bold" />
      </Pressable>

      <Composer
        visible={Boolean(composing)}
        onClose={() => setComposing(null)}
        initialProduct={seedProduct}
        initialBody={composing?.body}
        initialKind={composing?.kind ?? (composing?.body ? 'experience' : undefined)}
        onPosted={(t) => {
          setComposing(null);
          void qc.invalidateQueries({ queryKey: ['feed'] });
          void qc.invalidateQueries({ queryKey: ['pulse'] });
          openThread(t.id);
        }}
      />
      <Lightbox images={photo ? [{ url: photo }] : []} index={photo ? 0 : null} onClose={() => setPhoto(null)} />
      {gate}
      {scan.sheet}
    </SafeAreaView>
  );
}
