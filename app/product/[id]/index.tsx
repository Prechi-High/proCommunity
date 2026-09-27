import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillTabs, useMemberGate } from '@/components/community';
import { ArrowClockwise, ArrowLeft, ArrowsLeftRight, BookmarkSimple, ChatsCircle, ShareNetwork } from '@/components/icons';
import { Eyebrow, PrimaryButton, ProductImage } from '@/components/kit';
import { InvestigatingState, openLink, PricesPane, SourcesSheet, SpecsPane, VideosPane } from '@/components/product/Panes';
import { DiscussPane, OverviewPane, OwnersPane } from '@/components/product/PeoplePanes';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { fetchThreads, postThread, trackProduct } from '@/lib/community';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { displayName, formatPrice, getKnownProduct, investigateProduct, profileToProduct, rememberProduct, slugify } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import type { ThreadKind } from '@/lib/types';
import { loadProductClips } from '@/lib/videos';

type Tab = 'overview' | 'owners' | 'discuss' | 'specs' | 'prices' | 'videos';

export default function ProductScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id: string; q?: string; tab?: string }>();
  const id = routeId(params.id);
  const q = typeof params.q === 'string' ? params.q : undefined;
  const [tab, setTab] = useState<Tab>(params.tab === 'discuss' ? 'discuss' : 'overview');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [draft, setDraft] = useState<{ kind: Exclude<ThreadKind, 'compare'>; title: string }>({ kind: 'question', title: '' });
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const addRecent = useAppStore((s) => s.addRecentProduct);
  useAppStore((s) => s.knownProducts[id]);
  const known = getKnownProduct(id);
  const saved = favorites.some((f) => f.productId === id);
  const { requireMember, gate } = useMemberGate();
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    if (id) addRecent(id);
  }, [id, addRecent]);

  const intel = useQuery({
    queryKey: ['intel', id],
    queryFn: () => investigateProduct({ id, query: q }),
    enabled: Boolean(id),
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const profile = intel.data ?? null;
  const product = getKnownProduct(id) ?? known;
  const name = profile?.identity.name || (product ? displayName(product) : q ?? '');

  const threads = useQuery({
    queryKey: ['threads', id],
    queryFn: () => fetchThreads(id),
    enabled: Boolean(id),
    staleTime: 30_000,
  });

  const clips = useQuery({
    queryKey: ['clips', id],
    queryFn: () =>
      loadProductClips({
        id,
        name: profile?.identity.name || product?.name || q || '',
        brand: profile?.identity.brand || product?.brand || '',
      }),
    enabled: Boolean(id) && (Boolean(profile) || Boolean(product?.name)),
    staleTime: 60 * 60_000,
  });

  const tracked = useRef(false);
  useEffect(() => {
    if (!profile || tracked.current) return;
    tracked.current = true;
    trackProduct(profileToProduct(profile, product), 'view');
  }, [profile, product]);

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [tab, profile, fade]);

  const image = product?.heroImageUrl || profile?.images[0] || null;
  const lowest = profile?.offers.find((o) => o.price) ?? null;
  const brand = profile?.identity.brand || product?.brand || '';
  const category = profile?.identity.category || product?.category || '';
  const threadList = threads.data ?? [];

  const post = useMutation({
    mutationFn: () =>
      postThread({
        product: profile ? profileToProduct(profile, product) : { id, name, brand, category, heroImageUrl: image },
        kind: draft.kind,
        title: draft.title.trim(),
      }),
    onSuccess: (thread) => {
      hapticSuccess();
      setDraft({ kind: 'question', title: '' });
      void qc.invalidateQueries({ queryKey: ['threads', id] });
      void qc.invalidateQueries({ queryKey: ['pulse'] });
      router.push({ pathname: '/thread/[id]', params: { id: thread.id } } as Href);
    },
  });

  const openAlternative = (altName: string) => {
    const altId = slugify(altName);
    rememberProduct({ id: altId, name: altName, brand: '', category: category || 'Product' });
    router.push({ pathname: '/product/[id]', params: { id: altId, q: altName } } as Href);
  };

  const go = (t: Tab) => {
    setTab(t);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };

  const voiceCount = profile?.voices?.length ?? 0;
  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'owners' as const, label: 'Owners', count: voiceCount || undefined },
    { id: 'discuss' as const, label: 'Ask & discuss', count: threadList.length || undefined },
    { id: 'specs' as const, label: 'Specs' },
    { id: 'prices' as const, label: 'Prices' },
    { id: 'videos' as const, label: 'Videos' },
  ];

  const pane = useMemo(() => {
    if (!profile) return null;
    switch (tab) {
      case 'overview':
        return <OverviewPane profile={profile} threads={threadList} onGo={go} onOpenSources={() => setSourcesOpen(true)} />;
      case 'owners':
        return <OwnersPane profile={profile} />;
      case 'discuss':
        return (
          <DiscussPane
            profile={profile}
            productId={id}
            threads={threadList}
            loading={threads.isLoading}
            draft={draft}
            onDraft={setDraft}
            posting={post.isPending}
            onPost={() => requireMember(() => post.mutate())}
            onOpenThread={(tid) => router.push({ pathname: '/thread/[id]', params: { id: tid } } as Href)}
          />
        );
      case 'specs':
        return <SpecsPane profile={profile} onAlternative={openAlternative} />;
      case 'prices':
        return <PricesPane profile={profile} />;
      case 'videos':
        return <VideosPane clips={clips.data ?? []} loading={clips.isLoading} />;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile, clips.data, clips.isLoading, threadList, threads.isLoading, draft, post.isPending]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
        <RoundButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <ArrowLeft size={18} color={colors.bone} weight="bold" />
        </RoundButton>
        <View style={{ flex: 1 }} />
        <RoundButton
          label="Share"
          onPress={() => {
            void Share.share({ message: `What owners really say about ${name} — on Sourced` });
          }}
        >
          <ShareNetwork size={18} color={colors.bone} weight="bold" />
        </RoundButton>
        <RoundButton
          label={saved ? 'Remove from saved' : 'Save'}
          onPress={() => {
            toggleFavorite(id);
            if (!saved) {
              hapticSuccess();
              if (profile) trackProduct(profileToProduct(profile, product), 'save');
            }
          }}
          active={saved}
        >
          <BookmarkSimple size={18} color={saved ? colors.white : colors.bone} weight={saved ? 'fill' : 'bold'} />
        </RoundButton>
      </View>

      <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, alignItems: 'center' }}>
        <ProductImage uri={image} category={category} size={88} radius={20} style={{ borderWidth: 0 }} />
        <View style={{ flex: 1, gap: 4 }}>
          {brand ? <Eyebrow color={colors.hi}>{brand}</Eyebrow> : null}
          <Text numberOfLines={3} style={{ fontFamily: fonts.bold, fontSize: 21, lineHeight: 25, letterSpacing: -0.5, color: colors.bone }}>
            {name || 'Product'}
          </Text>
          {category ? (
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.bone3 }}>
              {category}
              {profile?.identity.variant ? ` · ${profile.identity.variant}` : ''}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ paddingTop: 14, paddingBottom: 12 }}>
        <PillTabs options={tabs} value={tab} onChange={go} />
      </View>

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {intel.isLoading ? (
          <InvestigatingState />
        ) : intel.isError || !profile ? (
          <View style={{ alignItems: 'center', gap: 12, paddingTop: 40 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>We couldn’t finish reading about this</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, textAlign: 'center', lineHeight: 20 }}>
              The connection dropped or sources were slow. Try again — nothing is lost.
            </Text>
            <PrimaryButton label="Try again" icon={ArrowClockwise} onPress={() => void intel.refetch()} />
          </View>
        ) : (
          <Animated.View style={{ opacity: fade }}>{pane}</Animated.View>
        )}
      </ScrollView>

      {profile ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 6,
            borderTopWidth: 1,
            borderTopColor: colors.line,
            backgroundColor: colors.lac,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone3 }}>
              {lowest ? `Lowest at ${lowest.seller}` : 'Price'}
            </Text>
            <Text style={{ fontFamily: fonts.bold, fontSize: 18, letterSpacing: -0.4, color: colors.bone }}>
              {lowest ? formatPrice(lowest.price) : '—'}
            </Text>
          </View>
          <RoundButton label="Ask the owners" onPress={() => go('discuss')} size={46}>
            <ChatsCircle size={20} color={colors.bone} weight="bold" />
          </RoundButton>
          <RoundButton
            label="Compare"
            onPress={() => {
              trackProduct(profileToProduct(profile, product), 'compare');
              router.push({ pathname: '/compare', params: { a: id } } as Href);
            }}
            size={46}
          >
            <ArrowsLeftRight size={20} color={colors.bone} weight="bold" />
          </RoundButton>
          <PrimaryButton
            label={lowest ? 'View deal' : 'Prices'}
            onPress={() => (lowest?.link ? void openLink(lowest.link) : go('prices'))}
            style={{ minWidth: 112 }}
          />
        </View>
      ) : null}

      <SourcesSheet profile={profile} visible={sourcesOpen} onClose={() => setSourcesOpen(false)} />
      {gate}
    </SafeAreaView>
  );
}

function RoundButton({
  children,
  onPress,
  label,
  active,
  size = 38,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  active?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        onPress();
      }}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: active ? colors.hi : size > 40 ? colors.lac2 : colors.lac,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
