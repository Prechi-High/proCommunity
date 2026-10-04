import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PillTabs, useMemberGate } from '@/components/community';
import { ArrowClockwise, ArrowLeft, ArrowsLeftRight, BookmarkSimple, CaretRight, ChatsCircle, Files, SealCheck, ShareNetwork } from '@/components/icons';
import { useVerifyOwner } from '@/components/VerifyOwner';
import { Eyebrow, PrimaryButton, ProductImage } from '@/components/kit';
import { FindingsPane } from '@/components/findings/FindingsPane';
import { InvestigatingState, openLink, PricesPane, SourcesSheet, SpecsPane } from '@/components/product/Panes';
import { VideosPane } from '@/components/product/VideosPane';
import { galleryFor, GalleryStrip, MatchesSheet, ScanBanner, VariantChips } from '@/components/product/Gallery';
import { Lightbox } from '@/components/Lightbox';
import { useOwnershipNote } from '@/components/OwnershipNote';
import { DiscussPane, OverviewPane, OwnersPane } from '@/components/product/PeoplePanes';
import { BRAND_SECTIONS } from '@/constants/brand';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { fetchRoom, fetchThreads, postThread, trackProduct } from '@/lib/community';
import { useOwnsProduct } from '@/lib/owners';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { displayName, formatPrice, getKnownProduct, investigateProduct, profileToProduct, rememberProduct, slugify } from '@/lib/products';
import { research } from '@/lib/research';
import { useAppStore } from '@/lib/store';
import type { ThreadKind } from '@/lib/types';
import { loadProductClips } from '@/lib/videos';

type Tab = 'findings' | 'overview' | 'owners' | 'discuss' | 'specs' | 'prices' | 'videos';

export default function ProductScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ id: string; q?: string; tab?: string }>();
  const id = routeId(params.id);
  const q = typeof params.q === 'string' ? params.q : undefined;
  const [tab, setTab] = useState<Tab>(params.tab === 'discuss' ? 'discuss' : params.tab === 'overview' ? 'overview' : 'findings');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [matchesOpen, setMatchesOpen] = useState(false);
  const scan = useAppStore((s) => s.scans[id]);
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

  const owned = useOwnsProduct(id);
  const note = useOwnershipNote();
  const myId = useAppStore((s) => s.profile?.id);
  const room = useQuery({ queryKey: ['room', id], queryFn: () => fetchRoom(id), enabled: Boolean(id), staleTime: 60_000 });

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
  const currentProduct = profile ? profileToProduct(profile, product) : { id, name, brand, category, heroImageUrl: image };
  const verify = useVerifyOwner({ onVerified: () => note.start(currentProduct) });
  const threadList = threads.data ?? [];
  const photos = useMemo(() => galleryFor(profile, scan, image), [profile, scan, image]);

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

  const makeCard = useMutation({
    mutationFn: () => research.create({ productId: id, name: name || id, brand, category, image }),
    onSuccess: ({ card }) => {
      hapticSuccess();
      void qc.invalidateQueries({ queryKey: ['research', 'list'] });
      router.push({ pathname: '/research/[id]', params: { id: card.id } } as unknown as Href);
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
    { id: 'findings' as const, label: 'Unmask' },
    { id: 'overview' as const, label: 'Overview' },
    { id: 'owners' as const, label: 'Owners', count: voiceCount || undefined },
    { id: 'discuss' as const, label: 'Ask & discuss', count: threadList.length || undefined },
    { id: 'specs' as const, label: 'Specs' },
    { id: 'prices' as const, label: BRAND_SECTIONS.whereToBuy },
    { id: 'videos' as const, label: 'Videos' },
  ];

  const pane = useMemo(() => {
    if (!profile) return null;
    switch (tab) {
      case 'findings':
        return <FindingsPane profile={profile} onOpenSources={() => setSourcesOpen(true)} />;
      case 'overview':
        return (
          <View style={{ gap: 24 }}>
            <OverviewPane
              profile={profile}
              threads={threadList}
              ownershipNotes={room.data?.notes ?? []}
              onGo={go}
              onOpenSources={() => setSourcesOpen(true)}
            />
            <GalleryStrip images={photos} hasScan={Boolean(scan?.photo)} onOpen={setViewing} />
            <VariantChips
              variants={profile.variants ?? []}
              current={[profile.identity.variant, profile.identity.size, name].join(' ')}
              onPick={(v) => openAlternative(v.query)}
            />
          </View>
        );
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
        return <VideosPane product={{ id, name: profile.identity.name || name, brand, category }} clips={clips.data ?? []} loading={clips.isLoading} />;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, profile, clips.data, clips.isLoading, threadList, threads.isLoading, draft, post.isPending, photos, scan, room.data?.notes]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, gap: 10 }}>
        <RoundButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          <ArrowLeft size={18} color={colors.bone} weight="bold" />
        </RoundButton>
        <View style={{ flex: 1 }} />
        <RoundButton
          label="Save as Research Card"
          onPress={() =>
            requireMember(() => {
              if (!makeCard.isPending) makeCard.mutate();
            })
          }
        >
          <Files size={18} color={colors.bone} weight={makeCard.isPending ? 'fill' : 'bold'} />
        </RoundButton>
        <RoundButton
          label="Share"
          onPress={() => {
            void Share.share({ message: `What owners really say about ${name} — on Unmask` });
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

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        stickyHeaderIndices={[0, 1]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center', backgroundColor: colors.wine }}>
          <Pressable
            onPress={() => photos.length && setViewing(scan?.photo && photos.length > 1 ? 1 : 0)}
            accessibilityLabel="View product photos"
            disabled={!photos.length}
          >
            <ProductImage uri={image || photos[0]?.url} category={category} size={88} radius={20} style={{ borderWidth: 0 }} />
            {photos.length > 1 ? (
              <View style={{ position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.66)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ fontFamily: fonts.semibold, fontSize: 11, color: colors.white }}>{photos.length}</Text>
              </View>
            ) : null}
          </Pressable>
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

        <View style={{ paddingTop: 4, paddingBottom: 12, backgroundColor: colors.wine }}>
          <PillTabs options={tabs} value={tab} onChange={go} />
        </View>

        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <OwnershipStrip
            owned={Boolean(owned)}
            count={room.data?.verifiedOwners ?? 0}
            noteCount={room.data?.ownershipNotes ?? 0}
            onVerify={() => verify.start(currentProduct)}
            onNote={() => note.start(currentProduct)}
            onMine={() => myId && router.push({ pathname: '/member/[id]', params: { id: myId } } as unknown as Href)}
          />

          {scan ? <ScanBanner scan={scan} onPhoto={() => setViewing(0)} onMatches={() => setMatchesOpen(true)} /> : null}

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
        </View>
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
          <RoundButton label="Quick question" onPress={() => go('discuss')} size={46}>
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
      <Lightbox images={photos} index={viewing} onClose={() => setViewing(null)} />
      <MatchesSheet
        scan={scan}
        visible={matchesOpen}
        onClose={() => setMatchesOpen(false)}
        onPick={(pick, img) => {
          setMatchesOpen(false);
          const altId = slugify(pick);
          rememberProduct({ id: altId, name: pick, brand: '', category: category || 'Product', heroImageUrl: img ?? null });
          if (scan) useAppStore.getState().rememberScan(altId, { ...scan, label: pick, at: new Date().toISOString() });
          router.replace({ pathname: '/product/[id]', params: { id: altId, q: pick, from: 'scan' } } as Href);
        }}
      />
      {gate}
      {verify.sheet}
      {note.sheet}
    </SafeAreaView>
  );
}

function OwnershipStrip({
  owned,
  count,
  noteCount,
  onVerify,
  onNote,
  onMine,
}: {
  owned: boolean;
  count: number;
  noteCount: number;
  onVerify: () => void;
  onNote: () => void;
  onMine: () => void;
}) {
  const others = owned ? count - 1 : count;
  const crowd = others > 0 ? `${others} verified ${others === 1 ? 'owner' : 'owners'}${owned ? ' besides you' : ''}` : '';
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        (owned ? onMine : onVerify)();
      }}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: owned ? colors.sageSoft : colors.hiSoft,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <SealCheck size={20} color={owned ? colors.sage : colors.hi} weight={owned ? 'fill' : 'bold'} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: owned ? colors.sageInk : colors.hiInk }}>
          {owned ? 'You’re a verified owner' : 'Own this? Verify it with a photo'}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: fonts.regular, fontSize: 12.5, color: owned ? colors.sageInk : colors.hiInk, opacity: 0.8 }}>
          {owned ? `${noteCount ? `${noteCount} Ownership Notes here · ` : ''}Add your experience to your shelf` : crowd ? `${crowd} answer here` : 'Your answers get a Verified owner mark'}
        </Text>
      </View>
      <CaretRight size={14} color={owned ? colors.sage : colors.hi} weight="bold" />
      {owned ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            hapticTap();
            onNote();
          }}
          style={{ height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12.5, color: colors.sageInk }}>Add note</Text>
        </Pressable>
      ) : null}
    </Pressable>
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
