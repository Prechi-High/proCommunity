import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { displayName, getKnownProduct, investigateProduct, profileToProduct, rememberProduct, slugify } from '@/lib/products';
import { useAppStore } from '@/lib/store';
import { InferredDomainNotice } from '@/components/unmask/InferredDomainNotice';
import { getPresentation, navigationTabs } from '@/lib/unmask/presentation';
import { trackOverviewViewed } from '@/lib/unmask/productAnalytics';
import type { UnmaskTab } from '@/lib/unmask/types';
import { loadProductClips } from '@/lib/videos';

export default function ProductScreen() {
  const router = useRouter();
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
    setTab(t);
    scroller.current?.scrollTo({ y: 0, animated: false });
  };

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
        <ProductSubTabs value={tab} onChange={changeTab} navigation={navigationTabs(profile)} />
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

            {intel.isError && !profile && !intel.isLoading ? (
              <View style={{ alignItems: 'center', gap: 12, paddingTop: 40 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 19, color: colors.bone }}>We couldn&apos;t finish reading about this</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2, textAlign: 'center' }}>
                  Try again — nothing is lost.
                </Text>
                <Pressable onPress={() => void intel.refetch()}>
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hi }}>Try again</Text>
                </Pressable>
              </View>
            ) : (
              <ProductUnmaskFlow
                product={currentProduct}
                profile={profile}
                intelLoading={intel.isLoading}
                intelError={intel.isError}
                onRetryIntel={() => void intel.refetch()}
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
