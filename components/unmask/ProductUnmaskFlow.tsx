import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowRight } from '@/components/icons';
import { PrimaryButton } from '@/components/kit';

import { DynamicFactPane } from '@/components/product/DynamicFactPane';
import { SpecsPane } from '@/components/product/Panes';
import { factSectionForTab, firstFactTabKey, isFactTab } from '@/lib/unmask/presentation';
import { trackFactSectionViewed, trackUnmaskStarted } from '@/lib/unmask/productAnalytics';
import { VideosPane } from '@/components/product/VideosPane';
import { colors, fonts, radii } from '@/constants/theme';
import { hapticTap } from '@/lib/haptics';
import { deriveUnmaskBundle } from '@/lib/unmask/derive';
import { investigationComplete } from '@/lib/unmask/investigationStages';
import { hasUnmaskRevealed, markUnmaskRevealed } from '@/lib/unmask/revealSession';
import type { UnmaskTab } from '@/lib/unmask/types';
import type { Product, ProductProfile } from '@/lib/types';
import type { JourneyClip } from '@/lib/videos';

import { AskUnmaskTab } from './AskUnmaskTab';
import { HighlightsTab } from './HighlightsTab';
import { ProductDiscoveringView } from './ProductDiscoveringView';
import { ProductIdentifyView } from './ProductIdentifyView';
import { DimensionDetail, ScorecardTab } from './ScorecardTab';
import { UnmaskingView } from './UnmaskingView';

const MAROON = '#6B0F1A';
const DISCOVER_MIN_MS = 2800;

type FlowPhase = 'found' | 'investigating' | 'unmasked';

export type IdentifyFooterActions = {
  onUnmask: () => void;
  onViewSpecs: () => void;
};

type Props = {
  product: Product;
  profile: ProductProfile | null;
  intelLoading: boolean;
  intelError?: boolean;
  onRetryIntel?: () => void;
  clipsLoading: boolean;
  clips: JourneyClip[];
  scanPhoto?: string | null;
  photoUrls: string[];
  tab: UnmaskTab;
  onTabChange: (tab: UnmaskTab) => void;
  onCompare: () => void;
  onOpenSources: () => void;
  onAskCommunity: (question: string) => void;
  onOpenPrices?: () => void;
  onIdentifyFooter?: (visible: boolean, actions: IdentifyFooterActions | null) => void;
};

export function ProductUnmaskFlow({
  product,
  profile,
  intelLoading,
  intelError,
  onRetryIntel,
  clipsLoading,
  clips,
  scanPhoto,
  photoUrls,
  tab,
  onTabChange,
  onCompare,
  onOpenSources,
  onAskCommunity,
  onOpenPrices,
  onIdentifyFooter,
}: Props) {
  const [phase, setPhase] = useState<FlowPhase>(() => (hasUnmaskRevealed(product.id) ? 'unmasked' : 'found'));
  const [dimensionId, setDimensionId] = useState<string | null>(null);
  const [discoverMinDone, setDiscoverMinDone] = useState(() => hasUnmaskRevealed(product.id));
  const [discoverIntelDone, setDiscoverIntelDone] = useState(() => hasUnmaskRevealed(product.id));

  useEffect(() => {
    setPhase(hasUnmaskRevealed(product.id) ? 'unmasked' : 'found');
    setDimensionId(null);
    setDiscoverMinDone(hasUnmaskRevealed(product.id));
    setDiscoverIntelDone(hasUnmaskRevealed(product.id));
  }, [product.id]);

  useEffect(() => {
    if (hasUnmaskRevealed(product.id)) return;
    setDiscoverMinDone(false);
    setDiscoverIntelDone(false);
    const t = setTimeout(() => setDiscoverMinDone(true), DISCOVER_MIN_MS);
    return () => clearTimeout(t);
  }, [product.id]);

  useEffect(() => {
    if (hasUnmaskRevealed(product.id)) return;
    if (!intelLoading && (profile || product.heroImageUrl || product.name)) {
      setDiscoverIntelDone(true);
    }
  }, [intelLoading, profile, product.heroImageUrl, product.name, product.id]);

  const discovering = phase === 'found' && tab === 'overview' && !hasUnmaskRevealed(product.id) && (!discoverMinDone || !discoverIntelDone);

  const bundle = useMemo(() => (profile ? deriveUnmaskBundle(profile) : null), [profile]);
  const trackedFactTab = useRef<string | null>(null);
  useEffect(() => {
    if (!profile || !isFactTab(tab)) return;
    if (trackedFactTab.current === tab) return;
    trackedFactTab.current = tab;
    trackFactSectionViewed(profile, product.id, tab);
  }, [tab, profile, product.id]);

  const startUnmask = () => {
    hapticTap();
    trackUnmaskStarted(profile, product.id);
    if (investigationComplete(intelLoading, profile)) {
      markUnmaskRevealed(product.id);
      setPhase('unmasked');
    } else setPhase('investigating');
  };

  const showIdentifyFooter = phase === 'found' && tab === 'overview' && !discovering;

  useEffect(() => {
    if (!onIdentifyFooter) return;
    if (showIdentifyFooter) {
      onIdentifyFooter(true, { onUnmask: startUnmask, onViewSpecs: () => onTabChange(firstFactTabKey(profile)) });
    } else {
      onIdentifyFooter(false, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parent setState callback; gate on layout mode only
  }, [showIdentifyFooter, product.id, tab, phase]);

  useEffect(() => {
    if (phase !== 'investigating') return;
    if (investigationComplete(intelLoading, profile)) {
      markUnmaskRevealed(product.id);
      setPhase('unmasked');
    }
  }, [phase, intelLoading, profile, product.id]);

  if (phase === 'investigating') {
    if (intelError) {
      return (
        <View style={{ gap: 12, paddingVertical: 24 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.bone }}>Research didn&apos;t finish</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.bone2 }}>Check your connection and try again.</Text>
          {onRetryIntel ? (
            <Text onPress={onRetryIntel} style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.hi }}>Try again</Text>
          ) : null}
        </View>
      );
    }
    return (
      <UnmaskingView
        product={product}
        profile={profile}
        loading={intelLoading}
        clipsLoading={clipsLoading}
        clipsCount={clips.length}
        photoUri={scanPhoto}
      />
    );
  }

  const factTabUnlocked = tab === 'specs' || isFactTab(tab);
  if (phase === 'found' && tab !== 'overview' && !factTabUnlocked) {
    return (
      <View style={{ gap: 16, paddingVertical: 24, alignItems: 'center' }}>
        <Text style={{ fontFamily: fonts.regular, fontSize: 15, color: colors.bone2, textAlign: 'center', lineHeight: 22 }}>
          Unmask this product first to unlock {tab === 'ask' ? 'Ask' : tab.charAt(0).toUpperCase() + tab.slice(1)}.
        </Text>
        <PrimaryButton label="Unmask this product →" onPress={startUnmask} style={{ alignSelf: 'stretch' }} />
      </View>
    );
  }

  if (tab === 'specs' || isFactTab(tab)) {
    if (!profile) {
      return (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator color={colors.hi} />
        </View>
      );
    }
    const section = factSectionForTab(profile, tab);
    if (section?.fields.length) {
      return <DynamicFactPane section={section} fallbackTitle={section.title} />;
    }
    if (tab === 'specs' || tab === 'product_details' || tab === 'details') {
      return <SpecsPane profile={profile} onAlternative={() => {}} />;
    }
    return <DynamicFactPane section={section} />;
  }

  if (tab === 'videos') {
    return (
      <VideosPane
        product={{ id: product.id, name: profile?.identity.name || product.name, brand: product.brand, category: product.category }}
        clips={clips}
        loading={clipsLoading}
      />
    );
  }

  if (tab === 'ask') {
    if (!profile || !bundle) {
      return (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator color={colors.hi} />
        </View>
      );
    }
    return <AskUnmaskTab profile={profile} bundle={bundle} onAskCommunity={onAskCommunity} />;
  }

  if (tab === 'evidence') {
    if (!profile || !bundle) {
      return (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator color={colors.hi} />
        </View>
      );
    }
    if (dimensionId) {
      return <DimensionDetail profile={profile} bundle={bundle} dimensionId={dimensionId} onBack={() => setDimensionId(null)} />;
    }
    return (
      <ScorecardTab
        profile={profile}
        bundle={bundle}
        onDimension={(id) => setDimensionId(id)}
        onOpenSources={onOpenSources}
        mode="evidence"
      />
    );
  }

  if (phase === 'found' && tab === 'overview') {
    if (discovering) {
      return <ProductDiscoveringView product={product} profile={profile} />;
    }
    const urls = photoUrls.filter(Boolean);
    return (
      <ProductIdentifyView
        product={product}
        profile={profile}
        photos={urls}
        onViewSpecs={() => onTabChange('specs')}
      />
    );
  }

  if (!profile || !bundle) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator color={colors.hi} />
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <ScorecardTab
        profile={profile}
        bundle={bundle}
        onDimension={(id) => {
          onTabChange('evidence');
          setDimensionId(id);
        }}
        onOpenSources={onOpenSources}
        mode="overview"
      />
      <HighlightsTab bundle={bundle} onDimension={(id) => { onTabChange('evidence'); setDimensionId(id); }} />
    </View>
  );
}

/** Fixed bottom CTA for the identify screen (rendered outside the scroll view). */
export function ProductIdentifyFloatingFooter({
  visible,
  onUnmask,
  onViewSpecs,
}: {
  visible: boolean;
  onUnmask: () => void;
  onViewSpecs: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 10),
        backgroundColor: 'rgba(249,246,240,0.96)',
        borderTopWidth: 1,
        borderTopColor: '#e8e4dc',
        gap: 8,
      }}
    >
      <Pressable onPress={onUnmask} accessibilityRole="button">
        <LinearGradient
          colors={[MAROON, '#4a0a12']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 16,
            borderRadius: radii.button,
          }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 16, color: colors.white }}>Unmask this product</Text>
          <ArrowRight size={18} color={colors.white} weight="bold" />
        </LinearGradient>
      </Pressable>
      <Pressable
        onPress={() => {
          hapticTap();
          onViewSpecs();
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 12,
          borderRadius: radii.button,
          borderWidth: 1.5,
          borderColor: MAROON,
        }}
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: MAROON }}>View Specs</Text>
      </Pressable>
    </View>
  );
}
