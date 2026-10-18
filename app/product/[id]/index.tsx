import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMemberGate } from '@/components/community';
import { ProductScreenChrome } from '@/components/shell/ProductScreenChrome';
import { ProductSubTabs } from '@/components/shell/ProductSubTabs';
import {
  ProductIdentifyFloatingFooter,
  ProductUnmaskFlow,
  type IdentifyFooterActions,
} from '@/components/unmask/ProductUnmaskFlow';
import { PricesPane, SourcesSheet } from '@/components/product/Panes';
import { galleryFor, MatchesSheet, ScanBanner } from '@/components/product/Gallery';
import { Lightbox } from '@/components/Lightbox';
import { useOwnershipNote } from '@/components/OwnershipNote';
import { useVerifyOwner } from '@/components/VerifyOwner';
import { SealCheck } from '@/components/icons';
import { colors, fonts } from '@/constants/theme';
import { routeId } from '@/lib/catalog';
import { fetchRoom, trackProduct } from '@/lib/community';
import { useOwnsProduct } from '@/lib/owners';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import {
  displayName,
  getCachedPreviewResult,
  getKnownProduct,
  getUnmaskJobStatus,
  previewToProfile,
  profileToProduct,
  kickProductOpenPipeline,
  resolveProductPreview,
  startProductUnmask,
  rememberProduct,
  slugify,
  callIntel,
} from '@/lib/products';
import { useAppStore } from '@/lib/store';
import { InferredDomainNotice } from '@/components/unmask/InferredDomainNotice';
import { getPresentation, navigationTabs } from '@/lib/unmask/presentation';
import type { ProductProfile } from '@/lib/types';
import {
  flushProductOpenTimings,
  hasProductOpenTiming,
  markJobMilestoneTimings,
  markProductOpenTiming,
} from '@/lib/unmask/openTimings';
import { agentLog } from '@/lib/debug/agentLog';
import { investigationComplete } from '@/lib/unmask/investigationStages';
import { trackOverviewViewed } from '@/lib/unmask/productAnalytics';
import type { UnmaskTab } from '@/lib/unmask/types';
import { loadProductClips } from '@/lib/videos';
import { ProductJourneyActions } from '@/components/living/ProductJourneyActions';

const ACTIVE_UNMASK_JOB_STATES = new Set([
  'queued',
  'identified',
  'researching',
  'mapping',
  'scoring',
]);

export default function ProductScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string; q?: string; tab?: string }>();
  const id = routeId(params.id);
  const q = typeof params.q === 'string' ? params.q : undefined;
  const [tab, setTab] = useState<UnmaskTab>('overview');
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [pricesOpen, setPricesOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [matchesOpen, setMatchesOpen] = useState(false);
  const [identifyFooterVisible, setIdentifyFooterVisible] = useState(false);
  const [identifyFooter, setIdentifyFooter] = useState<IdentifyFooterActions | null>(null);
  const scan = useAppStore((s) => s.scans[id]);
  const favorites = useAppStore((s) => s.favorites);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const addRecent = useAppStore((s) => s.addRecentProduct);
  const known = getKnownProduct(id);
  const saved = favorites.some((f) => f.productId === id);
  const { requireMember, gate } = useMemberGate();
  const scroller = useRef<ScrollView>(null);
  const unmaskStarted = useRef(false);

  useEffect(() => {
    if (id) addRecent(id);
  }, [id, addRecent]);

  useEffect(() => {
    unmaskStarted.current = false;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (!hasProductOpenTiming(id, 'selection')) {
      markProductOpenTiming(id, 'selection');
      agentLog('product/index.tsx', 'selection_on_screen_mount', { productId: id }, 'H1');
      kickProductOpenPipeline({ id, query: q, name: known?.name, brand: known?.brand });
    }
  }, [id, q, known?.name, known?.brand]);

  const previewQuery = useQuery({
    queryKey: ['preview', id],
    initialData: () => getCachedPreviewResult(id),
    queryFn: async () => {
      if (!hasProductOpenTiming(id, 'preview_request_started')) {
        markProductOpenTiming(id, 'preview_request_started');
      }
      const out = await resolveProductPreview({ id, query: q, name: known?.name, brand: known?.brand });
      if (!hasProductOpenTiming(id, 'preview_ready')) {
        markProductOpenTiming(id, 'preview_ready');
      }
      return out;
    },
    enabled: Boolean(id),
    staleTime: 30 * 60_000,
    retry: false,
    refetchOnMount: false,
  });

  const jobQuery = useQuery({
    queryKey: ['unmaskJob', id],
    queryFn: () => getUnmaskJobStatus(id),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      return state === 'ready' || state === 'failed' ? false : 2500;
    },
  });

  useEffect(() => {
    if (jobQuery.data?.milestones) {
      markJobMilestoneTimings(id, jobQuery.data.milestones);
    }
  }, [id, jobQuery.data?.milestones]);

  useEffect(() => {
    if (jobQuery.data?.state === 'ready') {
      markProductOpenTiming(id, 'job_ready');
      flushProductOpenTimings(id);
    }
  }, [id, jobQuery.data?.state]);

  useEffect(() => {
    if (!id) return;
    if (previewQuery.isLoading || !previewQuery.data) return;
    if (jobQuery.isLoading) return;
    const state = jobQuery.data?.state;
    if (state === 'ready' || state === 'failed') return;
    if (state && ACTIVE_UNMASK_JOB_STATES.has(state)) return;
    if (unmaskStarted.current) return;
    unmaskStarted.current = true;
    void startProductUnmask({ id, query: q ?? (known ? displayName(known) : undefined) }).catch(() => {
      unmaskStarted.current = false;
    });
  }, [
    id,
    q,
    known?.name,
    known?.brand,
    previewQuery.isLoading,
    previewQuery.data,
    jobQuery.isLoading,
    jobQuery.data?.state,
  ]);

  const intel = useQuery({
    queryKey: ['intel', id],
    queryFn: async () => {
      const res = await callIntel<{ profile?: ProductProfile | null }>({ action: 'get', productId: id }, 20_000);
      if (!res.profile) throw new Error('profile_not_ready');
      const { hydrateProductFindings } = await import('@/lib/products');
      await hydrateProductFindings(res.profile);
      rememberProduct(profileToProduct(res.profile, getKnownProduct(id)));
      return res.profile;
    },
    enabled: Boolean(id) && jobQuery.data?.state === 'ready',
    staleTime: 30 * 60_000,
    retry: (count, err) => count < 10 && err instanceof Error && err.message === 'profile_not_ready',
    retryDelay: 2000,
  });

  const previewProfile = previewQuery.data ? previewToProfile(previewQuery.data.preview) : null;
  const profile = intel.data ?? previewProfile;
  const intelReady = Boolean(intel.data && investigationComplete(false, intel.data));
  const jobState = jobQuery.data?.state;
  const intelLoading =
    !intelReady &&
    (previewQuery.isLoading || (jobState != null && ACTIVE_UNMASK_JOB_STATES.has(jobState)));

  const retryIntel = useCallback(() => {
    unmaskStarted.current = false;
    void previewQuery.refetch();
    void jobQuery.refetch();
    void intel.refetch();
  }, [previewQuery, jobQuery, intel]);

  const product = getKnownProduct(id) ?? known;
  const name = profile?.identity.name || (product ? displayName(product) : q ?? '');

  const owned = useOwnsProduct(id);
  const note = useOwnershipNote();
  const myId = useAppStore((s) => s.profile?.id);
  const room = useQuery({ queryKey: ['room', id], queryFn: () => fetchRoom(id), enabled: Boolean(id), staleTime: 60_000 });

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

  const image = product?.heroImageUrl || profile?.images[0] || null;
  const brand = profile?.identity.brand || product?.brand || '';
  const category = profile?.identity.category || product?.category || '';
  const currentProduct = profile ? profileToProduct(profile, product) : { id, name, brand, category, heroImageUrl: image };
  const verify = useVerifyOwner({ onVerified: () => note.start(currentProduct) });
  const photos = useMemo(() => galleryFor(profile, scan, image), [profile, scan, image]);
  const presentation = useMemo(() => getPresentation(profile), [profile]);

  useEffect(() => {
    if (profile && tab === 'overview') trackOverviewViewed(profile, id);
  }, [profile, tab, id]);


  const onAskCommunity = (question: string) => {
    requireMember(() => {
      router.push({
        pathname: '/product/[id]/ask-community',
        params: { id, q: question },
      } as unknown as Href);
    });
  };

  const changeTab = (t: UnmaskTab) => {
    if (!intelReady && t !== 'overview') return;
    setTab(t);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };

  const previewOnlyTabs = useMemo(
    () => [{ key: 'overview' as UnmaskTab, label: 'Overview', renderer: 'overview' as const }],
    [],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.wine }}>
      <ProductScreenChrome
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        saved={saved}
        onSave={() => {
          toggleFavorite(id);
          if (!saved && profile) {
            hapticSuccess();
            trackProduct(profileToProduct(profile, product), 'save');
          }
        }}
        onShare={() => void Share.share({ message: `What owners really say about ${name} — on Unmask` })}
      >
        <ProductSubTabs
          value={tab}
          onChange={changeTab}
          navigation={intelReady ? navigationTabs(profile) : previewOnlyTabs}
        />
      </ProductScreenChrome>

      {presentation?.domainNotice?.shouldShow && presentation.product.domain?.status === 'inferred' && presentation.product.domain.id ? (
        <InferredDomainNotice
          domainId={presentation.product.domain.id}
          domainName={presentation.product.domain.name}
          productId={id}
          officialDomains={presentation.domainNotice.officialDomains}
          canVote={presentation.domainNotice.canVote}
          onContinue={() => undefined}
        />
      ) : null}

      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView
          ref={scroller}
          style={{ flex: 1, backgroundColor: identifyFooterVisible ? '#F9F6F0' : colors.wine }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: identifyFooterVisible ? 150 : 32 }}
        >
          <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
            {!identifyFooterVisible && scan ? (
              <ScanBanner scan={scan} onPhoto={() => setViewing(0)} onMatches={() => setMatchesOpen(true)} />
            ) : null}

            {!identifyFooterVisible ? (
              <OwnershipStrip
                owned={Boolean(owned)}
                count={room.data?.verifiedOwners ?? 0}
                onVerify={() => verify.start(currentProduct)}
                onNote={() => note.start(currentProduct)}
                onMine={() => myId && router.push({ pathname: '/member/[id]', params: { id: myId } } as unknown as Href)}
              />
            ) : null}

            {(intel.isError || previewQuery.isError) && !profile && !intelLoading ? (
              <View style={{ alignItems: 'center', gap: 12, paddingTop: 40 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>We couldn&apos;t finish reading about this</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, textAlign: 'center' }}>
                  Try again — nothing is lost.
                </Text>
                <Pressable onPress={retryIntel}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hi }}>Try again</Text>
                </Pressable>
              </View>
            ) : (
              <ProductUnmaskFlow
                product={currentProduct}
                profile={profile}
                preview={previewQuery.data?.preview ?? null}
                intelReady={intelReady}
                jobProgress={jobQuery.data}
                previewLoading={previewQuery.isLoading}
                intelLoading={intelLoading}
                intelError={intel.isError || previewQuery.isError}
                onUnmaskPressed={() => markProductOpenTiming(id, 'user_pressed_unmask')}
                onRetryIntel={retryIntel}
                clipsLoading={clips.isLoading}
                clips={clips.data ?? []}
                scanPhoto={scan?.photo}
                photoUrls={photos.map((p) => p.url)}
                tab={tab}
                onTabChange={changeTab}
                onCompare={() => {
                  if (profile) trackProduct(profileToProduct(profile, product), 'compare');
                  router.push({ pathname: '/compare', params: { a: id } } as Href);
                }}
                onOpenSources={() => setSourcesOpen(true)}
                onAskCommunity={onAskCommunity}
                onOpenPrices={() => setPricesOpen(true)}
                onIdentifyFooter={(visible, actions) => {
                  setIdentifyFooterVisible(visible);
                  setIdentifyFooter(actions);
                }}
              />
            )}
            {!identifyFooterVisible ? <ProductJourneyActions product={currentProduct} /> : null}
          </View>
        </ScrollView>
        {identifyFooter ? (
          <ProductIdentifyFloatingFooter
            visible={identifyFooterVisible}
            onUnmask={identifyFooter.onUnmask}
            onViewSpecs={identifyFooter.onViewSpecs}
          />
        ) : null}
      </View>

      <SourcesSheet profile={profile} visible={sourcesOpen} onClose={() => setSourcesOpen(false)} />
      <Modal visible={pricesOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPricesOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.wine }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 16 }}>
            <Pressable onPress={() => setPricesOpen(false)}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.hi }}>Close</Text>
            </Pressable>
          </View>
          {profile ? <PricesPane profile={profile} /> : <ActivityIndicator color={colors.hi} />}
        </SafeAreaView>
      </Modal>
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
    </View>
  );
}

function OwnershipStrip({
  owned,
  count,
  onVerify,
  onNote,
  onMine,
}: {
  owned: boolean;
  count: number;
  onVerify: () => void;
  onNote: () => void;
  onMine: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        hapticTap();
        (owned ? onMine : onVerify)();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: owned ? colors.sageSoft : colors.hiSoft,
      }}
    >
      <SealCheck size={20} color={owned ? colors.sage : colors.hi} weight={owned ? 'fill' : 'bold'} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: owned ? colors.sageInk : colors.hiInk }}>
          {owned ? 'Verified owner' : 'Own this? Verify with a photo'}
        </Text>
        {count > 0 ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.bone2 }}>{count} verified owners</Text>
        ) : null}
      </View>
      {owned ? (
        <Pressable onPress={(e) => { e.stopPropagation(); onNote(); }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.hi }}>Add note</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}
